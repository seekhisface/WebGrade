// GET /api/admin/stale-utms?siteId=xxx
// Returns the list of utm_campaign values currently flagged as stale for a site.
// "Stale" = present in session traffic but not in any active or recent (180d)
// Google Ads campaign. Populated daily by the flagStaleUtmsDaily Inngest job.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { checkSuperAdmin } from '@/lib/auth/super-admin';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) {
    return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  }

  const isSuperAdmin = await checkSuperAdmin(session.user.email);
  if (!isSuperAdmin) {
    const membership = await prisma.orgMember.findFirst({
      where: {
        user: { email: session.user.email },
        org: { sites: { some: { id: siteId } } },
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { id: true },
    });
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const stale = await prisma.staleUtmCampaign.findMany({
    where: { siteId },
    orderBy: [{ sessionsAffected: 'desc' }, { lastSeenAt: 'desc' }],
  });

  const totalStaleSessions = stale.reduce((sum, s) => sum + s.sessionsAffected, 0);

  return NextResponse.json({
    items: stale,
    totalStaleSessions,
    distinctTags: stale.length,
  });
}
