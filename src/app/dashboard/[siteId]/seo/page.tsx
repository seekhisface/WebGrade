'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Range = '7d' | '14d' | '30d' | '60d' | '90d' | 'custom';

interface SeoKeyword {
  keyword: string;
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
  intent: string;
  description: string | null;
  trend: string;
  positionDelta: number;
}

interface CwvPage {
  url: string;
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  ttfb: number | null;
  mobileScore: number | null;
  pass: boolean;
}

interface SeoData {
  site: { id: string; name: string; domain: string };
  days: number;
  periodStart: string;
  periodEnd: string;
  organicSessions: number;
  organicSessionsDelta: number;
  clicks: number;
  clicksDelta: number;
  impressions: number;
  impressionsDelta: number;
  ctr: number;
  ctrDelta: number;
  avgPosition: number;
  positionDelta: number;
  keywordsTop3: number;
  keywordsTop10: number;
  keywordsTop30: number;
  keywordsTotal: number;
  indexedPages: number;
  crawlErrors: number;
  notIndexed: number;
  newPagesFound: number;
  keywords: SeoKeyword[];
  cwv: { lcp: number; fid: number; cls: number; ttfb: number; pass: boolean };
  cwvPages: CwvPage[];
  crawlScores: { overall: number; technical: number; onPage: number; content: number; crawlability: number } | null;
  sparkPoints: number[];
}

