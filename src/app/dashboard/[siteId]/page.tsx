import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/auth/session';
import { requireSiteAccess, getUserSites } from '@/lib/auth/session';
import { computeDropOffAnalysis } from '@/lib/analytics/dropoff';
import { DashboardClient } from './DashboardClient';

// ── Server-side data loading ────────────────────────────────────────────────

async function loadDashboardData(siteId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Fetch site info (already verified via requireSiteAccess)
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { onboarding: true },
  });

  if (!site) return null;

  // All queries in parallel
  const [
    sessionCount,
    intentAgg,
    intentGroups,
    baselines,
    latestHealthCheck,
    dropOffAnalysis,
  ] = await Promise.all([
    // Section 1: Total sessions (last 30 days, non-bot)
    prisma.visitorSession.count({
      where: { siteId, isBotFiltered: false, startedAt: { gte: thirtyDaysAgo } },
    }),

    // Section 1: Average intent score
    prisma.visitorSession.aggregate({
      _avg: { intentScore: true },
      where: { siteId, isBotFiltered: false, startedAt: { gte: thirtyDaysAgo }, intentScore: { not: null } },
    }),

    // Section 2: Intent distribution
    prisma.visitorSession.groupBy({
      by: ['intentClass'],
      _count: true,
      where: { siteId, startedAt: { gte: thirtyDaysAgo } },
    }),

    // Section 1: Baselines for comparison
    prisma.siteBaseline.findMany({
      where: { siteId },
      orderBy: { capturedAt: 'desc' },
    }),

    // Section 1: Latest health check status
    prisma.siteHealthCheck.findFirst({
      where: { siteId },
      orderBy: { checkedAt: 'desc' },
      select: { overallStatus: true },
    }),

    // Section 3 + 4: Drop-off analysis
    computeDropOffAnalysis({
      siteId,
      periodDays: 30,
      avgOrderValue: site.onboarding?.averageOrderValue ?? 500,
      leadToWinRate: site.onboarding?.leadToWinRate ?? 0.08,
    }),
  ]);

  // Compute intent distribution percentages
  const totalIntentSessions = intentGroups.reduce((sum, g) => sum + g._count, 0);
  const intentDistribution = {
    HIGH: 0, MEDIUM: 0, LOW: 0, RESEARCHER: 0, COMPETITOR: 0, BOT: 0,
  };
  for (const group of intentGroups) {
    if (group.intentClass && group.intentClass in intentDistribution) {
      intentDistribution[group.intentClass as keyof typeof intentDistribution] =
        totalIntentSessions > 0 ? Math.round((group._count / totalIntentSessions) * 100) : 0;
    }
  }

  // Find baseline values for comparison
  const sessionBaseline = baselines.find(b => b.metricKey === 'sessions_30d' || b.metricKey === 'baseline_sessions');
  const intentBaseline = baselines.find(b => b.metricKey === 'intent_score_avg' || b.metricKey === 'baseline_intent_score');

  const avgIntentScore = Math.round(intentAgg._avg.intentScore ?? 0);
  const baselineSessions = sessionBaseline?.value ?? 0;
  const baselineIntent = intentBaseline?.value ?? 0;

  const totalSessionsChange = baselineSessions > 0
    ? ((sessionCount - baselineSessions) / baselineSessions) * 100
    : 0;
  const avgIntentScoreChange = baselineIntent > 0
    ? ((avgIntentScore - baselineIntent) / baselineIntent) * 100
    : 0;

  // Revenue at risk from drop-off analysis
  const totalRevenueAtRisk = dropOffAnalysis.totalRevenueAtRisk;
  const top3Revenue = dropOffAnalysis.pages
    .slice(0, 3)
    .reduce((sum, p) => sum + (p.estimatedMonthlyRevenueAtRisk ?? 0), 0);

  // Map drop-off pages to dashboard format
  const dropOffPages = dropOffAnalysis.pages.slice(0, 10).map(p => ({
    url: p.url,
    title: p.title || p.url,
    exitRate: Math.round(p.exitRate),
    avgScrollDepth: Math.round(p.avgScrollDepth),
    sessions: p.sessions,
    isStorylineBreakpoint: p.isStorylineBreakpoint,
  }));

  const healthStatus = (latestHealthCheck?.overallStatus ?? 'UNKNOWN') as 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';

  return {
    site: { id: site.id, name: site.name, domain: site.domain, url: site.url },
    totalSessions: sessionCount,
    totalSessionsChange: Math.round(totalSessionsChange * 10) / 10,
    baselineSessions: Math.round(baselineSessions),
    avgIntentScore,
    avgIntentScoreChange: Math.round(avgIntentScoreChange * 10) / 10,
    baselineIntent: Math.round(baselineIntent),
    revenueAtRisk: Math.round(totalRevenueAtRisk),
    top3RecoverableRevenue: Math.round(top3Revenue),
    intentDistribution,
    dropOffPages,
    healthStatus: healthStatus === 'UNKNOWN' ? 'YELLOW' as const : healthStatus,
  };
}

// ── Page (server component) ─────────────────────────────────────────────────

export default async function DashboardPage({ params }: { params: { siteId: string } }) {
  const session = await requireSession();
  await requireSiteAccess(session.user!.id, params.siteId);

  const sites = await getUserSites(session.user!.id);
  const data = await loadDashboardData(params.siteId);

  const siteList = sites.map(s => ({
    id: s.id,
    name: s.name,
    domain: s.domain,
    hasWebWatch: s.hasWebWatch,
    hasWebOpp: s.hasWebOpp,
    hasInterimReport: s.hasInterimReport,
  }));

  return <DashboardClient siteId={params.siteId} sites={siteList} data={data} />;
}
