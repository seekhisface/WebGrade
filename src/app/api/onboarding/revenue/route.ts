// src/app/api/onboarding/revenue/route.ts
// GET + POST for revenue questionnaire data on SiteOnboarding.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { z } from 'zod';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const onboarding = await prisma.siteOnboarding.findFirst({
    where: {
      siteId,
      site: { org: { members: { some: { user: { email: session.user.email } } } } },
    },
    select: {
      averageOrderValue: true,
      leadToWinRate: true,
      conversionRate: true,
      monthlyAdSpend: true,
    },
  });

  return NextResponse.json(onboarding ?? {});
}

const revenueSchema = z.object({
  siteId: z.string().min(1),
  averageOrderValue: z.number().nullable(),
  leadToWinRate: z.number().min(0).max(1).nullable(),
  conversionRate: z.number().min(0).max(1).nullable(),
  monthlyAdSpend: z.number().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = revenueSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });

  const { siteId, averageOrderValue, leadToWinRate, conversionRate, monthlyAdSpend } = parsed.data;

  // Verify access
  const site = await prisma.site.findFirst({
    where: { id: siteId, org: { members: { some: { user: { email: session.user.email } } } } },
    select: { id: true },
  });
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  await prisma.siteOnboarding.updateMany({
    where: { siteId },
    data: {
      averageOrderValue,
      leadToWinRate,
      conversionRate,
      monthlyAdSpend,
    },
  });

  return NextResponse.json({ ok: true });
}
