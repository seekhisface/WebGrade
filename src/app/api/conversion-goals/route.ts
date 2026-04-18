export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { z } from 'zod';

async function resolveAccess(email: string, siteId: string) {
  const [user, site] = await prisma.$transaction([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.site.findUnique({ where: { id: siteId }, select: { orgId: true } }),
  ]);
  if (!user || !site) return null;
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: site.orgId, userId: user.id } },
    select: { role: true },
  });
  return membership ? { userId: user.id, role: membership.role } : null;
}

// GET /api/conversion-goals?siteId=xxx
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const access = await resolveAccess(session.user.email, siteId);
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const goals = await prisma.conversionGoal.findMany({
    where: { siteId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, url: true, isActive: true, createdAt: true },
  });

  return NextResponse.json({ goals });
}

// POST /api/conversion-goals — create one or many goals
const createSchema = z.object({
  siteId: z.string(),
  goals: z.array(z.object({
    name: z.string().min(1).max(200),
    url: z.string().min(1).max(2000),
  })).min(1).max(20),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { siteId, goals } = parsed.data;

  const access = await resolveAccess(session.user.email, siteId);
  if (!access || access.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.conversionGoal.createMany({
    data: goals.map(g => ({ siteId, name: g.name, url: g.url })),
    skipDuplicates: false,
  });

  const created = await prisma.conversionGoal.findMany({
    where: { siteId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, url: true, isActive: true, createdAt: true },
  });

  return NextResponse.json({ goals: created });
}

// DELETE /api/conversion-goals?id=xxx
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const goal = await prisma.conversionGoal.findUnique({ where: { id }, select: { siteId: true } });
  if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await resolveAccess(session.user.email, goal.siteId);
  if (!access || access.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.conversionGoal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/conversion-goals — toggle isActive
const patchSchema = z.object({
  id: z.string(),
  isActive: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { id, isActive } = parsed.data;

  const goal = await prisma.conversionGoal.findUnique({ where: { id }, select: { siteId: true } });
  if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await resolveAccess(session.user.email, goal.siteId);
  if (!access || access.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const updated = await prisma.conversionGoal.update({ where: { id }, data: { isActive } });
  return NextResponse.json(updated);
}
