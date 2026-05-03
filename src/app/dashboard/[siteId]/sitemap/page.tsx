'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

// =============================================================================
// Types
// =============================================================================

type CtaType = 'DEMO' | 'SIGNUP' | 'TRIAL' | 'CONTACT' | 'BUY' | 'SUBSCRIBE' | 'DOWNLOAD' | 'OTHER';
type CtaStatus = 'TRACKED' | 'SUGGESTED' | 'IGNORED';

interface CtaRow {
  id: string;
  competitorUrl: string;
  ctaText: string;
  ctaHref: string;
  ctaType: CtaType;
  pages: string[];
  pageCount: number;
  status: CtaStatus;
  firstDetectedAt: string;
  lastDetectedAt: string;
  clickCount30d: number;
  sessionsExposed: number;
  ctr: number;
  priority: number;
  recommendation: 'track' | 'ignore' | 'review';
}

interface CtaSummary {
  ctas: CtaRow[];
  competitorCtas: CtaRow[];
  competitorGroups: Record<string, CtaRow[]>;
  competitorCount: number;
  summary: Record<string, { count: number; tracked: number; suggested: number; ignored: number }>;
  totalPages: number;
  totalCtas: number;
  recommendedTrackCount: number;
  recommendedIgnoreCount: number;
}

interface CrawlStatus {
  lastDeepCrawlAt: string | null;
  nextEligibleAt: string | null;
  eligible: boolean;
  cooldownDays: number;
  competitorUrls: string[];
}

// =============================================================================
// Constants
// =============================================================================

const TYPE_LABELS: Record<CtaType, string> = {
  DEMO: 'Demo', SIGNUP: 'Signup', TRIAL: 'Trial', CONTACT: 'Contact',
  BUY: 'Buy', SUBSCRIBE: 'Subscribe', DOWNLOAD: 'Download', OTHER: 'Other',
};

const TYPE_ORDER: CtaType[] = ['DEMO', 'SIGNUP', 'TRIAL', 'CONTACT', 'BUY', 'SUBSCRIBE', 'DOWNLOAD', 'OTHER'];

