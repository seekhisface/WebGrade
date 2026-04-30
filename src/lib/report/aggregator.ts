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
    competitors,
  };
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
