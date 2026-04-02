export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';

// GET /api/invite/[token] — fetch invitation details (public, no auth needed)
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const invitation = await prisma.orgInvitation.findUnique({
    where: { token: params.token },
    select: {
      email: true,
      role: true,
      expiresAt: true,
      org: { select: { name: true } },
      inviter: { select: { name: true, email: true } },
    },
  });

  if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });

  return NextResponse.json({
    email: invitation.email,
    role: invitation.role,
    orgName: invitation.org.name,
    inviterName: invitation.inviter.name || invitation.inviter.email,
  });
}

// POST /api/invite/[token] — accept the invitation (requires auth)
export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });

  // Batch all reads in one transaction
  const [invitation, user] = await prisma.$transaction([
    prisma.orgInvitation.findUnique({ where: { token: params.token } }),
    prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }),
  ]);

  if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Check existing + add/cleanup in one transaction
  const existing = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: invitation.orgId, userId: user.id } },
  });

  if (existing) {
    await prisma.orgInvitation.delete({ where: { id: invitation.id } });
    return NextResponse.json({ success: true, alreadyMember: true });
  }

  await prisma.$transaction([
    prisma.orgMember.create({
      data: {
        orgId: invitation.orgId,
        userId: user.id,
        role: invitation.role,
      },
    }),
    prisma.orgInvitation.delete({ where: { id: invitation.id } }),
  ]);

  return NextResponse.json({ success: true });
}
