// =============================================================================
// WebGrade — P1-07: Drop-off Analysis + Storyline Breakpoint Engine
//
// This module runs against real PageView + VisitorSession data (when the
// snippet is installed) and falls back to typed demo data structures when not.
//
// Core jobs:
//  1. Aggregate page-level exit rates and scroll depths from raw PageView rows
//  2. Classify each page against the benchmark registry
//  3. Score storyline breakpoints — pages where the conversion journey breaks
//  4. Rank pages by revenue impact (not just by exit rate)
//  5. Return a typed DropOffAnalysis ready for the dashboard and AI layer
// =============================================================================

import { prisma } from '@/lib/db/client';
import {
  classifyPageUrl,
  PAGE_BENCHMARKS,
  exitRateGap,
  scrollDepthGap,
  exitRateSeverity,
  scrollDepthSeverity,
  estimateMonthlyRevenueAtRisk,
  type PageCategory,
  type GapSeverity,
} from './benchmarks';

// ---------------------------------------------------------------------------
// Output types — used by the dashboard, the AI prompt builder, and PDF export
// ---------------------------------------------------------------------------

export interface PageDropOffResult {
  url: string;
  title: string;
  pageCategory: PageCategory;
  sessions: number;

  // Actuals
  exitRate: number;           // 0–100
  avgScrollDepth: number;     // 0–100
  avgTimeOnPageSec: number;
  rageClickCount: number;
  hesitationCount: number;

  // vs benchmark
  benchmarkExitRate: number;
  benchmarkScrollDepth: number;
  exitRateGap: number;        // positive = worse than benchmark
  scrollDepthGap: number;     // positive = below benchmark
  exitRateSeverity: GapSeverity;
  scrollDepthSeverity: GapSeverity;

  // Storyline scoring
  isStorylineBreakpoint: boolean;
  storylineScore: number;     // 0–100, higher = more likely to be breaking the journey
  storylineReason: string | null;

  // Revenue
  estimatedMonthlyRevenueAtRisk: number;
  revenueImpactRank: number;  // 1 = highest impact
}

export interface DropOffAnalysis {
  siteId: string;
  periodStart: Date;
  periodEnd: Date;
  totalSessions: number;
  totalRevenueAtRisk: number;
  pages: PageDropOffResult[];
  topBreakpoint: PageDropOffResult | null;
  dataSource: 'live' | 'demo';
  generatedAt: Date;
}

// ---------------------------------------------------------------------------
// Storyline breakpoint detector
//
// A "storyline breakpoint" is a page where the conversion journey
// significantly degrades — not just any page with a high exit rate.
// We score based on:
//  - Position in conversion funnel (pricing/signup = higher weight)
//  - Exit rate gap vs benchmark (larger gap = more likely breakpoint)
//  - Traffic volume (low-traffic pages can't be breakpoints)
//  - Whether it precedes the conversion goal in the URL pattern
// ---------------------------------------------------------------------------

const FUNNEL_WEIGHT: Record<PageCategory, number> = {
  pricing:    10,
  signup:     10,
  demo:       9,
  features:   7,
  landing:    8,
  home:       5,
  about:      3,
  case_study: 4,
  contact:    6,
  blog:       2,
  docs:       1,
  login:      3,
  unknown:    2,
};

function scoreStorylineBreakpoint(params: {
  pageCategory: PageCategory;
  exitRate: number;
  benchmarkExitRate: number;
  sessions: number;
  totalSessions: number;
}): { isBreakpoint: boolean; score: number; reason: string | null } {
  const { pageCategory, exitRate, benchmarkExitRate, sessions, totalSessions } = params;

  const funnelWeight = FUNNEL_WEIGHT[pageCategory] ?? 2;
  const exitGap = exitRate - benchmarkExitRate;
  const trafficShare = sessions / totalSessions;

  // Must have meaningful traffic to be a breakpoint
  if (trafficShare < 0.05) {
    return { isBreakpoint: false, score: 0, reason: null };
  }

  // Score = funnel position weight × exit gap (floored at 0) × traffic share boost
  const score = Math.min(100, Math.round(
    funnelWeight * Math.max(0, exitGap) * (0.5 + trafficShare * 2)
  ));

  const isBreakpoint = score >= 35;

  let reason: string | null = null;
  if (isBreakpoint) {
    const benchmark = PAGE_BENCHMARKS[pageCategory];
    if (exitGap > 20) {
      reason = `Exit rate is ${exitGap} points above the ${benchmark.label} benchmark — this page is actively breaking the buyer journey`;
    } else if (exitGap > 10) {
      reason = `Exit rate is ${exitGap} points above benchmark for ${benchmark.label}s — high-value funnel stage losing visitors`;
    } else {
      reason = `${benchmark.label} at a critical conversion stage — even small improvements here compound significantly`;
    }
  }

  return { isBreakpoint, score, reason };
}

