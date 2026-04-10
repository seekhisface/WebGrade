// POST /api/setup-state/skip
// Permanently opt out of a setup item for a specific site.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { siteId, itemKey } = await req.json();
  if (!siteId || !itemKey) {
    return NextResponse.json({ error: 'siteId and itemKey required' }, { status: 400 });
  }

  const onboarding = await prisma.siteOnboarding.findUnique({ where: { siteId } });
  if (!onboarding) {
    return NextResponse.json({ error: 'Onboarding not found' }, { status: 404 });
  }

  const current = onboarding.skippedSetupItems ?? [];
  if (!current.includes(itemKey)) {
    await prisma.siteOnboarding.update({
      where: { siteId },
      data: { skippedSetupItems: [...current, itemKey] },
    });
  }

  return NextResponse.json({ ok: true });
}
