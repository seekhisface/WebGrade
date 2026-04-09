'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionEvent {
  id: string;
  eventType: string;
  pageUrl: string;
  timestamp: string;
  scrollDepthPct: number | null;
  elementTag: string | null;
  elementText: string | null;
  elementClass: string | null;
  isCtaClick: boolean;
  hesitationMs: number | null;
  rageClickCount: number | null;
  timeOnPageMs: number | null;
  metadata: Record<string, unknown> | null;
}

interface VisitorSession {
  id: string;
  sessionId: string;
  ipHash: string;
  country: string | null;
  region: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  intentScore: number | null;
  intentClass: string | null;
  isBotFiltered: boolean;
  botReason: string | null;
  pageCount: number;
  entryPage: string | null;
  exitPage: string | null;
  conversionGoalHit: boolean;
  events: SessionEvent[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatRelativeMs(eventIso: string, sessionStartIso: string): string {
  const diff = new Date(eventIso).getTime() - new Date(sessionStartIso).getTime();
  if (diff < 0) return '0s';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `+${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `+${minutes}m ${remaining}s`;
}

function truncateUrl(url: string, max = 60): string {
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    return path.length > max ? path.slice(0, max) + '...' : path;
  } catch {
    return url.length > max ? url.slice(0, max) + '...' : url;
  }
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  PAGE_VIEW: 'bg-blue-100 text-blue-700',
  PAGE_EXIT: 'bg-slate-100 text-slate-700',
  SCROLL: 'bg-purple-100 text-purple-700',
  CLICK: 'bg-emerald-100 text-emerald-700',
  HESITATION: 'bg-amber-100 text-amber-700',
  RAGE_CLICK: 'bg-red-100 text-red-700',
  FORM_FOCUS: 'bg-cyan-100 text-cyan-700',
  FORM_SUBMIT: 'bg-teal-100 text-teal-700',
  CONVERSION: 'bg-green-100 text-green-800 font-semibold',
  ROUTE_CHANGE: 'bg-indigo-100 text-indigo-700',
  SECTION_VIEW: 'bg-violet-100 text-violet-700',
  EXIT_INTENT: 'bg-orange-100 text-orange-700',
  TAB_BLUR: 'bg-slate-100 text-slate-500',
  TAB_FOCUS: 'bg-sky-100 text-sky-700',
  PAGE_LOAD_COMPLETE: 'bg-sky-100 text-sky-700',
  CTA_CLICK: 'bg-green-100 text-green-700 font-semibold',
  NAV_CLICK: 'bg-indigo-100 text-indigo-700',
  COPY_TEXT: 'bg-fuchsia-100 text-fuchsia-700',
  FILE_DOWNLOAD: 'bg-lime-100 text-lime-700 font-semibold',
  CUSTOM: 'bg-gray-100 text-gray-700',
};

const INTENT_COLORS: Record<string, string> = {
  HIGH: 'bg-emerald-100 text-emerald-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  LOW: 'bg-slate-100 text-slate-600',
  RESEARCHER: 'bg-purple-100 text-purple-700',
  COMPETITOR: 'bg-orange-100 text-orange-700',
  BOT: 'bg-red-100 text-red-700',
};

const DEVICE_ICONS: Record<string, string> = {
  desktop: '🖥',
  mobile: '📱',
  tablet: '📱',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SessionExplorerPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [sessions, setSessions] = useState<VisitorSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(25);
  const [showBots, setShowBots] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadingSummary, setDownloadingSummary] = useState(false);

  function fetchSessions() {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/sessions?siteId=${siteId}&page=${page}&pageSize=${pageSize}&showBots=${showBots}`)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(data => {
        setSessions(data.sessions);
        setTotalPages(data.totalPages);
        setTotal(data.total);
        setLastRefreshed(new Date());
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  // Fetch on mount and when filters/page/refreshKey change
  useEffect(() => {
    fetchSessions();
  }, [siteId, page, pageSize, showBots, refreshKey]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => setRefreshKey(k => k + 1), 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Session Explorer</h1>
            <p className="text-sm text-slate-500 mt-1">
              {total} session{total !== 1 ? 's' : ''} recorded
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500" />
              <span className="text-xs text-slate-400">to</span>
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500" />
            </div>

            {/* Download CSV */}
            <button
              onClick={async () => {
                setDownloading(true);
                const params = new URLSearchParams({ siteId });
                if (dateStart) params.set('start', dateStart);
                if (dateEnd) params.set('end', dateEnd);
                const res = await fetch(`/api/admin/sessions/export?${params}`);
                if (res.ok) {
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'sessions.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }
                setDownloading(false);
              }}
              disabled={downloading}
              className="px-3 py-1.5 text-sm bg-[#0c4a6e] text-white rounded-lg hover:bg-[#075985] disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              {downloading ? 'Exporting...' : 'Raw Data'}
            </button>

            {/* Download Summary */}
            <button
              onClick={async () => {
                setDownloadingSummary(true);
                const params = new URLSearchParams({ siteId });
                if (dateStart) params.set('start', dateStart);
                if (dateEnd) params.set('end', dateEnd);
                const res = await fetch(`/api/admin/sessions/summary?${params}`);
                if (res.ok) {
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'summary.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }
                setDownloadingSummary(false);
              }}
              disabled={downloadingSummary}
              className="px-3 py-1.5 text-sm bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              {downloadingSummary ? 'Building...' : 'Summary'}
            </button>

            <span className="text-xs text-slate-400">Updated {lastRefreshed.toLocaleTimeString()}</span>

            <button onClick={() => setRefreshKey(k => k + 1)} disabled={loading}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1.5">
              <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500" /> Auto
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={showBots} onChange={e => { setShowBots(e.target.checked); setPage(1); }}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500" /> Bots
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error === '403' ? 'You need OWNER or ADMIN access to view sessions.' : `Failed to load sessions (${error})`}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Sessions */}
        {!loading && !error && sessions.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-500">No sessions recorded yet.</p>
            <a href={`/dashboard/${siteId}/snippet`} className="text-sky-600 hover:text-sky-700 text-sm mt-2 inline-block">
              Check snippet installation
            </a>
          </div>
        )}

        {!loading && !error && sessions.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-8" />
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Device</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Entry Page</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500">Pages</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500">Events</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Duration</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500">Intent</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500">Conv</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    expanded={expandedId === s.id}
                    onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session row with expandable events
// ---------------------------------------------------------------------------

function SessionRow({ session: s, expanded, onToggle }: {
  session: VisitorSession;
  expanded: boolean;
  onToggle: () => void;
}) {
  const duration = s.endedAt
    ? new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()
    : s.durationMs;

  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-b border-slate-50 cursor-pointer transition-colors ${
          expanded ? 'bg-sky-50' : 'hover:bg-slate-50'
        } ${s.isBotFiltered ? 'opacity-50' : ''}`}
      >
        <td className="px-4 py-3">
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </td>
        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatTime(s.startedAt)}</td>
        <td className="px-4 py-3 text-slate-600">
          {s.country ?? '-'}{s.region ? `, ${s.region}` : ''}
        </td>
        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
          {DEVICE_ICONS[s.deviceType ?? ''] ?? ''} {s.browser ?? '-'} / {s.os ?? '-'}
        </td>
        <td className="px-4 py-3 text-slate-600 font-mono text-xs" title={s.entryPage ?? ''}>
          {s.entryPage ? truncateUrl(s.entryPage, 40) : '-'}
        </td>
        <td className="px-4 py-3 text-center text-slate-700">{s.pageCount}</td>
        <td className="px-4 py-3 text-center text-slate-700">{s.events.length}</td>
        <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">{formatDuration(duration)}</td>
        <td className="px-4 py-3 text-center">
          {s.intentClass ? (
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${INTENT_COLORS[s.intentClass] ?? 'bg-slate-100 text-slate-600'}`}>
              {s.intentClass}
            </span>
          ) : (
            <span className="text-slate-300">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          {s.conversionGoalHit ? (
            <span className="text-emerald-600 font-semibold">Yes</span>
          ) : (
            <span className="text-slate-300">-</span>
          )}
        </td>
      </tr>

      {/* Expanded events */}
      {expanded && (
        <tr>
          <td colSpan={10} className="p-0">
            <div className="bg-slate-50 border-y border-slate-200 px-8 py-4">
              {/* Session details header */}
              <div className="flex gap-6 text-xs text-slate-500 mb-4 flex-wrap">
                <span><strong className="text-slate-600">Session ID:</strong> {s.sessionId}</span>
                <span><strong className="text-slate-600">IP Hash:</strong> {s.ipHash.slice(0, 12)}...</span>
                {s.referrer && <span><strong className="text-slate-600">Referrer:</strong> {s.referrer}</span>}
                {s.utmSource && <span><strong className="text-slate-600">UTM:</strong> {s.utmSource}/{s.utmMedium}/{s.utmCampaign}</span>}
                {s.isBotFiltered && <span className="text-red-600"><strong>Bot:</strong> {s.botReason}</span>}
                {s.exitPage && <span><strong className="text-slate-600">Exit:</strong> {truncateUrl(s.exitPage, 50)}</span>}
              </div>

              {/* Events table */}
              {s.events.length === 0 ? (
                <p className="text-sm text-slate-400">No events recorded</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-4 font-medium text-slate-500 w-20">Time</th>
                      <th className="text-left py-2 pr-4 font-medium text-slate-500 w-28">Event</th>
                      <th className="text-left py-2 pr-4 font-medium text-slate-500">Page</th>
                      <th className="text-left py-2 pr-4 font-medium text-slate-500">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.events.map(event => (
                      <EventRow key={event.id} event={event} sessionStart={s.startedAt} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Event row
// ---------------------------------------------------------------------------

function EventRow({ event: e, sessionStart }: { event: SessionEvent; sessionStart: string }) {
  const details: string[] = [];

  if (e.eventType === 'SECTION_VIEW' && e.metadata && (e.metadata as Record<string, unknown>).section) {
    details.push(`#${(e.metadata as Record<string, unknown>).section}`);
  }
  if (e.scrollDepthPct != null) details.push(`Scroll: ${e.scrollDepthPct}%`);
  if (e.elementTag) details.push(`<${e.elementTag}>`);
  if (e.elementText) details.push(`"${e.elementText.slice(0, 50)}"`);
  if (e.isCtaClick) details.push('CTA');
  if (e.rageClickCount && e.rageClickCount > 0) details.push(`Rage x${e.rageClickCount}`);
  if (e.hesitationMs) details.push(`Hesitated ${e.hesitationMs}ms`);
  if (e.timeOnPageMs) details.push(`Time: ${formatDuration(e.timeOnPageMs)}`);

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-1.5 pr-4 text-slate-400 whitespace-nowrap font-mono">
        {formatRelativeMs(e.timestamp, sessionStart)}
      </td>
      <td className="py-1.5 pr-4">
        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${EVENT_TYPE_COLORS[e.eventType] ?? EVENT_TYPE_COLORS.CUSTOM}`}>
          {e.eventType}
        </span>
      </td>
      <td className="py-1.5 pr-4 text-slate-600 font-mono" title={e.pageUrl}>
        {truncateUrl(e.pageUrl, 50)}
      </td>
      <td className="py-1.5 text-slate-500">
        {details.join(' · ') || '-'}
        {e.metadata && Object.keys(e.metadata).length > 0 && (
          <details className="inline ml-2">
            <summary className="cursor-pointer text-sky-500 hover:text-sky-600">meta</summary>
            <pre className="mt-1 p-2 bg-white rounded border border-slate-200 text-[10px] max-h-32 overflow-auto">
              {JSON.stringify(e.metadata, null, 2)}
            </pre>
          </details>
        )}
      </td>
    </tr>
  );
}
