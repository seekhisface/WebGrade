// GET /api/gads/accounts?siteId=xxx — list accessible Google Ads accounts
// Called after OAuth to let the user pick which account to sync

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { listAccessibleAccounts } from '@/lib/gads/client';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const site = await prisma.site.findFirst({
    where: { id: siteId, org: { members: { some: { user: { email: session.user.email } } } } },
    select: { gadsConnectedByUserId: true },
  });

  if (!site?.gadsConnectedByUserId) {
    return NextResponse.json({ error: 'Google Ads not connected' }, { status: 400 });
  }

  try {
    const accounts = await listAccessibleAccounts(site.gadsConnectedByUserId);
    return NextResponse.json({ accounts });
  } catch (err) {
    console.error('[gads/accounts] Error:', err);
    return NextResponse.json({ error: 'Failed to list accounts' }, { status: 500 });
  }
}

// POST /api/gads/accounts — select a Google Ads account for this site
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { siteId, customerId } = await req.json();
  if (!siteId || !customerId) {
    return NextResponse.json({ error: 'siteId and customerId required' }, { status: 400 });
  }

  await prisma.site.update({
    where: { id: siteId },
    data: {
      gadsCustomerId: customerId,
      gadsConnected: true,
      gadsConnectedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
