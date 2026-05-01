// POST /api/checkins/acknowledge
// Body: { siteId: string, day: 7 | 14 }
//
// Marks a Day 7 or Day 14 check-in as acknowledged so the throbbing button in
// AppNav goes away for that window. Idempotent — re-acknowledging is a no-op.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';
import { z } from 'zod';

const Body = z.object({
  siteId: z.string().min(1),
  day: z.union([z.literal(7), z.literal(14)]),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const { siteId, day } = parsed.data;
  const site = await verifySiteAccess(session.user.email, siteId);
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  await prisma.site.update({
    where: { id: siteId },
    data: day === 7
      ? { checkin7AcknowledgedAt: new Date() }
      : { checkin14AcknowledgedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
