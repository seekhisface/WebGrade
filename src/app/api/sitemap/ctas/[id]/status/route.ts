// POST /api/sitemap/ctas/[id]/status
// Body: { status: 'TRACKED' | 'IGNORED' | 'SUGGESTED' }
//
// Updates a single CTA's user-managed status. Idempotent.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';
import { z } from 'zod';

const Body = z.object({
  status: z.enum(['TRACKED', 'IGNORED', 'SUGGESTED']),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cta = await prisma.siteCta.findUnique({
    where: { id: params.id },
    select: { id: true, siteId: true },
  });
  if (!cta) return NextResponse.json({ error: 'CTA not found' }, { status: 404 });

  const access = await verifySiteAccess(session.user.email, cta.siteId);
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  await prisma.siteCta.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ ok: true, status: parsed.data.status });
}
