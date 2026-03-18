/**
 * lib/analytics/baseline.ts
 *
 * BASELINE ESTABLISHMENT SERVICE
 * ================================
 *
 * Determines and stores the performance baseline for a site.
 * The baseline is what all future monthly comparisons are measured against.
 *
 * RULES:
 * 1. If GA4 is connected: use first 30 days of GA4 data as baseline
 * 2. If snippet is installed: use first 30 days of snippet data as baseline
 * 3. If neither: baseline is "pending" — established once data arrives
 * 4. After month 1, switch to month-over-month (MoM) comparisons
 * 5. The baseline NEVER changes unless the customer explicitly resets it
 *
 * BASELINE WINDOW:
 * - We capture the first 30 days of available data (not necessarily calendar month)
 * - After day 30, every subsequent month is compared to this fixed baseline
 * - The baseline month label is stored (e.g. "December 2025") for display
 *
 * SWITCHING TO MoM:
 * - Once baseline is established AND 2+ monthly reports exist, WebWatch
 *   shows both: "vs. baseline (Dec 2025)" and "vs. last month"
 * - The baseline remains visible as an anchor point
 */

import { prisma } from '@/lib/db/client';

export type BaselineStatus = 'PENDING' | 'ESTABLISHING' | 'ESTABLISHED';

export interface BaselineConfig {
  siteId: string;
  status: BaselineStatus;
  baselineStartDate: Date | null;
  baselineEndDate: Date | null;
  baselineLabel: string | null; // e.g. "December 2025"
  dataSource: 'ga4' | 'snippet' | 'mixed' | null;
  metrics: BaselineMetrics | null;
}

export interface BaselineMetrics {
  // Traffic
  totalSessions: number;
  totalPageviews: number;
  uniqueVisitors: number;

  // Engagement
  avgSessionDurationSec: number;
  bounceRate: number;
  pagesPerSession: number;

  // Intent (if snippet data available)
  avgIntentScore: number | null;
  highIntentPct: number | null;
  conversionRate: number | null;

  // Ad spend (if available from onboarding)
  monthlyAdSpend: number | null;
  costPerTrial: number | null;
  wastedSpendPct: number | null;
}

/**
 * Check if a site has enough data to establish a baseline.
 * Returns the data source and date range available.
 */
