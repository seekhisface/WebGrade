export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { z } from 'zod';

const inviteSchema = z.object({
  orgId: z.string(),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'VIEWER']).default('VIEWER'),
});

// POST /api/profile/invite — send an invitation
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  // Batch all read queries in a single transaction
  const [user, existingUser] = await prisma.$transaction([
    prisma.user.findUnique({ where: { email: session.user.email } }),
    prisma.user.findUnique({ where: { email: parsed.data.email } }),
  ]);

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Permission + duplicate check in one transaction
  const [membership, existingMember] = await prisma.$transaction([
    prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: parsed.data.orgId, userId: user.id } },
    }),
    ...(existingUser ? [
      prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: parsed.data.orgId, userId: existingUser.id } },
      }),
    ] : []),
  ]);

  if (!membership || membership.role === 'VIEWER') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  if (existingMember) {
    return NextResponse.json({ error: 'User is already a member of this organization' }, { status: 400 });
  }

  // Upsert invitation + fetch org name in one transaction
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const [invitation, org] = await prisma.$transaction([
    prisma.orgInvitation.upsert({
      where: { orgId_email: { orgId: parsed.data.orgId, email: parsed.data.email } },
      create: {
        orgId: parsed.data.orgId,
        email: parsed.data.email,
        role: parsed.data.role,
        invitedBy: user.id,
        expiresAt,
      },
      update: {
        role: parsed.data.role,
        invitedBy: user.id,
        expiresAt,
        token: undefined,
      },
    }),
    prisma.organization.findUnique({ where: { id: parsed.data.orgId }, select: { name: true } }),
  ]);

  // Send invitation email via Resend (non-blocking)
  const appUrl = process.env.NEXTAUTH_URL || 'https://www.webgrade.io';
  const inviteUrl = `${appUrl}/invite/${invitation.token}`;

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'WebGrade <noreply@webgrade.io>',
      to: parsed.data.email,
      subject: `You've been invited to ${org?.name || 'a WebGrade organization'}`,
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #0c4a6e; margin-bottom: 8px;">You're invited to WebGrade</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            <strong>${user.name || user.email}</strong> has invited you to join
            <strong>${org?.name || 'their organization'}</strong> on WebGrade as a ${parsed.data.role.toLowerCase()}.
          </p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            WebGrade provides website intelligence — behavioral audits, performance monitoring,
            and market opportunity analysis. Click below to accept the invitation and access the dashboard.
          </p>
          <a href="${inviteUrl}" style="display: inline-block; background: #0c4a6e; color: white; padding: 12px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px; margin-top: 16px;">
            Accept Invitation
          </a>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
            This invitation expires in 7 days. If you didn't expect this, you can ignore this email.
          </p>
        </div>
      `,
    });
  } catch (e) {
    console.error('Failed to send invitation email:', e);
  }

  return NextResponse.json({ success: true, invitation: { id: invitation.id, email: invitation.email, role: invitation.role } });
}

// DELETE /api/profile/invite — revoke a pending invitation
const revokeSchema = z.object({ invitationId: z.string() });

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  // All reads in one transaction
  const [user, invitation] = await prisma.$transaction([
    prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }),
    prisma.orgInvitation.findUnique({ where: { id: parsed.data.invitationId }, select: { id: true, orgId: true } }),
  ]);

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });

  // Permission check + delete in one transaction
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: invitation.orgId, userId: user.id } },
    select: { role: true },
  });
  if (!membership || membership.role === 'VIEWER') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  await prisma.orgInvitation.delete({ where: { id: parsed.data.invitationId } });

  return NextResponse.json({ success: true });
}
