'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
// ---------------------------------------------------------------------------
// Live SEO Dashboard — NovaPulse HR
// Date range drives all metrics via a deterministic seed multiplier
// ---------------------------------------------------------------------------

type Range = '7d' | '14d' | '30d' | '60d' | '90d' | 'custom';

interface DateRange {
  preset: Range;
  from: string;
  to: string;
}

const TODAY = '2026-03-11';

const PRESETS: { id: Range; label: string; days: number }[] = [
  { id: '7d',  label: 'Last 7 days',   days: 7  },
  { id: '14d', label: 'Last 14 days',  days: 14 },
  { id: '30d', label: 'Last 30 days',  days: 30 },
  { id: '60d', label: 'Last 60 days',  days: 60 },
  { id: '90d', label: 'Last 90 days',  days: 90 },
];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Deterministic "random" based on seed — gives stable but varying numbers
function seeded(seed: number, min: number, max: number, decimals = 0) {
  const val = min + ((Math.sin(seed) * 0.5 + 0.5) * (max - min));
  return parseFloat(val.toFixed(decimals));
}

// ---------------------------------------------------------------------------
// Generate all metrics from a date range
// Longer ranges → more sessions, better ranking trends, more crawl data
// ---------------------------------------------------------------------------
function computeMetrics(days: number, fromDate: string) {
  const seed = days + new Date(fromDate).getDate();

  // Core Web Vitals — vary slightly by range
  const lcp  = seeded(seed * 1.1, 1.1, 2.8, 1);
  const fid  = seeded(seed * 2.3, 8,   45,  0);
  const cls  = seeded(seed * 0.7, 0.02, 0.14, 2);
  const ttfb = seeded(seed * 3.1, 180,  620,  0);

  const cwvPass = lcp < 2.5 && fid < 100 && cls < 0.1;

  // Traffic
  const baseSessions = Math.round(days * seeded(seed * 1.4, 62, 94, 0));
  const organicSessions = Math.round(baseSessions * seeded(seed * 0.9, 0.52, 0.71, 2));
  const organicPct = Math.round((organicSessions / baseSessions) * 100);
  const clicks = Math.round(organicSessions * seeded(seed * 1.7, 0.8, 1.3, 2));
  const impressions = Math.round(clicks * seeded(seed * 2.2, 18, 34, 0));
  const ctr = seeded(seed * 3.3, 2.1, 5.8, 1);
  const avgPosition = seeded(seed * 1.9, 8.2, 22.4, 1);

  // Indexed pages
  const indexedPages  = Math.round(seeded(seed * 4.1, 38, 72, 0));
  const crawlErrors   = Math.round(seeded(seed * 2.8, 0, 7, 0));
  const notIndexed    = Math.round(seeded(seed * 3.7, 4, 18, 0));
  const newPagesFound = Math.round(seeded(seed * 1.2, 0, 4, 0));

  // Keyword rankings
  const top3  = Math.round(seeded(seed * 2.1, 1, 5, 0));
  const top10 = Math.round(seeded(seed * 3.5, 4, 12, 0));
  const top30 = Math.round(seeded(seed * 1.8, 8, 22, 0));
  const rankingKeywords = top3 + top10 + top30 + Math.round(seeded(seed * 4.4, 30, 80, 0));

  // MoM deltas — longer ranges show more movement
  const factor = Math.min(days / 30, 2);
  const sessionsDelta = seeded(seed * 5.1, -8, 28, 1) * factor;
  const clicksDelta   = seeded(seed * 6.2, -12, 32, 1) * factor;
  const positionDelta = seeded(seed * 2.9, -3.1, 1.8, 1); // negative = improvement

  // Top keyword table
  const KEYWORDS = [
    { kw: 'hr software for small business',  basePos: 4,  baseClicks: 312, intent: 'Commercial', desc: 'High-intent buyers comparing HR tools for SMBs. Visitors arriving via this keyword convert at 3.4×–4.2× the site average — your highest-ROI organic keyword.' },
    { kw: 'bamboohr alternative',             basePos: 6,  baseClicks: 187, intent: 'Commercial', desc: 'Competitor-switching keyword. These visitors are already sold on the category and actively evaluating alternatives — bottom-of-funnel, high close rate.' },
    { kw: 'employee management software',     basePos: 9,  baseClicks: 143, intent: 'Commercial', desc: 'Broad category keyword. High volume, moderate intent. Visitors are early-to-mid funnel. Best converted via a comparison or feature-focused landing page.' },
    { kw: 'hr onboarding software',           basePos: 12, baseClicks: 98,  intent: 'Commercial', desc: 'Feature-specific keyword targeting buyers who need onboarding functionality. Strong product-market fit signal — these visitors want what you have.' },
    { kw: 'hr management system mid-market',  basePos: 15, baseClicks: 76,  intent: 'Commercial', desc: 'Segment-qualified keyword. "Mid-market" signals budget and scale. Visitors using this query are pre-qualified for your ICP — worth a dedicated landing page.' },
    { kw: 'novapulse hr',                     basePos: 1,  baseClicks: 241, intent: 'Navigational', desc: 'Branded keyword — people searching directly for you. Position 1. No action needed. This traffic converts at the highest rate of any keyword.' },
    { kw: 'hr software 100 employees',        basePos: 22, baseClicks: 44,  intent: 'Informational', desc: 'Long-tail keyword with strong ICP signal. Ranking #22 means low click share — a content piece targeting this specific segment could move it to page 1.' },
    { kw: 'hris software comparison',         basePos: 31, baseClicks: 18,  intent: 'Commercial', desc: 'High-value comparison keyword currently off page 1. Competitors rank #2–7 here. A comparison landing page could recover 80–120 additional clicks/month.' },
  ].map((k, i) => {
    const posShift = seeded(seed * (i + 1) * 1.3, -4, 3, 0);
    const pos = Math.max(1, k.basePos + posShift);
    const clickScale = seeded(seed * (i + 1) * 2.1, 0.6, 1.5, 2);
    const kClicks = Math.round(k.baseClicks * (days / 30) * clickScale);
    const kImpr   = Math.round(kClicks * seeded(seed * i * 3, 12, 28, 0));
    const kCtr    = seeded(seed * i * 1.7, 1.8, 8.2, 1);
    const trend   = posShift < -1 ? 'up' : posShift > 1 ? 'down' : 'flat';
    return { ...k, pos, clicks: kClicks, impressions: kImpr, ctr: kCtr, trend, posShift };
  }).sort((a, b) => a.pos - b.pos);

  // Hourly traffic for sparkline (last 14 days of buckets, scaled to range)
  const sparkPoints = Array.from({ length: 14 }, (_, i) => {
    const v = seeded(seed * (i + 7) * 1.1, 20, 140, 0);
    return Math.round(v * (days / 30));
  });

  // Page CWV breakdown
  const pages = [
    { url: '/',                    lcp: lcp,               cls: cls,          fid: fid },
    { url: '/pricing',             lcp: seeded(seed*1.5,1.0,3.2,1), cls: seeded(seed*2.1,0.01,0.18,2), fid: seeded(seed*3.2,5,60,0) },
    { url: '/bamboohr-alternative',lcp: 1.3,               cls: 0.04,         fid: 12 },
    { url: '/features',            lcp: seeded(seed*2.3,1.4,3.8,1), cls: seeded(seed*1.7,0.02,0.22,2), fid: seeded(seed*2.8,8,80,0) },
    { url: '/blog',                lcp: seeded(seed*3.1,1.2,2.6,1), cls: seeded(seed*4.2,0.01,0.09,2), fid: seeded(seed*1.3,6,30,0) },
  ].map(p => ({
    ...p,
    pass: p.lcp < 2.5 && p.cls < 0.1 && p.fid < 100,
  }));

  return {
    lcp, fid, cls, ttfb, cwvPass,
    baseSessions, organicSessions, organicPct,
    clicks, impressions, ctr, avgPosition,
    indexedPages, crawlErrors, notIndexed, newPagesFound,
    top3, top10, top30, rankingKeywords,
    sessionsDelta, clicksDelta, positionDelta,
    keywords: KEYWORDS,
    sparkPoints,
    pages,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Delta({ v, unit = '%', inverse = false, decimals = 1 }: {
  v: number; unit?: string; inverse?: boolean; decimals?: number;
}) {
  const positive = inverse ? v < 0 : v > 0;
  const color = Math.abs(v) < 0.2 ? 'text-slate-400' : positive ? 'text-emerald-400' : 'text-red-400';
  const sign = v > 0 ? '+' : '';
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {sign}{v.toFixed(decimals)}{unit}
    </span>
  );
}

function CwvPill({ value, good, ok, unit, label }: {
  value: number; good: number; ok: number; unit: string; label: string;
}) {
  const pass  = value <= good;
  const warn  = !pass && value <= ok;
  const color = pass ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : warn ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              :        'text-red-400 bg-red-500/10 border-red-500/20';
  const badge = pass ? 'Good' : warn ? 'Needs work' : 'Poor';
  return (
    <div className={`p-4 border rounded-xl ${color}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold mb-1">{value}{unit}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider">{badge}</p>
    </div>
  );
}

function Sparkline({ data, color = '#10b981' }: { data: number[]; color?: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 100, H = 32;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const areaD = `M ${pts.split(' ')[0]} L ${pts.split(' ').join(' L ')} L ${W},${H} L 0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-8" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#spark-grad)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />
      {/* Last point dot */}
      {(() => {
        const last = pts.split(' ').slice(-1)[0].split(',');
        return <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />;
      })()}
    </svg>
  );
}

function RankBadge({ pos }: { pos: number }) {
  const color = pos <= 3  ? 'text-emerald-400 bg-emerald-500/10'
              : pos <= 10 ? 'text-cyan-400 bg-cyan-500/10'
              : pos <= 30 ? 'text-amber-400 bg-amber-500/10'
              :             'text-slate-400 bg-sky-50';
  return (
    <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold ${color}`}>
      {pos}
    </span>
  );
}

function TrendArrow({ trend }: { trend: string }) {
  if (trend === 'up')   return <span className="text-emerald-400 text-xs">↑</span>;
  if (trend === 'down') return <span className="text-red-400 text-xs">↓</span>;
  return <span className="text-slate-300 text-xs">→</span>;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function LiveSEOPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [range, setRange] = useState<DateRange>({
    preset: '30d',
    from: addDays(TODAY, -30),
    to: TODAY,
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hoveredKw, setHoveredKw] = useState<number | null>(null);
  const [customFrom, setCustomFrom] = useState(addDays(TODAY, -30));
  const [customTo, setCustomTo]     = useState(TODAY);
  const [activeTab, setActiveTab]   = useState<'overview' | 'keywords' | 'cwv' | 'indexing'>('overview');

  const days = useMemo(() => Math.max(1, daysBetween(range.from, range.to)), [range]);
  const M    = useMemo(() => computeMetrics(days, range.from), [days, range.from]);

  function applyPreset(p: typeof PRESETS[number]) {
    setRange({ preset: p.id, from: addDays(TODAY, -p.days), to: TODAY });
    setPickerOpen(false);
  }

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      setRange({ preset: 'custom', from: customFrom, to: customTo });
    }
    setPickerOpen(false);
  }

  const rangeLabel = range.preset === 'custom'
    ? `${fmtDate(range.from)} – ${fmtDate(range.to)}`
    : PRESETS.find(p => p.id === range.preset)?.label ?? '';

  return (
    <div className="min-h-screen bg-page-bg">

      {/* Page sub-header: date picker + tabs */}
      <div className="bg-white border-b border-sky-100 px-6 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Live SEO</span>
            </div>
            <span className="text-slate-300">·</span>
            <span>novapulsehr.com</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Date range picker */}
            <div className="relative">
              <button
                onClick={() => setPickerOpen((o: boolean) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 border border-sky-200 hover:border-sky-300 rounded-lg transition-all text-xs text-slate-700"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {rangeLabel}
                <svg className={`w-3 h-3 text-slate-500 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {pickerOpen && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-sky-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-2">
                    {PRESETS.map(p => (
                      <button key={p.id} onClick={() => applyPreset(p)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          range.preset === p.id ? 'bg-sky-100 text-sky-700' : 'text-slate-500 hover:bg-sky-50 hover:text-slate-700'
                        }`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-sky-100 p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Custom range</p>
                    <div className="flex items-center gap-2 mb-2">
                      <input type="date" value={customFrom} max={customTo}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFrom(e.target.value)}
                        className="flex-1 bg-sky-50 border border-sky-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:border-sky-300 [color-scheme:light]" />
                      <span className="text-slate-300 text-xs">→</span>
                      <input type="date" value={customTo} min={customFrom} max={TODAY}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomTo(e.target.value)}
                        className="flex-1 bg-sky-50 border border-sky-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:border-sky-300 [color-scheme:light]" />
                    </div>
                    <button onClick={applyCustom}
                      className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors">
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sub tabs */}
            <div className="flex items-center bg-sky-50 border border-sky-200 rounded-lg p-1 gap-1">
              {(['overview', 'keywords', 'cwv', 'indexing'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${ activeTab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700' }`}>
                  {t === 'cwv' ? 'Core Web Vitals' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close date picker */}
      {pickerOpen && <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />}

      {/* Page header */}
      <div className="max-w-6xl mx-auto px-6 pt-7 pb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">NovaPulse HR · Search Performance</p>
            <h1 className="text-2xl font-bold text-slate-900">Live SEO</h1>
            <p className="text-sm text-slate-500 mt-1">
              {fmtDate(range.from)} – {fmtDate(range.to)} · {days} days
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Synced with Google Search Console · Updated hourly
          </div>
        </div>

        {/* Top KPI strip */}
        <div className="grid grid-cols-6 gap-3 mt-6">
          {[
            { label: 'Organic Sessions',  value: M.organicSessions.toLocaleString(), delta: M.sessionsDelta, unit: '%', spark: M.sparkPoints, color: '#10b981' },
            { label: 'Total Clicks',      value: M.clicks.toLocaleString(),          delta: M.clicksDelta,   unit: '%', spark: M.sparkPoints.map((v: number) => Math.round(v * 0.9)), color: '#6366f1' },
            { label: 'Impressions',       value: M.impressions.toLocaleString(),      delta: M.clicksDelta * 1.2, unit: '%', spark: M.sparkPoints.map((v: number) => Math.round(v * 1.4)), color: '#6366f1' },
            { label: 'Avg CTR',           value: `${M.ctr}%`,                        delta: M.clicksDelta * 0.3, unit: '%', spark: M.sparkPoints.map((v: number) => v * 0.04 + 1), color: '#f59e0b' },
            { label: 'Avg Position',      value: M.avgPosition.toFixed(1),           delta: M.positionDelta, unit: '', inverse: true, spark: M.sparkPoints.map((v: number) => 25 - v * 0.12), color: '#06b6d4' },
            { label: 'Keywords Ranking',  value: M.rankingKeywords.toString(),        delta: M.sessionsDelta * 0.8, unit: '', spark: M.sparkPoints.map((v: number) => Math.round(v * 0.6 + 20)), color: '#a78bfa' },
          ].map((kpi, i) => (
            <div key={i} className="p-4 bg-sky-50 border border-sky-100 rounded-xl">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 truncate">{kpi.label}</p>
              <p className="text-lg font-bold text-slate-800 mb-1">{kpi.value}</p>
              <div className="mb-2">
                <Sparkline data={kpi.spark} color={kpi.color} />
              </div>
              <Delta v={kpi.delta} unit={kpi.unit} inverse={kpi.inverse} />
              <span className="text-[10px] text-slate-400 ml-1">vs prior period</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-6xl mx-auto px-6 pb-16 space-y-6">

        {/* ── OVERVIEW ────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* CWV summary banner */}
            <div className={`p-4 border rounded-2xl flex items-center justify-between ${
              M.cwvPass
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-amber-500/5 border-amber-500/20'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  M.cwvPass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {M.cwvPass ? '✓' : '⚠'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Core Web Vitals — {M.cwvPass ? 'All pages passing' : 'Needs attention'}
                  </p>
                  <p className="text-xs text-slate-500">
                    LCP {M.lcp}s · CLS {M.cls} · FID {M.fid}ms · TTFB {M.ttfb}ms
                  </p>
                </div>
              </div>
              <button onClick={() => setActiveTab('cwv')}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                View breakdown →
              </button>
            </div>

            {/* Ranking distribution */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Keyword Ranking Distribution</p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Top 3',   value: M.top3,  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', bar: 'bg-emerald-500' },
                  { label: 'Top 10',  value: M.top10, color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20',       bar: 'bg-cyan-500' },
                  { label: 'Top 30',  value: M.top30, color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',     bar: 'bg-amber-500' },
                  { label: 'Total ranking', value: M.rankingKeywords, color: 'text-slate-800', bg: 'bg-sky-50 border-sky-100', bar: 'bg-indigo-500' },
                ].map((r, i) => (
                  <div key={i} className={`p-4 border rounded-xl ${r.bg}`}>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{r.label}</p>
                    <p className={`text-2xl font-bold ${r.color} mb-2`}>{r.value}</p>
                    <div className="h-1 bg-sky-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${r.bar}`}
                        style={{ width: `${Math.min(100, (r.value / M.rankingKeywords) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Indexing snapshot */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Indexing Snapshot</p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Indexed pages',  value: M.indexedPages,  icon: '✓', color: 'text-emerald-400' },
                  { label: 'Crawl errors',   value: M.crawlErrors,   icon: '✗', color: M.crawlErrors > 0 ? 'text-red-400' : 'text-slate-400' },
                  { label: 'Not indexed',    value: M.notIndexed,    icon: '○', color: M.notIndexed > 8 ? 'text-amber-400' : 'text-slate-500' },
                  { label: 'New pages found', value: M.newPagesFound, icon: '+', color: 'text-indigo-400' },
                ].map((s, i) => (
                  <div key={i} className="p-4 bg-sky-50 border border-sky-100 rounded-xl flex items-center gap-3">
                    <span className={`text-xl ${s.color}`}>{s.icon}</span>
                    <div>
                      <p className="text-xl font-bold text-slate-900">{s.value}</p>
                      <p className="text-[10px] text-slate-500">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 5 keywords preview */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Top Keywords</p>
                <button onClick={() => setActiveTab('keywords')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  View all {M.keywords.length} →
                </button>
              </div>
              <div className="space-y-1.5">
                {M.keywords.slice(0, 5).map((kw: typeof M.keywords[0], i: number) => (
                  <div key={i} className="relative flex items-center gap-4 p-3 bg-sky-50 border border-sky-100 rounded-xl hover:bg-sky-100 transition-colors group"
                    onMouseEnter={() => setHoveredKw(100 + i)}
                    onMouseLeave={() => setHoveredKw(null)}>
                    <RankBadge pos={kw.pos} />
                    <p className="text-sm text-slate-700 flex-1 font-mono text-xs cursor-help">{kw.kw}</p>
                    {hoveredKw === 100 + i && kw.desc && (
                      <div className="absolute left-0 top-full mt-1 z-50 w-80 bg-slate-900 text-white text-xs rounded-xl shadow-xl p-4 pointer-events-none" style={{zIndex:100}}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${kw.intent === 'Commercial' ? 'bg-violet-500/30 text-violet-200' : kw.intent === 'Navigational' ? 'bg-blue-500/30 text-blue-200' : 'bg-slate-500/30 text-slate-300'}`}>{kw.intent}</span>
                          <span className="font-semibold text-sky-300">#{Math.round(kw.pos)}</span>
                        </div>
                        <p className="text-slate-200 leading-relaxed">{kw.desc}</p>
                      </div>
                    )}
                    <TrendArrow trend={kw.trend} />
                    <div className="flex gap-5 text-right text-xs">
                      <div><p className="text-slate-400 text-[10px]">Clicks</p><p className="text-sm font-semibold text-slate-900">{kw.clicks.toLocaleString()}</p></div>
                      <div><p className="text-slate-400 text-[10px]">Impr.</p><p className="text-slate-500">{kw.impressions.toLocaleString()}</p></div>
                      <div><p className="text-slate-400 text-[10px]">CTR</p><p className="text-slate-500">{kw.ctr}%</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── KEYWORDS ────────────────────────────────────────────────────── */}
        {activeTab === 'keywords' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Keyword Rankings</h2>
                <p className="text-sm text-slate-500">{M.rankingKeywords} keywords tracked · {fmtDate(range.from)} – {fmtDate(range.to)}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-emerald-500/40" />Top 3</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-cyan-500/40" />Top 10</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-amber-500/40" />Top 30</div>
              </div>
            </div>

            <div className="overflow-hidden border border-sky-100 rounded-2xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-page-bg border-b border-sky-100 text-slate-500">
                    <th className="text-left p-3 font-medium">Keyword</th>
                    <th className="text-center p-3 font-medium w-16">Rank</th>
                    <th className="text-center p-3 font-medium w-10">↕</th>
                    <th className="text-right p-3 font-medium">Clicks</th>
                    <th className="text-right p-3 font-medium">Impressions</th>
                    <th className="text-right p-3 font-medium">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {M.keywords.map((kw: typeof M.keywords[0], i: number) => (
                    <tr key={i} className="border-b border-sky-100 hover:bg-sky-50 transition-colors relative">
                      <td className="p-3 font-mono text-slate-700 relative"
                        onMouseEnter={() => setHoveredKw(i)}
                        onMouseLeave={() => setHoveredKw(null)}>
                        <span className="cursor-help underline decoration-dotted decoration-slate-400">{kw.kw}</span>
                        {hoveredKw === i && kw.desc && (
                          <div className="absolute left-0 top-full mt-1 z-50 w-80 bg-slate-900 text-white text-xs rounded-xl shadow-xl p-4 pointer-events-none" style={{zIndex:100}}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${kw.intent === 'Commercial' ? 'bg-violet-500/30 text-violet-200' : kw.intent === 'Navigational' ? 'bg-blue-500/30 text-blue-200' : 'bg-slate-500/30 text-slate-300'}`}>{kw.intent}</span>
                              <span className="font-semibold text-sky-300">#{Math.round(kw.pos)}</span>
                            </div>
                            <p className="text-slate-200 leading-relaxed">{kw.desc}</p>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center"><RankBadge pos={kw.pos} /></td>
                      <td className="p-3 text-center"><TrendArrow trend={kw.trend} /></td>
                      <td className="p-3 text-right text-slate-800 font-medium">{kw.clicks.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-500">{kw.impressions.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-500">{kw.ctr}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Opportunity callout */}
            <div className="p-4 bg-violet-500/5 border border-violet-500/15 rounded-2xl">
              <div className="flex items-start gap-3">
                <span className="text-violet-400 text-sm mt-0.5">◆</span>
                <div>
                  <p className="text-sm font-semibold text-slate-800 mb-1">WebOpp has identified 6 keyword gaps in your market</p>
                  <p className="text-xs text-slate-500 mb-2">
                    Keywords like "hr software comparison" (8,400/mo) and "hr software for 50–200 employees" (2,900/mo)
                    are high-value terms your competitors rank for that NovaPulse does not target.
                  </p>
                  <Link href={`/dashboard/${siteId}/webopp`}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                    View WebOpp keyword gaps →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CORE WEB VITALS ─────────────────────────────────────────────── */}
        {activeTab === 'cwv' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Core Web Vitals</h2>
              <p className="text-sm text-slate-500">
                Field data for {fmtDate(range.from)} – {fmtDate(range.to)} · {days} days
              </p>
            </div>

            {/* Site-wide scores */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Site-wide averages</p>
              <div className="grid grid-cols-4 gap-3">
                <CwvPill value={M.lcp}  good={2.5}  ok={4.0}   unit="s"  label="LCP — Largest Contentful Paint" />
                <CwvPill value={M.fid}  good={100}  ok={300}   unit="ms" label="FID — First Input Delay" />
                <CwvPill value={M.cls}  good={0.1}  ok={0.25}  unit=""   label="CLS — Cumulative Layout Shift" />
                <CwvPill value={M.ttfb} good={800}  ok={1800}  unit="ms" label="TTFB — Time to First Byte" />
              </div>
            </div>

            {/* Per-page breakdown */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Per-page breakdown</p>
              <div className="overflow-hidden border border-sky-100 rounded-2xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-page-bg border-b border-sky-100 text-slate-500">
                      <th className="text-left p-3 font-medium">Page</th>
                      <th className="text-right p-3 font-medium">LCP</th>
                      <th className="text-right p-3 font-medium">CLS</th>
                      <th className="text-right p-3 font-medium">FID</th>
                      <th className="text-center p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {M.pages.map((p: typeof M.pages[0], i: number) => (
                      <tr key={i} className="border-b border-sky-100 hover:bg-sky-50 transition-colors">
                        <td className="p-3 font-mono text-slate-600">{p.url}</td>
                        <td className={`p-3 text-right font-medium ${p.lcp < 2.5 ? 'text-emerald-400' : p.lcp < 4 ? 'text-amber-400' : 'text-red-400'}`}>
                          {p.lcp}s
                        </td>
                        <td className={`p-3 text-right ${p.cls < 0.1 ? 'text-emerald-400' : p.cls < 0.25 ? 'text-amber-400' : 'text-red-400'}`}>
                          {p.cls}
                        </td>
                        <td className={`p-3 text-right ${p.fid < 100 ? 'text-emerald-400' : p.fid < 300 ? 'text-amber-400' : 'text-red-400'}`}>
                          {p.fid}ms
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            p.pass ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {p.pass ? 'Good' : 'Needs work'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── INDEXING ────────────────────────────────────────────────────── */}
        {activeTab === 'indexing' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Indexing & Crawl Status</h2>
              <p className="text-sm text-slate-500">Google Search Console data · {fmtDate(range.from)} – {fmtDate(range.to)}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Indexed vs not */}
              <div className="p-5 bg-sky-50 border border-sky-100 rounded-2xl">
                <p className="text-xs text-slate-500 mb-4">Page indexing breakdown</p>
                <div className="space-y-3">
                  {[
                    { label: 'Indexed', value: M.indexedPages, color: 'bg-emerald-500', text: 'text-emerald-400', total: M.indexedPages + M.notIndexed },
                    { label: 'Not indexed', value: M.notIndexed, color: 'bg-amber-500', text: 'text-amber-400', total: M.indexedPages + M.notIndexed },
                    { label: 'Crawl errors', value: M.crawlErrors, color: 'bg-red-500', text: 'text-red-400', total: M.indexedPages + M.notIndexed },
                  ].map((s, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-500">{s.label}</span>
                        <span className={`text-sm font-bold ${s.text}`}>{s.value}</span>
                      </div>
                      <div className="h-1.5 bg-sky-50 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.color}`}
                          style={{ width: `${Math.min(100, (s.value / s.total) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent crawl activity */}
              <div className="p-5 bg-sky-50 border border-sky-100 rounded-2xl">
                <p className="text-xs text-slate-500 mb-4">Recent crawl activity</p>
                <div className="space-y-2">
                  {[
                    { url: '/',                     status: 'Indexed', date: 'Mar 11', ok: true },
                    { url: '/pricing',              status: 'Indexed', date: 'Mar 10', ok: true },
                    { url: '/bamboohr-alternative', status: 'Indexed', date: 'Mar 11', ok: true },
                    { url: '/features',             status: 'Indexed', date: 'Mar 9',  ok: true },
                    { url: '/blog/hr-onboarding',   status: M.crawlErrors > 2 ? 'Crawl error' : 'Indexed', date: 'Mar 8', ok: M.crawlErrors <= 2 },
                    { url: '/sitemap.xml',          status: 'Submitted', date: 'Mar 1', ok: true },
                  ].map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-sky-100 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="text-xs font-mono text-slate-500">{r.url}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] ${r.ok ? 'text-emerald-400/70' : 'text-red-400'}`}>{r.status}</span>
                        <span className="text-[10px] text-slate-500">{r.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {M.newPagesFound > 0 && (
                  <div className="mt-3 p-2.5 bg-indigo-500/5 border border-indigo-500/15 rounded-lg">
                    <p className="text-xs text-indigo-300">
                      {M.newPagesFound} new page{M.newPagesFound > 1 ? 's' : ''} discovered in this period
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
