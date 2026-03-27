export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      org: { members: { some: { user: { email: session.user.email } } } },
    },
    include: {
      installations: { orderBy: { installedAt: 'desc' }, take: 1 },
      onboarding: true,
      org: {
        include: {
          googleConnections: { take: 1 },
        },
      },
    },
  });

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const snippetInstalled = site.installations?.[0]?.status === 'VERIFIED';
  const ga4Connected = !!(site.org?.googleConnections?.[0]);
  const gscConnected = !!(site.org?.googleConnections?.[0]);
  const businessContextComplete = !!(
    site.onboarding?.businessDescription &&
    site.onboarding?.conversionGoalUrl
  );

  return NextResponse.json({
    snippetInstalled,
    ga4Connected,
    gscConnected,
    businessContextComplete,
  });
}
