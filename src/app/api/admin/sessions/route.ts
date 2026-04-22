export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

  const url = req.nextUrl;
  const siteId = url.searchParams.get('siteId');
  if (!siteId) {
    return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  }

  // Pagination
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '25', 10)));
  const showBots = url.searchParams.get('showBots') === 'true';
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');

  const where = {
    siteId,
    ...(!showBots ? { isBotFiltered: false } : {}),
    ...(start || end ? {
      startedAt: {
        ...(start ? { gte: new Date(start) } : {}),
        ...(end ? { lte: new Date(`${end}T23:59:59.999Z`) } : {}),
      },
    } : {}),
  };

  // Super admins bypass role check
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

  // All queries in a single batch transaction (1 connection)
  const [sessions, total] = await prisma.$transaction([
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
