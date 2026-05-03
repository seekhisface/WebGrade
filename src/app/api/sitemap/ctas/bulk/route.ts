// POST /api/sitemap/ctas/bulk
// Body: { siteId: string, ids: string[], status: 'TRACKED' | 'IGNORED' | 'SUGGESTED' }
//
// Bulk-update status across multiple SiteCta rows. Used by the
// "Track recommended" / "Ignore unrecommended" buttons.

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
  ids: z.array(z.string()).min(1),
  status: z.enum(['TRACKED', 'IGNORED', 'SUGGESTED']),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { siteId, ids, status } = parsed.data;
  const access = await verifySiteAccess(session.user.email, siteId);
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Scope by siteId so a malicious caller can't update other sites' CTAs by id.
  const result = await prisma.siteCta.updateMany({
    where: { id: { in: ids }, siteId, competitorUrl: '' }, // own-site only — competitor CTAs aren't user-managed
    data: { status },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
