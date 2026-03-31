// GET /api/snippet/verify?siteId=xxx
// Checks if any events have been received from the snippet in the last 24 hours.
// If yes, marks the installation as VERIFIED.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) {
    return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  }

  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      org: { members: { some: { user: { email: session.user.email } } } },
    },
  });

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Check for recent events from this site
  const since = new Date();
  since.setHours(since.getHours() - 24);

  const recentEvent = await prisma.sessionEvent.findFirst({
    where: { siteId, timestamp: { gte: since } },
    select: { id: true },
  });

  const verified = !!recentEvent;

  if (verified) {
    // Upsert installation record as VERIFIED
    const existing = await prisma.siteInstallation.findUnique({
      where: { siteId },
    });

    if (existing) {
      await prisma.siteInstallation.update({
        where: { siteId },
        data: { status: 'VERIFIED', lastVerifiedAt: new Date() },
      });
    } else {
      await prisma.siteInstallation.create({
        data: {
          siteId,
          method: 'MANUAL',
          status: 'VERIFIED',
          lastVerifiedAt: new Date(),
        },
      });
    }
  }

  return NextResponse.json({ verified });
}