// ---------------------------------------------------------------------------
// Main engine — runs against real Prisma data
// ---------------------------------------------------------------------------

export async function computeDropOffAnalysis(params: {
  siteId: string;
  periodDays?: number;
  avgOrderValue?: number;
  leadToWinRate?: number;
}): Promise<DropOffAnalysis> {
  const { siteId, periodDays = 7, avgOrderValue = 500, leadToWinRate = 0.08 } = params;

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - periodDays);

  // ── 1. Get all page views and section_view events in the period ──────────
  // Uses batch transaction to share a single DB connection for all 3 queries
  const [pageViews, sectionEvents, totalSessions] = await prisma.$transaction([
    prisma.pageView.findMany({
      where: {
        siteId,
        enteredAt: { gte: periodStart, lte: periodEnd },
        session: { isBotFiltered: false },
      },
      select: {
        url: true,
        title: true,
        maxScrollDepthPct: true,
        timeOnPageMs: true,
        isExit: true,
        rageClickCount: true,
        hesitationCount: true,
        sessionId: true,
      },
    }),
    // Section views for single-page sites — treat each #section as a virtual page
    prisma.sessionEvent.findMany({
      where: {
        siteId,
        eventType: 'SECTION_VIEW',
        timestamp: { gte: periodStart, lte: periodEnd },
        session: { isBotFiltered: false },
      },
      select: {
        pageUrl: true,
        metadata: true,
        sessionId: true,
      },
    }),
    prisma.visitorSession.count({
      where: {
        siteId,
        startedAt: { gte: periodStart, lte: periodEnd },
        isBotFiltered: false,
      },
    }),
  ]);

  if (pageViews.length === 0 || totalSessions === 0) {
    return {
      siteId,
      periodStart,
      periodEnd,
      totalSessions: 0,
      totalRevenueAtRisk: 0,
      pages: [],
      topBreakpoint: null,
      dataSource: 'live' as const,
      generatedAt: new Date(),
    };
  }

  // ── 3. Aggregate by URL ──────────────────────────────────────────────────
  const urlMap = new Map<string, {
    title: string;
    sessions: Set<string>;
    exits: number;
    scrollDepths: number[];
    timesOnPage: number[];
    rageClicks: number;
    hesitations: number;
  }>();

  for (const pv of pageViews) {
    const key = pv.url.split('?')[0]; // strip query params
    if (!urlMap.has(key)) {
      urlMap.set(key, {
        title: pv.title ?? key,
        sessions: new Set(),
        exits: 0,
        scrollDepths: [],
        timesOnPage: [],
        rageClicks: 0,
        hesitations: 0,
      });
    }
    const entry = urlMap.get(key)!;
    entry.sessions.add(pv.sessionId);
    if (pv.isExit) entry.exits++;
    if (pv.maxScrollDepthPct !== null) entry.scrollDepths.push(pv.maxScrollDepthPct);
    if (pv.timeOnPageMs !== null) entry.timesOnPage.push(pv.timeOnPageMs / 1000);
    if (pv.rageClickCount) entry.rageClicks += pv.rageClickCount;
    if (pv.hesitationCount) entry.hesitations += pv.hesitationCount;
  }

  // ── 3b. Inject section_view events as virtual pages ─────────────────────
  // On single-page sites, #pricing and #features are meaningful navigation
  // points that would otherwise be invisible in the drop-off analysis.
  // Each section gets its own entry keyed as "baseUrl#section".
  // Sessions that viewed a section but then exited count as exits for that section.
  const sessionLastSection = new Map<string, string>(); // sessionId → last section key
  for (const ev of sectionEvents) {
    const meta = ev.metadata as Record<string, unknown> | null;
    const section = typeof meta?.section === 'string' ? meta.section : null;
    if (!section) continue;

    const baseUrl = ev.pageUrl.split('?')[0].split('#')[0];
    const key = `${baseUrl}#${section}`;
    sessionLastSection.set(ev.sessionId, key);

    if (!urlMap.has(key)) {
      urlMap.set(key, {
        title: `#${section}`,
        sessions: new Set(),
        exits: 0,
        scrollDepths: [],
        timesOnPage: [],
        rageClicks: 0,
        hesitations: 0,
      });
    }
    urlMap.get(key)!.sessions.add(ev.sessionId);
  }

  // Mark exits: if the visitor's last section_view was this section and they
  // exited the page, count it as an exit for the section
  for (const pv of pageViews) {
    if (!pv.isExit) continue;
    const lastSection = sessionLastSection.get(pv.sessionId);
    if (lastSection && urlMap.has(lastSection)) {
      urlMap.get(lastSection)!.exits++;
    }
  }

  // ── 4. Build results ─────────────────────────────────────────────────────
  const rawResults: Omit<PageDropOffResult, 'revenueImpactRank'>[] = [];

  for (const [url, agg] of urlMap.entries()) {
    const sessions = agg.sessions.size;
    if (sessions < 10) continue; // skip low-traffic pages — not statistically meaningful

    const exitRate = Math.round((agg.exits / sessions) * 100);
    const avgScrollDepth = agg.scrollDepths.length > 0
      ? Math.round(agg.scrollDepths.reduce((a, b) => a + b, 0) / agg.scrollDepths.length)
      : 0;
    const avgTimeOnPageSec = agg.timesOnPage.length > 0
      ? Math.round(agg.timesOnPage.reduce((a, b) => a + b, 0) / agg.timesOnPage.length)
      : 0;

    const pageCategory = classifyPageUrl(url);
    const benchmark = PAGE_BENCHMARKS[pageCategory];

    const erGap = exitRateGap(exitRate, benchmark);
    const sdGap = scrollDepthGap(avgScrollDepth, benchmark);
    const erSeverity = exitRateSeverity(exitRate, benchmark);
    const sdSeverity = scrollDepthSeverity(avgScrollDepth, benchmark);

    const storyline = scoreStorylineBreakpoint({
      pageCategory,
      exitRate,
      benchmarkExitRate: benchmark.exitRate,
      sessions,
      totalSessions,
    });

    const revenueAtRisk = estimateMonthlyRevenueAtRisk({
      sessions,
      exitRateActual: exitRate,
      exitRateBenchmark: benchmark.exitRate,
      avgOrderValue,
      leadToWinRate,
      revenueImpactMultiplier: benchmark.revenueImpactMultiplier,
    });

    rawResults.push({
      url,
      title: agg.title,
      pageCategory,
      sessions,
      exitRate,
      avgScrollDepth,
      avgTimeOnPageSec,
      rageClickCount: agg.rageClicks,
      hesitationCount: agg.hesitations,
      benchmarkExitRate: benchmark.exitRate,
      benchmarkScrollDepth: benchmark.scrollDepth,
      exitRateGap: erGap,
      scrollDepthGap: sdGap,
      exitRateSeverity: erSeverity,
      scrollDepthSeverity: sdSeverity,
      isStorylineBreakpoint: storyline.isBreakpoint,
      storylineScore: storyline.score,
      storylineReason: storyline.reason,
      estimatedMonthlyRevenueAtRisk: revenueAtRisk,
    });
  }

  // ── 5. Sort by revenue impact and assign ranks ───────────────────────────
  rawResults.sort((a, b) => b.estimatedMonthlyRevenueAtRisk - a.estimatedMonthlyRevenueAtRisk);
  const results: PageDropOffResult[] = rawResults.map((r, i) => ({
    ...r,
    revenueImpactRank: i + 1,
  }));

  const totalRevenueAtRisk = results.reduce((s, r) => s + r.estimatedMonthlyRevenueAtRisk, 0);
  const topBreakpoint = results.find(r => r.isStorylineBreakpoint) ?? null;

  // ── 6. Persist isDropOffPage + storylineBreakpoint back to PageView ───────
  // Do this async — don't block the API response
  persistDropOffFlags(siteId, results).catch(console.error);

  return {
    siteId,
    periodStart,
    periodEnd,
    totalSessions,
    totalRevenueAtRisk,
    pages: results,
    topBreakpoint,
    dataSource: 'live',
    generatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Persist computed flags back to the DB so they're queryable
// ---------------------------------------------------------------------------
async function persistDropOffFlags(siteId: string, results: PageDropOffResult[]): Promise<void> {
  const dropOffUrls = new Set(
    results.filter(r => r.exitRateSeverity === 'critical' || r.exitRateSeverity === 'warning').map(r => r.url)
  );
  const breakpointUrls = new Set(results.filter(r => r.isStorylineBreakpoint).map(r => r.url));

  await prisma.$transaction([
    prisma.pageView.updateMany({
      where: { siteId, url: { in: [...dropOffUrls] } },
      data: { isDropOffPage: true },
    }),
    prisma.pageView.updateMany({
      where: { siteId, url: { in: [...breakpointUrls] } },
      data: { storylineBreakpoint: true },
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Demo fallback — structurally identical to live output
// Used when snippet not yet installed
// ---------------------------------------------------------------------------
export function buildDemoAnalysis(
  siteId: string,
  periodStart: Date,
  periodEnd: Date,
): DropOffAnalysis {
  const pages: PageDropOffResult[] = [
    {
      url: '/features',
      title: 'Features',
      pageCategory: 'features',
      sessions: 1820,
      exitRate: 68,
      avgScrollDepth: 34,
      avgTimeOnPageSec: 48,
      rageClickCount: 12,
      hesitationCount: 44,
      benchmarkExitRate: 44,
      benchmarkScrollDepth: 62,
      exitRateGap: 24,
      scrollDepthGap: 28,
      exitRateSeverity: 'critical',
      scrollDepthSeverity: 'critical',
      isStorylineBreakpoint: true,
      storylineScore: 82,
      storylineReason: 'Exit rate is 24 points above the Features page benchmark — this page is actively breaking the buyer journey',
      estimatedMonthlyRevenueAtRisk: 18200,
      revenueImpactRank: 1,
    },
    {
      url: '/pricing',
      title: 'Pricing',
      pageCategory: 'pricing',
      sessions: 943,
      exitRate: 54,
      avgScrollDepth: 71,
      avgTimeOnPageSec: 124,
      rageClickCount: 3,
      hesitationCount: 28,
      benchmarkExitRate: 42,
      benchmarkScrollDepth: 68,
      exitRateGap: 12,
      scrollDepthGap: -3,
      exitRateSeverity: 'warning',
      scrollDepthSeverity: 'ok',
      isStorylineBreakpoint: false,
      storylineScore: 41,
      storylineReason: null,
      estimatedMonthlyRevenueAtRisk: 14800,
      revenueImpactRank: 2,
    },
    {
      url: '/signup',
      title: 'Sign Up',
      pageCategory: 'signup',
      sessions: 512,
      exitRate: 41,
      avgScrollDepth: 82,
      avgTimeOnPageSec: 68,
      rageClickCount: 1,
      hesitationCount: 18,
      benchmarkExitRate: 28,
      benchmarkScrollDepth: 88,
      exitRateGap: 13,
      scrollDepthGap: 6,
      exitRateSeverity: 'warning',
      scrollDepthSeverity: 'ok',
      isStorylineBreakpoint: false,
      storylineScore: 38,
      storylineReason: null,
      estimatedMonthlyRevenueAtRisk: 8200,
      revenueImpactRank: 3,
    },
  ];

  return {
    siteId,
    periodStart,
    periodEnd,
    totalSessions: 4821,
    totalRevenueAtRisk: 41200,
    pages,
    topBreakpoint: pages[0],
    dataSource: 'demo',
    generatedAt: new Date(),
  };
}
