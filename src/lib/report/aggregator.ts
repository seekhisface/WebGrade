/**
 * lib/report/aggregator.ts
 *
 * P1-12: Behavioral Report Data Aggregator
 *
 * Collects ALL data needed to generate a WebGrade Interim Report™:
 * - Drop-off analysis (behavioral)
 * - GA4 baseline metrics
 * - Onboarding context
 * - Alert history
 * - Intent scoring summary
 * - Session + pageview stats
 *
 * Returns a typed ReportData object passed directly to the AI prompt builder.
 */

import { prisma } from '@/lib/db/client';
import { computeDropOffAnalysis } from '@/lib/analytics/dropoff';
import { loadSiteContext } from '@/lib/ai/context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BaselineMetrics {
  sessions90d: number;
  pageviews90d: number;
  bounceRate: number;
  avgSessionDuration: number;
  newUsers90d: number;
  conversions90d: number;
  conversionRate: number;
}

export interface LiveMetrics {
  totalSessions: number;
  totalPageviews: number;
  avgIntentScore: number;
  highIntentSessions: number;
  rageClickEvents: number;
  hesitationEvents: number;
  // Sum of lost-visitors above per-page benchmark (qualified-visitor loss).
  // Used for the "Disengaged Leads" KPI card when no revenue data is available.
  totalDisengagedVisitors: number;
  dataSource: 'live' | 'demo';
  periodDays: number;
}

export interface TopPage {
  url: string;
  title: string;
  sessions: number;
  exitRate: number;
  scrollDepth: number;
  revenueAtRisk: number;
  isBreakpoint: boolean;
  severity: string;
}

export interface AlertSummary {
  total: number;
  critical: number;
  high: number;
  resolved: number;
  topAlertType: string | null;
}

// Drives the conditional logic in the Bottom line prompt — specifically whether
// the LLM is allowed to state a $/mo revenue-at-risk figure or must use the
// "cost unquantifiable" variant.
export interface TrackingHealth {
  conversionEventsFiring: boolean;
  conversionEventsCount: number;
  botPct: number;                  // 0-100
  eventDataCompleteness: number;   // 0-100, % of non-bot sessions with event-level data
}

// Top 3 leaks table (Phase 3 Section 3). Sorted by revenue_at_risk if conversion
// tracking is firing, otherwise by qualified-visitor loss. Severity is always
// based on what % of total qualified-visitor loss this page accounts for.
export interface TopLeak {
  rank: number;
  url: string;
  title: string | null;
  sessions: number;
  exitRate: number;
  qualifiedVisitorsLost: number;   // HIGH or MEDIUM intent sessions that exited on this page
  revenueAtRisk: number;
  attributablePct: number;         // % of total qualified-visitor loss this page accounts for
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  evidence: string;                // programmatically generated one-sentence summary
}

// Per-leak page-level signals fed into the Findings & Insights LLM prompt
// (Phase 3 Section 4). The model receives these as structured input so behavioral
// claims are anchored in real data rather than hallucinated.
export interface LeakPageSignals {
  url: string;
  sessions: number;
  exitRate: number;
  scrollDepth: number;
  rageClicks: number;
  hesitations: number;
  intentBreakdown: { HIGH: number; MEDIUM: number; LOW: number; RESEARCHER: number; COMPETITOR: number; BOT: number };
}

// Section 5: Behavioral intent distribution
export interface IntentDistribution {
  HIGH: number;
  MEDIUM: number;
  LOW: number;
  RESEARCHER: number;
  COMPETITOR: number;
  BOT: number;
  totalClassified: number;
  topPageForCompetitor: string | null;  // most-visited URL by COMPETITOR-classified sessions
}

// Section 7: Paid traffic efficiency
export interface PaidCampaignRow {
  campaign: string;
  source: string;
  utmMedium: string;          // renamed to avoid collision with mediumIntent below
  sessions: number;
  botFlagged: number;
  highIntent: number;
  mediumIntent: number;
  lowIntent: number;
  verdict: 'Pure waste' | 'Mediocre' | 'Performing';
}

// Section 8: SEO snapshot — mirrors what the dashboard SEO Performance section shows
export interface SeoSnapshot {
  organicSessions: number;
  totalClicks: number;
  impressions: number;
  avgCtr: number;
  avgPosition: number;
  keywordsTracked: number;
  topKeywords: Array<{ keyword: string; position: number; clicks: number; ctr: number }>;
  cwv: { lcp: number | null; cls: number | null; fid: number | null; allPassing: boolean };
}

