'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Live SEO Dashboard — powered by SeoCrawl + SeoPageResult + SiteBaseline
// Falls back to deterministic seed data when no crawl data exists
// ---------------------------------------------------------------------------

type Range = '7d' | '14d' | '30d' | '60d' | '90d';

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface SeoData {
  hasSeoData: boolean;
  crawl?: {
    id: string;
    completedAt: string;
    pagesFound: number;
    pagesAnalyzed: number;
    overallSeoScore: number | null;
    technicalScore: number | null;
    onPageScore: number | null;
    contentScore: number | null;
    crawlabilityScore: number | null;
  };
  cwv?: {
    avgLcp: number;
    avgFid: number;
    avgCls: number;
    avgTtfb: number;
    cwvPass: boolean;
    pages: CwvPage[];
  };
  indexing?: {
    indexedPages: number;
    notIndexed: number;
    redirects: number;
    crawlErrors: number;
    inSitemap: number;
    pages: IndexPage[];
  };
  traffic?: {
    organicSessions30d: number;
    organicSessions7d: number;
    totalClicks30d: number;
    totalImpressions30d: number;
    avgCtr: number;
    avgPosition: number;
    keywordsTop3: number;
    keywordsTop10: number;
    keywordsTop30: number;
    keywordsTotal: number;
  };
  keywords?: Keyword[];
  pageResults?: PageResult[];
}

interface CwvPage {
  url: string;
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  ttfb: number | null;
  mobileScore: number | null;
  desktopScore: number | null;
  pass: boolean;
}

interface IndexPage {
  url: string;
  statusCode: number | null;
  isIndexable: boolean | null;
  hasNoindex: boolean | null;
  isInSitemap: boolean | null;
  crawlDepth: number | null;
  crawledAt: string;
}

interface Keyword {
  keyword: string;
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
}

interface PageResult {
  url: string;
  title: string | null;
  statusCode: number | null;
  onPageScore: number | null;
  contentScore: number | null;
  wordCount: number | null;
  altTextMissing: number | null;
  h1Count: number | null;
  h2Count: number | null;
  internalLinks: number | null;
  externalLinks: number | null;
  hasStructuredData: boolean | null;
  issues: { type: string; severity: string; description: string; fix: string }[];
}

// ---------------------------------------------------------------------------
// Fallback metrics — used when no SEO data exists in DB
// ---------------------------------------------------------------------------