const STATUS_STYLES: Record<CtaStatus, { bg: string; text: string }> = {
  TRACKED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  SUGGESTED: { bg: 'bg-amber-100', text: 'text-amber-700' },
  IGNORED: { bg: 'bg-slate-100', text: 'text-slate-500' },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function relativeFromNow(iso: string | null): string {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 0) return `in ${-days}d`;
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// =============================================================================
// Page
// =============================================================================

export default function SiteMapPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [status, setStatus] = useState<CrawlStatus | null>(null);
  const [ctaData, setCtaData] = useState<CtaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'conversion' | 'all'>('conversion');
  const [showCrawlModal, setShowCrawlModal] = useState(false);
  const [expandedType, setExpandedType] = useState<CtaType | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/sitemap/status?siteId=${siteId}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/sitemap/ctas?siteId=${siteId}&filter=${filter}`).then(r => r.ok ? r.json() : null),
    ]).then(([s, c]) => {
      if (s) setStatus(s);
      if (c) setCtaData(c);
    }).finally(() => setLoading(false));
  }, [siteId, filter]);

  function refresh() {
    setLoading(true);
    Promise.all([
      fetch(`/api/sitemap/status?siteId=${siteId}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/sitemap/ctas?siteId=${siteId}&filter=${filter}`).then(r => r.ok ? r.json() : null),
    ]).then(([s, c]) => {
      if (s) setStatus(s);
      if (c) setCtaData(c);
    }).finally(() => setLoading(false));
  }

  async function updateStatus(ctaId: string, newStatus: CtaStatus) {
    await fetch(`/api/sitemap/ctas/${ctaId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    refresh();
  }

  async function bulkUpdate(ids: string[], newStatus: CtaStatus) {
    if (ids.length === 0) return;
    await fetch('/api/sitemap/ctas/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, ids, status: newStatus }),
    });
    refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Site Map</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Inventory of CTAs detected on your site. Mark the ones worth tracking as conversion goals.
              Deep crawls run every 90 days and auto-fire before each scheduled monthly report.
            </p>
          </div>
          <button
            onClick={() => setShowCrawlModal(true)}
            className="px-5 py-2.5 bg-[#0c4a6e] hover:bg-[#075985] text-white font-semibold rounded-xl transition-colors flex items-center gap-2 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Crawl
          </button>
        </div>

        {/* Crawl status strip */}
        {status && (
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <span><strong className="text-slate-700">Last crawl:</strong> {fmtDate(status.lastDeepCrawlAt)} <span className="text-slate-400">({relativeFromNow(status.lastDeepCrawlAt)})</span></span>
              <span><strong className="text-slate-700">Next eligible:</strong> {status.eligible ? <span className="text-emerald-600 font-semibold">now</span> : <>{fmtDate(status.nextEligibleAt)} <span className="text-slate-400">({relativeFromNow(status.nextEligibleAt)})</span></>}</span>
            </div>
            {ctaData && (
              <div className="text-slate-500 text-xs">
                {ctaData.totalCtas} CTAs across {ctaData.totalPages} pages
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && ctaData && ctaData.totalCtas === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <p className="text-slate-700 font-semibold mb-2">No CTAs detected yet</p>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {status?.lastDeepCrawlAt
                ? "The last crawl didn't find any CTAs matching the conversion-relevant types. Try toggling the filter to 'all' or run a fresh crawl."
                : "Click the Crawl button above to scan your site for CTAs (demos, signups, contact forms, etc.)."}
            </p>
          </div>
        )}

        {/* CTA inventory */}
        {!loading && ctaData && ctaData.totalCtas > 0 && (
          <>
            {/* Bulk action bar — surfaces what we'd recommend so the user can
                approve in one click instead of reviewing every row */}
            {(ctaData.recommendedTrackCount > 0 || ctaData.recommendedIgnoreCount > 0) && (
              <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
                <p className="text-sm text-sky-900">
                  We&apos;ve scored each CTA. {ctaData.recommendedTrackCount} look worth tracking
                  {ctaData.recommendedIgnoreCount > 0 && `, ${ctaData.recommendedIgnoreCount} likely safe to ignore`}.
                </p>
                <div className="ml-auto flex gap-2">
                  {ctaData.recommendedTrackCount > 0 && (
                    <button
                      onClick={() => bulkUpdate(
                        ctaData.ctas.filter(c => c.recommendation === 'track' && c.status === 'SUGGESTED').map(c => c.id),
                        'TRACKED'
                      )}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                    >
                      Track {ctaData.recommendedTrackCount} recommended
                    </button>
                  )}
                  {ctaData.recommendedIgnoreCount > 0 && (
                    <button
                      onClick={() => bulkUpdate(
                        ctaData.ctas.filter(c => c.recommendation === 'ignore' && c.status === 'SUGGESTED').map(c => c.id),
                        'IGNORED'
                      )}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg"
                    >
                      Ignore {ctaData.recommendedIgnoreCount} low-priority
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Type summary chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {TYPE_ORDER.filter(t => ctaData.summary[t]).map(type => {
                const s = ctaData.summary[type];
                return (
                  <button
                    key={type}
                    onClick={() => setExpandedType(expandedType === type ? null : type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      expandedType === type ? 'bg-[#0c4a6e] text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {s.count} {TYPE_LABELS[type]}
                    {s.tracked > 0 && <span className="ml-1.5 opacity-70">· {s.tracked} tracked</span>}
                  </button>
                );
              })}
              {/* Filter toggle */}
              <div className="ml-auto flex items-center gap-2 text-xs">
                <span className="text-slate-500">Show:</span>
                <button
                  onClick={() => setFilter('conversion')}
                  className={`px-2 py-1 rounded ${filter === 'conversion' ? 'bg-[#0c4a6e] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  Conversion-relevant
                </button>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2 py-1 rounded ${filter === 'all' ? 'bg-[#0c4a6e] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  All
                </button>
              </div>
            </div>

            {/* CTAs grouped by type */}
            <div className="space-y-3">
              {TYPE_ORDER.filter(t => ctaData.summary[t]).map(type => {
                const items = ctaData.ctas.filter(c => c.ctaType === type);
                if (items.length === 0) return null;
                const isExpanded = expandedType === null || expandedType === type;
                return (
                  <div key={type} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <p className="text-sm font-bold text-[#0c4a6e]">{TYPE_LABELS[type]}</p>
                      <p className="text-xs text-slate-500">{items.length} CTA{items.length !== 1 ? 's' : ''}</p>
                    </div>
                    {isExpanded && (
                      <div className="divide-y divide-slate-100">
                        {items.map(cta => {
                          const sev = STATUS_STYLES[cta.status];
                          return (
                            <div key={cta.id} className="px-4 py-3 flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold text-slate-900">{cta.ctaText}</p>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${sev.bg} ${sev.text}`}>{cta.status}</span>
                                  {cta.status === 'SUGGESTED' && cta.recommendation === 'track' && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">★ Recommended</span>
                                  )}
                                  {cta.status === 'SUGGESTED' && cta.recommendation === 'ignore' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200">Low priority</span>
                                  )}
                                  <span className="text-[10px] text-slate-400" title={`Priority score 0-100: ${cta.priority}`}>· score {cta.priority}</span>
                                </div>
                                {cta.ctaHref && <p className="font-mono text-[11px] text-[#0891b2] mt-0.5 truncate">{cta.ctaHref}</p>}
                                <p className="text-xs text-slate-500 mt-1">
                                  on {cta.pageCount} page{cta.pageCount !== 1 ? 's' : ''}
                                  {' · '}
                                  <span className={cta.clickCount30d === 0 && cta.sessionsExposed >= 50 ? 'text-amber-600 font-semibold' : ''}>
                                    {cta.clickCount30d} click{cta.clickCount30d !== 1 ? 's' : ''} / {cta.sessionsExposed} sessions (30d)
                                  </span>
                                  {cta.sessionsExposed > 0 && <span className="text-slate-400"> · CTR {cta.ctr.toFixed(2)}%</span>}
                                </p>
                                {cta.clickCount30d === 0 && cta.sessionsExposed >= 50 && (
                                  <p className="text-[11px] text-amber-700 mt-1">
                                    ⚠ 0 clicks despite {cta.sessionsExposed} sessions exposed. Likely below the fold or invisible to users.
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {cta.status !== 'TRACKED' && (
                                  <button
                                    onClick={() => updateStatus(cta.id, 'TRACKED')}
                                    className="text-[11px] px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold"
                                  >
                                    Track
                                  </button>
                                )}
                                {cta.status !== 'IGNORED' && (
                                  <button
                                    onClick={() => updateStatus(cta.id, 'IGNORED')}
                                    className="text-[11px] px-2 py-1 rounded bg-slate-50 text-slate-600 hover:bg-slate-100"
                                  >
                                    Ignore
                                  </button>
                                )}
                                {cta.status === 'IGNORED' && (
                                  <button
                                    onClick={() => updateStatus(cta.id, 'SUGGESTED')}
                                    className="text-[11px] px-2 py-1 rounded text-slate-500 hover:text-slate-700"
                                  >
                                    Restore
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Competitor CTAs section — view-only, for comparison */}
            {ctaData.competitorCount > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Competitor CTAs</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      What {ctaData.competitorCount} competitor{ctaData.competitorCount !== 1 ? 's are' : ' is'} doing on their site. Reference only — not tracked or acted on.
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {Object.entries(ctaData.competitorGroups).map(([url, items]) => {
                    let host = url;
                    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }
                    return (
                      <div key={url} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                          <p className="text-sm font-bold text-slate-700">{host}</p>
                          <p className="text-[11px] text-slate-400 font-mono truncate">{url}</p>
                        </div>
                        {items.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-slate-500 italic">No CTAs detected on this competitor.</p>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {items.slice(0, 8).map(cta => (
                              <div key={cta.id} className="px-4 py-2.5 flex items-center gap-3">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wider flex-shrink-0">
                                  {TYPE_LABELS[cta.ctaType]}
                                </span>
                                <p className="text-sm text-slate-700 flex-1 truncate">{cta.ctaText}</p>
                                {cta.ctaHref && (
                                  <p className="font-mono text-[11px] text-slate-400 truncate max-w-xs">{cta.ctaHref}</p>
                                )}
                              </div>
                            ))}
                            {items.length > 8 && (
                              <p className="px-4 py-2 text-[11px] text-slate-500 italic">+{items.length - 8} more not shown</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showCrawlModal && status && (
        <CrawlModal
          siteId={siteId}
          status={status}
          onClose={() => setShowCrawlModal(false)}
          onCrawlComplete={() => { setShowCrawlModal(false); refresh(); }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Crawl modal — within-window vs eligible state
// =============================================================================

function CrawlModal({
  siteId, status, onClose, onCrawlComplete,
}: {
  siteId: string;
  status: CrawlStatus;
  onClose: () => void;
  onCrawlComplete: () => void;
}) {
  const [includeCompetitors, setIncludeCompetitors] = useState(true);
  const [newCompetitorUrl, setNewCompetitorUrl] = useState('');
  const [addedCompetitors, setAddedCompetitors] = useState<string[]>([]);
  const [crawling, setCrawling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCrawl() {
    setCrawling(true);
    setError(null);
    try {
      const res = await fetch('/api/sitemap/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          includeCompetitors,
          addCompetitorUrls: addedCompetitors,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || e.message || `Crawl failed (${res.status})`);
      }
      onCrawlComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Crawl failed');
      setCrawling(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(8, 47, 73, 0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#0c4a6e] to-[#0369a1] px-6 py-5">
          <h2 className="text-xl font-black text-white">Deep crawl</h2>
          <p className="text-sm text-white/70 mt-1">Scans pages, extracts CTAs, and refreshes site analysis. Limited to once per 90 days.</p>
        </div>

        <div className="px-6 py-5">
          {!status.eligible ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
              <p className="text-sm font-semibold text-amber-800">Cooldown active</p>
              <p className="text-xs text-amber-700 mt-1">
                Last crawl: <strong>{fmtDate(status.lastDeepCrawlAt)}</strong> ({relativeFromNow(status.lastDeepCrawlAt)}).
                Next eligible: <strong>{fmtDate(status.nextEligibleAt)}</strong> ({relativeFromNow(status.nextEligibleAt)}).
              </p>
              <p className="text-xs text-amber-700 mt-2">
                We don&apos;t re-crawl within {status.cooldownDays} days because it costs API quota and the site rarely changes meaningfully in that window.
                Your monthly scheduled report will auto-trigger a fresh crawl when the cooldown expires.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-700 mb-4">
                Ready to run. This will scan up to 50 pages on your site (~30-60s) and detect CTAs, forms, and key pages.
              </p>

              <label className="flex items-start gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCompetitors}
                  onChange={e => setIncludeCompetitors(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Include competitors</p>
                  <p className="text-xs text-slate-500">
                    Currently tracking {status.competitorUrls.length} competitor{status.competitorUrls.length !== 1 ? 's' : ''}
                    {status.competitorUrls.length > 0 ? `: ${status.competitorUrls.slice(0, 3).map(u => new URL(u).hostname).join(', ')}${status.competitorUrls.length > 3 ? '...' : ''}` : ''}.
                  </p>
                </div>
              </label>

              {(() => {
                const MAX_COMPETITORS = 3;
                const totalCompetitors = status.competitorUrls.length + addedCompetitors.length;
                const remainingSlots = Math.max(0, MAX_COMPETITORS - totalCompetitors);
                const atCap = remainingSlots === 0;
                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-slate-600">Add a competitor URL</p>
                      <p className="text-[10px] text-slate-400">
                        {totalCompetitors} of {MAX_COMPETITORS} competitor slots used
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://www.competitor.com"
                        value={newCompetitorUrl}
                        onFocus={() => {
                          // Auto-prefill the protocol so the user only types the domain
                          if (!newCompetitorUrl) setNewCompetitorUrl('https://www.');
                        }}
                        onChange={e => setNewCompetitorUrl(e.target.value)}
                        disabled={atCap}
                        className="flex-1 text-sm px-2 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                      <button
                        onClick={() => {
                          const trimmed = newCompetitorUrl.trim();
                          // Reject the bare prefix or anything without a real domain
                          if (!trimmed || trimmed === 'https://www.' || trimmed === 'https://') return;
                          if (addedCompetitors.includes(trimmed)) return;
                          if (totalCompetitors >= MAX_COMPETITORS) return;
                          setAddedCompetitors([...addedCompetitors, trimmed]);
                          setNewCompetitorUrl('');
                        }}
                        disabled={atCap}
                        className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-md font-semibold"
                      >
                        Add
                      </button>
                    </div>
                    {addedCompetitors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {addedCompetitors.map(url => (
                          <span
                            key={url}
                            className="text-[11px] bg-emerald-100 text-emerald-700 pl-2 pr-1 py-0.5 rounded-full inline-flex items-center gap-1"
                          >
                            {url}
                            <button
                              onClick={() => setAddedCompetitors(addedCompetitors.filter(u => u !== url))}
                              className="w-3.5 h-3.5 rounded-full hover:bg-emerald-200 flex items-center justify-center transition-colors"
                              title="Remove"
                              aria-label={`Remove ${url}`}
                            >
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {atCap && (
                      <p className="text-[11px] text-slate-500 mt-2">
                        Max 3 competitors per crawl. Remove one above or manage the full list in Settings.
                      </p>
                    )}
                  </div>
                );
              })()}

              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
            disabled={crawling}
          >
            Close
          </button>
          {status.eligible && (
            <button
              onClick={startCrawl}
              disabled={crawling}
              className="px-5 py-2 text-sm font-semibold bg-[#0c4a6e] hover:bg-[#075985] disabled:opacity-60 text-white rounded-lg"
            >
              {crawling ? 'Crawling… (~30-60s)' : 'Start deep crawl'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