// Section 11: Projected outcome
export interface ProjectedOutcome {
  metric: string;
  current: string;
  afterFixes: string;
  delta: string;
}

export interface ReportData {
  siteId: string;
  siteName: string;
  domain: string;
  periodStart: Date;
  periodEnd: Date;

  // Business context
  context: {
    businessDescription: string | null;
    targetAudience: string | null;
    primaryValueProp: string | null;
    conversionGoalName: string | null;
    conversionGoalUrl: string | null;
    monthlyAdSpend: number | null;
    averageOrderValue: number | null;
    conversionRate: number | null;
    leadToWinRate: number | null;
    competitorUrls: string[];
    dataScenario: 'A' | 'B' | 'C' | null;
  };

  // Metrics
  baseline: BaselineMetrics | null;
  live: LiveMetrics;

  // Pages
  topBreakpoint: TopPage | null;
  criticalPages: TopPage[];
  allPages: TopPage[];

  // Revenue
  totalRevenueAtRisk: number;
  estimatedMonthlyImpact: { low: number; high: number } | null;

  // Alerts
  alerts: AlertSummary;

  // Tracking health — used by Bottom line prompt conditional logic
  trackingHealth: TrackingHealth;

  // Top 3 leaks — Phase 3 Section 3 ranked table
  topLeaks: TopLeak[];

  // Per-leak structured signals fed into the Findings & insights LLM prompt (Section 4)
  leakSignals: LeakPageSignals[];

  // Section 5: behavioral intent distribution
  intentDistribution: IntentDistribution;

  // Section 7: paid traffic campaigns + verdicts
  paidCampaigns: PaidCampaignRow[];

  // Section 8: SEO snapshot from GSC (null if not connected)
  seoSnapshot: SeoSnapshot | null;

  // Competitors
  competitors: string[];
}

// ---------------------------------------------------------------------------
// Main aggregator
// ---------------------------------------------------------------------------

