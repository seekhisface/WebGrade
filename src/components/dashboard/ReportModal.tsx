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
interface Finding {
  rank: number;
  url: string;
  title: string;
  findingStatement: string;
  why: string;
  qualifier: string;
}
interface IntentDistribution {
  HIGH: number; MEDIUM: number; LOW: number; RESEARCHER: number; COMPETITOR: number; BOT: number;
  totalClassified: number;
  topPageForCompetitor: string | null;
}
interface PaidCampaignRow {
  campaign: string; source: string; utmMedium: string;
  sessions: number; botFlagged: number;
  highIntent: number; mediumIntent: number; lowIntent: number;
  verdict: 'Pure waste' | 'Mediocre' | 'Performing';
}
interface SeoSnapshot {
  organicSessions: number; totalClicks: number; impressions: number;
  avgCtr: number; avgPosition: number; keywordsTracked: number;
  topKeywords: Array<{ keyword: string; position: number; clicks: number; ctr: number }>;
  cwv: { lcp: number | null; cls: number | null; fid: number | null; allPassing: boolean };
}
interface PageRow {
  url: string; title: string; sessions: number;
  exitRate: number; avgScrollDepth: number;
  estimatedMonthlyRevenueAtRisk: number;
  rageClickCount: number; hesitationCount: number;
}
interface DataQualityCheck {
  id: string; label: string; severity: 'pass' | 'warn' | 'fail';
  message: string;
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
  findings?: Finding[];
  intentDistribution?: IntentDistribution | null;
  paidCampaigns?: PaidCampaignRow[];
  seoSnapshot?: SeoSnapshot | null;
  allPages?: PageRow[];
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
  // Section 12: Data Gaps — fetched separately, runs the rule-based check engine.
  const [dataGaps, setDataGaps] = useState<{ checks: DataQualityCheck[]; overall: 'green' | 'yellow' | 'red' } | null>(null);

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

  // Fetch the live data-quality report for Section 12 (Data Gaps). Runs rule-based
  // checks against current DB state — separate from the LLM report so this section
  // stays accurate even as data flows in.
  useEffect(() => {
    if (!report || !siteId) return;
    fetch(`/api/checkins/data-quality?siteId=${siteId}&mode=report`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setDataGaps({ checks: d.checks, overall: d.overall }))
      .catch(() => null);
  }, [report, siteId]);

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

