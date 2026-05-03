// POST /api/sitemap/ctas/bulk
// Body: { siteId: string, ids: string[], status: 'TRACKED' | 'IGNORED' | 'SUGGESTED' }
//
// Bulk-update status across multiple SiteCta rows AND sync to ConversionGoal.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';
import { z } from 'zod';
import { syncCtaToConversionGoal } from '@/lib/sitemap/conversion-goal-sync';

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

  // Pull existing rows so we know previous status (for ConversionGoal cleanup
  // when transitioning OUT of TRACKED).
  const existing = await prisma.siteCta.findMany({
    where: { id: { in: ids }, siteId, competitorUrl: '' },
    select: { id: true, ctaText: true, ctaHref: true, pages: true, status: true },
  });

  const result = await prisma.siteCta.updateMany({
    where: { id: { in: ids }, siteId, competitorUrl: '' },
    data: { status },
  });

  // Sync each row's ConversionGoal record. Sequential to avoid Prisma connection
  // exhaustion — bulk usage is typically <50 rows so this is fine.
  for (const row of existing) {
    await syncCtaToConversionGoal({
      siteId,
      ctaText: row.ctaText,
      ctaHref: row.ctaHref,
      pages: row.pages,
      previousStatus: row.status as 'TRACKED' | 'IGNORED' | 'SUGGESTED',
      newStatus: status,
    });
  }

  return NextResponse.json({ ok: true, updated: result.count });
}
