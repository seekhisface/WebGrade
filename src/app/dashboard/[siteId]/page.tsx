'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import SubscriptionBanner from '@/components/dashboard/SubscriptionBanner';
import ReportModal from '@/components/dashboard/ReportModal';
import { useSetupState } from '@/hooks/useSetupState';

// =============================================================================
// Types
// =============================================================================

type Range = '7d' | '14d' | '30d' | '60d' | '90d' | 'custom';

interface DashboardData {
  site: { id: string; name: string; domain: string; url: string };
  totalSessions: number; totalSessionsChange: number;
  avgIntentScore: number; avgIntentScoreChange: number;
  revenueAtRisk: number;
  hasRevenueData?: boolean;
  intentDistribution: Record<string, number>;
  dropOffPages: DropOffPage[];
  topPageSessions: { url: string; sessions: number } | null;
  bounceRate?: number;
  healthStatus: 'GREEN' | 'YELLOW' | 'RED';
  subscription?: {
    tier: 'WEBAUDIT' | 'WEBAUDIT_EXPIRED' | 'WEBWATCH' | 'WEBWATCH_WEBOPP';
    webauditStartDate: string | null;
    webauditEndDate: string | null;
    webwatchStartDate: string | null;
    hasWebOpp: boolean;
  };
  baselineComparison?: Record<string, { current: number; baseline: number; change: number; changePercent: number }>;
}

interface DropOffPage {
  url: string; title: string; exitRate: number;
  avgScrollDepth: number; sessions: number;
  isStorylineBreakpoint: boolean; aiExplanation?: string;
}

interface SeoData {
  site: { id: string; name: string; domain: string };
  days: number; periodStart: string; periodEnd: string;
  organicSessions: number; organicSessionsDelta: number;
  clicks: number; clicksDelta: number;
  impressions: number; impressionsDelta: number;
  ctr: number; ctrDelta: number;
  avgPosition: number; positionDelta: number;
  keywordsTop3: number; keywordsTop10: number; keywordsTop30: number; keywordsTotal: number;
  indexedPages: number; crawlErrors: number; notIndexed: number; newPagesFound: number;
  keywords: SeoKeyword[];
  cwv: { lcp: number; fid: number; cls: number; ttfb: number; pass: boolean };
  cwvPages: CwvPage[];
  crawlScores: { overall: number; technical: number; onPage: number; content: number; crawlability: number } | null;
  sparkPoints: number[];
}

interface SeoKeyword {
  keyword: string; position: number; clicks: number; impressions: number;
  ctr: number; intent: string; description: string | null; trend: string; positionDelta: number;
}

interface CwvPage {
  url: string; lcp: number | null; fid: number | null; cls: number | null;
  ttfb: number | null; mobileScore: number | null; pass: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

const PRESETS: { id: Range; label: string; days: number }[] = [
  { id: '7d', label: '7 days', days: 7 },
  { id: '14d', label: '14 days', days: 14 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '60d', label: '60 days', days: 60 },
  { id: '90d', label: '90 days', days: 90 },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function useCountUp(target: number, duration = 1600, trigger = true): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let v = 0;
    const step = target / (duration / 16);
    const t = setInterval(() => { v += step; if (v >= target) { setVal(target); clearInterval(t); } else setVal(Math.floor(v)); }, 16);
    return () => clearInterval(t);
  }, [target, duration, trigger]);
  return val;
}

// =============================================================================
// Sub-components
// =============================================================================

