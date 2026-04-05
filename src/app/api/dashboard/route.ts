// src/app/api/dashboard/route.ts
// Dashboard data API — aggregates sessions, intent, drop-offs, and health from live DB data.
//
// GET /api/dashboard?siteId=xxx&days=30

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
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

    // Verify user has access to this site
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        org: {
          members: { some: { user: { email: session.user.email } } },
        },
      },
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
    for (const group of intentDistribution) {
      if (group.intentClass && totalClassified > 0) {
        intentDist[group.intentClass] = Math.round((group._count / totalClassified) * 100);
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

    // ── Bounce rate ─────────────────────────────────────────────────────
    const bounceCount = totalSessions > 0
      ? await prisma.visitorSession.count({
          where: { siteId, startedAt: { gte: periodStart, lte: now }, isBotFiltered: false, pageCount: { lte: 1 } },
        })
      : 0;
    const bounceRate = totalSessions > 0
      ? Math.round((bounceCount / totalSessions) * 1000) / 10
      : 0;

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
      bounceRate,
      intentDistribution: intentDist,
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
      baselineComparison,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error('[dashboard] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