              {/* ── Section 4: Findings & Insights ──────────────────────────────── */}
              {report.findings && report.findings.length > 0 && (
                <>
                  <SectionHeader title="Findings & Insights" icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  <div className="space-y-4 mb-6">
                    {report.findings.map(f => (
                      <div key={f.rank} className="bg-white border border-[#e2e8f0] rounded-xl p-5">
                        <div className="flex items-start gap-3 mb-3">
                          <span className="w-7 h-7 bg-[#0c4a6e] text-white rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0">{f.rank}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#1e293b]">{f.title}</p>
                            <p className="font-mono text-[11px] text-[#0891b2] mt-0.5">{f.url}</p>
                          </div>
                        </div>
                        <div className="space-y-3 text-sm text-[#334155] leading-relaxed pl-10">
                          <p>{f.findingStatement}</p>
                          <p>{f.why}</p>
                          <p className="text-[#64748b] italic text-xs">{f.qualifier}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── Section 5: Behavioral Intent Distribution ──────────────────── */}
              {report.intentDistribution && report.intentDistribution.totalClassified > 0 && (() => {
                const d = report.intentDistribution;
                const total = d.totalClassified || 1;
                const pct = (n: number) => Math.round((n / total) * 100);
                const segs = [
                  { label: 'HIGH',       count: d.HIGH,       color: 'bg-emerald-500' },
                  { label: 'MEDIUM',     count: d.MEDIUM,     color: 'bg-blue-500' },
                  { label: 'LOW',        count: d.LOW,        color: 'bg-slate-400' },
                  { label: 'RESEARCHER', count: d.RESEARCHER, color: 'bg-purple-500' },
                  { label: 'COMPETITOR', count: d.COMPETITOR, color: 'bg-orange-500' },
                  { label: 'BOT',        count: d.BOT,        color: 'bg-red-500' },
                ];
                let interp: string;
                if (pct(d.BOT) > 30) interp = `${pct(d.BOT)}% of traffic is bot-suspected — paid traffic skews higher. See ad spend section.`;
                else if (pct(d.COMPETITOR) > 15) interp = `${pct(d.COMPETITOR)}% of visitors classified as COMPETITOR price-shopping${d.topPageForCompetitor ? `, concentrated on ${d.topPageForCompetitor}` : ''}.`;
                else if (pct(d.LOW) > 70) interp = `${pct(d.LOW)}% of traffic is LOW intent — content traffic without a path to conversion.`;
                else interp = 'Distribution within healthy range.';
                return (
                  <>
                    <SectionHeader title="Behavioral Intent Distribution" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 mb-6">
                      <div className="flex h-8 rounded-lg overflow-hidden mb-3">
                        {segs.map(s => s.count > 0 && (
                          <div key={s.label} className={`${s.color} flex items-center justify-center`} style={{ width: `${pct(s.count)}%` }}>
                            <span className="text-[10px] text-white font-semibold px-1">{pct(s.count) >= 8 ? `${pct(s.count)}%` : ''}</span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                        {segs.map(s => (
                          <div key={s.label} className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${s.color}`} />
                            <span className="text-[10px] text-[#64748b] uppercase tracking-wider">{s.label}</span>
                            <span className="text-xs font-semibold text-[#1e293b] ml-auto">{s.count}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-[#475569] leading-relaxed border-t border-[#f1f5f9] pt-3">{interp}</p>
                    </div>
                  </>
                );
              })()}

              {/* ── Section 6: Drop-off pages — top 5 by qualified-visitor loss ─── */}
              {report.allPages && report.allPages.length > 0 && (() => {
                const showRevenue = (report.trackingHealth?.conversionEventsCount ?? 0) >= 1;
                // Spec: sort by qualified-visitor loss when conv tracking dark, else by revenue
                const sorted = [...report.allPages].sort((a, b) => b.estimatedMonthlyRevenueAtRisk - a.estimatedMonthlyRevenueAtRisk).slice(0, 5);
                const cols = showRevenue ? 6 : 5;
                return (
                  <>
                    <SectionHeader title="Drop-off Pages" icon="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] overflow-hidden mb-6">
                      <div className={`grid gap-2 px-4 py-2 bg-[#f1f5f9] text-[9px] font-bold text-[#64748b] uppercase tracking-wider`} style={{ gridTemplateColumns: `2fr 1fr 1fr 1fr 1.2fr ${showRevenue ? '1fr' : ''}` }}>
                        <span>Page</span><span>Sessions</span><span>Scroll</span><span>Exit Rate</span><span>Qualified Lost</span>{showRevenue && <span>Revenue at Risk</span>}
                      </div>
                      {sorted.map((p, i) => {
                        const qualified = report.topLeaks?.find(l => l.url === p.url)?.qualifiedVisitorsLost ?? 0;
                        return (
                          <div key={i} className={`grid gap-2 px-4 py-2.5 text-sm border-t border-[#f1f5f9]`} style={{ gridTemplateColumns: `2fr 1fr 1fr 1fr 1.2fr ${showRevenue ? '1fr' : ''}` }}>
                            <span className="font-mono text-xs text-[#0891b2] truncate">{p.url}</span>
                            <span className="text-[#334155] text-xs">{p.sessions}</span>
                            <span className="text-[#334155] text-xs">{p.avgScrollDepth ? `${p.avgScrollDepth.toFixed(0)}%` : '—'}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full inline-block w-fit ${exitRateColor(p.exitRate)}`}>{p.exitRate.toFixed(0)}%</span>
                            <span className="text-[#334155] text-xs font-semibold">{qualified}</span>
                            {showRevenue && <span className="text-xs font-semibold text-red-600">${p.estimatedMonthlyRevenueAtRisk.toLocaleString()}/mo</span>}
                          </div>
                        );
                      })}
                    </div>
                    {!showRevenue && (
                      <p className="text-[11px] text-[#94a3b8] -mt-4 mb-6 italic">Revenue at Risk column hidden — conversion tracking not firing in this period.</p>
                    )}
                  </>
                );
              })()}

              {/* ── Section 7: Paid Traffic Efficiency ────────────────────────────── */}
              <SectionHeader title="Paid Traffic Efficiency" icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              {report.paidCampaigns && report.paidCampaigns.length > 0 ? (
                <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] overflow-hidden mb-6">
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr] gap-2 px-4 py-2 bg-[#f1f5f9] text-[9px] font-bold text-[#64748b] uppercase tracking-wider">
                    <span>Campaign</span><span>Sessions</span><span>Bot</span><span>HIGH</span><span>MED</span><span>LOW</span><span>Verdict</span>
                  </div>
                  {report.paidCampaigns.slice(0, 8).map((c, i) => {
                    const verdictColor = c.verdict === 'Pure waste' ? 'text-red-700 bg-red-50' : c.verdict === 'Performing' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50';
                    return (
                      <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr] gap-2 px-4 py-2.5 text-sm border-t border-[#f1f5f9]">
                        <span className="text-xs text-[#334155] truncate" title={c.campaign}>{c.campaign}</span>
                        <span className="text-xs text-[#334155]">{c.sessions}</span>
                        <span className="text-xs text-[#334155]">{c.botFlagged}</span>
                        <span className="text-xs text-emerald-700 font-semibold">{c.highIntent}</span>
                        <span className="text-xs text-blue-700">{c.mediumIntent}</span>
                        <span className="text-xs text-[#94a3b8]">{c.lowIntent}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block w-fit ${verdictColor}`}>{c.verdict}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-4 py-3 mb-6 text-sm text-[#64748b]">
                  No paid campaigns detected. Connect Google Ads / Meta in Settings to populate.
                </div>
              )}

              {/* ── Section 8: SEO Snapshot ──────────────────────────────────────── */}
              <SectionHeader title="SEO Snapshot" icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              {report.seoSnapshot ? (
                <div className="space-y-3 mb-6">
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {[
                      { label: 'Organic Sessions', value: report.seoSnapshot.organicSessions.toLocaleString() },
                      { label: 'Total Clicks', value: report.seoSnapshot.totalClicks.toLocaleString() },
                      { label: 'Impressions', value: report.seoSnapshot.impressions.toLocaleString() },
                      { label: 'Avg CTR', value: `${report.seoSnapshot.avgCtr}%` },
                      { label: 'Avg Position', value: report.seoSnapshot.avgPosition.toFixed(1) },
                      { label: 'Keywords', value: String(report.seoSnapshot.keywordsTracked) },
                    ].map(t => (
                      <div key={t.label} className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3">
                        <p className="text-[9px] text-[#64748b] uppercase tracking-wider mb-1 truncate">{t.label}</p>
                        <p className="text-base font-black text-[#0c4a6e]">{t.value}</p>
                      </div>
                    ))}
                  </div>
                  {report.seoSnapshot.topKeywords.length > 0 && (
                    <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
                      <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 px-4 py-2 bg-[#f1f5f9] text-[9px] font-bold text-[#64748b] uppercase tracking-wider">
                        <span>Top Keywords</span><span>Position</span><span>Clicks</span><span>CTR</span>
                      </div>
                      {report.seoSnapshot.topKeywords.map((k, i) => (
                        <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 px-4 py-2 text-sm border-t border-[#f1f5f9]">
                          <span className="text-xs text-[#334155] truncate">{k.keyword}</span>
                          <span className="text-xs text-[#334155]">{k.position.toFixed(1)}</span>
                          <span className="text-xs text-[#334155]">{k.clicks}</span>
                          <span className="text-xs text-[#334155]">{(k.ctr * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(report.seoSnapshot.cwv.lcp || report.seoSnapshot.cwv.cls || report.seoSnapshot.cwv.fid) && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className={`px-3 py-1 rounded-full ${(report.seoSnapshot.cwv.lcp ?? 999) < 2500 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>LCP {report.seoSnapshot.cwv.lcp ? `${(report.seoSnapshot.cwv.lcp / 1000).toFixed(2)}s` : '—'}</span>
                      <span className={`px-3 py-1 rounded-full ${(report.seoSnapshot.cwv.cls ?? 1) < 0.1 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>CLS {report.seoSnapshot.cwv.cls ?? '—'}</span>
                      <span className={`px-3 py-1 rounded-full ${(report.seoSnapshot.cwv.fid ?? 999) < 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>FID {report.seoSnapshot.cwv.fid ? `${report.seoSnapshot.cwv.fid}ms` : '—'}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-4 py-3 mb-6 text-sm text-[#64748b]">
                  Connect Google Search Console in Settings to see SEO performance.
                </div>
              )}

              {/* ── Section 9: Recommendations (table format) ────────────────────── */}
              {report.actionItems && report.actionItems.length > 0 && (
                <>
                  <SectionHeader title={`Recommendations (${report.actionItems.length})`} icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden mb-6">
                    <div className="grid grid-cols-[40px_2fr_1fr_1.2fr] gap-3 px-4 py-2 bg-[#f1f5f9] text-[9px] font-bold text-[#64748b] uppercase tracking-wider">
                      <span>#</span><span>Action</span><span>Effort</span><span>Estimated Impact</span>
                    </div>
                    {(report.actionItems as ActionItem[]).slice(0, 8).map(r => {
                      const isExpanded = expandedAction === r.rank;
                      return (
                        <div key={r.rank} className="border-t border-[#f1f5f9]">
                          <div onClick={() => setExpandedAction(isExpanded ? null : r.rank)}
                               className="grid grid-cols-[40px_2fr_1fr_1.2fr] gap-3 px-4 py-3 text-sm cursor-pointer hover:bg-slate-50">
                            <span className="font-black text-[#0c4a6e]">{r.rank}</span>
                            <span className="text-[#1e293b] font-semibold">{r.title}</span>
                            <span className="text-xs text-[#64748b] capitalize">{r.effort}</span>
                            <span className="text-xs font-semibold text-emerald-700">{r.impact}</span>
                          </div>
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-1 bg-slate-50 border-t border-[#f1f5f9]">
                              <div className="grid md:grid-cols-2 gap-4 text-xs">
                                <div>
                                  <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Problem</p>
                                  <p className="text-[#334155] leading-relaxed">{r.problem}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Fix</p>
                                  <p className="text-[#334155] leading-relaxed">{r.fix}</p>
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

              {/* ── Section 10: Projected Outcome (conditional) ──────────────────── */}
              {(report.trackingHealth?.conversionEventsCount ?? 0) >= 1 && (report.actionItems?.length ?? 0) >= 3 && (
                <>
                  <SectionHeader title="Projected Monthly Outcome" icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden mb-6">
                    <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-[#f1f5f9] text-[9px] font-bold text-[#64748b] uppercase tracking-wider">
                      <span>Metric</span><span>Current Run Rate</span><span>After Fixes</span><span>Delta</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 px-4 py-2.5 text-sm border-t border-[#f1f5f9]">
                      <span className="text-xs text-[#334155]">Revenue at Risk</span>
                      <span className="text-xs text-red-600 font-semibold">${report.totalRevenueAtRisk.toLocaleString()}/mo</span>
                      <span className="text-xs text-emerald-600 font-semibold">~${Math.round(report.totalRevenueAtRisk * 0.4).toLocaleString()}/mo recoverable</span>
                      <span className="text-xs text-[#0c4a6e] font-semibold">{report.estimatedImpact ?? '—'}</span>
                    </div>
                  </div>
                </>
              )}

              {/* ── Section 11: Data Gaps ────────────────────────────────────────── */}
              <span id="data-gaps" />
              <SectionHeader title="Data Gaps" icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              {dataGaps ? (
                <div className="space-y-2 mb-6">
                  <p className="text-xs text-[#64748b] mb-2">
                    Programmatic checklist of what we know is missing or unreliable. Existing tools never tell you what they don&apos;t know — we do.
                  </p>
                  {dataGaps.checks.filter(c => c.severity !== 'pass').map(c => {
                    const colors = c.severity === 'fail'
                      ? { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'GAP' }
                      : { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'WARN' };
                    return (
                      <div key={c.id} className={`flex items-start gap-3 p-3 rounded-xl border ${colors.bg} ${colors.border}`}>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.text} flex-shrink-0 mt-0.5`}>{colors.label}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1e293b]">{c.label}</p>
                          <p className="text-xs text-[#475569] mt-0.5">{c.message}</p>
                        </div>
                      </div>
                    );
                  })}
                  {dataGaps.checks.filter(c => c.severity !== 'pass').length === 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
                      No data gaps detected — tracking is healthy.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-[#94a3b8] mb-6 italic">Loading data quality checks…</div>
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
