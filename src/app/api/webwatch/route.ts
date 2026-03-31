// src/app/api/webwatch/route.ts
// WebWatch monthly report API — aggregates monthly performance report,
// recommendations with implementation status, and behavioral shift data.
//
// GET /api/webwatch?siteId=xxx&year=2026&month=2

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId');

    if (!siteId) {
      return NextResponse.json({ error: 'siteId required' }, { status: 400 });
    }

    // Verify user access
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        org: {
          members: { some: { user: { email: session.user.email } } },
        },
      },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Get the year/month from query or default to latest report
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');

    let report;
    if (yearParam && monthParam) {
      report = await prisma.monthlyPerformanceReport.findUnique({
        where: {
          siteId_year_month: {
            siteId,
            year: parseInt(yearParam),
            month: parseInt(monthParam),
          },
        },
      });
    } else {
      // Get latest report
      report = await prisma.monthlyPerformanceReport.findFirst({
        where: { siteId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });
    }

    if (!report) {
      return NextResponse.json({ error: 'No WebWatch report found', hasReport: false }, { status: 404 });
    }

    // Get all recommendations for this site
    const recommendations = await prisma.recommendation.findMany({
      where: { siteId },
      orderBy: { priorityScore: 'desc' },
    });

    // Compute behavioral shifts from real session data
    // Current month window
    const monthStart = new Date(report.year, report.month - 1, 1);
    const monthEnd = new Date(report.year, report.month, 0, 23, 59, 59);

    // Baseline data from SiteBaseline
    const baselines = await prisma.siteBaseline.findMany({
      where: { siteId },
    });

    const baselineMap = new Map(baselines.map(b => [b.metricKey, b.value]));

    // Current month aggregates from visitor sessions
    const [currentSessions, currentIntent, currentPageStats] = await Promise.all([
      prisma.visitorSession.count({
        where: { siteId, startedAt: { gte: monthStart, lte: monthEnd }, isBotFiltered: false },
      }),
      prisma.visitorSession.aggregate({
        where: { siteId, startedAt: { gte: monthStart, lte: monthEnd }, isBotFiltered: false, intentScore: { not: null } },
        _avg: { intentScore: true },
      }),
      // Per-page stats for behavioral shifts
      prisma.pageView.groupBy({
        by: ['url'],
        where: { siteId, enteredAt: { gte: monthStart, lte: monthEnd }, session: { isBotFiltered: false } },
        _count: true,
        _avg: { maxScrollDepthPct: true },
      }),
    ]);

    // Page-level exit rates
    const pageExitData = await prisma.pageView.groupBy({
      by: ['url'],
      where: { siteId, enteredAt: { gte: monthStart, lte: monthEnd }, session: { isBotFiltered: false } },
      _count: { _all: true, isExit: true },
    });

    // Build behavioral shifts from recommendations that have baseline/current values
    const behavioralShifts = recommendations
      .filter(r => r.baselineMetricKey && r.baselineMetricValue != null && r.lastVerifiedValue != null)
      .map(r => {
        const current = r.lastVerifiedValue!;
        const baseline = r.baselineMetricValue!;
        const isImproved = r.verificationStatus === 'IMPROVED' || r.verificationStatus === 'PARTIAL';
        const isRegressed = r.verificationStatus === 'REGRESSED';

        return {
          metric: r.baselineMetricLabel ?? r.baselineMetricKey!,
          title: r.title,
          baseline,
          current,
          direction: isImproved ? 'improved' : isRegressed ? 'regressed' : 'stable',
        };
      });

    // Format implementations from recommendations
    const implementations = recommendations
      .filter(r => r.implementationStatus === 'VERIFIED' || r.implementationStatus === 'IMPLEMENTED')
      .map(r => ({
        id: r.id,
        title: r.title,
        sourceModule: r.sourceModule,
        implementedDate: r.completedAt?.toISOString() ?? null,
        status: r.implementationStatus,
        impact: {
          metric: r.baselineMetricLabel ?? r.baselineMetricKey ?? '',
          before: r.baselineMetricValue,
          after: r.lastVerifiedValue,
          change: r.baselineMetricValue != null && r.lastVerifiedValue != null
            ? r.lastVerifiedValue - r.baselineMetricValue
            : null,
        },
        notes: r.verificationNote,
        estimatedImpact: r.estimatedMonthlyImpact,
        recoveredValue: r.recoveredMonthlyValue,
      }));

    // New findings = concerns from the report
    const newFindings = (report.concernPoints as Array<Record<string, unknown>> | null) ?? [];

    // Build trend data from traffic snapshots (last 6 months)
    const sixMonthsAgo = new Date(report.year, report.month - 7, 1);
    const trafficSnapshots = await prisma.seoTrafficSnapshot.findMany({
      where: { siteId, date: { gte: sixMonthsAgo, lte: monthEnd } },
      orderBy: { date: 'asc' },
    });

    // Group snapshots by month for trends
    const monthlyTraffic = new Map<string, { sessions: number; count: number }>();
    for (const snap of trafficSnapshots) {
      const key = `${snap.date.getFullYear()}-${snap.date.getMonth() + 1}`;
      const existing = monthlyTraffic.get(key) ?? { sessions: 0, count: 0 };
      existing.sessions += snap.totalSessions;
      existing.count++;
      monthlyTraffic.set(key, existing);
    }

    const trendMonths = Array.from(monthlyTraffic.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, val]) => ({
        label: new Date(parseInt(key.split('-')[0]), parseInt(key.split('-')[1]) - 1).toLocaleDateString('en-US', { month: 'short' }),
        sessions: val.sessions,
      }));

    return NextResponse.json({
      site: { id: site.id, name: site.name, domain: site.domain },
      report: {
        year: report.year,
        month: report.month,
        label: report.label,
        baselineLabel: report.baselineLabel,
        priorPeriodLabel: report.priorPeriodLabel,
        executiveNarrative: report.executiveNarrative,
        performanceGrade: report.performanceGrade,
        generatedAt: report.generatedAt.toISOString(),

        // Metrics
        sessionsThisMonth: report.sessionsThisMonth,
        sessionsBaseline: report.sessionsBaseline,
        sessionsMoM: report.sessionsMoM,
        sessionsPctBaseline: report.sessionsPctBaseline,
        intentScoreNow: report.intentScoreNow,
        intentScoreBaseline: report.intentScoreBaseline,
        intentScoreMoM: report.intentScoreMoM,
        conversionRateNow: report.conversionRateNow,
        conversionRateBaseline: report.conversionRateBaseline,
        revenueAtRiskNow: report.revenueAtRiskNow,
        revenueRecoveredTotal: report.revenueRecoveredTotal,

        // Implementation summary
        totalRecs: report.totalRecs,
        verifiedFixed: report.verifiedFixed,
        inProgress: report.inProgress,
        stalled: report.stalled,
        openUnacted: report.openUnacted,

        // AI narrative sections
        praisePoints: report.praisePoints,
        concernPoints: report.concernPoints,
      },
      implementations,
      newFindings,
      behavioralShifts,
      trendMonths,

      // Live metrics from current DB
      liveMetrics: {
        currentSessions: currentSessions,
        currentIntentAvg: Math.round(currentIntent._avg.intentScore ?? 0),
      },
    });
  } catch (err) {
    console.error('[webwatch] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
