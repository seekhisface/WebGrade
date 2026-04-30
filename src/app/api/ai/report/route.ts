export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/**
 * GET /api/ai/report?siteId=xxx
 *
 * Read-only retrieval of the latest WebGrade report for a site.
 *
 * Reports are no longer generated on demand from the UI. Generation only
 * happens on schedule via Inngest cron jobs:
 *   - WebAudit: Day 30 + Day 60 (webauditSnapshot)
 *   - WebWatch: 1st of each month (webwatchMonthlyReport)
 *
 * To trigger a generation outside the schedule, call generateReport()
 * from src/lib/report/generator.ts directly (cron-internal use).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const site = await verifySiteAccess(session.user.email, siteId);
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const report = await prisma.report.findFirst({
    where: { siteId, type: 'INTERIM' },
    orderBy: { createdAt: 'desc' },
  });

  if (!report) return NextResponse.json({ report: null });

  let growthPlays = [];
  let liveMetrics = null;
  let baselineMetrics = null;
  let criticalPages = [];
  let totalRevenueAtRisk = 0;
  let reportLabel: string | null = null;

  try {
    const behavioral = JSON.parse(report.behavioralSummary ?? '{}');
    growthPlays = behavioral.growthPlays ?? [];
    liveMetrics = behavioral.liveMetrics ?? null;
    baselineMetrics = behavioral.baselineMetrics ?? null;
    criticalPages = behavioral.criticalPages ?? [];
    totalRevenueAtRisk = behavioral.totalRevenueAtRisk ?? 0;
    reportLabel = behavioral.reportLabel ?? null;
  } catch { /* ignore parse errors */ }

  return NextResponse.json({
    report: {
      id: report.id,
      status: report.status,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      executiveSummary: report.executiveSummary,
      actionItems: report.topRecommendations,
      topFindings: report.topFindings,
      growthPlays,
      estimatedImpact: report.estimatedImpact,
      liveMetrics,
      baselineMetrics,
      criticalPages,
      totalRevenueAtRisk,
      reportLabel,
      createdAt: report.createdAt,
    },
  });
}
