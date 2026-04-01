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

  const url = req.nextUrl;
  const siteId = url.searchParams.get('siteId');
  if (!siteId) {
    return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  }

  // Verify the user has OWNER or ADMIN role on the site's org
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { orgId: true },
  });

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: site.orgId, userId: user.id } },
    select: { role: true },
  });

  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Pagination
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '25', 10)));
  const showBots = url.searchParams.get('showBots') === 'true';

  const where = {
    siteId,
    ...(!showBots ? { isBotFiltered: false } : {}),
  };

  const [sessions, total] = await Promise.all([
    prisma.visitorSession.findMany({
      where,
      include: {
        events: {
          orderBy: { timestamp: 'asc' as const },
          take: 200,
        },
      },
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.visitorSession.count({ where }),
  ]);

  return NextResponse.json({
    sessions,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