const PRESETS: { id: Range; label: string; days: number }[] = [
  { id: '7d',  label: 'Last 7 days',   days: 7  },
  { id: '14d', label: 'Last 14 days',  days: 14 },
  { id: '30d', label: 'Last 30 days',  days: 30 },
  { id: '60d', label: 'Last 60 days',  days: 60 },
  { id: '90d', label: 'Last 90 days',  days: 90 },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  if (data.length < 2) return null;
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
      {Math.round(pos)}
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

  const [days, setDays] = useState(30);
  const [rangePreset, setRangePreset] = useState<Range>('30d');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hoveredKw, setHoveredKw] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'keywords' | 'cwv' | 'indexing'>('overview');
  const [data, setData] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback((d: number) => {
    setLoading(true);
    fetch(`/api/seo?siteId=${siteId}&days=${d}`)
      .then(r => { if (!r.ok) throw new Error(`SEO API error: ${r.status}`); return r.json(); })
      .then(setData)
      .catch(err => console.error('[seo] Failed to load:', err))
      .finally(() => setLoading(false));
  }, [siteId]);

  useEffect(() => { fetchData(days); }, [days, fetchData]);

  function applyPreset(p: typeof PRESETS[number]) {
    setDays(p.days);
    setRangePreset(p.id);
    setPickerOpen(false);
  }

  const rangeLabel = PRESETS.find(p => p.id === rangePreset)?.label ?? `Last ${days} days`;

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#f0f9ff]">
        <div className="max-w-6xl mx-auto px-6 py-8 animate-pulse">
          <div className="h-8 w-48 bg-[#bae6fd] rounded-lg mb-6" />
          <div className="grid grid-cols-6 gap-3 mb-6">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 bg-white border border-[#bae6fd] rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const M = data;

  return (
    <div className="min-h-screen bg-[#f0f9ff]">

      {/* Page sub-header: date picker + tabs */}
      <div className="bg-white border-b border-sky-100 px-6 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-[#64748b]">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Live SEO</span>
            </div>
            <span className="text-slate-300">·</span>
            <span>{M.site.domain}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Date range picker */}
            <div className="relative">
              <button
                onClick={() => setPickerOpen((o: boolean) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 border border-sky-200 hover:border-sky-300 rounded-lg transition-all text-xs text-slate-700"
              >
                <svg className="w-3.5 h-3.5 text-[#64748b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {rangeLabel}
                <svg className={`w-3 h-3 text-[#64748b] transition-transform ${pickerOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {pickerOpen && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-sky-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-2">
                    {PRESETS.map(p => (
                      <button key={p.id} onClick={() => applyPreset(p)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          rangePreset === p.id ? 'bg-sky-100 text-sky-700' : 'text-slate-500 hover:bg-sky-50 hover:text-slate-700'
                        }`}>
                        {p.label}
                      </button>
                    ))}
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
            <p className="text-xs text-[#64748b] uppercase tracking-wider mb-1">{M.site.name} · Search Performance</p>
            <h1 className="text-2xl font-bold text-[#1e293b]">Live SEO</h1>
            <p className="text-sm text-[#64748b] mt-1">
              {fmtDate(M.periodStart)} – {fmtDate(M.periodEnd)} · {M.days} days
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#64748b]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Synced with Google Search Console · Updated hourly
          </div>
        </div>

        {/* Top KPI strip */}
        <div className="grid grid-cols-6 gap-3 mt-6">
          {[
            { label: 'Organic Sessions',  value: M.organicSessions.toLocaleString(), delta: M.organicSessionsDelta, unit: '%', spark: M.sparkPoints, color: '#10b981' },
            { label: 'Total Clicks',      value: M.clicks.toLocaleString(),          delta: M.clicksDelta,   unit: '%', spark: M.sparkPoints.map(v => Math.round(v * 0.9)), color: '#6366f1' },
            { label: 'Impressions',       value: M.impressions.toLocaleString(),      delta: M.impressionsDelta, unit: '%', spark: M.sparkPoints.map(v => Math.round(v * 1.4)), color: '#6366f1' },
            { label: 'Avg CTR',           value: `${M.ctr}%`,                        delta: M.ctrDelta, unit: '%', spark: M.sparkPoints.map(v => v * 0.04 + 1), color: '#f59e0b' },
            { label: 'Avg Position',      value: M.avgPosition.toFixed(1),           delta: M.positionDelta, unit: '', inverse: true, spark: M.sparkPoints.map(v => 25 - v * 0.12), color: '#06b6d4' },
            { label: 'Keywords Ranking',  value: M.keywordsTotal.toString(),          delta: 0, unit: '', spark: M.sparkPoints.map(v => Math.round(v * 0.6 + 20)), color: '#a78bfa' },
          ].map((kpi, i) => (
            <div key={i} className="p-4 bg-sky-50 border border-sky-100 rounded-xl">
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1 truncate">{kpi.label}</p>
              <p className="text-lg font-bold text-slate-800 mb-1">{kpi.value}</p>
              <div className="mb-2">
                <Sparkline data={kpi.spark} color={kpi.color} />
              </div>
              <Delta v={kpi.delta} unit={kpi.unit} inverse={kpi.inverse} />
              <span className="text-[10px] text-[#94a3b8] ml-1">vs prior period</span>
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
              M.cwv.pass
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-amber-500/5 border-amber-500/20'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  M.cwv.pass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {M.cwv.pass ? '✓' : '⚠'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1e293b]">
                    Core Web Vitals — {M.cwv.pass ? 'All pages passing' : 'Needs attention'}
                  </p>
                  <p className="text-xs text-[#64748b]">
                    LCP {M.cwv.lcp}s · CLS {M.cwv.cls} · FID {M.cwv.fid}ms · TTFB {M.cwv.ttfb}ms
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
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-3">Keyword Ranking Distribution</p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Top 3',   value: M.keywordsTop3,  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', bar: 'bg-emerald-500' },
                  { label: 'Top 10',  value: M.keywordsTop10, color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20',       bar: 'bg-cyan-500' },
                  { label: 'Top 30',  value: M.keywordsTop30, color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',     bar: 'bg-amber-500' },
                  { label: 'Total ranking', value: M.keywordsTotal, color: 'text-slate-800', bg: 'bg-sky-50 border-sky-100', bar: 'bg-indigo-500' },
                ].map((r, i) => (
                  <div key={i} className={`p-4 border rounded-xl ${r.bg}`}>
                    <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">{r.label}</p>
                    <p className={`text-2xl font-bold ${r.color} mb-2`}>{r.value}</p>
                    <div className="h-1 bg-sky-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${r.bar}`}
                        style={{ width: `${M.keywordsTotal > 0 ? Math.min(100, (r.value / M.keywordsTotal) * 100) : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Indexing snapshot */}
            <div>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-3">Indexing Snapshot</p>
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
                      <p className="text-xl font-bold text-[#1e293b]">{s.value}</p>
                      <p className="text-[10px] text-[#64748b]">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 5 keywords preview */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider">Top Keywords</p>
                <button onClick={() => setActiveTab('keywords')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  View all {M.keywords.length} →
                </button>
              </div>
              <div className="space-y-1.5">
                {M.keywords.slice(0, 5).map((kw, i) => (
                  <div key={i} className="relative flex items-center gap-4 p-3 bg-sky-50 border border-sky-100 rounded-xl hover:bg-[#e0f2fe] transition-colors group"
                    onMouseEnter={() => setHoveredKw(100 + i)}
                    onMouseLeave={() => setHoveredKw(null)}>
                    <RankBadge pos={kw.position} />
                    <p className="text-sm text-[#334155] flex-1 font-mono text-xs cursor-help">{kw.keyword}</p>
                    {hoveredKw === 100 + i && kw.description && (
                      <div className="absolute left-0 top-full mt-1 z-50 w-80 bg-[#1e293b] text-white text-xs rounded-xl shadow-xl p-4 pointer-events-none" style={{zIndex:100}}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${kw.intent === 'Commercial' ? 'bg-violet-500/30 text-violet-200' : kw.intent === 'Navigational' ? 'bg-blue-500/30 text-blue-200' : 'bg-slate-500/30 text-slate-300'}`}>{kw.intent}</span>
                          <span className="font-semibold text-sky-300">#{Math.round(kw.position)}</span>
                        </div>
                        <p className="text-slate-200 leading-relaxed">{kw.description}</p>
                      </div>
                    )}
                    <TrendArrow trend={kw.trend} />
                    <div className="flex gap-5 text-right text-xs">
                      <div><p className="text-slate-400 text-[10px]">Clicks</p><p className="text-sm font-semibold text-[#1e293b]">{kw.clicks.toLocaleString()}</p></div>
                      <div><p className="text-slate-400 text-[10px]">Impr.</p><p className="text-[#64748b]">{kw.impressions.toLocaleString()}</p></div>
                      <div><p className="text-slate-400 text-[10px]">CTR</p><p className="text-[#64748b]">{kw.ctr}%</p></div>
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
                <h2 className="text-lg font-bold text-[#1e293b]">Keyword Rankings</h2>
                <p className="text-sm text-[#64748b]">{M.keywordsTotal} keywords tracked · {fmtDate(M.periodStart)} – {fmtDate(M.periodEnd)}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#64748b]">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-emerald-500/40" />Top 3</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-cyan-500/40" />Top 10</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-amber-500/40" />Top 30</div>
              </div>
            </div>

            <div className="overflow-hidden border border-sky-100 rounded-2xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#f0f9ff] border-b border-[#e0f2fe] text-[#64748b]">
                    <th className="text-left p-3 font-medium">Keyword</th>
                    <th className="text-center p-3 font-medium w-16">Rank</th>
                    <th className="text-center p-3 font-medium w-10">↕</th>
                    <th className="text-right p-3 font-medium">Clicks</th>
                    <th className="text-right p-3 font-medium">Impressions</th>
                    <th className="text-right p-3 font-medium">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {M.keywords.map((kw, i) => (
                    <tr key={i} className="border-b border-sky-100 hover:bg-sky-50 transition-colors relative">
                      <td className="p-3 font-mono text-[#334155] relative"
                        onMouseEnter={() => setHoveredKw(i)}
                        onMouseLeave={() => setHoveredKw(null)}>
                        <span className="cursor-help underline decoration-dotted decoration-[#94a3b8]">{kw.keyword}</span>
                        {hoveredKw === i && kw.description && (
                          <div className="absolute left-0 top-full mt-1 z-50 w-80 bg-[#1e293b] text-white text-xs rounded-xl shadow-xl p-4 pointer-events-none" style={{zIndex:100}}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${kw.intent === 'Commercial' ? 'bg-violet-500/30 text-violet-200' : kw.intent === 'Navigational' ? 'bg-blue-500/30 text-blue-200' : 'bg-slate-500/30 text-slate-300'}`}>{kw.intent}</span>
                              <span className="font-semibold text-sky-300">#{Math.round(kw.position)}</span>
                            </div>
                            <p className="text-slate-200 leading-relaxed">{kw.description}</p>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center"><RankBadge pos={kw.position} /></td>
                      <td className="p-3 text-center"><TrendArrow trend={kw.trend} /></td>
                      <td className="p-3 text-right text-slate-800 font-medium">{kw.clicks.toLocaleString()}</td>
                      <td className="p-3 text-right text-[#64748b]">{kw.impressions.toLocaleString()}</td>
                      <td className="p-3 text-right text-[#64748b]">{kw.ctr}%</td>
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
                  <p className="text-sm font-semibold text-slate-800 mb-1">WebOpp has identified keyword gaps in your market</p>
                  <p className="text-xs text-slate-500 mb-2">
                    High-value terms your competitors rank for that {M.site.name} does not yet target.
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
              <p className="text-sm text-[#64748b]">
                Field data for {fmtDate(M.periodStart)} – {fmtDate(M.periodEnd)} · {M.days} days
              </p>
            </div>

            {/* Site-wide scores */}
            <div>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-3">Site-wide averages</p>
              <div className="grid grid-cols-4 gap-3">
                <CwvPill value={M.cwv.lcp}  good={2.5}  ok={4.0}   unit="s"  label="LCP — Largest Contentful Paint" />
                <CwvPill value={M.cwv.fid}  good={100}  ok={300}   unit="ms" label="FID — First Input Delay" />
                <CwvPill value={M.cwv.cls}  good={0.1}  ok={0.25}  unit=""   label="CLS — Cumulative Layout Shift" />
                <CwvPill value={M.cwv.ttfb} good={800}  ok={1800}  unit="ms" label="TTFB — Time to First Byte" />
              </div>
            </div>

            {/* Per-page breakdown */}
            <div>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-3">Per-page breakdown</p>
              <div className="overflow-hidden border border-sky-100 rounded-2xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#f0f9ff] border-b border-[#e0f2fe] text-[#64748b]">
                      <th className="text-left p-3 font-medium">Page</th>
                      <th className="text-right p-3 font-medium">LCP</th>
                      <th className="text-right p-3 font-medium">CLS</th>
                      <th className="text-right p-3 font-medium">FID</th>
                      <th className="text-center p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {M.cwvPages.map((p, i) => (
                      <tr key={i} className="border-b border-sky-100 hover:bg-sky-50 transition-colors">
                        <td className="p-3 font-mono text-slate-600">{p.url}</td>
                        <td className={`p-3 text-right font-medium ${(p.lcp ?? 99) < 2.5 ? 'text-emerald-400' : (p.lcp ?? 99) < 4 ? 'text-amber-400' : 'text-red-400'}`}>
                          {p.lcp}s
                        </td>
                        <td className={`p-3 text-right ${(p.cls ?? 99) < 0.1 ? 'text-emerald-400' : (p.cls ?? 99) < 0.25 ? 'text-amber-400' : 'text-red-400'}`}>
                          {p.cls}
                        </td>
                        <td className={`p-3 text-right ${(p.fid ?? 999) < 100 ? 'text-emerald-400' : (p.fid ?? 999) < 300 ? 'text-amber-400' : 'text-red-400'}`}>
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
              <p className="text-sm text-[#64748b]">Google Search Console data · {fmtDate(M.periodStart)} – {fmtDate(M.periodEnd)}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Indexed vs not */}
              <div className="p-5 bg-sky-50 border border-sky-100 rounded-2xl">
                <p className="text-xs text-[#64748b] mb-4">Page indexing breakdown</p>
                <div className="space-y-3">
                  {[
                    { label: 'Indexed', value: M.indexedPages, color: 'bg-emerald-500', text: 'text-emerald-400', total: M.indexedPages + M.notIndexed },
                    { label: 'Not indexed', value: M.notIndexed, color: 'bg-amber-500', text: 'text-amber-400', total: M.indexedPages + M.notIndexed },
                    { label: 'Crawl errors', value: M.crawlErrors, color: 'bg-red-500', text: 'text-red-400', total: M.indexedPages + M.notIndexed },
                  ].map((s, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[#64748b]">{s.label}</span>
                        <span className={`text-sm font-bold ${s.text}`}>{s.value}</span>
                      </div>
                      <div className="h-1.5 bg-sky-50 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.color}`}
                          style={{ width: `${s.total > 0 ? Math.min(100, (s.value / s.total) * 100) : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Crawl scores */}
              <div className="p-5 bg-sky-50 border border-sky-100 rounded-2xl">
                <p className="text-xs text-[#64748b] mb-4">Latest crawl scores</p>
                {M.crawlScores ? (
                  <div className="space-y-3">
                    {[
                      { label: 'Overall SEO', value: M.crawlScores.overall, color: 'bg-indigo-500' },
                      { label: 'Technical', value: M.crawlScores.technical, color: 'bg-cyan-500' },
                      { label: 'On-Page', value: M.crawlScores.onPage, color: 'bg-emerald-500' },
                      { label: 'Content', value: M.crawlScores.content, color: 'bg-amber-500' },
                      { label: 'Crawlability', value: M.crawlScores.crawlability, color: 'bg-violet-500' },
                    ].map((s, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[#64748b]">{s.label}</span>
                          <span className="text-sm font-bold text-[#1e293b]">{s.value}/100</span>
                        </div>
                        <div className="h-1.5 bg-sky-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${s.color}`}
                            style={{ width: `${s.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#64748b]">No crawl data available yet.</p>
                )}
              </div>
            </div>

            {M.newPagesFound > 0 && (
              <div className="p-3 bg-indigo-500/5 border border-indigo-500/15 rounded-lg">
                <p className="text-xs text-indigo-600">
                  {M.newPagesFound} new page{M.newPagesFound > 1 ? 's' : ''} discovered in this period
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
