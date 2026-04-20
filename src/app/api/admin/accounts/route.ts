export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { checkSuperAdmin } from '@/lib/auth/super-admin';
import { prisma } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await checkSuperAdmin(session.user.email);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const search = req.nextUrl.searchParams.get('q')?.toLowerCase() ?? '';

  const orgs = await prisma.organization.findMany({
    include: {
      sites: {
        select: { id: true, name: true, domain: true, url: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      members: {
        include: {
          user: { select: { id: true, email: true, name: true, image: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const filtered = search
    ? orgs.filter(o =>
        o.name.toLowerCase().includes(search) ||
        o.members.some(m => m.user.email.toLowerCase().includes(search)) ||
        o.sites.some(s => s.domain.toLowerCase().includes(search))
      )
    : orgs;

  return NextResponse.json({ orgs: filtered, total: orgs.length });
}

// PATCH — change a member's role (super admin override)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await checkSuperAdmin(session.user.email);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { memberId, role } = await req.json();
  if (!memberId || !['OWNER', 'ADMIN', 'VIEWER'].includes(role)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  await prisma.orgMember.update({ where: { id: memberId }, data: { role } });
  return NextResponse.json({ ok: true });
}

// DELETE — remove a member (super admin override)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await checkSuperAdmin(session.user.email);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('memberId');
  if (!id) return NextResponse.json({ error: 'memberId required' }, { status: 400 });

  await prisma.orgMember.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
