'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

// =============================================================================
// Types
// =============================================================================

interface ArchivedReportSummary {
  id: string;
  type: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  kpiSnapshot: Record<string, number>;
  createdAt: string;
}

interface ActionItem {
  rank: number;
  title: string;
  problem: string;
  fix: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  pageUrl: string | null;
  category: string;
}

interface GrowthPlay {
  rank: number;
  title: string;
  opportunity: string;
  hypothesis: string;
  experiment: string;
  upside: string;
  timeToResult: string;
  category: string;
}

interface LiveMetrics {
  totalSessions: number;
  avgIntentScore: number;
  rageClickEvents: number;
  hesitationEvents: number;
  dataSource: 'live' | 'demo';
}

interface BaselineMetrics {
  sessions: number;
  bounceRate: number;
  avgSessionDuration: number;
  pagesPerSession: number;
  organicSessions: number;
  paidSessions: number;
  conversionRate: number;
}

interface CriticalPage {
  url: string;
  exitRate: number;
  scrollDepth: number;
  revenueAtRisk: number;
  severity: string;
  sessions?: number;
}

interface TopFinding {
  title: string;
  problem: string;
  impact: string;
  category: string;
}

interface ReportPayload {
  id: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  executiveSummary: string | null;
  actionItems: ActionItem[] | null;
  topFindings: TopFinding[] | null;
  growthPlays: GrowthPlay[] | null;
  estimatedImpact: string | null;
  liveMetrics: LiveMetrics | null;
  baselineMetrics: BaselineMetrics | null;
  criticalPages: CriticalPage[] | null;
  totalRevenueAtRisk: number;
  createdAt: string;
}

// =============================================================================
// Helper components (matching marketing sample style)
// =============================================================================

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 mt-8 first:mt-0">
      <svg className="w-5 h-5 text-[#0891b2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
      </svg>
      <h3 className="text-lg font-black text-[#0c4a6e]">{title}</h3>
    </div>
  );
}

