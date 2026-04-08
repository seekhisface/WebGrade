// src/app/api/recommendations/verify/route.ts
// POST — mark a recommendation as implemented (captures before metric, creates measurement job)
// GET — get verification status for a recommendation

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { markImplemented } from '@/lib/verification/engine';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { recommendationId, customerNote } = await req.json();
    if (!recommendationId) return NextResponse.json({ error: 'recommendationId required' }, { status: 400 });

    // Verify access through site
    const rec = await prisma.recommendation.findUnique({
      where: { id: recommendationId },
      select: { siteId: true },
    });
    if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const site = await prisma.site.findFirst({
      where: { id: rec.siteId, org: { members: { some: { user: { email: session.user.email } } } } },
    });
    if (!site) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await markImplemented(recommendationId, customerNote);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Verify error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const siteId = req.nextUrl.searchParams.get('siteId');
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    const jobs = await prisma.measurementJob.findMany({
      where: { siteId },
      include: {
        recommendation: {
          select: { id: true, title: true, baselineMetricKey: true, baselineMetricValue: true, targetMetricValue: true, verificationStatus: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ jobs });
  } catch (err) {
    console.error('Verify status error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