function HealthBadge({ status, onShowReport }: { status: 'GREEN' | 'YELLOW' | 'RED'; onShowReport?: () => void }) {
  const c = { GREEN: { bg: 'bg-[#f0fdf4]', border: 'border-[#bbf7d0]', dot: 'bg-[#0d9488]', text: 'text-[#0d9488]', label: 'Healthy' }, YELLOW: { bg: 'bg-[#fffbeb]', border: 'border-[#fde68a]', dot: 'bg-[#b45309]', text: 'text-[#b45309]', label: 'Attention needed' }, RED: { bg: 'bg-[#fef2f2]', border: 'border-[#fecaca]', dot: 'bg-[#b91c1c]', text: 'text-[#b91c1c]', label: 'Issues detected' } }[status];
  const isClickable = status !== 'GREEN' && onShowReport;
  const handleClick = () => {
    if (isClickable) {
      const el = document.getElementById('drop-off-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      else onShowReport?.();
    }
  };
  return (
    <div onClick={handleClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 ${c.bg} border ${c.border} rounded-full ${isClickable ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`} />
      <span className={`text-xs font-semibold ${c.text}`}>{c.label}</span>
      {isClickable && <span className={`text-[10px] ${c.text} ml-0.5`}>→</span>}
    </div>
  );
}

function KpiCard({ label, value, suffix, change, changeLabel, baseline, valueColor, onReportClick, bottomCta }: {
  label: string; value: string; suffix?: string; change?: number; changeLabel?: string; baseline?: string; valueColor?: string; onReportClick?: () => void;
  bottomCta?: { text: string; tooltip: string; href: string };
}) {
  const positive = (change ?? 0) >= 0;
  const changeColor = change === undefined ? '' : positive ? 'text-[#0d9488]' : Math.abs(change) > 15 ? 'text-[#b91c1c]' : 'text-[#b45309]';
  return (
    <div className="bg-[#f0fdfa]/60 border border-[#99f6e4] rounded-2xl p-5 shadow-sm">
      <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-3">{label}</p>
      <p className="text-3xl font-black mb-1" style={{ color: valueColor ?? '#0c4a6e' }}>
        {value}{suffix && <span className="text-base font-normal text-[#94a3b8] ml-1">{suffix}</span>}
      </p>
      {baseline && <p className="text-[11px] text-[#94a3b8] mb-2">{baseline}</p>}
      {change !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${changeColor}`}>
          <span>{positive ? '↑' : '↓'}</span><span>{Math.abs(change).toFixed(1)}%</span>
          <span className="text-[#94a3b8] font-normal ml-1">{changeLabel ?? 'vs baseline'}</span>
        </div>
      )}
      {onReportClick && (
        <button onClick={onReportClick} className="text-[10px] text-[#0891b2] hover:underline font-medium mt-2 inline-block">
          View in report →
        </button>
      )}
      {bottomCta && (
        <div className="mt-2 pt-2 border-t border-[#99f6e4]/50 group relative">
          <Link href={bottomCta.href} className="text-[10px] text-[#0891b2] font-semibold hover:underline">
            {bottomCta.text}
          </Link>
          <div className="absolute bottom-full left-0 mb-1 px-3 py-1.5 bg-[#0c4a6e] text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">
            {bottomCta.tooltip}
          </div>
        </div>
      )}
    </div>
  );
}

function SeoKpiCard({ label, value, delta, unit, spark, color, inverse }: {
  label: string; value: string; delta: number; unit: string; spark: number[]; color: string; inverse?: boolean;
}) {
  const positive = inverse ? delta < 0 : delta > 0;
  const deltaColor = Math.abs(delta) < 0.2 ? 'text-slate-400' : positive ? 'text-emerald-500' : 'text-red-500';
  return (
    <div className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl">
      <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1 truncate">{label}</p>
      <p className="text-lg font-bold text-[#1e293b] mb-1">{value}</p>
      <Sparkline data={spark} color={color} />
      <span className={`text-xs font-semibold ${deltaColor}`}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}{unit}</span>
      <span className="text-[10px] text-[#94a3b8] ml-1">vs prior period</span>
    </div>
  );
}

function Sparkline({ data, color = '#10b981' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const W = 100, H = 28;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-7 mb-1" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function RankBadge({ pos }: { pos: number }) {
  const color = pos <= 3 ? 'text-emerald-600 bg-emerald-50' : pos <= 10 ? 'text-cyan-600 bg-cyan-50' : pos <= 30 ? 'text-amber-600 bg-amber-50' : 'text-slate-500 bg-slate-50';
  return <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold ${color}`}>{Math.round(pos)}</span>;
}

function CwvPill({ value, good, ok, unit, label }: { value: number; good: number; ok: number; unit: string; label: string }) {
  const pass = value <= good, warn = !pass && value <= ok;
  const color = pass ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : warn ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200';
  return (
    <div className={`p-3 border rounded-xl ${color}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold mb-0.5">{value}{unit}</p>
      <p className="text-[10px] font-semibold uppercase">{pass ? 'Good' : warn ? 'Needs work' : 'Poor'}</p>
    </div>
  );
}

const INTENT_CONFIG: Record<string, { label: string; color: string }> = {
  HIGH: { label: 'High Intent', color: '#0d9488' }, MEDIUM: { label: 'Medium', color: '#b45309' },
  LOW: { label: 'Low Intent', color: '#b91c1c' }, RESEARCHER: { label: 'Researcher', color: '#7c3aed' },
  COMPETITOR: { label: 'Competitor', color: '#64748b' }, BOT: { label: 'Bot/Filtered', color: '#cbd5e1' },
};

// =============================================================================
// Main Page
// =============================================================================

