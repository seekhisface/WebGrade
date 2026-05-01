'use client';

import { useState, useEffect } from 'react';
import SampleReportModal from '@/components/marketing/SampleReportModal';

// =============================================================================
// Types (duplicated from report page for self-containment)
// =============================================================================

interface ActionItem { rank: number; title: string; problem: string; fix: string; impact: string; effort: 'low' | 'medium' | 'high'; pageUrl: string | null; category: string; }
interface GrowthPlay { rank: number; title: string; opportunity: string; hypothesis: string; experiment: string; upside: string; timeToResult: string; category: string; }
interface CriticalPage { url: string; exitRate: number; scrollDepth: number; revenueAtRisk: number; severity: string; }
interface TopFinding { title: string; problem: string; impact: string; category: string; }
interface TrackingHealth { conversionEventsFiring: boolean; conversionEventsCount: number; botPct: number; eventDataCompleteness: number; }
interface TopLeak {
  rank: number;
  url: string;
  title: string | null;
  sessions: number;
  exitRate: number;
  qualifiedVisitorsLost: number;
  revenueAtRisk: number;
  attributablePct: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  evidence: string;
}
interface ReportPayload {
  id: string; status: string; periodStart: string; periodEnd: string;
  executiveSummary: string | null; actionItems: ActionItem[] | null; topFindings: TopFinding[] | null;
  growthPlays: GrowthPlay[] | null; estimatedImpact: string | null;
  liveMetrics: { totalSessions: number; avgIntentScore: number; totalDisengagedVisitors?: number; periodDays?: number } | null;
  baselineMetrics: { bounceRate: number; conversionRate: number } | null;
  criticalPages: CriticalPage[] | null; totalRevenueAtRisk: number; createdAt: string;
  trackingHealth?: TrackingHealth | null;
  conversionGoalConfigured?: boolean;
  topLeaks?: TopLeak[];
}

// =============================================================================
// Helpers
// =============================================================================

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 mt-6 first:mt-0">
      <svg className="w-5 h-5 text-[#0891b2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
      </svg>
      <h3 className="text-lg font-black text-[#0c4a6e]">{title}</h3>
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

const severityColors = { HIGH: 'bg-red-100 text-red-700', MEDIUM: 'bg-amber-100 text-amber-700', LOW: 'bg-blue-100 text-blue-700' };
function severityFromIndex(i: number): 'HIGH' | 'MEDIUM' | 'LOW' { return i < 2 ? 'HIGH' : i < 4 ? 'MEDIUM' : 'LOW'; }

// Top 3 Leaks (Section 3) — programmatic severity tiers
const SEVERITY_BADGES: Record<'CRITICAL' | 'HIGH' | 'MEDIUM', { bg: string; text: string }> = {
  CRITICAL: { bg: 'bg-red-100', text: 'text-red-700' },
  HIGH:     { bg: 'bg-amber-100', text: 'text-amber-700' },
  MEDIUM:   { bg: 'bg-blue-100', text: 'text-blue-700' },
};

// =============================================================================
// Main Modal
// =============================================================================

interface ReportSchedule {
  nextReportDate: string | null;
  nextReportLabel: string | null;
  auditComplete: boolean;
}

interface ReportModalProps {
  siteId: string;
  days: number;
  schedule: ReportSchedule | null;
  onClose: () => void;
}