function MetricCard({ label, value, change, status }: { label: string; value: string; change?: string; status?: 'green' | 'red' | 'yellow' }) {
  const statusColors = { green: 'text-emerald-600 bg-emerald-50', red: 'text-red-600 bg-red-50', yellow: 'text-amber-600 bg-amber-50' };
  return (
    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4">
      <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-black text-[#0c4a6e]">{value}</p>
      {change && status && (
        <p className={`text-xs font-semibold mt-1 inline-block px-2 py-0.5 rounded-full ${statusColors[status]}`}>{change}</p>
      )}
    </div>
  );
}

function exitRateColor(rate: number): string {
  if (rate >= 70) return 'text-red-700 bg-red-50 font-black';
  if (rate >= 60) return 'text-red-500 bg-red-50 font-bold';
  if (rate >= 50) return 'text-amber-600 bg-amber-50 font-bold';
  if (rate >= 40) return 'text-amber-500 bg-amber-50 font-semibold';
  return 'text-emerald-600 bg-emerald-50 font-semibold';
}

const recColors = [
  { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-600', text: 'text-red-700' },
  { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-600', text: 'text-red-700' },
  { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-600', text: 'text-amber-700' },
  { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-600', text: 'text-amber-700' },
  { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-600', text: 'text-blue-700' },
  { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-600', text: 'text-blue-700' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-600', text: 'text-emerald-700' },
];

function severityFromIndex(i: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (i < 2) return 'HIGH';
  if (i < 4) return 'MEDIUM';
  return 'LOW';
}

const severityColors = { HIGH: 'bg-red-100 text-red-700', MEDIUM: 'bg-amber-100 text-amber-700', LOW: 'bg-blue-100 text-blue-700' };

// =============================================================================
// Main page
// =============================================================================

export default function ReportPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const [activeView, setActiveView] = useState<'executive' | 'action' | 'growth'>('executive');
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [archives, setArchives] = useState<ArchivedReportSummary[]>([]);
  const [showArchiveDropdown, setShowArchiveDropdown] = useState(false);
  const [viewingArchive, setViewingArchive] = useState<ArchivedReportSummary | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [expandedAction, setExpandedAction] = useState<number | null>(null);
  const archiveRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadReport(); loadArchives(); }, [siteId]); // eslint-disable-line

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (archiveRef.current && !archiveRef.current.contains(e.target as Node)) setShowArchiveDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function loadReport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/report?siteId=${siteId}`);
      const data = await res.json();
      if (data.report?.status === 'COMPLETE') setReport(data.report);
    } catch { /* no report yet */ }
    setLoading(false);
  }

  async function loadArchives() {
    try {
      const res = await fetch(`/api/reports/archive?siteId=${siteId}`);
      if (res.ok) { const data = await res.json(); setArchives(data.archives ?? []); }
    } catch { /* no archives */ }
  }

  async function saveToArchive() {
    setArchiving(true);
    try { const res = await fetch('/api/reports/archive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId }) }); if (res.ok) await loadArchives(); } catch { /* ignore */ }
    setArchiving(false);
  }

  function viewArchive(archive: ArchivedReportSummary) { setViewingArchive(archive); setShowArchiveDropdown(false); setActiveView('executive'); }
  function backToLive() { setViewingArchive(null); }

  async function generateReport() {
    setGenerating(true); setError('');
    try {
      const res = await fetch('/api/ai/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Generation failed'); return; }
      await loadReport();
    } catch { setError('Something went wrong. Please try again.'); }
    finally { setGenerating(false); }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtMoney = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(1)}k` : `$${n}`;

  // Loading state
  if (loading) return (
    <div className="min-h-screen bg-[#f0f9ff] flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0c4a6e] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  // Empty state
  if (!report) return (
    <div className="min-h-screen bg-[#f0f9ff] flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#e0f2fe] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#0c4a6e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#1e293b] mb-2">Generate Your WebAudit™</h1>
          <p className="text-sm text-[#64748b] mb-6 leading-relaxed">WebGrade analyzes your behavioral data, drop-off patterns, and GA4 baseline to generate a prioritized action plan with estimated revenue impact.</p>
          {error && <p className="text-sm text-red-500 mb-4 p-3 bg-red-50 rounded-lg">{error}</p>}
          <button onClick={generateReport} disabled={generating}
            className="w-full bg-[#0c4a6e] hover:bg-[#075985] disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2">
            {generating ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating… (~30s)</> : 'Generate WebAudit™'}
          </button>
          <p className="text-xs text-[#94a3b8] mt-3">AI-powered · Uses your behavioral data · ~30 seconds</p>
        </div>
      </div>
    </div>
  );

  const actionItems = (report.actionItems ?? []) as ActionItem[];
  const growthPlays = (report.growthPlays ?? []) as GrowthPlay[];
  const criticalPages = (report.criticalPages ?? []) as CriticalPage[];
  const topFindings = (report.topFindings ?? []) as TopFinding[];
  const live = report.liveMetrics;
  const baseline = report.baselineMetrics;

  return (
    <div className="min-h-screen bg-[#f0f9ff] flex flex-col">

      {/* ── Header with gradient (matches marketing sample) ── */}
      <div className="bg-gradient-to-r from-[#0c4a6e] to-[#0369a1] px-8 py-6">
        <div className="max-w-5xl mx-auto">
          {viewingArchive ? (
            <>
              <button onClick={backToLive} className="text-xs text-white/60 hover:text-white/90 font-medium mb-2 inline-block">← Back to Live Report</button>
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Archived Report</p>
              <h2 className="text-2xl font-black text-white">{viewingArchive.title}</h2>
              <p className="text-sm text-white/70 mt-1">{fmt(viewingArchive.periodStart)} – {fmt(viewingArchive.periodEnd)}</p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">WebGrade Intelligence Report</p>
              <h2 className="text-2xl font-black text-white">WebAudit™ Report</h2>
              <p className="text-sm text-white/70 mt-1">{fmt(report.periodStart)} – {fmt(report.periodEnd)}</p>
            </>
          )}
        </div>
      </div>

      {/* ── Tab bar + actions ── */}
      <div className="bg-white border-b border-[#e0f2fe] px-6 py-2 flex items-center justify-between sticky top-[52px] z-10">
        <div className="flex items-center gap-3">
          {!viewingArchive && (
            <div className="flex bg-[#f0f9ff] border border-[#bae6fd] rounded-lg p-0.5 gap-0.5">
              {(['executive','action','growth'] as const).map(v => (
                <button key={v} onClick={() => setActiveView(v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeView===v ? 'bg-white text-[#1e293b] shadow-sm' : 'text-[#64748b]'}`}>
                  {v==='executive' ? 'Executive View' : v==='action' ? `Action Items (${actionItems.length})` : `Growth Plays (${growthPlays.length})`}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Archive dropdown */}
          <div className="relative" ref={archiveRef}>
            <button onClick={() => setShowArchiveDropdown(p => !p)}
              className="text-xs px-3 py-1.5 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-[#64748b] hover:bg-[#e0f2fe] transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
              Archive{archives.length > 0 && ` (${archives.length})`}
            </button>
            {showArchiveDropdown && (
              <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl border border-[#e0f2fe] shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[#f0f9ff] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1e293b] uppercase tracking-wider">Report Archive</span>
                  {!viewingArchive && report && (
                    <button onClick={saveToArchive} disabled={archiving}
                      className="text-xs px-2.5 py-1 bg-[#0c4a6e] text-white rounded-lg hover:bg-[#075985] disabled:opacity-60 transition-colors">
                      {archiving ? '…' : '+ Save Current'}
                    </button>
                  )}
                </div>
                {archives.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-[#94a3b8]">No archived reports yet</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {archives.map(a => (
                      <button key={a.id} onClick={() => viewArchive(a)}
                        className={`w-full text-left px-4 py-3 hover:bg-[#f0f9ff] transition-colors border-b border-[#f0f9ff] last:border-0 ${viewingArchive?.id === a.id ? 'bg-[#f0f9ff]' : ''}`}>
                        <span className="text-sm font-medium text-[#1e293b] truncate block">{a.title}</span>
                        <span className="text-xs text-[#94a3b8]">{fmt(a.periodStart)} – {fmt(a.periodEnd)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {!viewingArchive && (
            <button onClick={generateReport} disabled={generating}
              className="text-xs px-3 py-1.5 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-[#64748b] hover:bg-[#e0f2fe] transition-colors">
              {generating ? '…' : '↻ Regenerate'}
            </button>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">

        {/* ARCHIVED REPORT VIEW */}
        {viewingArchive && (
          <div className="space-y-6">
            <div className="bg-[#fffbeb] border border-[#fde68a] rounded-xl px-5 py-3 flex items-center gap-3">
              <svg className="w-4 h-4 text-[#92400e] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm text-[#92400e]">Viewing archived snapshot from <strong>{fmt(viewingArchive.createdAt)}</strong>. KPIs and findings are frozen at the time of archival.</p>
            </div>
            {viewingArchive.kpiSnapshot && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Sessions" value={String(viewingArchive.kpiSnapshot.sessions ?? '—')} />
                <MetricCard label="Intent Score" value={String(viewingArchive.kpiSnapshot.intentScore ?? '—')} />
                <MetricCard label="Bounce Rate" value={`${(viewingArchive.kpiSnapshot.bounceRate ?? 0).toFixed(1)}%`} status="yellow" change="At time of archive" />
                <MetricCard label="Revenue at Risk" value={fmtMoney(viewingArchive.kpiSnapshot.revenueAtRisk ?? 0)} status="red" change="Recoverable" />
              </div>
            )}
            <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-5">
              {viewingArchive.summary
                ? viewingArchive.summary.split('\n\n').map((p, i) => <p key={i} className="text-sm text-[#334155] leading-relaxed mb-3 last:mb-0">{p}</p>)
                : <p className="text-[#94a3b8] text-sm">No summary available for this archive.</p>}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* EXECUTIVE VIEW                                                     */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {!viewingArchive && activeView === 'executive' && (
          <div>
            {/* Executive Summary narrative */}
            <SectionHeader title="Executive Summary" icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-5 mb-6">
              {report.executiveSummary
                ? report.executiveSummary.split('\n\n').map((p, i) => <p key={i} className="text-sm text-[#334155] leading-relaxed mb-3 last:mb-0">{p}</p>)
                : <p className="text-[#94a3b8] text-sm">No executive summary available.</p>}
            </div>

            {/* KPI Metrics Grid */}
            <SectionHeader title="Key Metrics" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <MetricCard label="Total Sessions" value={live ? live.totalSessions.toLocaleString() : '—'} />
              <MetricCard label="Avg Intent Score" value={live ? `${live.avgIntentScore}/100` : '—'}
                status={live && live.avgIntentScore >= 50 ? 'green' : 'yellow'}
                change={live && live.avgIntentScore >= 50 ? 'Above benchmark' : 'Below benchmark'} />
              <MetricCard label="Revenue at Risk" value={fmtMoney(report.totalRevenueAtRisk)} status="red" change="Recoverable" />
              <MetricCard label="Action Items" value={String(actionItems.length)}
                change={`${actionItems.filter(a => a.effort === 'low').length} quick wins`} status="green" />
              {baseline && (
                <>
                  <MetricCard label="Bounce Rate" value={`${baseline.bounceRate.toFixed(1)}%`}
                    status={baseline.bounceRate > 60 ? 'red' : baseline.bounceRate > 45 ? 'yellow' : 'green'}
                    change={baseline.bounceRate > 60 ? 'Above industry avg' : 'Within range'} />
                  <MetricCard label="Conversion Rate" value={`${baseline.conversionRate.toFixed(1)}%`}
                    status={baseline.conversionRate < 2 ? 'red' : baseline.conversionRate < 3.5 ? 'yellow' : 'green'}
                    change={baseline.conversionRate < 2 ? 'Below benchmark' : 'Healthy'} />
                  <MetricCard label="Organic Sessions" value={baseline.organicSessions.toLocaleString()} />
                  <MetricCard label="Bot Traffic Filtered" value={live?.dataSource === 'demo' ? '8.3%' : 'Active'} status="green" change="Removed from data" />
                </>
              )}
            </div>

            {/* Drop-Off Pages Table */}
            {criticalPages.length > 0 && (
              <>
                <SectionHeader title="Top Drop-Off Pages" icon="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                <div className="mb-6">
                  <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] overflow-hidden">
                    <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-[#f1f5f9] text-[9px] font-bold text-[#64748b] uppercase tracking-wider">
                      <span>Page</span><span>Scroll Depth</span><span>Exit Rate</span><span>Revenue at Risk</span>
                    </div>
                    {criticalPages.slice(0, 8).map((p, i) => (
                      <div key={i} className="grid grid-cols-4 gap-2 px-4 py-2.5 text-sm border-t border-[#f1f5f9] group hover:bg-[#f0f9ff] transition-colors">
                        <span className="font-mono text-xs text-[#0891b2] truncate">{p.url}</span>
                        <span className="text-[#334155] text-xs">{p.scrollDepth ? `${p.scrollDepth.toFixed(0)}%` : '—'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full inline-block w-fit ${exitRateColor(p.exitRate)}`}>
                          {p.exitRate.toFixed(0)}%
                        </span>
                        <span className="text-xs font-semibold text-red-600">${p.revenueAtRisk.toLocaleString()}/mo</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Priority Findings */}
            {topFindings.length > 0 && (
              <>
                <SectionHeader title="Priority Findings" icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                <div className="bg-white rounded-xl border border-[#e2e8f0] divide-y divide-[#f1f5f9] mb-6">
                  {topFindings.map((f, i) => {
                    const sev = severityFromIndex(i);
                    return (
                      <div key={i} className="flex items-start gap-3 px-5 py-3.5 hover:bg-[#f8fafc] transition-colors">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${severityColors[sev]}`}>{sev}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#1e293b]">{f.title}</p>
                          <p className="text-xs text-[#64748b] mt-0.5">{f.problem}</p>
                        </div>
                        {f.impact && <span className="text-xs font-semibold text-red-600 flex-shrink-0">{f.impact}</span>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* AI Recommendations preview (top 3) */}
            {actionItems.length > 0 && (
              <>
                <SectionHeader title="Top Recommendations" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                <div className="space-y-2 mb-6">
                  {actionItems.slice(0, 4).map((r, i) => {
                    const c = recColors[i] ?? recColors[recColors.length - 1];
                    return (
                      <div key={r.rank} className={`flex items-center gap-3 ${c.bg} border ${c.border} rounded-xl px-4 py-3`}>
                        <span className={`w-7 h-7 ${c.badge} text-white rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0`}>{r.rank}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#1e293b] font-semibold">{r.title}</p>
                          <p className="text-xs text-[#64748b] mt-0.5 truncate">{r.fix}</p>
                        </div>
                        <span className={`text-[10px] font-black ${c.text} flex-shrink-0`}>
                          {r.effort === 'low' ? 'Quick Win' : r.effort === 'medium' ? 'Moderate' : 'Major'}
                        </span>
                        <span className="text-[10px] font-semibold text-[#64748b] bg-white px-2 py-0.5 rounded-full flex-shrink-0">
                          {r.effort} effort
                        </span>
                      </div>
                    );
                  })}
                </div>
                {actionItems.length > 4 && (
                  <button onClick={() => setActiveView('action')}
                    className="text-sm text-[#0891b2] font-semibold hover:underline">
                    View all {actionItems.length} action items →
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ACTION ITEMS VIEW                                                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {!viewingArchive && activeView === 'action' && (
          <div>
            <SectionHeader title="Action Items" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            <p className="text-xs text-[#64748b] mb-4">Ranked by estimated revenue impact. Click any item to expand details.</p>

            {actionItems.length === 0
              ? <div className="bg-white rounded-2xl border border-[#e0f2fe] p-12 text-center"><p className="text-[#94a3b8] text-sm">No action items yet — generate a report first.</p></div>
              : (
                <div className="space-y-3">
                  {actionItems.map((item, i) => {
                    const c = recColors[i] ?? recColors[recColors.length - 1];
                    const isExpanded = expandedAction === item.rank;
                    return (
                      <div key={item.rank}
                        className={`${c.bg} border ${c.border} rounded-xl overflow-hidden transition-all cursor-pointer`}
                        onClick={() => setExpandedAction(isExpanded ? null : item.rank)}>
                        {/* Collapsed row */}
                        <div className="flex items-center gap-3 px-5 py-3.5">
                          <span className={`w-7 h-7 ${c.badge} text-white rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0`}>{item.rank}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#1e293b]">{item.title}</p>
                            {item.pageUrl && <p className="text-xs text-[#94a3b8] font-mono mt-0.5">{item.pageUrl}</p>}
                          </div>
                          <span className="text-xs font-semibold text-green-600 flex-shrink-0">{item.impact}</span>
                          <span className="text-[10px] font-semibold text-[#64748b] bg-white px-2 py-0.5 rounded-full flex-shrink-0">{item.effort} effort</span>
                          <svg className={`w-4 h-4 text-[#94a3b8] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        {/* Expanded detail panel */}
                        {isExpanded && (
                          <div className="px-5 pb-5 pt-0 border-t border-white/50" onClick={e => e.stopPropagation()}>
                            <div className="grid grid-cols-2 gap-5 mt-4">
                              <div>
                                <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Problem</p>
                                <p className="text-sm text-[#334155] leading-relaxed">{item.problem}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Recommended Fix</p>
                                <p className="text-sm text-[#334155] leading-relaxed">{item.fix}</p>
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/50 flex items-center gap-6">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-[#64748b] uppercase font-bold">Impact:</span>
                                <span className="text-sm font-black text-green-700">{item.impact}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-[#64748b] uppercase font-bold">Effort:</span>
                                <span className="text-sm font-semibold text-[#334155] capitalize">{item.effort}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-[#64748b] uppercase font-bold">Category:</span>
                                <span className="text-sm text-[#334155] capitalize">{item.category}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* GROWTH PLAYS VIEW                                                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {!viewingArchive && activeView === 'growth' && (
          <div>
            <SectionHeader title="Growth Plays" icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            <p className="text-xs text-[#64748b] mb-4">Strategic opportunities beyond fixing what&apos;s broken. Click to expand hypothesis and experiment details.</p>

            {growthPlays.length === 0
              ? <div className="bg-white rounded-2xl border border-[#e0f2fe] p-12 text-center"><p className="text-[#94a3b8] text-sm">No growth plays yet — generate a report first.</p></div>
              : (
                <div className="space-y-3">
                  {growthPlays.map(play => <GrowthPlayCard key={play.rank} play={play} />)}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Growth Play Card (expandable)
// =============================================================================

function GrowthPlayCard({ play }: { play: GrowthPlay }) {
  const [exp, setExp] = useState(false);
  const cats: Record<string, { bg: string; border: string; text: string }> = {
    ab_test:   { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
    content:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700' },
    audience:  { bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-700' },
    retention: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
    channel:   { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700' },
    product:   { bg: 'bg-pink-50',   border: 'border-pink-200',   text: 'text-pink-700' },
  };
  const cat = cats[play.category] ?? { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' };

  return (
    <div className={`${cat.bg} border ${cat.border} rounded-xl overflow-hidden`}>
      <div className="flex items-center gap-3 px-5 py-3.5 cursor-pointer" onClick={() => setExp(e => !e)}>
        <span className="w-7 h-7 bg-[#0891b2] text-white rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0">{play.rank}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#1e293b]">{play.title}</p>
          <p className="text-xs text-[#64748b] mt-0.5 truncate">{play.opportunity}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs font-black text-[#0c4a6e]">{play.upside}</span>
          <span className="text-[10px] text-[#64748b]">{play.timeToResult}</span>
          <svg className={`w-4 h-4 text-[#94a3b8] transition-transform ${exp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {exp && (
        <div className="px-5 pb-5 border-t border-white/50">
          <p className="text-sm text-[#475569] leading-relaxed mt-4 mb-4">{play.opportunity}</p>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Hypothesis</p>
              <p className="text-sm text-[#475569] italic leading-relaxed">{play.hypothesis}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Experiment</p>
              <p className="text-sm text-[#475569] leading-relaxed">{play.experiment}</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/50 flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#64748b] uppercase font-bold">Upside:</span>
              <span className="text-sm font-black text-[#0c4a6e]">{play.upside}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#64748b] uppercase font-bold">Timeline:</span>
              <span className="text-sm text-[#475569]">{play.timeToResult}</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cat.text} bg-white`}>
              {play.category.replace('_', ' ')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
