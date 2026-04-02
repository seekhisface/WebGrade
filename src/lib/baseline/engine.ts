// src/lib/baseline/engine.ts
// Baseline engine — compute, store, and compare site performance baselines.

import { prisma } from '@/lib/db/client';

// ── Compute current metrics for a site over N days ─────────────────────
export async function computeCurrentMetrics(siteId: string, days: number): Promise<Record<string, number>> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 86400000);

  const sessions = await prisma.visitorSession.findMany({
    where: {
      siteId,
      isBotFiltered: false,
      startedAt: { gte: periodStart, lte: now },
    },
    select: { intentScore: true, pageCount: true },
  });

  const totalSessions = sessions.length;
  const bounceCount = sessions.filter(s => s.pageCount <= 1).length;
  const intentScores = sessions.filter(s => s.intentScore != null).map(s => s.intentScore!);
  const avgIntentScore = intentScores.length > 0
    ? intentScores.reduce((a, b) => a + b, 0) / intentScores.length
    : 0;

  // High-intent sessions (score >= 70) as conversion proxy
  const highIntentCount = intentScores.filter(s => s >= 70).length;
  const conversionRate = totalSessions > 0
    ? (highIntentCount / totalSessions) * 100
    : 0;

  // Revenue at risk: bounced sessions * AOV
  const onboarding = await prisma.siteOnboarding.findFirst({
    where: { siteId },
    select: { averageOrderValue: true },
  });
  const aov = onboarding?.averageOrderValue ?? 100;
  const revenueAtRisk = bounceCount * aov;

  return {
    sessions: totalSessions,
    bounce_rate: totalSessions > 0 ? (bounceCount / totalSessions) * 100 : 0,
    intent_score: Math.round(avgIntentScore * 10) / 10,
    conversion_rate: Math.round(conversionRate * 10) / 10,
    revenue_at_risk: Math.round(revenueAtRisk),
  };
}

// ── Capture baseline: compute + persist metrics ────────────────────────
export async function captureBaseline(
  siteId: string,
  period: string,
  source: string,
  days: number = 60
): Promise<void> {
  const metrics = await computeCurrentMetrics(siteId, days);

  const data = Object.entries(metrics).map(([metricKey, value]) => ({
    siteId,
    metricKey,
    value,
    period,
    source,
  }));

  await prisma.siteBaseline.createMany({ data });
}

// ── Get baseline metrics for a site ────────────────────────────────────
export async function getBaseline(
  siteId: string,
  period?: string
): Promise<Record<string, number>> {
  let baselines;

  if (period) {
    baselines = await prisma.siteBaseline.findMany({
      where: { siteId, period },
      orderBy: { capturedAt: 'desc' },
    });
  } else {
    // Get the most recent baseline set by finding the latest capturedAt
    const latest = await prisma.siteBaseline.findFirst({
      where: { siteId },
      orderBy: { capturedAt: 'desc' },
      select: { period: true },
    });

    if (!latest) return {};

    baselines = await prisma.siteBaseline.findMany({
      where: { siteId, period: latest.period },
    });
  }

  const result: Record<string, number> = {};
  for (const b of baselines) {
    result[b.metricKey] = b.value;
  }
  return result;
}

// ── Compare current metrics against baseline ───────────────────────────
export async function getBaselineComparison(
  siteId: string,
  currentMetrics: Record<string, number>
): Promise<Record<string, { current: number; baseline: number; change: number; changePercent: number }>> {
  const baseline = await getBaseline(siteId);

  if (Object.keys(baseline).length === 0) return {};

  const comparison: Record<string, { current: number; baseline: number; change: number; changePercent: number }> = {};

  for (const [key, current] of Object.entries(currentMetrics)) {
    const base = baseline[key];
    if (base != null) {
      const change = current - base;
      const changePercent = base > 0 ? (change / base) * 100 : 0;
      comparison[key] = {
        current,
        baseline: base,
        change: Math.round(change * 10) / 10,
        changePercent: Math.round(changePercent * 10) / 10,
      };
    }
  }

  return comparison;
}

// ── Check if baseline should be reset (annual anniversary) ─────────────
export function shouldResetBaseline(site: {
  baselineResetDate?: Date | string | null;
  webwatchStartDate?: Date | string | null;
}): boolean {
  const now = new Date();

  if (site.baselineResetDate) {
    return new Date(site.baselineResetDate) <= now;
  }

  // Fallback: if WebWatch started > 365 days ago and no reset date set
  if (site.webwatchStartDate) {
    const daysSinceStart = (now.getTime() - new Date(site.webwatchStartDate).getTime()) / 86400000;
    return daysSinceStart >= 365;
  }

  return false;
}
