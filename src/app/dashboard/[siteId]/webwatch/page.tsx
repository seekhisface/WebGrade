'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';


function useCountUp(target: number, duration = 1800): number {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCurrent(target); clearInterval(timer); }
      else setCurrent(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return current;
}

function WatchKpiTile({ label, raw, display, sub, bg, fg, sub_c, trend, tc }: {
  label: string; raw: number; display: string; sub: string;
  bg: string; fg: string; sub_c: string; trend: number[]; tc: string;
}) {
  const animated = useCountUp(raw);
  // Reconstruct display with animated number
  let animDisplay = display;
  if (display.startsWith('$') && display.endsWith('k')) {
    animDisplay = `$${animated.toFixed(1)}k`;
  } else if (display.startsWith('$')) {
    animDisplay = `$${animated}`;
  } else if (display.endsWith('%')) {
    animDisplay = `${animated}%`;
  } else if (display.includes('/100')) {
    animDisplay = `${animated}/100`;
  } else {
    animDisplay = String(animated);
  }

  return (
    <div className={`p-4 ${bg} rounded-xl`}>
      <p className={`text-[10px] ${sub_c} uppercase tracking-wider mb-1`}>{label}</p>
      <p className={`text-lg font-bold ${fg} mb-1`}>{animDisplay}</p>
      <div className="mb-2">
        <Sparkline data={trend} color={tc} width={100} height={24} />
      </div>
      <p className={`text-[10px] ${sub_c} opacity-80`}>{sub}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WebWatch Monthly Report — NovaPulse HR  (Month 2: February 2026)
// ---------------------------------------------------------------------------

const REPORT = {
  site: 'NovaPulse HR',
  domain: 'novapulsehr.com',
  month: 'February 2026',
  reportNumber: 2,
  baselineMonth: 'December 2025',
  generatedAt: 'March 1, 2026',

  // Month-over-month headline numbers
  headline: {
    trialsThisMonth: 187,
    trialsMoM: +34,          // vs last month
    trialsVsBaseline: +61,   // vs Dec baseline
    cpaThisMonth: 148,
    cpaBaseline: 205,
    cpaChange: -27.8,        // % improvement
    totalSpend: 18600,       // LinkedIn paused, budget reallocated
    spendChange: -3400,      // saved by pausing LinkedIn
    wastedSpend: 2100,       // down from 11,100
    wastedChange: -81.1,
    intentAvg: 63,
    intentBaseline: 51,
    revenueRecovered: 38400,
  },

  executiveSummary: `February marks the first full month with all three high-priority fixes implemented. Trial starts are up 48% versus the December baseline — 187 trials vs 126. Wasted ad spend dropped from $11,100/mo to $2,100/mo after pausing LinkedIn retargeting and reallocating to Google Branded. The BambooHR landing page fix delivered the largest single lift: LCP dropped from 4.2s to 1.3s and that campaign's CVR tripled from 0.9% to 2.8%. One new issue has emerged: your /features page is seeing rising exit rates from organic traffic — we've flagged it below for action this month.`,

  // 6-month trend data for sparklines / charts
  // Months: Sep, Oct, Nov, Dec(baseline), Jan, Feb
  trends: {
    months: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
    trials:        [98,  104, 112, 126, 153, 187],
    cpa:           [248, 231, 219, 205, 172, 148],
    wastedSpend:   [9200, 9800, 10400, 11100, 4800, 2100],
    intentAvg:     [44,  46,  48,  51,  58,  63],
    spendTotal:    [19800, 20400, 21200, 22000, 19400, 18600],
    cvr:           [1.8, 1.9, 2.0, 2.1, 2.9, 3.4],
  },

  // Implementation status of prior recommendations
  implementations: [
    {
      id: 1,
      title: 'Paused LinkedIn retargeting',
      implementedDate: 'Jan 14, 2026',
      status: 'implemented',
      impact: {
        metric: 'Wasted spend',
        before: '$6,400/mo',
        after: '$0/mo',
        change: '-$6,400/mo',
        trend: 'up',
      },
      notes: 'Budget reallocated to Google Branded. Google Branded now running at 1.4x previous volume.',
    },
    {
      id: 2,
      title: 'Moved pricing tiers above the fold',
      implementedDate: 'Jan 19, 2026',
      status: 'implemented',
      impact: {
        metric: 'Scroll depth to pricing',
        before: '31%',
        after: '67%',
        change: '+36pts',
        trend: 'up',
      },
      notes: '/pricing exit rate dropped from 84% to 61%. Still above benchmark — monitoring.',
    },
    {
      id: 3,
      title: 'Fixed BambooHR landing page load time',
      implementedDate: 'Jan 22, 2026',
      status: 'implemented',
      impact: {
        metric: 'LCP (mobile)',
        before: '4.2s',
        after: '1.3s',
        change: '-2.9s',
        trend: 'up',
      },
      notes: 'CVR tripled from 0.9% → 2.8%. Biggest single lift this month. Campaign CPA dropped to $286.',
    },
    {
      id: 4,
      title: 'Fixed homepage CTA loading state',
      implementedDate: 'Jan 28, 2026',
      status: 'implemented',
      impact: {
        metric: 'Rage clicks on CTA',
        before: '47/mo',
        after: '3/mo',
        change: '-94%',
        trend: 'up',
      },
      notes: 'Trial form bundle now preloaded on idle. CTA response time <80ms.',
    },
  ],

  // Campaign performance — current month
  campaigns: [
    {
      name: 'Google Branded',
      source: 'Google / CPC',
      spend: 10800,
      spendChange: +2400,
      cpa: 118,
      cpaChange: -42,
      cvr: 5.8,
      cvrChange: +1.7,
      intentScore: 76,
      intentChange: +2,
      costPerHighIntent: 14,
      status: 'performing',
      verdict: 'Scaling well after LinkedIn budget reallocation. CPA at $118 vs $205 baseline. Volume up 40%.',
    },
    {
      name: 'BambooHR Alternative',
      source: 'Google / CPC',
      spend: 7800,
      spendChange: +600,
      cpa: 286,
      cpaChange: -514,
      cvr: 2.8,
      cvrChange: +1.9,
      intentScore: 55,
      intentChange: +4,
      costPerHighIntent: 51,
      status: 'improving',
      verdict: 'Post-load-time fix: CVR tripled. CPA down from $800 to $286. Targeting a further drop to <$200 as the page earns more Google Quality Score history.',
    },
    {
      name: 'HR Software Comparison',
      source: 'Google / CPC',
      spend: 0,
      spendChange: 0,
      cpa: 0,
      cpaChange: 0,
      cvr: 0,
      cvrChange: 0,
      intentScore: 0,
      intentChange: 0,
      costPerHighIntent: 0,
      status: 'new_opportunity',
      verdict: 'New opportunity identified by WebOpp this month. "HR software comparison" keyword cluster has 8,400 monthly searches at $3.20 CPC — your competitors are here, you are not. See WebOpp report.',
    },
  ],

  // New findings this month
  newFindings: [
    {
      id: 1,
      severity: 'high',
      module: 'BEHAVIORAL',
      isNew: true,
      title: '/features page exit rate rising — 3rd month of organic traffic degradation',
      impact: 'Estimated -18 to -24 trials/month at current trajectory',
      detail: 'Exit rate on /features climbed from 61% (Dec) to 74% (Feb). Organic sessions to this page are up 22% — Google is sending more traffic — but conversion is declining. Scroll data shows visitors are hitting the feature comparison table and leaving. The table has no pricing context and no clear CTA.',
      before: '61% exit rate · Dec baseline',
      after: '74% exit rate · Feb (3-month trend up)',
      trend: 'worsening',
      recommendation: 'Add pricing context to feature comparison table. Add "Start Free Trial" inline CTA after top 3 features.',
    },
    {
      id: 2,
      severity: 'medium',
      module: 'AD_SPEND',
      isNew: false,
      title: '/pricing exit rate improved but still above benchmark',
      impact: 'Estimated +12 additional trials/month available',
      detail: 'Post-fix improvement confirmed: exit rate down from 84% to 61%. Benchmark for B2B SaaS pricing pages is 52-55%. 9-point gap remains. Session recordings show visitors are still hesitating at the Enterprise tier — no clear pricing or "contact sales" path visible without scrolling.',
      before: '84% exit rate · Dec baseline',
      after: '61% exit rate · Feb (improving)',
      trend: 'improving',
      recommendation: 'Add "Contact Sales" CTA alongside Enterprise tier. Make annual/monthly toggle more prominent.',
    },
    {
      id: 3,
      severity: 'low',
      module: 'SEO',
      isNew: true,
      title: 'Core Web Vitals improvement: CLS score now passing on all key pages',
      impact: 'Positive ranking signal — eligible for "Good" CWV badge',
      detail: 'The BambooHR landing page fix had a positive side effect: Cumulative Layout Shift dropped from 0.18 to 0.04 (threshold: <0.1). All 4 monitored pages now pass CWV. Google Search Console shows this page moved from "Needs Improvement" to "Good" status.',
      before: 'CLS 0.18 — Needs Improvement',
      after: 'CLS 0.04 — Good',
      trend: 'improving',
      recommendation: 'No action needed. Monitor in Search Console.',
    },
  ],

  // Month-over-month behavioral shifts
  behavioralShifts: [
    { page: '/pricing',    metric: 'Exit rate',    baseline: 84, current: 61, unit: '%',   direction: 'down_good' },
    { page: '/pricing',    metric: 'Scroll depth', baseline: 31, current: 67, unit: '%',   direction: 'up_good' },
    { page: '/bamboohr-alternative', metric: 'CVR', baseline: 0.9, current: 2.8, unit: '%', direction: 'up_good' },
    { page: '/bamboohr-alternative', metric: 'LCP (mobile)', baseline: 4.2, current: 1.3, unit: 's', direction: 'down_good' },
    { page: '/',           metric: 'CTA rage clicks', baseline: 47, current: 3, unit: '/mo', direction: 'down_good' },
    { page: '/',           metric: 'Trial CVR',    baseline: 2.1, current: 3.4, unit: '%', direction: 'up_good' },
    { page: '/features',   metric: 'Exit rate',    baseline: 61, current: 74, unit: '%',   direction: 'up_bad' },
    { page: '/features',   metric: 'Organic sessions', baseline: 1840, current: 2248, unit: '/mo', direction: 'up_neutral' },
  ],

  // Spend trend for bar chart (6 months)
  spendTrend: [
    { month: 'Sep', effective: 10600, wasted: 9200 },
    { month: 'Oct', effective: 10600, wasted: 9800 },
    { month: 'Nov', effective: 10800, wasted: 10400 },
    { month: 'Dec', effective: 10900, wasted: 11100 },
    { month: 'Jan', effective: 14600, wasted: 4800 },
    { month: 'Feb', effective: 16500, wasted: 2100 },
  ],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type View = 'overview' | 'implementations' | 'findings' | 'behavioral';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SEVERITY_STYLES = {
  critical: { badge: 'bg-red-500/15 text-red-400 border-red-500/20', dot: 'bg-red-500', border: 'border-red-500/30' },
  high:     { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20', dot: 'bg-amber-500', border: 'border-amber-500/30' },
  medium:   { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/20', dot: 'bg-blue-500', border: 'border-blue-500/30' },
  low:      { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500', border: 'border-emerald-500/30' },
};

function Delta({ value, unit = '', inverse = false }: { value: number; unit?: string; inverse?: boolean }) {
  const positive = inverse ? value < 0 : value > 0;
  const color = positive ? 'text-emerald-400' : 'text-red-400';
  const sign = value > 0 ? '+' : '';
  return <span className={`text-xs font-semibold ${color}`}>{sign}{value}{unit}</span>;
}

// Simple SVG sparkline
function Sparkline({ data, color = '#6366f1', height = 32, width = 120 }: {
  data: number[]; color?: string; height?: number; width?: number;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* End dot */}
      <circle
        cx={parseFloat(pts[pts.length - 1].split(',')[0])}
        cy={parseFloat(pts[pts.length - 1].split(',')[1])}
        r="3"
        fill={color}
      />
    </svg>
  );
}

// Stacked bar chart for spend
function SpendBars({ data }: { data: typeof REPORT.spendTrend }) {
  const maxTotal = Math.max(...data.map(d => d.effective + d.wasted));
  const BAR_H = 80;
  const BAR_W = 36;
  const GAP = 14;
  const totalW = data.length * (BAR_W + GAP);

  return (
    <div>
      <svg width={totalW} height={BAR_H + 20} viewBox={`0 0 ${totalW} ${BAR_H + 20}`}>
        {data.map((d, i) => {
          const total = d.effective + d.wasted;
          const effH = (d.effective / maxTotal) * BAR_H;
          const wastH = (d.wasted / maxTotal) * BAR_H;
          const x = i * (BAR_W + GAP);
          const isLast = i === data.length - 1;
          return (
            <g key={i}>
              {/* Wasted (top, red) */}
              <rect x={x} y={BAR_H - effH - wastH} width={BAR_W} height={wastH}
                fill={isLast ? '#ef4444' : '#7f1d1d'} rx="2" />
              {/* Effective (bottom, green) */}
              <rect x={x} y={BAR_H - effH} width={BAR_W} height={effH}
                fill={isLast ? '#10b981' : '#064e3b'} rx="2" />
              {/* Month label */}
              <text x={x + BAR_W / 2} y={BAR_H + 14} textAnchor="middle"
                fill="#666" fontSize="8" fontFamily="Helvetica">
                {d.month}
              </text>
              {/* Baseline marker */}
              {i === 3 && (
                <line x1={x + BAR_W / 2} y1={0} x2={x + BAR_W / 2} y2={BAR_H}
                  stroke="#6366f1" strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 mt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40" />
          <span className="text-[10px] text-[#64748b]">Effective spend</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-500/40" />
          <span className="text-[10px] text-[#64748b]">Wasted spend</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 border-l-2 border-dashed border-indigo-400/50" />
          <span className="text-[10px] text-[#64748b]">Baseline (Dec)</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function WebWatchPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const [view, setView] = useState<View>('overview');
  const [drawer, setDrawer] = useState<{ title: string; body: string } | null>(null);

  const h = REPORT.headline;

  return (
    <div className="min-h-screen bg-[#f0f9ff]">

      {/* Page sub-header: view tabs */}
      <div className="bg-white border-b border-sky-100 px-6 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-semibold text-cyan-600 uppercase tracking-wider">WebWatch™</span>
            </div>
            <span className="text-slate-300">·</span>
            <span>{REPORT.month}</span>
            <span className="px-2 py-0.5 bg-sky-50 border border-sky-200 rounded text-[10px] text-[#64748b]">Report #{REPORT.reportNumber}</span>
          </div>
          <div className="flex items-center bg-sky-50 border border-sky-200 rounded-lg p-1 gap-1">
            {(['overview', 'implementations', 'findings', 'behavioral'] as View[]).map((v) => {
              const label = v === 'implementations' ? 'Implementations' : v === 'findings' ? 'New Findings' : v === 'behavioral' ? 'Behavioral Shifts' : 'Overview';
              return (
                <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${ view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700' }`}>
                  {label}
                  {v === 'findings' && REPORT.newFindings.filter(f => f.isNew).length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-[9px] font-bold text-white rounded">{REPORT.newFindings.filter(f => f.isNew).length}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-[#64748b]">Generated {REPORT.generatedAt}</div>
        </div>
      </div>

      {/* Report header */}
      <div className="max-w-6xl mx-auto px-6 pt-8 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xs text-[#64748b] uppercase tracking-wider mb-1">{REPORT.domain}</p>
            <h1 className="text-2xl font-bold text-[#1e293b]">{REPORT.site}</h1>
            <p className="text-sm text-[#64748b] mt-1">
              Monthly monitoring report · {REPORT.month} · Baseline: {REPORT.baselineMonth}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#64748b] mb-1">Revenue recovered this month</p>
            <p className="text-2xl font-bold text-emerald-600">${h.revenueRecovered.toLocaleString()}</p>
            <p className="text-xs text-[#64748b]">vs {REPORT.baselineMonth} baseline</p>
          </div>
        </div>

        {/* Headline KPI bar */}
        <div className="grid grid-cols-6 gap-3 mt-6">
          {[
            { label: 'Trials This Month', raw: h.trialsThisMonth, display: String(h.trialsThisMonth), sub: `+${h.trialsVsBaseline} vs ${REPORT.baselineMonth}`, bg: 'bg-[#0c4a6e]', fg: 'text-white', sub_c: 'text-sky-300', trend: REPORT.trends.trials, tc: '#7dd3fc' },
            { label: 'Cost Per Trial', raw: h.cpaThisMonth, display: `$${h.cpaThisMonth}`, sub: `${h.cpaChange}% vs ${REPORT.baselineMonth}`, bg: 'bg-[#0d9488]', fg: 'text-white', sub_c: 'text-teal-200', trend: REPORT.trends.cpa.map((v: number) => -v), tc: '#99f6e4' },
            { label: 'Total Ad Spend', raw: h.totalSpend/1000, display: `$${(h.totalSpend/1000).toFixed(1)}k`, sub: `-$${Math.abs(h.spendChange).toLocaleString()} vs ${REPORT.baselineMonth}`, bg: 'bg-[#1e40af]', fg: 'text-white', sub_c: 'text-blue-200', trend: REPORT.trends.spendTotal.map((v: number) => -v), tc: '#93c5fd' },
            { label: 'Wasted Spend', raw: h.wastedSpend/1000, display: `$${(h.wastedSpend/1000).toFixed(1)}k`, sub: `${h.wastedChange}% vs ${REPORT.baselineMonth}`, bg: 'bg-[#7c3aed]', fg: 'text-white', sub_c: 'text-violet-200', trend: REPORT.trends.wastedSpend.map((v: number) => -v), tc: '#c4b5fd' },
            { label: 'Avg Intent Score', raw: h.intentAvg, display: `${h.intentAvg}/100`, sub: `+${h.intentAvg - h.intentBaseline}pts vs ${REPORT.baselineMonth}`, bg: 'bg-[#b45309]', fg: 'text-white', sub_c: 'text-amber-200', trend: REPORT.trends.intentAvg, tc: '#fde68a' },
            { label: 'Trial CVR', raw: REPORT.trends.cvr[5], display: `${REPORT.trends.cvr[5]}%`, sub: `+${(REPORT.trends.cvr[5] - REPORT.trends.cvr[3]).toFixed(1)}pts vs ${REPORT.baselineMonth}`, bg: 'bg-[#166534]', fg: 'text-white', sub_c: 'text-green-200', trend: REPORT.trends.cvr, tc: '#86efac' },
          ].map((kpi, i) => (
            <WatchKpiTile key={i} {...kpi} />
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-16">

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        {view === 'overview' && (
          <div className="space-y-8">

            {/* Executive summary */}
            <section>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-3">Monthly Summary</p>
              <div className="p-6 bg-sky-50 border border-sky-100 rounded-2xl">
                <p className="text-sm text-slate-700 leading-relaxed">{REPORT.executiveSummary}</p>
              </div>
            </section>

            {/* Spend trend chart */}
            <section>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-3">Ad Spend — 6-Month Trend</p>
              <div className="p-5 bg-sky-50 border border-sky-100 rounded-2xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">
                      Effective spend climbing as wasted spend collapses — January marked the inflection point
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#64748b]">Wasted this month</p>
                    <p className="text-lg font-bold text-emerald-600">
                      ${h.wastedSpend.toLocaleString()}<span className="text-xs font-normal text-[#64748b]">/mo</span>
                    </p>
                    <p className="text-[10px] text-emerald-400/70">↓ ${(11100 - h.wastedSpend).toLocaleString()} from baseline</p>
                  </div>
                </div>
                <SpendBars data={REPORT.spendTrend} />
              </div>
            </section>

            {/* Trend sparklines grid */}
            <section>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-3">6-Month Performance Trends</p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Monthly Trial Starts', data: REPORT.trends.trials, color: '#10b981', unit: 'trials', baselineIdx: 3 },
                  { label: 'Cost Per Trial (CPA)', data: REPORT.trends.cpa, color: '#6366f1', unit: '$/trial', baselineIdx: 3, inverse: true },
                  { label: 'Avg Intent Score', data: REPORT.trends.intentAvg, color: '#f59e0b', unit: '/100', baselineIdx: 3 },
                ].map((chart, i) => {
                  const current = chart.data[chart.data.length - 1];
                  const baseline = chart.data[chart.baselineIdx];
                  const delta = chart.inverse
                    ? (((baseline - current) / baseline) * 100).toFixed(1)
                    : (((current - baseline) / baseline) * 100).toFixed(1);
                  const positive = parseFloat(delta) > 0;
                  return (
                    <div key={i} className="p-4 bg-sky-50 border border-sky-100 rounded-xl">
                      <p className="text-xs text-[#64748b] mb-3">{chart.label}</p>
                      <div className="flex items-end justify-between mb-3">
                        <p className="text-xl font-bold text-[#1e293b]">{current}{chart.unit}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${positive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                          {positive ? '+' : ''}{delta}% vs baseline
                        </span>
                      </div>
                      <Sparkline data={chart.data} color={chart.color} width={CONTENT_W_APPROX} height={48} />
                      <div className="flex justify-between mt-2">
                        {REPORT.trends.months.map((m, mi) => (
                          <span key={mi} className={`text-[9px] ${mi === 3 ? 'text-indigo-400 font-semibold' : 'text-slate-300'}`}>{m}</span>
                        ))}
                      </div>
                      {/* Baseline annotation */}
                      <div className="mt-2 flex items-center gap-1.5">
                        <div className="w-3 h-px bg-indigo-400/50 border-dashed border-t border-indigo-400/50" />
                        <span className="text-[9px] text-indigo-400/60">Dec baseline: {baseline}{chart.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Campaign table */}
            <section>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-3">Campaign Performance — February 2026</p>
              <div className="space-y-3">
                {REPORT.campaigns.map((c, i) => {
                  const statusConfig = {
                    performing:      { bg: 'border-emerald-500/20 bg-emerald-500/5', dot: 'bg-emerald-500', label: 'Performing', lc: 'text-emerald-400' },
                    improving:       { bg: 'border-cyan-500/20 bg-cyan-500/5', dot: 'bg-cyan-400', label: 'Improving', lc: 'text-cyan-400' },
                    new_opportunity: { bg: 'border-indigo-500/20 bg-indigo-500/5', dot: 'bg-indigo-400', label: 'Opportunity', lc: 'text-indigo-400' },
                  }[c.status] ?? { bg: 'border-sky-100 bg-sky-50', dot: 'bg-sky-500', label: '', lc: 'text-slate-400' };

                  return (
                    <div key={i} className={`p-5 border rounded-2xl ${statusConfig.bg}`}>
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusConfig.dot}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-[#1e293b]">{c.name}</p>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                c.status === 'performing' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                c.status === 'improving' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                                'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                              }`}>{statusConfig.label}</span>
                            </div>
                            <p className="text-xs text-[#64748b]">{c.source}</p>
                          </div>
                        </div>
                        {c.status !== 'new_opportunity' && (
                          <div className="flex gap-5 text-right">
                            {[
                              { label: 'Spend', value: `$${c.spend.toLocaleString()}`, delta: c.spendChange, unit: '', inverse: false, neutral: true },
                              { label: 'CPA', value: `$${c.cpa}`, delta: c.cpaChange, unit: '', inverse: true },
                              { label: 'CVR', value: `${c.cvr}%`, delta: c.cvrChange, unit: '%' },
                              { label: 'Intent', value: `${c.intentScore}/100`, delta: c.intentChange, unit: '' },
                              { label: 'Cost/HI', value: `$${c.costPerHighIntent}`, delta: 0, unit: '', neutral: true },
                            ].map((m, mi) => (
                              <div key={mi}>
                                <p className="text-[10px] text-[#64748b] mb-0.5">{m.label}</p>
                                <p className="text-sm font-semibold text-[#1e293b]">{m.value}</p>
                                {m.delta !== 0 && !m.neutral && (
                                  <Delta value={m.delta} unit={m.unit} inverse={m.inverse} />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{c.verdict}</p>
                    </div>
                  );
                })}
              </div>
            </section>

          </div>
        )}

        {/* ── IMPLEMENTATIONS ───────────────────────────────────────────────── */}
        {view === 'implementations' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Implementation Tracker</h2>
              <p className="text-sm text-slate-500">
                Status and measured impact of all prior WebWatch recommendations.
              </p>
            </div>

            {/* Summary row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Recommendations issued', value: REPORT.implementations.length, color: 'text-slate-800' },
                { label: 'Implemented', value: REPORT.implementations.filter(i => i.status === 'implemented').length, color: 'text-emerald-400' },
                { label: 'Avg time to implement', value: '8 days', color: 'text-slate-800' },
                { label: 'Combined lift', value: '+$38,400/mo', color: 'text-emerald-400' },
              ].map((s, i) => (
                <div key={i} className="p-4 bg-sky-50 border border-sky-100 rounded-xl">
                  <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Implementation cards */}
            <div className="space-y-4">
              {REPORT.implementations.map((impl) => (
                <div key={impl.id} className="border border-emerald-500/20 bg-emerald-500/3 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-400 text-xs font-bold">✓</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1e293b]">{impl.title}</p>
                        <p className="text-xs text-[#64748b]">Implemented {impl.implementedDate}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold rounded uppercase tracking-wider">
                      Confirmed Lift
                    </span>
                  </div>

                  {/* Impact comparison */}
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div className="p-3 bg-sky-50 border border-sky-100 rounded-lg">
                      <p className="text-[10px] text-[#64748b] mb-1">{impl.impact.metric}</p>
                      <p className="text-xs text-slate-500">Before</p>
                      <p className="text-sm font-semibold text-red-600">{impl.impact.before}</p>
                    </div>
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
                      <p className="text-[10px] text-[#64748b] mb-1">{impl.impact.metric}</p>
                      <p className="text-xs text-slate-500">Now</p>
                      <p className="text-sm font-semibold text-emerald-600">{impl.impact.after}</p>
                    </div>
                    <div className="p-3 bg-sky-50 border border-sky-100 rounded-lg col-span-2">
                      <p className="text-[10px] text-[#64748b] mb-1">Change</p>
                      <p className="text-lg font-bold text-emerald-600">{impl.impact.change}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">{impl.notes}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── NEW FINDINGS ──────────────────────────────────────────────────── */}
        {view === 'findings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">New Findings — {REPORT.month}</h2>
              <p className="text-sm text-slate-500">
                Issues discovered during this month's monitoring cycle. New issues are flagged separately from carry-over.
              </p>
            </div>

            <div className="space-y-4">
              {REPORT.newFindings.map((f) => {
                const sev = SEVERITY_STYLES[f.severity as keyof typeof SEVERITY_STYLES];
                const trendConfig = {
                  worsening: { color: 'text-red-400', icon: '↑', label: 'Worsening' },
                  improving: { color: 'text-emerald-400', icon: '↓', label: 'Improving' },
                  stable:    { color: 'text-slate-400', icon: '→', label: 'Stable' },
                }[f.trend] ?? { color: 'text-slate-400', icon: '→', label: '' };

                return (
                  <div key={f.id} className={`border rounded-2xl p-5 ${sev.border} bg-sky-50`}>
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${sev.dot}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded border ${sev.badge}`}>
                            {f.severity}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-medium text-[#64748b] bg-sky-50 rounded">
                            {f.module}
                          </span>
                          {f.isNew && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded uppercase">
                              New this month
                            </span>
                          )}
                          <span className={`text-xs font-semibold ${trendConfig.color}`}>
                            {trendConfig.icon} {trendConfig.label}
                          </span>
                        </div>

                        <h3 className="text-sm font-semibold text-slate-800 mb-1">{f.title}</h3>
                        <p className="text-xs text-emerald-400/80 mb-2">{f.impact}</p>
                        <p className="text-xs text-slate-500 leading-relaxed mb-3">{f.detail}</p>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                            <p className="text-[10px] text-red-400/70 font-semibold uppercase tracking-wider mb-1">Baseline / Before</p>
                            <p className="text-xs text-slate-500">{f.before}</p>
                          </div>
                          <div className={`p-3 border rounded-lg ${f.trend === 'improving' ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${f.trend === 'improving' ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                              Current — {REPORT.month}
                            </p>
                            <p className="text-xs text-slate-500">{f.after}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 p-2.5 bg-sky-50 rounded-lg">
                          <span className="text-indigo-400 text-xs mt-0.5">→</span>
                          <p className="text-xs text-indigo-300">{f.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── BEHAVIORAL SHIFTS ─────────────────────────────────────────────── */}
        {view === 'behavioral' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Behavioral Shifts</h2>
              <p className="text-sm text-slate-500">
                Page-level behavioral changes vs the {REPORT.baselineMonth} baseline.
              </p>
            </div>

            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-12 gap-2 px-4 pb-1">
                <p className="col-span-3 text-[10px] text-[#64748b] uppercase tracking-wider">Page</p>
                <p className="col-span-2 text-[10px] text-[#64748b] uppercase tracking-wider">Metric</p>
                <p className="col-span-2 text-[10px] text-[#64748b] uppercase tracking-wider">Baseline</p>
                <p className="col-span-2 text-[10px] text-[#64748b] uppercase tracking-wider">Current</p>
                <p className="col-span-2 text-[10px] text-[#64748b] uppercase tracking-wider">Change</p>
                <p className="col-span-1 text-[10px] text-[#64748b] uppercase tracking-wider">Signal</p>
              </div>

              {REPORT.behavioralShifts.map((s, i) => {
                const isGood = s.direction === 'up_good' || s.direction === 'down_good';
                const isBad = s.direction === 'up_bad' || s.direction === 'down_bad';
                const isUp = s.direction.startsWith('up');

                const rawDelta = s.current - s.baseline;
                const pctDelta = ((rawDelta / s.baseline) * 100).toFixed(1);

                const signalConfig = isGood
                  ? { bg: 'bg-emerald-500/5 border-emerald-500/15', indicator: 'bg-emerald-500', label: '↑ Better', lc: 'text-emerald-400' }
                  : isBad
                  ? { bg: 'bg-red-500/5 border-red-500/15', indicator: 'bg-red-500', label: '⚠ Action', lc: 'text-red-400' }
                  : { bg: 'bg-sky-50 border-sky-100', indicator: 'bg-sky-200', label: '→ Neutral', lc: 'text-slate-400' };

                return (
                  <div key={i} className={`grid grid-cols-12 gap-2 p-4 border rounded-xl items-center ${signalConfig.bg}`}>
                    <p className="col-span-3 text-xs font-mono text-slate-600">{s.page}</p>
                    <p className="col-span-2 text-xs text-slate-500">{s.metric}</p>
                    <p className="col-span-2 text-xs text-[#64748b]">{s.baseline}{s.unit}</p>
                    <p className="col-span-2 text-xs font-semibold text-[#1e293b]">{s.current}{s.unit}</p>
                    <div className="col-span-2">
                      <p className={`text-xs font-semibold ${isGood ? 'text-emerald-400' : isBad ? 'text-red-400' : 'text-slate-400'}`}>
                        {rawDelta > 0 ? '+' : ''}{rawDelta.toFixed(rawDelta < 1 && rawDelta > -1 ? 1 : 0)}{s.unit}
                      </p>
                      <p className="text-[10px] text-[#64748b]">{pctDelta}%</p>
                    </div>
                    <div className="col-span-1 flex items-center">
                      <div className={`w-2 h-2 rounded-full ${signalConfig.indicator}`} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-xs text-[#64748b] pt-2">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Improved vs baseline</div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /> Degraded — action recommended</div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-sky-200" /> Neutral / informational</div>
            </div>
          </div>
        )}

      </div>

      {/* Drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawer(null)} />
          <div className="relative w-full max-w-lg bg-gray-950 border-l border-sky-200 h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gray-950/95 backdrop-blur border-b border-sky-100 px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1e293b]">{drawer.title}</h3>
              <button onClick={() => setDrawer(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-6">
              <p className="text-sm text-slate-600 leading-relaxed">{drawer.body}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Approximate content width for sparkline sizing
const CONTENT_W_APPROX = 160;
