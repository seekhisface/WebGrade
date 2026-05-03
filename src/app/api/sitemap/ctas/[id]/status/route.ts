// POST /api/sitemap/ctas/[id]/status
// Body: { status: 'TRACKED' | 'IGNORED' | 'SUGGESTED' }
//
// Updates a single CTA's user-managed status, AND syncs the change to the
// ConversionGoal table so the rest of the app (dashboard "Set Conversion Goal"
// banner, report aggregator, etc.) recognizes TRACKED CTAs as conversion goals.

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
  status: z.enum(['TRACKED', 'IGNORED', 'SUGGESTED']),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cta = await prisma.siteCta.findUnique({
    where: { id: params.id },
    select: {
      id: true, siteId: true, competitorUrl: true,
      ctaText: true, ctaHref: true, pages: true, status: true,
    },
  });
  if (!cta) return NextResponse.json({ error: 'CTA not found' }, { status: 404 });

  const access = await verifySiteAccess(session.user.email, cta.siteId);
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const newStatus = parsed.data.status;

  await prisma.siteCta.update({
    where: { id: params.id },
    data: { status: newStatus },
  });

  // Only sync own-site CTAs — competitor CTAs are reference-only.
  if (cta.competitorUrl === '') {
    await syncCtaToConversionGoal({
      siteId: cta.siteId,
      ctaText: cta.ctaText,
      ctaHref: cta.ctaHref,
      pages: cta.pages,
      previousStatus: cta.status as 'TRACKED' | 'IGNORED' | 'SUGGESTED',
      newStatus,
    });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
