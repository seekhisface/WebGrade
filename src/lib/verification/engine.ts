// src/lib/verification/engine.ts
// Fix verification engine — captures before/after metrics for recommendations.
// Called when a recommendation is marked as implemented, and again after the
// measurement window to evaluate impact.

import { prisma } from '@/lib/db/client';

// ── Mark a recommendation as implemented ────────────────────────────────
// Captures the "before" metric value and creates a MeasurementJob
export async function markImplemented(
  recommendationId: string,
  customerNote?: string,
  measureAfterDays: number = 14,
): Promise<{ measurementJobId: string }> {
  const rec = await prisma.recommendation.findUnique({
    where: { id: recommendationId },
    select: {
      id: true, siteId: true, sourceModule: true,
      baselineMetricKey: true, baselineMetricValue: true,
    },
  });

  if (!rec) throw new Error('Recommendation not found');

  // Update recommendation status
  await prisma.recommendation.update({
    where: { id: recommendationId },
    data: {
      implementationStatus: 'IMPLEMENTED',
      customerNote,
      customerUpdatedAt: new Date(),
      completedAt: new Date(),
      status: 'DONE',
    },
  });

  // Create measurement job
  const measureAfterDate = new Date();
  measureAfterDate.setDate(measureAfterDate.getDate() + measureAfterDays);

  const job = await prisma.measurementJob.create({
    data: {
      recommendationId,
      siteId: rec.siteId,
      productModule: rec.sourceModule,
      measureAfterDate,
      status: 'PENDING',
      beforeValue: rec.baselineMetricValue,
    },
  });

  return { measurementJobId: job.id };
}

// ── Evaluate pending measurement jobs ────────────────────────────────────
// Called by Inngest daily — checks if measurement window has passed
export async function evaluatePendingMeasurements(): Promise<{ evaluated: number }> {
  const now = new Date();

  const pendingJobs = await prisma.measurementJob.findMany({
    where: {
      status: 'PENDING',
      measureAfterDate: { lte: now },
    },
    include: {
      recommendation: {
        select: {
          id: true, siteId: true, baselineMetricKey: true,
          baselineMetricValue: true, targetMetricValue: true,
        },
      },
    },
  });

  let evaluated = 0;

  for (const job of pendingJobs) {
    try {
      const rec = job.recommendation;
      if (!rec.baselineMetricKey) {
        await prisma.measurementJob.update({
          where: { id: job.id },
          data: { status: 'INSUFFICIENT_DATA', resultType: 'INSUFFICIENT_DATA' },
        });
        continue;
      }

      // Measure current value based on metric key
      const currentValue = await measureMetric(rec.siteId, rec.baselineMetricKey);

      if (currentValue === null) {
        await prisma.measurementJob.update({
          where: { id: job.id },
          data: { status: 'INSUFFICIENT_DATA', resultType: 'INSUFFICIENT_DATA' },
        });
        continue;
      }

      const beforeValue = job.beforeValue ?? rec.baselineMetricValue ?? 0;
      const changePct = beforeValue > 0 ? ((currentValue - beforeValue) / beforeValue) * 100 : 0;

      // Determine if the change is in the right direction
      const isLowerBetter = ['exit_rate', 'bounce_rate', 'lcp_ms', 'wasted_spend', 'rage_clicks'].includes(rec.baselineMetricKey);
      const improved = isLowerBetter ? currentValue < beforeValue : currentValue > beforeValue;
      const significantChange = Math.abs(changePct) > 5;

      const resultType = improved && significantChange ? 'WORKED'
        : improved ? 'PARTIAL'
        : 'NO_CHANGE';

      // Update measurement job
      await prisma.measurementJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETE',
          afterValue: currentValue,
          changePct: Math.round(changePct * 10) / 10,
          isSignificant: significantChange,
          resultType,
          completedAt: new Date(),
        },
      });

      // Update recommendation verification
      const verificationStatus = resultType === 'WORKED' ? 'IMPROVED'
        : resultType === 'PARTIAL' ? 'PARTIAL'
        : 'NO_CHANGE';

      await prisma.recommendation.update({
        where: { id: rec.id },
        data: {
          lastVerifiedAt: new Date(),
          lastVerifiedValue: currentValue,
          verificationStatus,
          verificationNote: `${isLowerBetter ? 'Decreased' : 'Increased'} from ${beforeValue.toFixed(1)} to ${currentValue.toFixed(1)} (${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%)`,
          contradictionFlag: resultType === 'NO_CHANGE',
        },
      });

      evaluated++;
    } catch (err) {
      console.error(`[Verification] Failed for job ${job.id}:`, err);
    }
  }

  return { evaluated };
}

// ── Measure a specific metric for a site ─────────────────────────────────
async function measureMetric(siteId: string, metricKey: string): Promise<number | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  switch (metricKey) {
    case 'exit_rate': {
      // Average exit rate across all pages
      const pages = await prisma.pageView.findMany({
        where: { siteId, enteredAt: { gte: thirtyDaysAgo } },
        select: { isExit: true },
      });
      if (pages.length === 0) return null;
      return (pages.filter(p => p.isExit).length / pages.length) * 100;
    }
    case 'bounce_rate': {
      const sessions = await prisma.visitorSession.findMany({
        where: { siteId, isBotFiltered: false, startedAt: { gte: thirtyDaysAgo } },
        select: { pageCount: true },
      });
      if (sessions.length === 0) return null;
      return (sessions.filter(s => s.pageCount <= 1).length / sessions.length) * 100;
    }
    case 'intent_score': {
      const agg = await prisma.visitorSession.aggregate({
        where: { siteId, isBotFiltered: false, startedAt: { gte: thirtyDaysAgo }, intentScore: { not: null } },
        _avg: { intentScore: true },
      });
      return agg._avg.intentScore ?? null;
    }
    case 'conversion_rate': {
      const total = await prisma.visitorSession.count({
        where: { siteId, isBotFiltered: false, startedAt: { gte: thirtyDaysAgo } },
      });
      if (total === 0) return null;
      const converted = await prisma.visitorSession.count({
        where: { siteId, isBotFiltered: false, startedAt: { gte: thirtyDaysAgo }, conversionGoalHit: true },
      });
      return (converted / total) * 100;
    }
    case 'rage_clicks': {
      const agg = await prisma.sessionEvent.aggregate({
        where: { siteId, eventType: 'RAGE_CLICK', timestamp: { gte: thirtyDaysAgo } },
        _count: true,
      });
      return agg._count;
    }
    case 'lcp_ms': {
      const crawl = await prisma.seoCrawl.findFirst({
        where: { siteId, crawlStatus: 'COMPLETED' },
        orderBy: { startedAt: 'desc' },
        select: { id: true },
      });
      if (!crawl) return null;
      const pages = await prisma.seoPageResult.findMany({
        where: { crawlId: crawl.id, lcp: { not: null } },
        select: { lcp: true },
      });
      if (pages.length === 0) return null;
      return pages.reduce((sum, p) => sum + (p.lcp ?? 0), 0) / pages.length * 1000; // convert to ms
    }
    case 'wasted_spend': {
      const agg = await prisma.adSource.aggregate({
        where: { siteId, estimatedWastedSpend: { not: null } },
        _sum: { estimatedWastedSpend: true },
      });
      return agg._sum.estimatedWastedSpend ?? null;
    }
    default:
      return null;
  }
}