export async function aggregateReportData(
  siteId: string,
  userEmail: string | null,
  periodDays: number = 45,
): Promise<ReportData | null> {
  // Load site context. userEmail=null is fine — cron jobs hit this code path
  // and loadSiteContext's last-resort branch loads the site without auth.
  const ctx = await loadSiteContext(siteId, userEmail);
  if (!ctx) return null;

  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Run drop-off analysis
  const dropoff = await computeDropOffAnalysis({
    siteId,
    periodDays,
  });

  // Load GA4 baseline metrics
  const baselineRows = await prisma.siteBaseline.findMany({
    where: { siteId, source: 'ga4_import' },
    orderBy: { capturedAt: 'desc' },
  });

  const baseline = parseBaseline(baselineRows);

  // Load alert summary
  const alerts = await prisma.alert.findMany({
    where: { siteId, triggeredAt: { gte: periodStart } },
    orderBy: { triggeredAt: 'desc' },
  });

  const alertSummary: AlertSummary = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'CRITICAL').length,
    high: alerts.filter(a => a.severity === 'HIGH').length,
    resolved: alerts.filter(a => a.resolvedAt !== null).length,
    topAlertType: alerts[0]?.alertType ?? null,
  };

  // Load onboarding context for competitors
  const onboarding = await prisma.siteOnboarding.findUnique({ where: { siteId } });
  const competitors = (onboarding?.competitorUrls ?? []).filter(Boolean);

  // Build top pages list
  const allPages: TopPage[] = dropoff.pages.map(p => ({
    url: p.url,
    title: p.title,
    sessions: p.sessions,
    exitRate: p.exitRate,
    scrollDepth: p.avgScrollDepth,
    revenueAtRisk: p.estimatedMonthlyRevenueAtRisk,
    isBreakpoint: p.isStorylineBreakpoint,
    severity: p.exitRateSeverity,
  }));

  const criticalPages = allPages
    .filter(p => p.severity === 'critical' || p.severity === 'severe')
    .slice(0, 5);

  const topBreakpoint = dropoff.topBreakpoint
    ? allPages.find(p => p.url === dropoff.topBreakpoint!.url) ?? null
    : null;

  // Estimate dollar impact
  let estimatedMonthlyImpact: { low: number; high: number } | null = null;
  if (ctx.averageOrderValue && ctx.conversionRate && dropoff.totalRevenueAtRisk > 0) {
    estimatedMonthlyImpact = {
      low: Math.round(dropoff.totalRevenueAtRisk * 0.2),
      high: Math.round(dropoff.totalRevenueAtRisk * 0.6),
    };
  }

  // Live metrics from drop-off analysis
  const live: LiveMetrics = {
    totalSessions: dropoff.totalSessions,
    totalPageviews: dropoff.pages.reduce((sum, p) => sum + p.sessions, 0),
    avgIntentScore: 0, // populated below if data exists
    highIntentSessions: 0,
    rageClickEvents: dropoff.pages.reduce((sum, p) => sum + p.rageClickCount, 0),
    hesitationEvents: dropoff.pages.reduce((sum, p) => sum + p.hesitationCount, 0),
    totalDisengagedVisitors: dropoff.totalDisengagedVisitors,
    dataSource: dropoff.dataSource,
    periodDays,
  };

  // Try to get intent score averages from visitor sessions
  try {
    const sessionStats = await prisma.visitorSession.aggregate({
      where: { siteId, startedAt: { gte: periodStart } },
      _avg: { intentScore: true },
      _count: { id: true },
    });
    const highIntent = await prisma.visitorSession.count({
      where: { siteId, startedAt: { gte: periodStart }, intentScore: { gte: 70 } },
    });
    live.avgIntentScore = Math.round(sessionStats._avg.intentScore ?? 0);
    live.highIntentSessions = highIntent;
  } catch { /* snippet not collecting yet */ }

  // Tracking health — drives the Bottom line prompt's conditional cost branch
  let trackingHealth: TrackingHealth = {
    conversionEventsFiring: false,
    conversionEventsCount: 0,
    botPct: 0,
    eventDataCompleteness: 0,
  };
  try {
    const [conversionEventsCount, totalSessionsAll, botCount, sessionsWithEvents] = await Promise.all([
      prisma.visitorSession.count({
        where: { siteId, startedAt: { gte: periodStart }, conversionGoalHit: true },
      }),
      prisma.visitorSession.count({
        where: { siteId, startedAt: { gte: periodStart } },
      }),
      prisma.visitorSession.count({
        where: { siteId, startedAt: { gte: periodStart }, OR: [{ isBotFiltered: true }, { isBotSuspect: true }] },
      }),
      prisma.visitorSession.count({
        where: { siteId, startedAt: { gte: periodStart }, isBotFiltered: false, events: { some: {} } },
      }),
    ]);
    trackingHealth = {
      conversionEventsFiring: conversionEventsCount > 0,
      conversionEventsCount,
      botPct: totalSessionsAll > 0 ? Math.round((botCount / totalSessionsAll) * 1000) / 10 : 0,
      eventDataCompleteness: dropoff.totalSessions > 0 ? Math.round((sessionsWithEvents / dropoff.totalSessions) * 1000) / 10 : 0,
    };
  } catch { /* leave defaults */ }

  // ── Top 3 leaks (Phase 3 Section 3) ───────────────────────────────────────
  const topLeaks = await computeTopLeaks(siteId, periodStart, dropoff.pages, trackingHealth.conversionEventsFiring);

  // ── Per-leak page signals for Findings & Insights (Phase 3 Section 4) ─────
  const leakSignals = await computeLeakSignals(siteId, periodStart, topLeaks, dropoff.pages);

  // ── Intent distribution (Phase 3 Section 5) ───────────────────────────────
  const intentDistribution = await computeIntentDistribution(siteId, periodStart);

  // ── Paid campaigns (Phase 3 Section 7) ────────────────────────────────────
  const paidCampaigns = await computePaidCampaigns(siteId, periodStart);

  // ── SEO snapshot (Phase 3 Section 8) ──────────────────────────────────────
  const seoSnapshot = await computeSeoSnapshot(siteId);

  return {
    siteId,
    siteName: ctx.siteName,
    domain: ctx.domain,
    periodStart,
    periodEnd: now,

    context: {
      businessDescription: ctx.businessDescription,
      targetAudience: ctx.targetAudience,
      primaryValueProp: ctx.primaryValueProp,
      conversionGoalName: ctx.conversionGoalName,
      conversionGoalUrl: ctx.conversionGoalUrl,
      monthlyAdSpend: ctx.monthlyAdSpend,
      averageOrderValue: ctx.averageOrderValue,
      conversionRate: ctx.conversionRate,
      leadToWinRate: ctx.leadToWinRate,
      competitorUrls: competitors,
      dataScenario: ctx.dataScenario,
    },

    baseline,
    live,
    topBreakpoint,
    criticalPages,
    allPages,
    totalRevenueAtRisk: dropoff.totalRevenueAtRisk,
    estimatedMonthlyImpact,
    alerts: alertSummary,
    trackingHealth,
    topLeaks,
    leakSignals,
    intentDistribution,
    paidCampaigns,
    seoSnapshot,
    competitors,
  };
}

