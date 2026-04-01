export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { z } from 'zod';

// PUT /api/profile/members — update a member's role
const updateMemberSchema = z.object({
  memberId: z.string(),
  role: z.enum(['ADMIN', 'VIEWER']),
});

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  // Batch user + target lookup in one transaction
  const [user, target] = await prisma.$transaction([
    prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }),
    prisma.orgMember.findUnique({ where: { id: parsed.data.memberId } }),
  ]);

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // Permission check (needs target.orgId from above)
  const requester = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: target.orgId, userId: user.id } },
    select: { role: true },
  });
  if (!requester || requester.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only owners can change roles' }, { status: 403 });
  }

  if (target.userId === user.id) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
  }
  if (target.role === 'OWNER') {
    return NextResponse.json({ error: 'Cannot change another owner\'s role' }, { status: 400 });
  }

  const updated = await prisma.orgMember.update({
    where: { id: parsed.data.memberId },
    data: { role: parsed.data.role },
  });

  return NextResponse.json(updated);
}

// DELETE /api/profile/members — remove a member from org
const removeMemberSchema = z.object({
  memberId: z.string(),
});

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = removeMemberSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  // Batch user + target lookup in one transaction
  const [user, target] = await prisma.$transaction([
    prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }),
    prisma.orgMember.findUnique({ where: { id: parsed.data.memberId } }),
  ]);

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // Permission check (needs target.orgId from above)
  const requester = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: target.orgId, userId: user.id } },
    select: { role: true },
  });
  if (!requester || requester.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only owners can remove members' }, { status: 403 });
  }

  if (target.userId === user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
  }
  if (target.role === 'OWNER') {
    return NextResponse.json({ error: 'Cannot remove another owner' }, { status: 400 });
  }

  await prisma.orgMember.delete({ where: { id: parsed.data.memberId } });

  return NextResponse.json({ success: true });
}
