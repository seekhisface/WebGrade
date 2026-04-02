// src/app/api/reports/archive/route.ts
// Report archive API — list and create archived report snapshots.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { z } from 'zod';

export const runtime = 'nodejs';

// ----------------------------------------------------------------
// GET /api/reports/archive?siteId=xxx — list archived reports
// ----------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = req.nextUrl.searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'siteId required' }, { status: 400 });
    }

    // Verify org membership
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        org: { members: { some: { user: { email: session.user.email } } } },
      },
      select: { id: true },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const archives = await prisma.archivedReport.findMany({
      where: { siteId },
      orderBy: { periodEnd: 'desc' },
      select: {
        id: true,
        type: true,
        title: true,
        periodStart: true,
        periodEnd: true,
        summary: true,
        kpiSnapshot: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ archives });
  } catch (err) {
    console.error('Archive list error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ----------------------------------------------------------------
// POST /api/reports/archive — snapshot current report into archive
// ----------------------------------------------------------------
const createSchema = z.object({
  siteId: z.string().min(1),
  type: z.enum(['webaudit', 'webwatch', 'webopp']).default('webaudit'),
  title: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const { siteId, type } = parsed.data;

    // Verify org membership
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        org: { members: { some: { user: { email: session.user.email } } } },
      },
      select: { id: true, name: true },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Get the latest complete report to archive
    const latestReport = await prisma.report.findFirst({
      where: { siteId, status: 'COMPLETE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestReport) {
      return NextResponse.json({ error: 'No completed report to archive' }, { status: 404 });
    }

    // Build KPI snapshot from dashboard data
    const now = new Date();
    const periodStart = latestReport.periodStart ?? new Date(now.getTime() - 30 * 86400000);
    const periodEnd = latestReport.periodEnd ?? now;

    const sessions = await prisma.visitorSession.findMany({
      where: {
        siteId,
        isBotFiltered: false,
        startedAt: { gte: periodStart, lte: periodEnd },
      },
      select: { intentScore: true, pageCount: true },
    });

    const totalSessions = sessions.length;
    const bounceCount = sessions.filter(s => s.pageCount <= 1).length;
    const intentScores = sessions.filter(s => s.intentScore != null).map(s => s.intentScore!);
    const avgIntent = intentScores.length > 0 ? intentScores.reduce((a, b) => a + b, 0) / intentScores.length : 0;

    const kpiSnapshot = {
      sessions: totalSessions,
      bounceRate: totalSessions > 0 ? (bounceCount / totalSessions) * 100 : 0,
      intentScore: Math.round(avgIntent * 10) / 10,
      revenueAtRisk: latestReport.estimatedImpact ? parseFloat(latestReport.estimatedImpact) || 0 : 0,
    };

    const title = parsed.data.title ?? `${type === 'webaudit' ? 'WebAudit' : type === 'webwatch' ? 'WebWatch' : 'WebOpp'} — ${periodEnd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

    const archive = await prisma.archivedReport.create({
      data: {
        siteId,
        type,
        title,
        periodStart,
        periodEnd,
        summary: latestReport.executiveSummary ?? '',
        kpiSnapshot,
        findings: latestReport.topFindings ?? [],
        actionItems: latestReport.topRecommendations ?? [],
      },
    });

    return NextResponse.json({ archive }, { status: 201 });
  } catch (err) {
    console.error('Archive create error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
