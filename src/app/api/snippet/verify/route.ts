// GET /api/snippet/verify?siteId=xxx
// Checks if any events have been received from the snippet in the last 24 hours.
// If yes, marks the installation as VERIFIED.

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
  if (!siteId) {
    return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  }

  // Verify access and check for recent events in parallel
  const since = new Date();
  since.setHours(since.getHours() - 24);

  const [site, recentEvent] = await Promise.all([
    verifySiteAccess(session.user.email, siteId),
    prisma.sessionEvent.findFirst({
      where: { siteId, timestamp: { gte: since } },
      select: { id: true },
    }),
  ]);

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const verified = !!recentEvent;

  if (verified) {
    await prisma.siteInstallation.upsert({
      where: { siteId },
      update: { status: 'VERIFIED', lastVerifiedAt: new Date() },
      create: {
        siteId,
        method: 'MANUAL',
        status: 'VERIFIED',
        lastVerifiedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ verified });
}