export default function ReportModal({ siteId, days, schedule, onClose }: ReportModalProps) {
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedAction, setExpandedAction] = useState<number | null>(null);
  const [showSamplePreview, setShowSamplePreview] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => { loadReport(); }, [siteId]); // eslint-disable-line

  async function loadReport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/report?siteId=${siteId}`);
      const data = await res.json();
      if (data.report?.status === 'COMPLETE') setReport(data.report);
    } catch { /* no report yet */ }
    setLoading(false);
  }

  function handleSavePDF() {
    window.print();
  }

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function fmtRelativeAge(iso: string): string {
    const hrs = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
    if (hrs < 1) return 'just now';
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  function daysUntil(iso: string): number {
    return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtMoney = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`;

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 86400000);
  const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(8, 47, 73, 0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl print:rounded-none print:shadow-none"
        style={{ maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button (hidden in print) */}
        <button onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors print:hidden"
          aria-label="Close">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-[#0c4a6e] to-[#0369a1] px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">WebGrade Intelligence Report</p>
              <h2 className="text-xl font-black text-white">WebAudit™ Report</h2>
              {report && (
                <p className="text-[11px] text-white/60 mt-1.5 leading-relaxed">
                  <span className="text-white/80">Generated</span> {fmtDate(report.createdAt)} ·{' '}
                  <span className="text-white/50">{fmtRelativeAge(report.createdAt)}</span>
                  <span className="block">
                    <span className="text-white/80">Covers</span> {fmtShort(new Date(report.periodStart))} – {fmtShort(new Date(report.periodEnd))}
                    {' · '}
                    {schedule?.auditComplete ? (
                      <span>
                        <span className="text-white/80">Audit complete</span>{' — '}
                        <a href="/marketing#pricing" className="underline text-white/80 hover:text-white">upgrade to WebWatch for monthly reports</a>
                      </span>
                    ) : schedule?.nextReportDate ? (
                      <span>
                        <span className="text-white/80">Next report:</span> {fmtDate(schedule.nextReportDate)}
                        {schedule.nextReportLabel ? <span className="text-white/50"> ({schedule.nextReportLabel})</span> : null}
                      </span>
                    ) : null}
                  </span>
                </p>
              )}
              {!report && (
                <p className="text-sm text-white/70 mt-0.5">{fmtShort(startDate)} – {fmtShort(endDate)}</p>
              )}
            </div>
            <button onClick={handleSavePDF}
              className="text-xs font-semibold px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors print:hidden flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Save as PDF
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-8 py-6" style={{ maxHeight: 'calc(92vh - 120px)' }}>

          {/* Loading */}
          {loading && (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-[#0c4a6e] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-[#64748b]">Loading report…</p>
            </div>
          )}

          {/* No report — explain the schedule + offer a sample preview */}
          {!loading && !report && (
            <div className="py-12 text-center max-w-md mx-auto">
              <div className="w-14 h-14 bg-[#e0f2fe] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#0c4a6e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#1e293b] mb-2">
                {schedule?.auditComplete
                  ? 'Audit complete'
                  : schedule?.nextReportDate
                    ? `Your first report fires ${fmtDate(schedule.nextReportDate)}`
                    : 'Your first report is on the way'}
              </h3>
              <p className="text-sm text-[#64748b] mb-5">
                {schedule?.auditComplete ? (
                  <>
                    Your WebAudit window is closed.{' '}
                    <a href="/marketing#pricing" className="text-[#0891b2] hover:text-[#0e7490] underline font-medium">
                      Upgrade to WebWatch
                    </a>{' '}
                    to keep getting monthly reports as your site evolves.
                  </>
                ) : schedule?.nextReportDate ? (
                  <>
                    Reports generate on a fixed schedule so the numbers you see are always reproducible.
                    Your <strong>{schedule.nextReportLabel ?? 'next'}</strong> report fires in{' '}
                    <strong>{daysUntil(schedule.nextReportDate)} days</strong>. Use the dashboard for live data in the meantime.
                  </>
                ) : (
                  <>Reports fire on a fixed schedule. Use the dashboard for live data in the meantime.</>
                )}
              </p>
              <button
                onClick={() => setShowSamplePreview(true)}
                className="px-6 py-2.5 bg-[#0c4a6e] hover:bg-[#075985] text-white font-semibold rounded-xl transition-colors">
                Preview a sample report
              </button>
            </div>
          )}

          {/* Report content */}
          {!loading && report && (
            <div>
              {/* Executive Summary */}
              <SectionHeader title="Bottom line" icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-5 mb-6">
                {report.executiveSummary
                  ? report.executiveSummary.split('\n\n').map((p, i) => <p key={i} className="text-sm text-[#334155] leading-relaxed mb-3 last:mb-0">{p}</p>)
                  : <p className="text-[#94a3b8] text-sm">No executive summary available.</p>}
              </div>

              {/* Key Metrics — Sessions / Avg Intent Score / Disengaged Leads / Revenue at Risk
                  Per Phase 3 Section 2 spec. Action Items count moved to recommendations header. */}
              <SectionHeader title="Key Metrics" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              {(() => {
                const sessions = report.liveMetrics?.totalSessions ?? 0;
                const intent = report.liveMetrics?.avgIntentScore ?? 0;
                const disengaged = report.liveMetrics?.totalDisengagedVisitors ?? 0;
                const periodDays = report.liveMetrics?.periodDays ?? 30;
                const conversions = report.trackingHealth?.conversionEventsCount ?? 0;
                const goalConfigured = !!report.conversionGoalConfigured;

                // Spec: <10 sessions in window — collapse the card row entirely.
                if (sessions < 10) {
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
                      Insufficient sample (<strong>{sessions} sessions</strong> in window). Key Metrics need 10+ to be statistically meaningful.
                    </div>
                  );
                }

                // Determine Revenue at Risk card state per spec table.
                let rarLabel: string;
                let rarValue: string;
                let rarColor: string;
                let rarSubtext: React.ReactNode = null;
                if (conversions >= 1) {
                  rarLabel = 'Revenue at Risk';
                  rarValue = `${fmtMoney(report.totalRevenueAtRisk)}/mo`;
                  rarColor = 'text-[#dc2626]';
                } else if (goalConfigured && periodDays >= 30) {
                  rarLabel = 'Revenue at Risk';
                  rarValue = `${fmtMoney(report.totalRevenueAtRisk)}/mo`;
                  rarColor = 'text-[#b45309]';
                  rarSubtext = (
                    <span className="text-[10px] text-[#94a3b8] mt-1 block group cursor-help relative">
                      (modeled)
                      <span className="absolute z-50 hidden group-hover:block top-full left-0 mt-1 w-64 px-3 py-2 bg-[#0c4a6e] text-white text-[11px] leading-relaxed rounded-lg shadow-xl pointer-events-none">
                        Modeled estimate. Conversion tracking is configured but no conversion events fired in this {periodDays}-day window. Figure assumes industry-default AOV and lead-to-win rate.
                      </span>
                    </span>
                  );
                } else {
                  rarLabel = 'Revenue at Risk';
                  rarValue = 'Not yet measurable';
                  rarColor = 'text-[#94a3b8]';
                  rarSubtext = (
                    <a href="#data-gaps" className="text-[10px] text-[#0891b2] hover:text-[#0e7490] underline mt-1 inline-block">(why?)</a>
                  );
                }

                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4">
                      <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Sessions</p>
                      <p className="text-xl font-black text-[#0c4a6e]">{sessions.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4">
                      <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Avg Intent Score</p>
                      <p className="text-xl font-black text-[#0c4a6e]">{intent}/100</p>
                    </div>
                    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4">
                      <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Disengaged Leads</p>
                      <p className="text-xl font-black text-[#b45309]">{disengaged.toLocaleString()}<span className="text-base font-normal text-[#94a3b8] ml-1">visitors</span></p>
                    </div>
                    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4">
                      <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">{rarLabel}</p>
                      <p className={`text-xl font-black ${rarColor}`}>{rarValue}</p>
                      {rarSubtext}
                    </div>
                  </div>
                );
              })()}

              {/* Top 3 Leaks (Phase 3 Section 3) — ranked, severity-tiered, programmatic evidence */}
              <SectionHeader title="Top 3 Leaks" icon="M13 10V3L4 14h7v7l9-11h-7z" />
              {report.topLeaks && report.topLeaks.length > 0 ? (
                <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden mb-6">
                  <div className="grid grid-cols-[40px_1fr_120px] md:grid-cols-[40px_220px_1fr_120px] gap-3 px-4 py-2 bg-[#f1f5f9] text-[9px] font-bold text-[#64748b] uppercase tracking-wider">
                    <span>#</span>
                    <span>Where it leaks</span>
                    <span className="hidden md:inline">Evidence</span>
                    <span>Severity</span>
                  </div>
                  {report.topLeaks.map(leak => {
                    const sev = SEVERITY_BADGES[leak.severity];
                    return (
                      <div key={leak.rank} className="grid grid-cols-[40px_1fr_120px] md:grid-cols-[40px_220px_1fr_120px] gap-3 px-4 py-3 text-sm border-t border-[#f1f5f9] items-start">
                        <span className="text-base font-black text-[#0c4a6e]">{leak.rank}</span>
                        <span className="font-mono text-xs text-[#0891b2] break-all">{leak.url}</span>
                        <span className="hidden md:inline text-xs text-[#475569] leading-relaxed">{leak.evidence}</span>
                        <span className="self-start">
                          <span className={`text-[10px] font-black px-2 py-1 rounded-full ${sev.bg} ${sev.text}`}>{leak.severity}</span>
                          <span className="block text-[10px] text-[#94a3b8] mt-0.5">{leak.attributablePct.toFixed(1)}% attributable</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-4 py-3 mb-6 text-sm text-[#64748b]">
                  No leaks reached the 5% qualified-loss threshold.
                  {' '}
                  This either means traffic is clean, or HIGH/MEDIUM intent classification hasn&apos;t scored sessions yet (intent scoring runs after sessions end).
                </div>
              )}

              {/* Drop-Off Pages */}
              {report.criticalPages && report.criticalPages.length > 0 && (
                <>
                  <SectionHeader title="Top Drop-Off Pages" icon="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] overflow-hidden mb-6">
                    <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-[#f1f5f9] text-[9px] font-bold text-[#64748b] uppercase tracking-wider">
                      <span>Page</span><span>Scroll Depth</span><span>Exit Rate</span><span>Revenue at Risk</span>
                    </div>
                    {report.criticalPages.slice(0, 6).map((p, i) => (
                      <div key={i} className="grid grid-cols-4 gap-2 px-4 py-2.5 text-sm border-t border-[#f1f5f9]">
                        <span className="font-mono text-xs text-[#0891b2] truncate">{p.url}</span>
                        <span className="text-[#334155] text-xs">{p.scrollDepth ? `${p.scrollDepth.toFixed(0)}%` : '—'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full inline-block w-fit ${exitRateColor(p.exitRate)}`}>{p.exitRate.toFixed(0)}%</span>
                        <span className="text-xs font-semibold text-red-600">${p.revenueAtRisk.toLocaleString()}/mo</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Priority Findings */}
              {report.topFindings && report.topFindings.length > 0 && (
                <>
                  <SectionHeader title="Priority Findings" icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  <div className="bg-white rounded-xl border border-[#e2e8f0] divide-y divide-[#f1f5f9] mb-6">
                    {report.topFindings.map((f, i) => {
                      const sev = severityFromIndex(i);
                      return (
                        <div key={i} className="flex items-start gap-3 px-5 py-3.5">
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

              {/* Action Items */}
              {report.actionItems && report.actionItems.length > 0 && (
                <>
                  <SectionHeader title="Action Items" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  <div className="space-y-2 mb-6">
                    {(report.actionItems as ActionItem[]).map((r, i) => {
                      const c = recColors[i] ?? recColors[recColors.length - 1];
                      const isExpanded = expandedAction === r.rank;
                      return (
                        <div key={r.rank} className={`${c.bg} border ${c.border} rounded-xl overflow-hidden cursor-pointer`}
                          onClick={() => setExpandedAction(isExpanded ? null : r.rank)}>
                          <div className="flex items-center gap-3 px-4 py-3">
                            <span className={`w-6 h-6 ${c.badge} text-white rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0`}>{r.rank}</span>
                            <p className="text-sm font-semibold text-[#1e293b] flex-1">{r.title}</p>
                            <span className="text-xs font-semibold text-green-600 flex-shrink-0">{r.impact}</span>
                            <span className="text-[10px] font-semibold text-[#64748b] bg-white px-2 py-0.5 rounded-full flex-shrink-0">{r.effort} effort</span>
                          </div>
                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-white/50" onClick={e => e.stopPropagation()}>
                              <div className="grid grid-cols-2 gap-4 mt-3">
                                <div>
                                  <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Problem</p>
                                  <p className="text-sm text-[#334155] leading-relaxed">{r.problem}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Fix</p>
                                  <p className="text-sm text-[#334155] leading-relaxed">{r.fix}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Bottom Save as PDF */}
              <div className="text-center pt-4 border-t border-[#e2e8f0] print:hidden">
                <button onClick={handleSavePDF}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0c4a6e] text-white text-sm font-semibold rounded-xl hover:bg-[#075985] transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Save as PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sample report preview — shown when user clicks "Preview a sample report" */}
      {showSamplePreview && (
        <SampleReportModal type="webaudit" onClose={() => setShowSamplePreview(false)} />
      )}
    </div>
  );
}