// ---------------------------------------------------------------------------
// Compute the top 3 leaks (Phase 3 Section 3)
//
// For each candidate page in the drop-off analysis, count HIGH/MEDIUM intent
// sessions that exited on that page (qualified-visitor loss). Severity ladder
// is based on what % of total qualified-visitor loss the page accounts for:
//   CRITICAL >25%, HIGH 10-25%, MEDIUM 5-10%, drop <5%.
// Sort order depends on whether conversion events are firing.
// ---------------------------------------------------------------------------

async function computeTopLeaks(
  siteId: string,
  periodStart: Date,
  pages: Array<{ url: string; title: string; sessions: number; exitRate: number; estimatedMonthlyRevenueAtRisk: number }>,
  conversionEventsFiring: boolean,
): Promise<TopLeak[]> {
  if (pages.length === 0) return [];

  // Pull every isExit=true PageView in the period with the session's intentClass.
  // After the recent ingest fix, isExit is set on at most one PageView per session
  // (the one they actually ended on), so this gives us distinct exit-sessions per page.
  const exits = await prisma.pageView.findMany({
    where: {
      siteId,
      enteredAt: { gte: periodStart },
      isExit: true,
      session: { isBotFiltered: false },
    },
    select: {
      url: true,
      session: { select: { intentClass: true } },
    },
  });

  // Count HIGH/MEDIUM intent exits per URL
  const qualifiedByUrl = new Map<string, number>();
  for (const pv of exits) {
    const c = pv.session.intentClass;
    if (c === 'HIGH' || c === 'MEDIUM') {
      const key = pv.url.split('?')[0]; // strip query (matches dropoff key)
      qualifiedByUrl.set(key, (qualifiedByUrl.get(key) ?? 0) + 1);
    }
  }
  const totalQualifiedLoss = Array.from(qualifiedByUrl.values()).reduce((a, b) => a + b, 0);

  // Build candidates from drop-off pages
  const candidates = pages.map(p => {
    const qualifiedLost = qualifiedByUrl.get(p.url) ?? 0;
    const attributablePct = totalQualifiedLoss > 0 ? (qualifiedLost / totalQualifiedLoss) * 100 : 0;
    return {
      url: p.url,
      title: p.title,
      sessions: p.sessions,
      exitRate: p.exitRate,
      qualifiedVisitorsLost: qualifiedLost,
      revenueAtRisk: p.estimatedMonthlyRevenueAtRisk,
      attributablePct,
    };
  });

  // Sort: revenue if conversions firing, else qualified-visitor loss
  candidates.sort((a, b) =>
    conversionEventsFiring
      ? b.revenueAtRisk - a.revenueAtRisk
      : b.qualifiedVisitorsLost - a.qualifiedVisitorsLost,
  );

  // Apply severity threshold + take top 3
  const top: TopLeak[] = [];
  for (const c of candidates) {
    if (top.length >= 3) break;
    let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    if (c.attributablePct > 25) severity = 'CRITICAL';
    else if (c.attributablePct >= 10) severity = 'HIGH';
    else if (c.attributablePct >= 5) severity = 'MEDIUM';
    else continue; // Below 5% doesn't make the table — never pad

    const exitedCount = Math.round(c.sessions * (c.exitRate / 100));
    const evidence = `${c.sessions.toLocaleString()} sessions on ${c.url}, ${exitedCount.toLocaleString()} (${Math.round(c.exitRate)}%) exited — ${c.qualifiedVisitorsLost} of those were HIGH or MEDIUM intent (${c.attributablePct.toFixed(1)}% of total qualified-visitor loss).`;

    top.push({
      rank: top.length + 1,
      url: c.url,
      title: c.title,
      sessions: c.sessions,
      exitRate: c.exitRate,
      qualifiedVisitorsLost: c.qualifiedVisitorsLost,
      revenueAtRisk: c.revenueAtRisk,
      attributablePct: c.attributablePct,
      severity,
      evidence,
    });
  }

  return top;
}

