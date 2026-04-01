export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { z } from 'zod';

// PUT /api/profile/sites — update a site's details
const updateSiteSchema = z.object({
  siteId: z.string(),
  name: z.string().min(1).max(200).optional(),
  domain: z.string().min(1).max(200).optional(),
  url: z.string().url().optional(),
  industry: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
});

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = updateSiteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { siteId, ...updates } = parsed.data;

  // Verify user has OWNER/ADMIN access to this site's org
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { orgId: true },
  });
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: site.orgId, userId: user.id } },
  });
  if (!membership || membership.role === 'VIEWER') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const updated = await prisma.site.update({
    where: { id: siteId },
    data: updates,
    select: { id: true, name: true, domain: true, url: true, industry: true, description: true },
  });

  return NextResponse.json(updated);
}
