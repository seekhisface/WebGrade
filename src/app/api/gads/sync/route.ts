// POST /api/gads/sync?siteId=xxx — trigger a manual Google Ads data sync
// Also called by the daily Inngest job

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { syncCampaignData } from '@/lib/gads/client';
import { verifySiteAccess } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { siteId, daysBack } = await req.json().catch(() => ({
    siteId: req.nextUrl.searchParams.get('siteId'),
    daysBack: 30,
  }));

  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const accessCheck = await verifySiteAccess(session.user.email, siteId);
  if (!accessCheck) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { gadsConnected: true, gadsCustomerId: true, gadsConnectedByUserId: true },
  });

  if (!site?.gadsConnected || !site.gadsCustomerId || !site.gadsConnectedByUserId) {
    return NextResponse.json({ error: 'Google Ads not fully configured' }, { status: 400 });
  }

  try {
    const result = await syncCampaignData(
      siteId,
      site.gadsConnectedByUserId,
      site.gadsCustomerId,
      daysBack ?? 30,
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error('[gads/sync] Error:', err);
    return NextResponse.json({ error: 'Sync failed', details: (err as Error).message }, { status: 500 });
  }
}