// ---------------------------------------------------------------------------
// Parse baseline rows into typed metrics
// ---------------------------------------------------------------------------

function parseBaseline(
  rows: { metricKey: string; value: number }[]
): BaselineMetrics | null {
  if (rows.length === 0) return null;

  const get = (key: string) => rows.find(r => r.metricKey === key)?.value ?? 0;

  return {
    sessions90d: get('sessions_90d'),
    pageviews90d: get('pageviews_90d'),
    bounceRate: get('bounce_rate'),
    avgSessionDuration: get('avg_session_duration'),
    newUsers90d: get('new_users_90d'),
    conversions90d: get('conversions_90d'),
    conversionRate: get('conversion_rate'),
  };
}

// ---------------------------------------------------------------------------
// Section 4: Per-leak page signals for the Findings LLM prompt
// ---------------------------------------------------------------------------

async function computeLeakSignals(
  siteId: string,
  periodStart: Date,
  topLeaks: TopLeak[],
  pages: Array<{ url: string; sessions: number; exitRate: number; avgScrollDepth: number; rageClickCount: number; hesitationCount: number }>,
): Promise<LeakPageSignals[]> {
  if (topLeaks.length === 0) return [];

  const result: LeakPageSignals[] = [];
  for (const leak of topLeaks) {
    const pageRow = pages.find(p => p.url === leak.url);

    // Intent breakdown for sessions that VISITED this page (entered or exited it)
    const sessionsOnPage = await prisma.pageView.findMany({
      where: { siteId, enteredAt: { gte: periodStart }, url: leak.url, session: { isBotFiltered: false } },
      select: { session: { select: { intentClass: true } } },
    });
    const intentBreakdown = { HIGH: 0, MEDIUM: 0, LOW: 0, RESEARCHER: 0, COMPETITOR: 0, BOT: 0 };
    for (const pv of sessionsOnPage) {
      const c = pv.session.intentClass;
      if (c && c in intentBreakdown) intentBreakdown[c as keyof typeof intentBreakdown]++;
    }

    result.push({
      url: leak.url,
      sessions: leak.sessions,
      exitRate: leak.exitRate,
      scrollDepth: pageRow?.avgScrollDepth ?? 0,
      rageClicks: pageRow?.rageClickCount ?? 0,
      hesitations: pageRow?.hesitationCount ?? 0,
      intentBreakdown,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Section 5: Intent distribution
// ---------------------------------------------------------------------------

async function computeIntentDistribution(siteId: string, periodStart: Date): Promise<IntentDistribution> {
  const [byClass, competitorPages] = await Promise.all([
    prisma.visitorSession.groupBy({
      by: ['intentClass'],
      where: { siteId, startedAt: { gte: periodStart }, isBotFiltered: false, intentClass: { not: null } },
      _count: { _all: true },
    }),
    prisma.pageView.groupBy({
      by: ['url'],
      where: {
        siteId,
        enteredAt: { gte: periodStart },
        session: { isBotFiltered: false, intentClass: 'COMPETITOR' },
      },
      _count: { _all: true },
      orderBy: { _count: { url: 'desc' } },
      take: 1,
    }),
  ]);

  const dist: IntentDistribution = {
    HIGH: 0, MEDIUM: 0, LOW: 0, RESEARCHER: 0, COMPETITOR: 0, BOT: 0,
    totalClassified: 0,
    topPageForCompetitor: competitorPages[0]?.url ?? null,
  };
  for (const row of byClass) {
    const c = row.intentClass;
    if (c && c in dist) {
      (dist as unknown as Record<string, number>)[c] = row._count._all;
      dist.totalClassified += row._count._all;
    }
  }
  return dist;
}

// ---------------------------------------------------------------------------
// Section 7: Paid campaigns + verdict logic
// ---------------------------------------------------------------------------

async function computePaidCampaigns(siteId: string, periodStart: Date): Promise<PaidCampaignRow[]> {
  // Group paid traffic sessions by campaign + source + medium and break down
  // into HIGH/MEDIUM/LOW intent + bot-flagged.
  const sessions = await prisma.visitorSession.findMany({
    where: {
      siteId,
      startedAt: { gte: periodStart },
      trafficSource: 'paid',
    },
    select: { utmCampaign: true, utmSource: true, utmMedium: true, intentClass: true, isBotFiltered: true, isBotSuspect: true },
  });

  const map = new Map<string, PaidCampaignRow>();
  for (const s of sessions) {
    const key = `${s.utmSource ?? '?'}::${s.utmMedium ?? '?'}::${s.utmCampaign ?? '(none)'}`;
    let row = map.get(key);
    if (!row) {
      row = {
        campaign: s.utmCampaign ?? '(none)',
        source: s.utmSource ?? '?',
        utmMedium: s.utmMedium ?? '?',
        sessions: 0,
        botFlagged: 0,
        highIntent: 0,
        mediumIntent: 0,
        lowIntent: 0,
        verdict: 'Mediocre',
      };
      map.set(key, row);
    }
    row.sessions++;
    if (s.isBotFiltered || s.isBotSuspect) row.botFlagged++;
    if (s.intentClass === 'HIGH') row.highIntent++;
    else if (s.intentClass === 'MEDIUM') row.mediumIntent++;
    else if (s.intentClass === 'LOW') row.lowIntent++;
  }

  // Compute verdicts per spec rules
  const rows = Array.from(map.values());
  for (const r of rows) {
    const total = r.sessions || 1;
    const highMedPct = ((r.highIntent + r.mediumIntent) / total) * 100;
    const botPct = (r.botFlagged / total) * 100;
    if (highMedPct < 2 && botPct > 40) r.verdict = 'Pure waste';
    else if (highMedPct < 5) r.verdict = 'Mediocre';
    else r.verdict = 'Performing';
  }
  rows.sort((a, b) => b.sessions - a.sessions);
  return rows;
}

// ---------------------------------------------------------------------------
// Section 8: SEO snapshot
// ---------------------------------------------------------------------------

async function computeSeoSnapshot(siteId: string): Promise<SeoSnapshot | null> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { gscConnected: true },
  });
  if (!site?.gscConnected) return null;

  // Pull last 28 days of GSC data
  const lookback = new Date(Date.now() - 28 * 86400000);

  const [keywords, traffic, latestPageResult] = await Promise.all([
    prisma.seoKeywordRanking.findMany({
      where: { siteId, date: { gte: lookback } },
      orderBy: [{ date: 'desc' }, { clicks: 'desc' }],
    }),
    prisma.seoTrafficSnapshot.findMany({
      where: { siteId, date: { gte: lookback } },
      orderBy: { date: 'desc' },
    }),
    // CWV lives on per-page crawl results — grab the most recent for any page
    // as a representative measurement for the site overall.
    prisma.seoPageResult.findFirst({
      where: { crawl: { siteId }, lcp: { not: null } },
      orderBy: { id: 'desc' },
      select: { lcp: true, cls: true, fid: true },
    }),
  ]);

  // Aggregate keyword stats
  const distinctKeywords = new Map<string, { keyword: string; position: number; clicks: number; ctr: number }>();
  for (const k of keywords) {
    if (!distinctKeywords.has(k.keyword)) {
      distinctKeywords.set(k.keyword, {
        keyword: k.keyword,
        position: k.position ?? 0,
        clicks: k.clicks ?? 0,
        ctr: k.ctr ?? 0,
      });
    }
  }
  const topKeywords = Array.from(distinctKeywords.values())
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5);

  const totalClicks = traffic.reduce((sum: number, t) => sum + (t.clicks ?? 0), 0);
  const totalImpressions = traffic.reduce((sum: number, t) => sum + (t.impressions ?? 0), 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const positions = keywords.map(k => k.position).filter((p): p is number => p !== null);
  const avgPosition = positions.length > 0 ? positions.reduce((a: number, b: number) => a + b, 0) / positions.length : 0;
  const organicSessions = traffic.reduce((sum: number, t) => sum + (t.organicSessions ?? 0), 0);

  const lcp = latestPageResult?.lcp ?? null;
  const cls = latestPageResult?.cls ?? null;
  const fid = latestPageResult?.fid ?? null;
  // CWV thresholds: LCP <2.5s, CLS <0.1, FID <100ms (stored values are seconds for lcp, count for cls, ms for fid per schema)
  const allPassing = lcp !== null && cls !== null && fid !== null && lcp < 2.5 && cls < 0.1 && fid < 100;

  return {
    organicSessions,
    totalClicks,
    impressions: totalImpressions,
    avgCtr: Math.round(avgCtr * 100) / 100,
    avgPosition: Math.round(avgPosition * 10) / 10,
    keywordsTracked: distinctKeywords.size,
    topKeywords,
    cwv: { lcp, cls, fid, allPassing },
  };
}
