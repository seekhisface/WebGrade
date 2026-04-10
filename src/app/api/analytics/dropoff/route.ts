export const dynamic = 'force-dynamic'
// src/app/api/analytics/dropoff/route.ts
// P1-07: Drop-off analysis API endpoint
//
// GET /api/analytics/dropoff?siteId=xxx&days=7
//
// Returns DropOffAnalysis — live data if snippet installed, demo data otherwise.
// Response is cached for 5 minutes at the edge to keep the dashboard fast.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { computeDropOffAnalysis, buildDemoAnalysis } from '@/lib/analytics/dropoff';

export const runtime = 'nodejs';
export const revalidate = 300; // 5 min edge cache

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId');
    const days = parseInt(searchParams.get('days') ?? '7', 10);

    if (!siteId) {
      return NextResponse.json({ error: 'siteId required' }, { status: 400 });
    }

    // Verify the user has access to this site
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        org: {
          members: {
            some: {
              user: { email: session.user.email },
            },
          },
        },
      },
      include: {
        onboarding: {
          select: {
            averageOrderValue: true,
            leadToWinRate: true,
          },
        },
      },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Check if snippet is installed by looking for recent session events
    const recentEvent = await prisma.sessionEvent.findFirst({
      where: { siteId, timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    const snippetInstalled = recentEvent !== null;

    // If no snippet, return demo data immediately — no DB query needed
    if (!snippetInstalled) {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - days);
      const analysis = buildDemoAnalysis(siteId, start, now);
      return NextResponse.json({ ...analysis, snippetInstalled: false });
    }

    // Live analysis
    const analysis = await computeDropOffAnalysis({
      siteId,
      periodDays: days,
      avgOrderValue: site.onboarding?.averageOrderValue ?? 500,
      leadToWinRate: site.onboarding?.leadToWinRate ?? 0.08,
    });

    return NextResponse.json({ ...analysis, snippetInstalled: true });

  } catch (err) {
    console.error('[dropoff] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
