// GET /api/checkins/state?siteId=xxx
//
// Lightweight check — returns whether the Day 7 / Day 14 throbbing nav button
// should be shown. Intentionally split from /api/dashboard so AppNav can poll
// it cheaply without triggering all the dashboard's drop-off computation.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const site = await verifySiteAccess(session.user.email, siteId);
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const full = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      subscriptionTier: true,
      webauditStartDate: true,
      checkin7AcknowledgedAt: true,
      checkin14AcknowledgedAt: true,
    },
  });

  if (!full || full.subscriptionTier !== 'WEBAUDIT' || !full.webauditStartDate) {
    return NextResponse.json({ day7Visible: false, day14Visible: false });
  }

  const daysSinceStart = Math.floor((Date.now() - full.webauditStartDate.getTime()) / 86400000);
  const day7Visible = daysSinceStart >= 7 && daysSinceStart <= 9 && !full.checkin7AcknowledgedAt;
  const day14Visible = daysSinceStart >= 14 && daysSinceStart <= 16 && !full.checkin14AcknowledgedAt;

  return NextResponse.json({ day7Visible, day14Visible });
}