function buildFallbackData(): SeoData {
  return {
    hasSeoData: false,
    cwv: {
      avgLcp: 1.9, avgFid: 15, avgCls: 0.05, avgTtfb: 310, cwvPass: true,
      pages: [
        { url: '/', lcp: 1.8, cls: 0.04, fid: 12, ttfb: 280, mobileScore: 88, desktopScore: 94, pass: true },
        { url: '/pricing', lcp: 2.4, cls: 0.12, fid: 18, ttfb: 310, mobileScore: 72, desktopScore: 85, pass: false },
        { url: '/features', lcp: 3.2, cls: 0.08, fid: 45, ttfb: 420, mobileScore: 58, desktopScore: 71, pass: false },
        { url: '/blog', lcp: 1.9, cls: 0.06, fid: 14, ttfb: 340, mobileScore: 82, desktopScore: 90, pass: true },
      ],
    },
    traffic: {
      organicSessions30d: 4820, organicSessions7d: 1180,
      totalClicks30d: 1119, totalImpressions30d: 31900,
      avgCtr: 3.5, avgPosition: 12.8,
      keywordsTop3: 2, keywordsTop10: 5, keywordsTop30: 7, keywordsTotal: 48,
    },
    keywords: [
      { keyword: 'hr software for small business', position: 4, clicks: 312, impressions: 8900, ctr: 3.5 },
      { keyword: 'bamboohr alternative', position: 6, clicks: 187, impressions: 4200, ctr: 4.5 },
      { keyword: 'employee management software', position: 9, clicks: 143, impressions: 6800, ctr: 2.1 },
      { keyword: 'hr onboarding software', position: 12, clicks: 98, impressions: 3400, ctr: 2.9 },
      { keyword: 'novapulse hr', position: 1, clicks: 241, impressions: 1800, ctr: 13.4 },
    ],
    indexing: {
      indexedPages: 12, notIndexed: 3, redirects: 1, crawlErrors: 1, inSitemap: 13,
      pages: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Delta({ v, unit = '%', inverse = false }: {
  v: number; unit?: string; inverse?: boolean;
}) {
  const positive = inverse ? v < 0 : v > 0;
  const color = Math.abs(v) < 0.2 ? 'text-slate-400' : positive ? 'text-emerald-400' : 'text-red-400';
  const sign = v > 0 ? '+' : '';
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {sign}{v.toFixed(1)}{unit}
    </span>
  );
}

function CwvPill({ value, good, ok, unit, label }: {
  value: number; good: number; ok: number; unit: string; label: string;
}) {
  const pass = value <= good;
  const warn = !pass && value <= ok;
  const color = pass ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : warn ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      : 'text-red-400 bg-red-500/10 border-red-500/20';
  const badge = pass ? 'Good' : warn ? 'Needs work' : 'Poor';
  return (
    <div className={`p-4 border rounded-xl ${color}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold mb-1">{value}{unit}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider">{badge}</p>
    </div>
  );
}

function RankBadge({ pos }: { pos: number }) {
  const color = pos <= 3 ? 'text-emerald-400 bg-emerald-500/10'
    : pos <= 10 ? 'text-cyan-400 bg-cyan-500/10'
      : pos <= 30 ? 'text-amber-400 bg-amber-500/10'
        : 'text-slate-400 bg-sky-50';
  return (
    <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold ${color}`}>
      {Math.round(pos)}
    </span>
  );
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function LiveSEOPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [data, setData] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'keywords' | 'cwv' | 'indexing'>('overview');
  const [range, setRange] = useState<Range>('30d');
  const [hoveredKw, setHoveredKw] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/analytics/seo?siteId=${siteId}`);
        const json = await res.json();
        if (json.hasSeoData) {
          setData(json);
        } else {
          setData(buildFallbackData());
        }
      } catch {
        setData(buildFallbackData());
      }
      setLoading(false);
    }
    load();
  }, [siteId]);

  if (loading) return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-nav-bg border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return null;

  const traffic = data.traffic!;
  const cwv = data.cwv!;
  const indexing = data.indexing!;
  const keywords = data.keywords ?? [];
  const crawl = data.crawl;

  // Scale traffic by range (the DB has 30d data; scale proportionally)
  const RANGE_DAYS: Record<Range, number> = { '7d': 7, '14d': 14, '30d': 30, '60d': 60, '90d': 90 };
  const days = RANGE_DAYS[range];
  const scale = days / 30;

  const scaledTraffic = {
    organicSessions: Math.round(traffic.organicSessions30d * scale),
    clicks: Math.round(traffic.totalClicks30d * scale),
    impressions: Math.round(traffic.totalImpressions30d * scale),
    ctr: traffic.avgCtr,
    avgPosition: traffic.avgPosition,
    keywordsTotal: traffic.keywordsTotal,
  };

  const rangeLabel = { '7d': 'Last 7 days', '14d': 'Last 14 days', '30d': 'Last 30 days', '60d': 'Last 60 days', '90d': 'Last 90 days' }[range];

  return (
    <div className="min-h-screen bg-page-bg">

      {/* Page sub-header */}
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
            {!data.hasSeoData && (
              <span className="text-xs text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Demo data</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Range selector */}
            <div className="flex items-center bg-sky-50 border border-sky-200 rounded-lg p-1 gap-0.5">
              {(['7d', '14d', '30d', '60d', '90d'] as const).map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${range === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {r}
                </button>
              ))}
            </div>

            {/* Sub tabs */}
            <div className="flex items-center bg-sky-50 border border-sky-200 rounded-lg p-1 gap-1">
              {(['overview', 'keywords', 'cwv', 'indexing'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {t === 'cwv' ? 'Core Web Vitals' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Page header */}
      <div className="max-w-6xl mx-auto px-6 pt-7 pb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Search Performance</p>
            <h1 className="text-2xl font-bold text-slate-900">Live SEO</h1>
            <p className="text-sm text-slate-500 mt-1">{rangeLabel} · {days} days</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {crawl?.completedAt && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Last crawl: {fmtDate(crawl.completedAt)}
              </>
            )}
          </div>
        </div>

        {/* Top KPI strip */}
        <div className="grid grid-cols-6 gap-3 mt-6">
          {[
            { label: 'Organic Sessions', value: scaledTraffic.organicSessions.toLocaleString() },
            { label: 'Total Clicks', value: scaledTraffic.clicks.toLocaleString() },
            { label: 'Impressions', value: scaledTraffic.impressions.toLocaleString() },
            { label: 'Avg CTR', value: `${scaledTraffic.ctr}%` },
            { label: 'Avg Position', value: scaledTraffic.avgPosition.toFixed(1) },
            { label: 'Keywords Ranking', value: scaledTraffic.keywordsTotal.toString() },
          ].map((kpi, i) => (
            <div key={i} className="p-4 bg-sky-50 border border-sky-100 rounded-xl">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 truncate">{kpi.label}</p>
              <p className="text-lg font-bold text-slate-800">{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-6xl mx-auto px-6 pb-16 space-y-6">

        {/* ── OVERVIEW ──────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* CWV summary banner */}
            <div className={`p-4 border rounded-2xl flex items-center justify-between ${cwv.cwvPass
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : 'bg-amber-500/5 border-amber-500/20'
              }`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cwv.cwvPass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                  {cwv.cwvPass ? '✓' : '⚠'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Core Web Vitals — {cwv.cwvPass ? 'All passing' : 'Needs attention'}
                  </p>
                  <p className="text-xs text-slate-500">
                    LCP {cwv.avgLcp}s · CLS {cwv.avgCls} · FID {cwv.avgFid}ms · TTFB {cwv.avgTtfb}ms
                  </p>
                </div>
              </div>
              <button onClick={() => setActiveTab('cwv')}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                View breakdown →
              </button>
            </div>

            {/* SEO scores (only if real crawl data) */}
            {crawl && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">SEO Scores</p>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: 'Overall', value: crawl.overallSeoScore },
                    { label: 'Technical', value: crawl.technicalScore },
                    { label: 'On-Page', value: crawl.onPageScore },
                    { label: 'Content', value: crawl.contentScore },
                    { label: 'Crawlability', value: crawl.crawlabilityScore },
                  ].map((s, i) => (
                    <div key={i} className="p-4 bg-sky-50 border border-sky-100 rounded-xl text-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
                      <p className={`text-2xl font-bold ${(s.value ?? 0) >= 80 ? 'text-emerald-500' : (s.value ?? 0) >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                        {s.value ?? '—'}
                      </p>
                      <p className="text-[10px] text-slate-400">/100</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ranking distribution */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Keyword Ranking Distribution</p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Top 3', value: traffic.keywordsTop3, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', bar: 'bg-emerald-500' },
                  { label: 'Top 10', value: traffic.keywordsTop10, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', bar: 'bg-cyan-500' },
                  { label: 'Top 30', value: traffic.keywordsTop30, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', bar: 'bg-amber-500' },
                  { label: 'Total ranking', value: traffic.keywordsTotal, color: 'text-slate-800', bg: 'bg-sky-50 border-sky-100', bar: 'bg-indigo-500' },
                ].map((r, i) => (
                  <div key={i} className={`p-4 border rounded-xl ${r.bg}`}>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{r.label}</p>
                    <p className={`text-2xl font-bold ${r.color} mb-2`}>{r.value}</p>
                    <div className="h-1 bg-sky-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${r.bar}`}
                        style={{ width: `${Math.min(100, (r.value / traffic.keywordsTotal) * 100)}%` }} />
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
                  { label: 'Indexed pages', value: indexing.indexedPages, icon: '✓', color: 'text-emerald-400' },
                  { label: 'Crawl errors', value: indexing.crawlErrors, icon: '✗', color: indexing.crawlErrors > 0 ? 'text-red-400' : 'text-slate-400' },
                  { label: 'Not indexed', value: indexing.notIndexed, icon: '○', color: indexing.notIndexed > 8 ? 'text-amber-400' : 'text-slate-500' },
                  { label: 'Redirects', value: indexing.redirects, icon: '→', color: 'text-slate-500' },
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
                  View all {keywords.length} →
                </button>
              </div>
              <div className="space-y-1.5">
                {keywords.slice(0, 5).map((kw, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 bg-sky-50 border border-sky-100 rounded-xl hover:bg-sky-100 transition-colors">
                    <RankBadge pos={kw.position} />
                    <p className="text-sm text-slate-700 flex-1 font-mono text-xs">{kw.keyword}</p>
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

        {/* ── KEYWORDS ──────────────────────────────────────────────────── */}
        {activeTab === 'keywords' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Keyword Rankings</h2>
                <p className="text-sm text-slate-500">{traffic.keywordsTotal} keywords tracked</p>
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
                    <th className="text-right p-3 font-medium">Clicks</th>
                    <th className="text-right p-3 font-medium">Impressions</th>
                    <th className="text-right p-3 font-medium">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw, i) => (
                    <tr key={i} className="border-b border-sky-100 hover:bg-sky-50 transition-colors">
                      <td className="p-3 font-mono text-slate-700">{kw.keyword}</td>
                      <td className="p-3 text-center"><RankBadge pos={kw.position} /></td>
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
                  <p className="text-sm font-semibold text-slate-800 mb-1">WebOpp can identify keyword gaps in your market</p>
                  <p className="text-xs text-slate-500 mb-2">
                    Discover high-value terms your competitors rank for that you don&apos;t target yet.
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

        {/* ── CORE WEB VITALS ─────────────────────────────────────────── */}
        {activeTab === 'cwv' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Core Web Vitals</h2>
              <p className="text-sm text-slate-500">
                {crawl ? `Crawl data from ${fmtDate(crawl.completedAt)}` : 'Demo data'}
              </p>
            </div>

            {/* Site-wide scores */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Site-wide averages</p>
              <div className="grid grid-cols-4 gap-3">
                <CwvPill value={cwv.avgLcp} good={2.5} ok={4.0} unit="s" label="LCP — Largest Contentful Paint" />
                <CwvPill value={cwv.avgFid} good={100} ok={300} unit="ms" label="FID — First Input Delay" />
                <CwvPill value={cwv.avgCls} good={0.1} ok={0.25} unit="" label="CLS — Cumulative Layout Shift" />
                <CwvPill value={cwv.avgTtfb} good={800} ok={1800} unit="ms" label="TTFB — Time to First Byte" />
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
                    {cwv.pages.map((p, i) => (
                      <tr key={i} className="border-b border-sky-100 hover:bg-sky-50 transition-colors">
                        <td className="p-3 font-mono text-slate-600">{p.url}</td>
                        <td className={`p-3 text-right font-medium ${(p.lcp ?? 0) < 2.5 ? 'text-emerald-400' : (p.lcp ?? 0) < 4 ? 'text-amber-400' : 'text-red-400'}`}>
                          {p.lcp}s
                        </td>
                        <td className={`p-3 text-right ${(p.cls ?? 0) < 0.1 ? 'text-emerald-400' : (p.cls ?? 0) < 0.25 ? 'text-amber-400' : 'text-red-400'}`}>
                          {p.cls}
                        </td>
                        <td className={`p-3 text-right ${(p.fid ?? 0) < 100 ? 'text-emerald-400' : (p.fid ?? 0) < 300 ? 'text-amber-400' : 'text-red-400'}`}>
                          {p.fid}ms
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${p.pass ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
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

        {/* ── INDEXING ──────────────────────────────────────────────────── */}
        {activeTab === 'indexing' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Indexing & Crawl Status</h2>
              <p className="text-sm text-slate-500">
                {crawl ? `${crawl.pagesAnalyzed} pages analyzed · ${fmtDate(crawl.completedAt)}` : 'Demo data'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Indexed vs not */}
              <div className="p-5 bg-sky-50 border border-sky-100 rounded-2xl">
                <p className="text-xs text-slate-500 mb-4">Page indexing breakdown</p>
                <div className="space-y-3">
                  {[
                    { label: 'Indexed', value: indexing.indexedPages, color: 'bg-emerald-500', text: 'text-emerald-400', total: indexing.indexedPages + indexing.notIndexed },
                    { label: 'Not indexed', value: indexing.notIndexed, color: 'bg-amber-500', text: 'text-amber-400', total: indexing.indexedPages + indexing.notIndexed },
                    { label: 'Crawl errors', value: indexing.crawlErrors, color: 'bg-red-500', text: 'text-red-400', total: indexing.indexedPages + indexing.notIndexed },
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
                <p className="text-xs text-slate-500 mb-4">Crawled pages</p>
                <div className="space-y-2">
                  {indexing.pages.length > 0 ? (
                    indexing.pages.slice(0, 8).map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-sky-100 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.isIndexable ? 'bg-emerald-500' : p.statusCode === 404 ? 'bg-red-500' : 'bg-amber-500'}`} />
                          <span className="text-xs font-mono text-slate-500 truncate max-w-[180px]">{p.url}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] ${p.isIndexable ? 'text-emerald-400/70' : p.statusCode === 404 ? 'text-red-400' : 'text-amber-400'}`}>
                            {p.statusCode === 404 ? '404' : p.statusCode === 301 ? '301 redirect' : p.hasNoindex ? 'noindex' : p.isIndexable ? 'Indexed' : 'Not indexed'}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">No crawl data available yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
