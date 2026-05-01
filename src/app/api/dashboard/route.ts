// src/app/api/dashboard/route.ts
// Dashboard data API — aggregates sessions, intent, drop-offs, and health from live DB data.
//
// GET /api/dashboard?siteId=xxx&days=30

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';
import { computeDropOffAnalysis } from '@/lib/analytics/dropoff';
import { getBaselineComparison } from '@/lib/baseline/engine';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId');
    const days = parseInt(searchParams.get('days') ?? '30', 10);

    if (!siteId) {
      return NextResponse.json({ error: 'siteId required' }, { status: 400 });
    }

    // Verify user has access to this site (super admins bypass org membership)
    const siteAccess = await verifySiteAccess(session.user.email, siteId);
    if (!siteAccess) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: {
        onboarding: {
          select: { averageOrderValue: true, leadToWinRate: true },
        },
      },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - days);

    // Previous period for comparison
    const prevStart = new Date(periodStart);
    prevStart.setDate(prevStart.getDate() - days);

    // ── Dashboard stats in a single interactive transaction (1 connection) ──
    const {
      totalSessions,
      prevSessions,
      intentAgg,
      prevIntentAgg,
      intentDistribution,
      latestHealth,
    } = await prisma.$transaction(async (tx) => {
      const [ts, ps, ia, pia, id, lh] = await Promise.all([
        tx.visitorSession.count({
          where: { siteId, startedAt: { gte: periodStart, lte: now }, isBotFiltered: false },
        }),
        tx.visitorSession.count({
          where: { siteId, startedAt: { gte: prevStart, lt: periodStart }, isBotFiltered: false },
        }),
        tx.visitorSession.aggregate({
          where: { siteId, startedAt: { gte: periodStart, lte: now }, isBotFiltered: false, intentScore: { not: null } },
          _avg: { intentScore: true },
        }),
        tx.visitorSession.aggregate({
          where: { siteId, startedAt: { gte: prevStart, lt: periodStart }, isBotFiltered: false, intentScore: { not: null } },
          _avg: { intentScore: true },
        }),
        tx.visitorSession.groupBy({
          by: ['intentClass'],
          where: { siteId, startedAt: { gte: periodStart, lte: now }, isBotFiltered: false, intentClass: { not: null } },
          _count: true,
        }),
        tx.siteHealthCheck.findFirst({
          where: { siteId },
          orderBy: { checkedAt: 'desc' },
          select: { overallStatus: true },
        }),
      ]);
      return { totalSessions: ts, prevSessions: ps, intentAgg: ia, prevIntentAgg: pia, intentDistribution: id, latestHealth: lh };
    });

    // Drop-off runs after the transaction releases its connection
    const dropOff = await computeDropOffAnalysis({
      siteId,
      periodDays: days,
      avgOrderValue: site.onboarding?.averageOrderValue ?? 500,
      leadToWinRate: site.onboarding?.leadToWinRate ?? 0.08,
    });

    // ── Compute derived values ──────────────────────────────────────────
    const sessionChange = prevSessions > 0
      ? ((totalSessions - prevSessions) / prevSessions) * 100
      : 0;

    const avgIntent = Math.round(intentAgg._avg.intentScore ?? 0);
    const prevAvgIntent = prevIntentAgg._avg.intentScore ?? 0;
    const intentChange = prevAvgIntent > 0
      ? ((avgIntent - prevAvgIntent) / prevAvgIntent) * 100
      : 0;

    // Build intent distribution percentages
    const totalClassified = intentDistribution.reduce((s, g) => s + g._count, 0);
    const intentDist: Record<string, number> = {
      HIGH: 0, MEDIUM: 0, LOW: 0, RESEARCHER: 0, COMPETITOR: 0, BOT: 0,
    };
    const intentCounts: Record<string, number> = {
      HIGH: 0, MEDIUM: 0, LOW: 0, RESEARCHER: 0, COMPETITOR: 0, BOT: 0,
    };
    for (const group of intentDistribution) {
      if (group.intentClass && totalClassified > 0) {
        intentDist[group.intentClass] = Math.round((group._count / totalClassified) * 100);
        intentCounts[group.intentClass] = group._count;
      }
    }

    // Top 5 drop-off pages for the dashboard
    const dropOffPages = dropOff.pages.slice(0, 5).map(p => ({
      url: p.url,
      title: p.title,
      exitRate: p.exitRate,
      avgScrollDepth: p.avgScrollDepth,
      sessions: p.sessions,
      isStorylineBreakpoint: p.isStorylineBreakpoint,
    }));

    // ── Bounce rate (non-blocking) ──────────────────────────────────────
    let bounceRate = 0;
    try {
      if (totalSessions > 0) {
        const bounceCount = await prisma.visitorSession.count({
          where: { siteId, startedAt: { gte: periodStart, lte: now }, isBotFiltered: false, pageCount: { lte: 1 } },
        });
        bounceRate = Math.round((bounceCount / totalSessions) * 1000) / 10;
      }
    } catch { /* bounce rate calculation failed — skip */ }

    // ── Baseline comparison (non-blocking) ──────────────────────────────
    let baselineComparison = {};
    try {
      const currentMetrics = {
        sessions: totalSessions,
        bounce_rate: bounceRate,
        intent_score: avgIntent,
        revenue_at_risk: Math.round(dropOff.totalRevenueAtRisk),
      };
      baselineComparison = await getBaselineComparison(siteId, currentMetrics);
    } catch { /* baselines not available yet — skip */ }

    const response = {
      site: {
        id: site.id,
        name: site.name,
        domain: site.domain,
        url: site.url,
      },
      totalSessions,
      totalSessionsChange: Math.round(sessionChange * 10) / 10,
      avgIntentScore: avgIntent,
      avgIntentScoreChange: Math.round(intentChange * 10) / 10,
      revenueAtRisk: Math.round(dropOff.totalRevenueAtRisk),
      disengagedVisitors: dropOff.totalDisengagedVisitors,
      hasRevenueData: !!(site.onboarding?.averageOrderValue && site.onboarding?.leadToWinRate),
      bounceRate,
      intentDistribution: intentDist,
      intentCounts,
      dropOffPages,
      topPageSessions: dropOff.topPageSessions,
      healthStatus: latestHealth?.overallStatus ?? 'YELLOW',
      dataSource: dropOff.dataSource,
      prevSessions,
      // Subscription state
      subscription: {
        tier: site.subscriptionTier ?? 'WEBAUDIT',
        webauditStartDate: site.webauditStartDate?.toISOString() ?? null,
        webauditEndDate: site.webauditEndDate?.toISOString() ?? null,
        webwatchStartDate: site.webwatchStartDate?.toISOString() ?? null,
        hasWebOpp: site.hasWebOpp ?? false,
      },
      // Integration freshness — lets the dashboard show "GSC last synced X ago"
      // so users can tell at a glance whether the daily Inngest sync is firing.
      integrations: {
        gscConnected: site.gscConnected,
        gscLastSyncAt: site.gscLastSyncAt?.toISOString() ?? null,
        ga4Connected: site.ga4Connected,
        ga4LastSyncAt: site.ga4LastSyncAt?.toISOString() ?? null,
        gadsConnected: site.gadsConnected,
        gadsLastSyncAt: site.gadsLastSyncAt?.toISOString() ?? null,
      },
      reportSchedule: computeReportSchedule({
        tier: site.subscriptionTier ?? 'WEBAUDIT',
        webauditStartDate: site.webauditStartDate ?? null,
        webwatchStartDate: site.webwatchStartDate ?? null,
      }),
      baselineComparison,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error('[dashboard] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Compute when the next scheduled report fires for a given site.
// Used by the report modal header so users know when fresh numbers arrive.
// ---------------------------------------------------------------------------

function computeReportSchedule(input: {
  tier: string;
  webauditStartDate: Date | null;
  webwatchStartDate: Date | null;
}): {
  nextReportDate: string | null;
  nextReportLabel: string | null;
  auditComplete: boolean;
} {
  const { tier, webauditStartDate, webwatchStartDate } = input;
  const now = new Date();

  if (tier === 'WEBAUDIT_EXPIRED') {
    return { nextReportDate: null, nextReportLabel: null, auditComplete: true };
  }

  if (tier === 'WEBAUDIT' && webauditStartDate) {
    const day30 = new Date(webauditStartDate.getTime() + 30 * 86400000);
    const day60 = new Date(webauditStartDate.getTime() + 60 * 86400000);
    if (now < day30) return { nextReportDate: day30.toISOString(), nextReportLabel: 'Day 30 audit', auditComplete: false };
    if (now < day60) return { nextReportDate: day60.toISOString(), nextReportLabel: 'Day 60 final audit', auditComplete: false };
    // Past Day 60 but tier hasn't been flipped yet (cron runs at 4am UTC)
    return { nextReportDate: null, nextReportLabel: null, auditComplete: true };
  }

  if (tier === 'WEBWATCH' || tier === 'WEBWATCH_WEBOPP') {
    // First of next calendar month at 4am UTC
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 4, 0, 0, 0));
    const monthLabel = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { nextReportDate: nextMonth.toISOString(), nextReportLabel: monthLabel, auditComplete: false };
  }

  // Don't reference webwatchStartDate — silence unused-var linting on this branch
  void webwatchStartDate;
  return { nextReportDate: null, nextReportLabel: null, auditComplete: false };
}
