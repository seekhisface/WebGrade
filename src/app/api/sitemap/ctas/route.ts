// GET /api/sitemap/ctas?siteId=xxx&filter=conversion|all
//
// Returns the CTA inventory grouped by type, with click counts joined from
// the last 30 days of CTA_CLICK events. Default filter=conversion only shows
// the conversion-relevant types (DEMO/SIGNUP/TRIAL/CONTACT/BUY).

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';
import type { CtaType } from '@prisma/client';

const CONVERSION_TYPES: CtaType[] = ['DEMO', 'SIGNUP', 'TRIAL', 'CONTACT', 'BUY'];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteId = req.nextUrl.searchParams.get('siteId');
  const filter = req.nextUrl.searchParams.get('filter') ?? 'conversion';
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const site = await verifySiteAccess(session.user.email, siteId);
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const where = filter === 'all'
    ? { siteId }
    : { siteId, ctaType: { in: CONVERSION_TYPES } };

  const ctas = await prisma.siteCta.findMany({
    where,
    orderBy: [{ ctaType: 'asc' }, { pageCount: 'desc' }],
  });

  // Click counts last 30d — match by case-insensitive elementText.
  // Cheap-and-cheerful: pull all CTA_CLICK events for the site in the period
  // then count per CTA in memory. For high-volume sites this can be optimized
  // with a SQL aggregate later.
  const last30 = new Date(Date.now() - 30 * 86400000);
  const clicks = await prisma.sessionEvent.findMany({
    where: {
      siteId,
      timestamp: { gte: last30 },
      eventType: { in: ['CTA_CLICK', 'CLICK'] },
      isCtaClick: true,
    },
    select: { elementText: true, pageUrl: true },
  });

  // Sessions count per page in the same period (denominator for CTR)
  const sessionsByPage = await prisma.pageView.groupBy({
    by: ['url'],
    where: { siteId, enteredAt: { gte: last30 }, session: { isBotFiltered: false } },
    _count: { sessionId: true },
  });
  const sessionsByPageMap = new Map<string, number>();
  for (const row of sessionsByPage) {
    sessionsByPageMap.set(row.url.split('?')[0], row._count.sessionId);
  }

  const enriched = ctas.map(cta => {
    const ctaTextLower = cta.ctaText.toLowerCase();
    const matchingClicks = clicks.filter(c => (c.elementText ?? '').toLowerCase().includes(ctaTextLower));
    const clickCount30d = matchingClicks.length;

    // Sessions exposed = sum of sessions on each page where this CTA appears
    const sessionsExposed = cta.pages.reduce((sum, page) => sum + (sessionsByPageMap.get(page) ?? 0), 0);
    const ctr = sessionsExposed > 0 ? (clickCount30d / sessionsExposed) * 100 : 0;

    return {
      id: cta.id,
      ctaText: cta.ctaText,
      ctaHref: cta.ctaHref,
      ctaType: cta.ctaType,
      pages: cta.pages,
      pageCount: cta.pageCount,
      status: cta.status,
      firstDetectedAt: cta.firstDetectedAt,
      lastDetectedAt: cta.lastDetectedAt,
      clickCount30d,
      sessionsExposed,
      ctr: Math.round(ctr * 100) / 100,
    };
  });

  // Group by type for the summary chips
  const summary: Record<string, { count: number; tracked: number; suggested: number; ignored: number }> = {};
  for (const cta of enriched) {
    if (!summary[cta.ctaType]) summary[cta.ctaType] = { count: 0, tracked: 0, suggested: 0, ignored: 0 };
    summary[cta.ctaType].count++;
    if (cta.status === 'TRACKED') summary[cta.ctaType].tracked++;
    else if (cta.status === 'SUGGESTED') summary[cta.ctaType].suggested++;
    else if (cta.status === 'IGNORED') summary[cta.ctaType].ignored++;
  }

  return NextResponse.json({
    ctas: enriched,
    summary,
    totalPages: new Set(enriched.flatMap(c => c.pages)).size,
    totalCtas: enriched.length,
  });
}
