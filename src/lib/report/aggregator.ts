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
