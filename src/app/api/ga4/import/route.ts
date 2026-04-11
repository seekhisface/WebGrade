export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { importGa4Baseline } from '@/lib/ga4/client';

// GET /api/ga4/import?siteId=xxx — check import status
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      org: { members: { some: { user: { email: session.user.email } } } },
    },
    include: { onboarding: { select: { ga4BaselineImportedAt: true, ga4PropertyId: true } } },
  });

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ga4Connected: site.ga4Connected,
    ga4PropertyId: site.ga4PropertyId ?? site.onboarding?.ga4PropertyId ?? null,
    ga4BaselineImportedAt: site.onboarding?.ga4BaselineImportedAt ?? null,
  });
}

// POST /api/ga4/import — trigger baseline import from GA4
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { siteId, propertyId } = body as { siteId?: string; propertyId?: string };

  if (!siteId || !propertyId) {
    return NextResponse.json({ error: 'siteId and propertyId are required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Verify site access
  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      org: { members: { some: { userId: user.id } } },
    },
  });
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const result = await importGa4Baseline(siteId, user.id, propertyId);
    return NextResponse.json({ success: true, metricsImported: result.metricsImported });
  } catch (err) {
    console.error('[ga4/import] Import failed:', err);
    return NextResponse.json({ error: 'GA4 import failed' }, { status: 500 });
  }
}