export default function UnifiedDashboard({ params }: { params: { siteId: string } }) {
  const setup = useSetupState(params.siteId);
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [seoData, setSeoData] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [rangePreset, setRangePreset] = useState<Range>('30d');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [seoTab, setSeoTab] = useState<'overview' | 'keywords' | 'cwv' | 'indexing'>('overview');
  const [triggered, setTriggered] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [funnelData, setFunnelData] = useState<{ stages: { name: string; count: number; rate: number }[]; dropOffs: { from: string; to: string; dropped: number; dropRate: number }[]; abandonmentPages: { url: string; abandonments: number }[] } | null>(null);
  const kpiRef = useRef<HTMLDivElement>(null);

  const fetchAll = useCallback((d: number) => {
    setLoading(true);
    Promise.all([
      fetch(`/api/dashboard?siteId=${params.siteId}&days=${d}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/seo?siteId=${params.siteId}&days=${d}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/analytics/funnel?siteId=${params.siteId}&days=${d}`).then(r => r.ok ? r.json() : null),
    ]).then(([dash, seo, funnel]) => {
      if (dash) setDashData(dash);
      if (seo) setSeoData(seo);
      if (funnel) setFunnelData(funnel);
    }).catch(err => console.error('[dashboard] Failed:', err))
      .finally(() => setLoading(false));
  }, [params.siteId]);

  useEffect(() => { fetchAll(days); }, [days, fetchAll]);

  useEffect(() => {
    if (!kpiRef.current || loading) return;
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setTriggered(true); }, { threshold: 0.3 });
    observer.observe(kpiRef.current);
    return () => observer.disconnect();
  }, [loading]);

  const sessions = useCountUp(dashData?.totalSessions ?? 0, 1600, triggered);
  const intentScore = useCountUp(dashData?.avgIntentScore ?? 0, 1400, triggered);
  const revenueRisk = useCountUp(dashData?.revenueAtRisk ?? 0, 1800, triggered);

  function applyPreset(p: typeof PRESETS[number]) { setDays(p.days); setRangePreset(p.id); setPickerOpen(false); setShowCustom(false); }
  function applyCustomRange() {
    if (!customStart || !customEnd) return;
    const start = new Date(customStart);
    const end = new Date(customEnd);
    const diff = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
    setDays(diff);
    setRangePreset('custom');
    setPickerOpen(false);
    setShowCustom(false);
  }

  if (setup.loading || loading) {
    return (
      <div className="min-h-screen bg-[#f0f9ff]">
        <div className="px-6 py-8 max-w-7xl mx-auto animate-pulse">
          <div className="h-8 w-64 bg-[#bae6fd] rounded-lg mb-8" />
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-white border border-[#bae6fd] rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const D = dashData;
  const S = seoData;

  return (
    <div className="min-h-screen bg-[#f0f9ff]">

      {/* ── SUB-HEADER: Title + Date Picker + Report Archive ── */}
      <div className="bg-white border-b border-[#e0f2fe] px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-[#0c4a6e]">Dashboard</h1>
            {D && <HealthBadge status={D.healthStatus} onShowReport={() => setShowReport(true)} />}
            {D && <span className="text-sm text-[#64748b]">{D.site.domain}</span>}
          </div>
          <div className="flex items-center gap-3">
            {/* Date range picker */}
            <div className="relative">
              {(() => {
                const endDate = new Date();
                const startDate = new Date(endDate.getTime() - days * 86400000);
                const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <button onClick={() => setPickerOpen(o => !o)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#f0f9ff] border border-[#bae6fd] hover:border-[#7dd3fc] rounded-lg text-xs text-[#334155] transition-all">
                    <svg className="w-3.5 h-3.5 text-[#64748b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {fmtShort(startDate)} – {fmtShort(endDate)}
                    <svg className={`w-3 h-3 text-[#64748b] transition-transform ${pickerOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                );
              })()}
              {pickerOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => { setPickerOpen(false); setShowCustom(false); }} />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-[#bae6fd] rounded-xl shadow-xl z-50 overflow-hidden p-1">
                    {PRESETS.map(p => (
                      <button key={p.id} onClick={() => applyPreset(p)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${rangePreset === p.id ? 'bg-[#e0f2fe] text-[#0c4a6e] font-semibold' : 'text-[#64748b] hover:bg-[#f0f9ff]'}`}>
                        Last {p.days} days
                      </button>
                    ))}
                    <div className="border-t border-[#e0f2fe] mt-1 pt-1">
                      <button onClick={() => setShowCustom(c => !c)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${rangePreset === 'custom' ? 'bg-[#e0f2fe] text-[#0c4a6e] font-semibold' : 'text-[#0891b2] hover:bg-[#f0f9ff] font-medium'}`}>
                        Custom range…
                      </button>
                      {showCustom && (
                        <div className="px-3 py-2 space-y-2">
                          <div>
                            <label className="text-[10px] text-[#64748b] uppercase font-bold">Start</label>
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                              className="w-full mt-0.5 px-2 py-1 border border-[#bae6fd] rounded-lg text-xs text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#0891b2]" />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#64748b] uppercase font-bold">End</label>
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                              className="w-full mt-0.5 px-2 py-1 border border-[#bae6fd] rounded-lg text-xs text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#0891b2]" />
                          </div>
                          <button onClick={applyCustomRange} disabled={!customStart || !customEnd}
                            className="w-full px-3 py-1.5 bg-[#0c4a6e] text-white text-xs font-semibold rounded-lg hover:bg-[#075985] disabled:opacity-40 transition-colors">
                            Apply
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* View Report button */}
            <button onClick={() => setShowReport(true)}
              className="px-4 py-1.5 bg-[#0c4a6e] hover:bg-[#075985] text-white text-xs font-bold rounded-lg transition-colors">
              View Report →
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Subscription Banner ── */}
        {D?.subscription && (
          <SubscriptionBanner
            tier={D.subscription.tier}
            webauditStartDate={D.subscription.webauditStartDate}
            webauditEndDate={D.subscription.webauditEndDate}
            webwatchStartDate={D.subscription.webwatchStartDate}
            hasWebOpp={D.subscription.hasWebOpp}
            viewingDays={days}
          />
        )}

        {/* ── SECTION 1: Hero KPI Cards ── */}
        <div ref={kpiRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Sessions" value={sessions.toLocaleString()} change={D?.totalSessionsChange} baseline=""
            valueColor="#0c4a6e" onReportClick={() => setShowReport(true)} />
          <KpiCard label="Avg Intent Score" value={String(intentScore)} suffix="/100" change={D?.avgIntentScoreChange} baseline=""
            valueColor={intentScore >= 70 ? '#0d9488' : intentScore >= 40 ? '#b45309' : '#dc2626'}
            onReportClick={() => setShowReport(true)} />
          <KpiCard
            label={D?.hasRevenueData ? 'Revenue at Risk' : 'Disengaged Leads'}
            value={D?.hasRevenueData ? `$${revenueRisk.toLocaleString()}` : revenueRisk.toLocaleString()}
            suffix={D?.hasRevenueData ? '/mo' : 'visitors'}
            change={D?.baselineComparison?.revenue_at_risk?.changePercent} changeLabel="vs baseline" baseline=""
            valueColor={D?.hasRevenueData ? (revenueRisk > 30000 ? '#dc2626' : revenueRisk > 10000 ? '#b45309' : '#0c4a6e') : '#b45309'}
            onReportClick={() => setShowReport(true)}
            bottomCta={!D?.hasRevenueData ? { text: 'Revenue questionnaire?', tooltip: 'Answer a few questions so we can translate to lost revenue for you', href: `/onboarding?siteId=${params.siteId}&step=revenue` } : undefined} />
          <KpiCard label="Bounce Rate" value={D?.bounceRate != null ? `${D.bounceRate.toFixed(1)}%` : '—'} change={D?.baselineComparison?.bounce_rate?.changePercent} changeLabel="vs baseline" baseline=""
            valueColor={D?.bounceRate != null && D.bounceRate > 65 ? '#dc2626' : D?.bounceRate != null && D.bounceRate > 45 ? '#b45309' : '#0d9488'}
            onReportClick={() => setShowReport(true)} />
        </div>

        {/* ── SECTION 2: Live SEO KPIs ── */}
        {S && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-black text-[#0c4a6e]">SEO Performance</h2>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
                  <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Live</span>
                </div>
              </div>
              <div className="flex items-center bg-[#f0f9ff] border border-[#bae6fd] rounded-lg p-1 gap-1">
                {(['overview', 'keywords', 'cwv', 'indexing'] as const).map(t => (
                  <button key={t} onClick={() => setSeoTab(t)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${seoTab === t ? 'bg-white text-[#0c4a6e] shadow-sm' : 'text-[#64748b] hover:text-[#334155]'}`}>
                    {t === 'cwv' ? 'Web Vitals' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {seoTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  {[
                    { label: 'Organic Sessions', value: S.organicSessions.toLocaleString(), delta: S.organicSessionsDelta, unit: '%', spark: S.sparkPoints, color: '#10b981' },
                    { label: 'Total Clicks', value: S.clicks.toLocaleString(), delta: S.clicksDelta, unit: '%', spark: S.sparkPoints.map(v => Math.round(v * 0.9)), color: '#6366f1' },
                    { label: 'Impressions', value: S.impressions.toLocaleString(), delta: S.impressionsDelta, unit: '%', spark: S.sparkPoints.map(v => Math.round(v * 1.4)), color: '#6366f1' },
                    { label: 'Avg CTR', value: `${S.ctr}%`, delta: S.ctrDelta, unit: '%', spark: S.sparkPoints.map(v => v * 0.04 + 1), color: '#f59e0b' },
                    { label: 'Avg Position', value: S.avgPosition.toFixed(1), delta: S.positionDelta, unit: '', spark: S.sparkPoints.map(v => 25 - v * 0.12), color: '#06b6d4', inverse: true },
                    { label: 'Keywords', value: S.keywordsTotal.toString(), delta: 0, unit: '', spark: S.sparkPoints.map(v => Math.round(v * 0.6 + 20)), color: '#a78bfa' },
                  ].map((kpi, i) => <SeoKpiCard key={i} {...kpi} />)}
                </div>

                {/* CWV banner */}
                <div className={`p-4 border rounded-xl flex items-center justify-between ${S.cwv.pass ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{S.cwv.pass ? '✓' : '⚠'}</span>
                    <div>
                      <p className="text-sm font-semibold text-[#1e293b]">Core Web Vitals — {S.cwv.pass ? 'All passing' : 'Needs attention'}</p>
                      <p className="text-xs text-[#64748b]">LCP {S.cwv.lcp}s · CLS {S.cwv.cls} · FID {S.cwv.fid}ms</p>
                    </div>
                  </div>
                  <button onClick={() => setSeoTab('cwv')} className="text-xs text-[#0891b2] hover:underline">View details →</button>
                </div>

                {/* Top keywords preview */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Top Keywords</p>
                    <button onClick={() => setSeoTab('keywords')} className="text-xs text-[#0891b2] hover:underline">View all {S.keywords.length} →</button>
                  </div>
                  <div className="space-y-1.5">
                    {S.keywords.slice(0, 5).map((kw, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl">
                        <RankBadge pos={kw.position} />
                        <span className="text-xs font-mono text-[#334155] flex-1">{kw.keyword}</span>
                        <div className="flex gap-4 text-xs text-right">
                          <div><p className="text-[10px] text-[#94a3b8]">Clicks</p><p className="font-semibold text-[#1e293b]">{kw.clicks.toLocaleString()}</p></div>
                          <div><p className="text-[10px] text-[#94a3b8]">CTR</p><p className="text-[#64748b]">{kw.ctr}%</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ranking distribution */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Top 3', value: S.keywordsTop3, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
                    { label: 'Top 10', value: S.keywordsTop10, color: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-200' },
                    { label: 'Top 30', value: S.keywordsTop30, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
                    { label: 'Total', value: S.keywordsTotal, color: 'text-[#0c4a6e]', bg: 'bg-[#f0f9ff] border-[#bae6fd]' },
                  ].map((r, i) => (
                    <div key={i} className={`p-4 border rounded-xl ${r.bg}`}>
                      <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">{r.label}</p>
                      <p className={`text-2xl font-bold ${r.color}`}>{r.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {seoTab === 'keywords' && (
              S.keywords.length > 0 ? (
                <div className="bg-white border border-[#bae6fd] rounded-2xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#f0f9ff] border-b border-[#e0f2fe] text-[#64748b]">
                        <th className="text-left p-3 font-medium">Keyword</th>
                        <th className="text-center p-3 font-medium w-16">Rank</th>
                        <th className="text-right p-3 font-medium">Clicks</th>
                        <th className="text-right p-3 font-medium">Impressions</th>
                        <th className="text-right p-3 font-medium">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {S.keywords.map((kw, i) => (
                        <tr key={i} className="border-b border-[#f1f5f9]">
                          <td className="p-3 font-mono text-[#334155]">{kw.keyword}</td>
                          <td className="p-3 text-center"><RankBadge pos={kw.position} /></td>
                          <td className="p-3 text-right font-medium text-[#1e293b]">{kw.clicks.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#64748b]">{kw.impressions.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#64748b]">{kw.ctr}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-white border border-[#bae6fd] rounded-2xl p-8 text-center">
                  <svg className="w-10 h-10 text-[#bae6fd] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <p className="text-sm font-semibold text-[#1e293b] mb-1">No keyword rankings found</p>
                  <p className="text-xs text-[#64748b] mb-3">Keyword tracking requires Google Search Console to be connected.</p>
                  <Link href={`/dashboard/${params.siteId}/settings`} className="text-xs text-[#0891b2] font-semibold hover:underline">
                    Connect Google Search Console →
                  </Link>
                </div>
              )
            )}

            {seoTab === 'cwv' && (
              <div className="space-y-6">
                <div className="grid grid-cols-4 gap-3">
                  <CwvPill value={S.cwv.lcp} good={2.5} ok={4.0} unit="s" label="LCP" />
                  <CwvPill value={S.cwv.fid} good={100} ok={300} unit="ms" label="FID" />
                  <CwvPill value={S.cwv.cls} good={0.1} ok={0.25} unit="" label="CLS" />
                  <CwvPill value={S.cwv.ttfb} good={800} ok={1800} unit="ms" label="TTFB" />
                </div>
                {S.cwvPages.length > 0 && (
                  <div className="bg-white border border-[#bae6fd] rounded-2xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-[#f0f9ff] border-b border-[#e0f2fe] text-[#64748b]">
                        <th className="text-left p-3">Page</th><th className="text-right p-3">LCP</th><th className="text-right p-3">CLS</th><th className="text-right p-3">FID</th><th className="text-center p-3">Status</th>
                      </tr></thead>
                      <tbody>
                        {S.cwvPages.map((p, i) => (
                          <tr key={i} className="border-b border-[#f1f5f9]">
                            <td className="p-3 font-mono text-[#64748b]">{p.url}</td>
                            <td className={`p-3 text-right font-medium ${(p.lcp ?? 99) < 2.5 ? 'text-emerald-600' : (p.lcp ?? 99) < 4 ? 'text-amber-600' : 'text-red-600'}`}>{p.lcp}s</td>
                            <td className={`p-3 text-right ${(p.cls ?? 99) < 0.1 ? 'text-emerald-600' : 'text-amber-600'}`}>{p.cls}</td>
                            <td className={`p-3 text-right ${(p.fid ?? 999) < 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{p.fid}ms</td>
                            <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${p.pass ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{p.pass ? 'Good' : 'Needs work'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {seoTab === 'indexing' && (
              <div className="space-y-4">
                {/* Alert when indexing is low */}
                {S.indexedPages === 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="text-red-500 mt-0.5">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-red-800 mb-1">No pages indexed by Google</p>
                        <p className="text-xs text-red-700 leading-relaxed mb-2">Google hasn&apos;t indexed any pages yet. This means your site won&apos;t appear in search results. Common causes:</p>
                        <ul className="text-xs text-red-700 space-y-1 mb-3 list-disc pl-4">
                          <li>Site is too new and hasn&apos;t been crawled yet</li>
                          <li>robots.txt is blocking Googlebot</li>
                          <li>Pages have <code className="bg-red-100 px-1 rounded">noindex</code> meta tags</li>
                          <li>No sitemap submitted to Google Search Console</li>
                          <li>Domain verification not completed in GSC</li>
                        </ul>
                        <button onClick={() => setShowReport(true)}
                          className="text-xs font-semibold text-red-700 hover:text-red-900 underline">
                          View SEO findings in report →
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {S.indexedPages > 0 && S.notIndexed > S.indexedPages && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center gap-3">
                    <span className="text-amber-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" /></svg></span>
                    <p className="text-xs text-amber-800 flex-1"><strong>{S.notIndexed} pages not indexed</strong> — more pages are excluded than included. <button onClick={() => setShowReport(true)} className="text-amber-700 underline font-semibold">See recommendations →</button></p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-white border border-[#bae6fd] rounded-2xl">
                  <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-4">Page Indexing</p>
                  <div className="space-y-3">
                    {[
                      { label: 'Indexed', value: S.indexedPages, color: 'text-emerald-600', bar: 'bg-emerald-500' },
                      { label: 'Not indexed', value: S.notIndexed, color: S.notIndexed > 8 ? 'text-amber-600' : 'text-[#64748b]', bar: 'bg-amber-500' },
                      { label: 'Crawl errors', value: S.crawlErrors, color: S.crawlErrors > 0 ? 'text-red-600' : 'text-[#64748b]', bar: 'bg-red-500' },
                    ].map((s, i) => (
                      <div key={i}>
                        <div className="flex justify-between mb-1"><span className="text-xs text-[#64748b]">{s.label}</span><span className={`text-sm font-bold ${s.color}`}>{s.value}</span></div>
                        <div className="h-1.5 bg-[#f0f9ff] rounded-full overflow-hidden"><div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(100, (s.value / (S.indexedPages + S.notIndexed || 1)) * 100)}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
                {S.crawlScores && (
                  <div className="p-5 bg-white border border-[#bae6fd] rounded-2xl">
                    <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-4">Crawl Scores</p>
                    <div className="space-y-3">
                      {[
                        { label: 'Overall', value: S.crawlScores.overall, color: 'bg-indigo-500' },
                        { label: 'Technical', value: S.crawlScores.technical, color: 'bg-cyan-500' },
                        { label: 'On-Page', value: S.crawlScores.onPage, color: 'bg-emerald-500' },
                        { label: 'Content', value: S.crawlScores.content, color: 'bg-amber-500' },
                        { label: 'Crawlability', value: S.crawlScores.crawlability, color: 'bg-violet-500' },
                      ].map((s, i) => (
                        <div key={i}>
                          <div className="flex justify-between mb-1"><span className="text-xs text-[#64748b]">{s.label}</span><span className="text-sm font-bold text-[#1e293b]">{s.value}/100</span></div>
                          <div className="h-1.5 bg-[#f0f9ff] rounded-full overflow-hidden"><div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.value}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 3: Behavioral Intent Breakdown ── */}
        {D && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 bg-[#f0fdfa]/60 rounded-2xl border border-[#99f6e4] p-6 shadow-sm">
              <h2 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-5">Intent Distribution</h2>
              <div className="space-y-3">
                {Object.entries(D.intentDistribution).map(([key, pct]) => {
                  const cfg = INTENT_CONFIG[key];
                  if (!cfg) return null;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                      <div className="flex-1">
                        <div className="flex justify-between mb-1"><span className="text-xs text-[#334155]">{cfg.label}</span><span className="text-xs font-bold text-[#1e293b]">{pct}%</span></div>
                        <div className="h-1.5 bg-[#f0f9ff] rounded-full overflow-hidden border border-[#e0f2fe]"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: cfg.color }} /></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── SECTION 4: Drop-Off Analysis ── */}
            <div id="drop-off-section" className="lg:col-span-3 bg-[#f0fdfa]/60 rounded-2xl border border-[#99f6e4] p-6 shadow-sm">
              <h2 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-5">Drop-off Analysis</h2>
              <div className="space-y-3">
                {D.dropOffPages.length > 0 ? D.dropOffPages.map(page => {
                  const sev = page.exitRate >= 60 ? 'RED' : page.exitRate >= 40 ? 'YELLOW' : 'GREEN';
                  const sevStyle = { RED: 'text-[#b91c1c] bg-[#fef2f2] border-[#fecaca]', YELLOW: 'text-[#b45309] bg-[#fffbeb] border-[#fde68a]', GREEN: 'text-[#0d9488] bg-[#f0fdf4] border-[#bbf7d0]' }[sev];
                  return (
                    <div key={page.url} className="border border-[#bae6fd] rounded-xl overflow-hidden">
                      <button onClick={() => setExpanded(expanded === page.url ? null : page.url)} className="w-full flex items-center gap-4 p-4 hover:bg-[#f0f9ff] transition-colors text-left">
                        <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-xs font-black ${sevStyle}`}>{page.exitRate}% exit</div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-bold text-[#1e293b] truncate block">{page.title}</span>
                          <span className="text-xs text-[#64748b]">{page.url}</span>
                        </div>
                        <div className="text-right flex-shrink-0"><p className="text-xs text-[#64748b]">Scroll</p><p className="text-sm font-bold text-[#1e293b]">{page.avgScrollDepth}%</p></div>
                      </button>
                      {expanded === page.url && (
                        <div className="px-4 pb-4 border-t border-[#e0f2fe]">
                          <div className="mt-3 p-4 bg-[#f0f9ff] border border-[#bae6fd] rounded-xl">
                            <div className="flex items-center gap-2 mb-2"><div className="w-5 h-5 bg-[#0c4a6e] rounded flex items-center justify-center"><span className="text-white text-[9px] font-black">AI</span></div><span className="text-xs font-bold text-[#0c4a6e]">WebGrade Analysis</span></div>
                            {page.aiExplanation ? (
                              <p className="text-sm text-[#334155] leading-relaxed">{page.aiExplanation}</p>
                            ) : (
                              <p className="text-sm text-[#94a3b8] italic">More traffic data needed for AI analysis. Check back after additional sessions are recorded on this page.</p>
                            )}
                          </div>
                          <button onClick={() => setShowReport(true)} className="text-[10px] text-[#0891b2] font-semibold hover:underline mt-2 inline-block">
                            View full findings in report →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }) : (
                  <div className="px-4 py-8 text-center">
                    <svg className="w-10 h-10 text-[#bae6fd] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                    <p className="text-sm font-semibold text-[#1e293b] mb-1">Gathering drop-off data</p>
                    <p className="text-xs text-[#64748b] mb-3">Analysis activates once pages reach 10+ unique sessions. Keep your tracking snippet installed — data is being collected.</p>
                    <Link href={`/dashboard/${params.siteId}/snippet`} className="text-xs text-[#0891b2] font-semibold hover:underline">
                      Check snippet installation →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 5: Funnel Abandonment ── */}
        {funnelData && funnelData.stages[0].count > 0 && (
          <div className="bg-[#f0fdfa]/60 rounded-2xl border border-[#99f6e4] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Conversion Funnel</h2>
              <button onClick={() => setShowReport(true)} className="text-[10px] text-[#0891b2] font-semibold hover:underline">View in report →</button>
            </div>

            {/* Funnel bars */}
            <div className="space-y-2.5 mb-5">
              {funnelData.stages.map((stage, i) => {
                const barColor = i === 0 ? 'bg-[#0c4a6e]' : i === funnelData.stages.length - 1 ? 'bg-[#0d9488]' : 'bg-[#0891b2]';
                return (
                  <div key={stage.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-[#1e293b]">{stage.name}</span>
                      <span className="text-xs text-[#64748b]">{stage.count.toLocaleString()} <span className="text-[#94a3b8]">({stage.rate}%)</span></span>
                    </div>
                    <div className="h-2 bg-[#e0f2fe] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${stage.rate}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Drop-off highlights */}
            {funnelData.dropOffs.filter(d => d.dropRate > 30).length > 0 && (
              <div className="bg-[#fffbeb] border border-[#fde68a] rounded-xl px-4 py-3 mb-4">
                <p className="text-xs font-bold text-[#92400e] mb-2">Biggest drop-offs</p>
                <div className="space-y-1.5">
                  {funnelData.dropOffs.filter(d => d.dropRate > 30).map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-[#92400e]">{d.from} → {d.to}</span>
                      <span className="font-bold text-[#b45309]">{d.dropRate}% lost ({d.dropped.toLocaleString()} visitors)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top abandonment pages */}
            {funnelData.abandonmentPages.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-2">Pages with form abandonment</p>
                <div className="space-y-1">
                  {funnelData.abandonmentPages.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-[#e0f2fe] last:border-0">
                      <span className="font-mono text-[#0891b2] truncate">{p.url}</span>
                      <span className="text-[#b45309] font-semibold flex-shrink-0 ml-3">{p.abandonments} abandoned</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {funnelData.stages.every(s => s.count === 0 || s === funnelData.stages[0]) && (
              <div className="text-center py-4">
                <p className="text-xs text-[#64748b]">Form and CTA tracking is active. Data will appear as visitors interact with your site.</p>
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 6: Revenue at Risk CTA ── */}
        {D && D.revenueAtRisk > 0 && (
          <div className="p-5 bg-[#f0fdfa]/60 border border-[#99f6e4] rounded-2xl shadow-sm flex items-center justify-between gap-6 flex-wrap">
            <div>
              <p className="text-xs font-bold text-[#b91c1c] uppercase tracking-wider mb-1">Revenue at Risk</p>
              <p className="text-sm text-[#334155]">
                WebGrade has identified <strong className="text-[#0c4a6e]">${D.revenueAtRisk.toLocaleString()}/mo</strong> in recoverable revenue across your behavioral data, ad spend, and SEO profile.
              </p>
            </div>
            <Link href={`/dashboard/${params.siteId}/report`} className="flex-shrink-0 px-5 py-2.5 bg-[#0c4a6e] hover:bg-[#075985] text-white text-sm font-bold rounded-xl transition-colors shadow-sm">
              See action plan →
            </Link>
          </div>
        )}

        {/* ── SECTION 6: WebOpp CTA (if not subscribed) ── */}
        <div className="p-5 bg-[#f5f3ff] border border-[#ddd6fe] rounded-2xl flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-3">
            <span className="text-[#7c3aed] text-lg mt-0.5">◆</span>
            <div>
              <p className="text-sm font-bold text-[#1e293b] mb-1">See what your competitors are capturing</p>
              <p className="text-xs text-[#64748b]">WebOpp™ maps keyword gaps, competitor rankings, and untapped market demand — starting at $199/mo.</p>
            </div>
          </div>
          <Link href={`/dashboard/${params.siteId}/webopp`} className="flex-shrink-0 px-5 py-2.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-bold rounded-xl transition-colors shadow-sm">
            Explore WebOpp™ →
          </Link>
        </div>

      </div>

      {/* Report Modal */}
      {showReport && (
        <ReportModal siteId={params.siteId} days={days} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