export async function checkBaselineReadiness(siteId: string): Promise<{
  ready: boolean;
  dataSource: 'ga4' | 'snippet' | 'mixed' | null;
  earliestDataDate: Date | null;
  latestDataDate: Date | null;
  daysCovered: number;
  message: string;
}> {
  // Check GA4 baseline data
  const ga4Rows = await prisma.siteBaseline.findMany({
    where: { siteId, source: 'ga4_import' },
    orderBy: { period: 'asc' },
  });

  // Check snippet (visitor session) data
  const snippetStats = await prisma.visitorSession.aggregate({
    where: { siteId },
    _count: { id: true },
    _min: { startedAt: true },
    _max: { startedAt: true },
  });

  const hasGA4 = ga4Rows.length > 0;
  const hasSnippet = (snippetStats._count.id ?? 0) > 0;

  if (!hasGA4 && !hasSnippet) {
    return {
      ready: false,
      dataSource: null,
      earliestDataDate: null,
      latestDataDate: null,
      daysCovered: 0,
      message: 'No data available yet. Connect GA4 or install the tracking snippet to begin.',
    };
  }

  // Determine date range
  let earliestDate: Date | null = null;
  let latestDate: Date | null = null;
  let source: 'ga4' | 'snippet' | 'mixed' = 'ga4';

  if (hasGA4) {
    // GA4 baselines are stored with period strings like "2024-Q4"
    // We approximate: use the range from import
    const onboarding = await prisma.siteOnboarding.findUnique({ where: { siteId } });
    if (onboarding?.ga4ConnectedAt) {
      earliestDate = new Date(onboarding.ga4ConnectedAt.getTime() - 90 * 24 * 60 * 60 * 1000);
      latestDate = onboarding.ga4ConnectedAt;
    }
  }

  if (hasSnippet && snippetStats._min.startedAt && snippetStats._max.startedAt) {
    const snippetStart = snippetStats._min.startedAt;
    const snippetEnd = snippetStats._max.startedAt;
    if (!earliestDate || snippetStart < earliestDate) earliestDate = snippetStart;
    if (!latestDate || snippetEnd > latestDate) latestDate = snippetEnd;
    source = hasGA4 ? 'mixed' : 'snippet';
  }

  const daysCovered = earliestDate && latestDate
    ? Math.floor((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const ready = daysCovered >= 7; // Need at least 7 days for a meaningful baseline

  return {
    ready,
    dataSource: source,
    earliestDataDate: earliestDate,
    latestDataDate: latestDate,
    daysCovered,
    message: ready
      ? `${daysCovered} days of data available from ${source === 'ga4' ? 'GA4' : source === 'snippet' ? 'behavioral tracking' : 'GA4 + behavioral tracking'}`
      : `Only ${daysCovered} days of data — need at least 7 days to establish baseline`,
  };
}

/**
 * Establish the baseline for a site.
 * Takes the first 30 days of available data and stores key metrics.
 * 
 * This is called:
 * - Automatically after onboarding completes
 * - Manually if the customer wants to reset their baseline
 */
export async function establishBaseline(siteId: string): Promise<BaselineConfig> {
  const readiness = await checkBaselineReadiness(siteId);

  if (!readiness.ready || !readiness.earliestDataDate) {
    return {
      siteId,
      status: 'PENDING',
      baselineStartDate: null,
      baselineEndDate: null,
      baselineLabel: null,
      dataSource: null,
      metrics: null,
    };
  }

  // Use first 30 days (or all available data if less than 30 days)
  const baselineStart = readiness.earliestDataDate;
  const thirtyDaysLater = new Date(baselineStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  const baselineEnd = readiness.latestDataDate && readiness.latestDataDate < thirtyDaysLater
    ? readiness.latestDataDate
    : thirtyDaysLater;

  const baselineLabel = baselineStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Aggregate metrics for baseline period
  const metrics = await aggregateBaselineMetrics(siteId, baselineStart, baselineEnd, readiness.dataSource);

  // Store baseline in SiteBaseline records
  const existingConfig = await prisma.siteBaseline.findFirst({
    where: { siteId, metricKey: 'baseline_config' },
  });
  if (existingConfig) {
    await prisma.siteBaseline.update({
      where: { id: existingConfig.id },
      data: { period: baselineLabel, capturedAt: new Date() },
    });
  } else {
    await prisma.siteBaseline.create({
      data: {
        siteId,
        metricKey: 'baseline_config',
        value: 1,
        period: baselineLabel,
        source: 'baseline_establishment',
        capturedAt: new Date(),
      },
    });
  }

  // Store individual baseline metrics
  const metricsToStore: Array<{ key: string; value: number }> = [
    { key: 'baseline_sessions', value: metrics.totalSessions },
    { key: 'baseline_pageviews', value: metrics.totalPageviews },
    { key: 'baseline_bounce_rate', value: metrics.bounceRate },
    { key: 'baseline_avg_session_sec', value: metrics.avgSessionDurationSec },
  ];

  if (metrics.avgIntentScore !== null) {
    metricsToStore.push({ key: 'baseline_intent_score', value: metrics.avgIntentScore });
  }
  if (metrics.conversionRate !== null) {
    metricsToStore.push({ key: 'baseline_conversion_rate', value: metrics.conversionRate });
  }

  for (const m of metricsToStore) {
    await prisma.siteBaseline.upsert({
      where: { siteId_metricKey: { siteId, metricKey: m.key } },
      create: {
        siteId,
        metricKey: m.key,
        value: m.value,
        period: baselineLabel,
        source: 'baseline_establishment',
        capturedAt: new Date(),
      },
      update: { value: m.value, period: baselineLabel, collectedAt: new Date() },
    });
  }

  return {
    siteId,
    status: 'ESTABLISHED',
    baselineStartDate: baselineStart,
    baselineEndDate: baselineEnd,
    baselineLabel,
    dataSource: readiness.dataSource,
    metrics,
  };
}

/**
 * Get the current baseline config for a site.
 * Returns null if no baseline is established yet.
 */
export async function getBaselineConfig(siteId: string): Promise<BaselineConfig | null> {
  const configRow = await prisma.siteBaseline.findFirst({
    where: { siteId, metricKey: 'baseline_config' },
  });

  if (!configRow) {
    // No baseline yet — check if data is available
    const readiness = await checkBaselineReadiness(siteId);
    return {
      siteId,
      status: readiness.ready ? 'ESTABLISHING' : 'PENDING',
      baselineStartDate: null,
      baselineEndDate: null,
      baselineLabel: null,
      dataSource: readiness.dataSource,
      metrics: null,
    };
  }

  // Load stored metrics
  const metricRows = await prisma.siteBaseline.findMany({
    where: { siteId, source: 'baseline_establishment' },
  });

  const getMetric = (key: string) => metricRows.find(r => r.metricKey === key)?.value ?? 0;

  const metrics: BaselineMetrics = {
    totalSessions: getMetric('baseline_sessions'),
    totalPageviews: getMetric('baseline_pageviews'),
    uniqueVisitors: getMetric('baseline_unique_visitors'),
    avgSessionDurationSec: getMetric('baseline_avg_session_sec'),
    bounceRate: getMetric('baseline_bounce_rate'),
    pagesPerSession: getMetric('baseline_pages_per_session'),
    avgIntentScore: getMetric('baseline_intent_score') || null,
    highIntentPct: getMetric('baseline_high_intent_pct') || null,
    conversionRate: getMetric('baseline_conversion_rate') || null,
    monthlyAdSpend: getMetric('baseline_ad_spend') || null,
    costPerTrial: getMetric('baseline_cost_per_trial') || null,
    wastedSpendPct: getMetric('baseline_wasted_spend_pct') || null,
  };

  return {
    siteId,
    status: 'ESTABLISHED',
    baselineStartDate: null, // Would need to store this separately
    baselineEndDate: null,
    baselineLabel: configRow.period,
    dataSource: null,
    metrics,
  };
}

/**
 * Compare current period metrics to baseline.
 * Returns delta values (+ means improvement, - means regression) for each metric.
 */
export function compareToBaseline(
  current: Partial<BaselineMetrics>,
  baseline: BaselineMetrics,
): Record<string, { delta: number; pct: number; improved: boolean }> {
  const compare = (cur: number | null | undefined, base: number, higherIsBetter = true) => {
    if (cur === null || cur === undefined || base === 0) return { delta: 0, pct: 0, improved: true };
    const delta = cur - base;
    const pct = (delta / base) * 100;
    const improved = higherIsBetter ? delta >= 0 : delta <= 0;
    return { delta, pct, improved };
  };

  return {
    sessions: compare(current.totalSessions, baseline.totalSessions),
    pageviews: compare(current.totalPageviews, baseline.totalPageviews),
    bounceRate: compare(current.bounceRate, baseline.bounceRate, false), // lower is better
    intentScore: compare(current.avgIntentScore ?? 0, baseline.avgIntentScore ?? 0),
    conversionRate: compare(current.conversionRate ?? 0, baseline.conversionRate ?? 0),
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function aggregateBaselineMetrics(
  siteId: string,
  startDate: Date,
  endDate: Date,
  dataSource: 'ga4' | 'snippet' | 'mixed' | null,
): Promise<BaselineMetrics> {
  // Try to get snippet-based metrics
  if (dataSource === 'snippet' || dataSource === 'mixed') {
    const sessions = await prisma.visitorSession.findMany({
      where: { siteId, startedAt: { gte: startDate, lte: endDate } },
      select: { intentScore: true, converted: true, durationSec: true, isBotFiltered: true },
    });

    const realSessions = sessions.filter(s => !s.isBotFiltered);
    const totalSessions = realSessions.length;
    const avgIntentScore = totalSessions > 0
      ? Math.round(realSessions.reduce((sum, s) => sum + (s.intentScore ?? 0), 0) / totalSessions)
      : 0;
    const conversions = realSessions.filter(s => s.converted).length;
    const conversionRate = totalSessions > 0 ? (conversions / totalSessions) * 100 : 0;
    const avgDuration = totalSessions > 0
      ? Math.round(realSessions.reduce((sum, s) => sum + (s.durationSec ?? 0), 0) / totalSessions)
      : 0;

    return {
      totalSessions,
      totalPageviews: totalSessions * 2.3, // estimate until we have pageview data
      uniqueVisitors: Math.round(totalSessions * 0.85),
      avgSessionDurationSec: avgDuration,
      bounceRate: 45, // placeholder
      pagesPerSession: 2.3,
      avgIntentScore,
      highIntentPct: Math.round((realSessions.filter(s => (s.intentScore ?? 0) >= 70).length / Math.max(totalSessions, 1)) * 100),
      conversionRate,
      monthlyAdSpend: null,
      costPerTrial: null,
      wastedSpendPct: null,
    };
  }

  // GA4-only baseline — use stored baseline metrics
  const ga4Rows = await prisma.siteBaseline.findMany({
    where: { siteId, source: 'ga4_import' },
  });

  const getGA4 = (key: string) => ga4Rows.find(r => r.metricKey === key)?.value ?? 0;

  return {
    totalSessions: getGA4('sessions_90d') / 3, // convert 90d to 30d equivalent
    totalPageviews: getGA4('pageviews_90d') / 3,
    uniqueVisitors: getGA4('new_users_90d') / 3,
    avgSessionDurationSec: getGA4('avg_session_duration'),
    bounceRate: getGA4('bounce_rate'),
    pagesPerSession: 2.5,
    avgIntentScore: null, // not available from GA4
    highIntentPct: null,
    conversionRate: getGA4('conversion_rate'),
    monthlyAdSpend: null,
    costPerTrial: null,
    wastedSpendPct: null,
  };
}
