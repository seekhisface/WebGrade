// GET /api/sitemap/ctas?siteId=xxx&filter=conversion|all
//
// Returns the CTA inventory (own site + competitors), with click counts joined
// from the last 30 days, plus a priority score and recommended action so the
// user can quickly approve or ignore without reviewing every row.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';
import type { CtaType } from '@prisma/client';

const CONVERSION_TYPES: CtaType[] = ['DEMO', 'SIGNUP', 'TRIAL', 'CONTACT', 'BUY'];

// Per-type weight in the priority score. Drives the "Recommended" badges.
const TYPE_WEIGHT: Record<CtaType, number> = {
  DEMO: 30, SIGNUP: 25, TRIAL: 25, BUY: 30,
  CONTACT: 20, SUBSCRIBE: 5, DOWNLOAD: 10, OTHER: 5,
};

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

  const baseWhere = filter === 'all' ? { siteId } : { siteId, ctaType: { in: CONVERSION_TYPES } };

  const ctas = await prisma.siteCta.findMany({
    where: baseWhere,
    orderBy: [{ ctaType: 'asc' }, { pageCount: 'desc' }],
  });

  // Click counts last 30d — case-insensitive substring match on elementText.
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

  const sessionsByPage = await prisma.pageView.groupBy({
    by: ['url'],
    where: { siteId, enteredAt: { gte: last30 }, session: { isBotFiltered: false } },
    _count: { sessionId: true },
  });
  const sessionsByPageMap = new Map<string, number>();
  for (const row of sessionsByPage) {
    sessionsByPageMap.set(row.url.split('?')[0], row._count.sessionId);
  }

  type Enriched = {
    id: string;
    competitorUrl: string;
    ctaText: string;
    ctaHref: string;
    ctaType: CtaType;
    pages: string[];
    pageCount: number;
    status: 'SUGGESTED' | 'TRACKED' | 'IGNORED';
    firstDetectedAt: Date;
    lastDetectedAt: Date;
    clickCount30d: number;
    sessionsExposed: number;
    ctr: number;
    priority: number;
    recommendation: 'track' | 'ignore' | 'review';
  };

  const enriched: Enriched[] = ctas.map(cta => {
    // Click + session counts only meaningful for own-site CTAs (we don't track
    // visitors on competitor sites). For competitor CTAs both will be 0.
    const isOwn = cta.competitorUrl === '';
    let clickCount30d = 0;
    let sessionsExposed = 0;
    if (isOwn) {
      const ctaTextLower = cta.ctaText.toLowerCase();
      clickCount30d = clicks.filter(c => (c.elementText ?? '').toLowerCase().includes(ctaTextLower)).length;
      sessionsExposed = cta.pages.reduce((sum, page) => sum + (sessionsByPageMap.get(page) ?? 0), 0);
    }
    const ctr = sessionsExposed > 0 ? (clickCount30d / sessionsExposed) * 100 : 0;

    // Priority score: type weight + click signal + exposure signal (cap each)
    const typeScore = TYPE_WEIGHT[cta.ctaType] ?? 0;
    const clickScore = Math.min(40, clickCount30d * 4);
    const exposureScore = Math.min(20, cta.pageCount * 2);
    const priority = Math.min(100, typeScore + clickScore + exposureScore);

    // Recommendation: prioritize by what makes the decision easy
    let recommendation: 'track' | 'ignore' | 'review';
    if (!isOwn) {
      // Competitor CTAs are reference-only — never marked TRACKED
      recommendation = 'review';
    } else if (clickCount30d >= 3 && CONVERSION_TYPES.includes(cta.ctaType)) {
      // Already getting real engagement on a conversion-type CTA → clear keeper
      recommendation = 'track';
    } else if (priority >= 50) {
      recommendation = 'track';
    } else if (priority < 15 && clickCount30d === 0) {
      recommendation = 'ignore';
    } else {
      recommendation = 'review';
    }

    return {
      id: cta.id,
      competitorUrl: cta.competitorUrl,
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
      priority,
      recommendation,
    };
  });

  // Split own vs competitor for the UI
  const ownCtas = enriched
    .filter(c => c.competitorUrl === '')
    .sort((a, b) => b.priority - a.priority);
  const competitorCtas = enriched
    .filter(c => c.competitorUrl !== '')
    .sort((a, b) => b.priority - a.priority);

  // Group competitor CTAs by competitor URL for the side-by-side view
  const competitorGroups: Record<string, typeof competitorCtas> = {};
  for (const c of competitorCtas) {
    if (!competitorGroups[c.competitorUrl]) competitorGroups[c.competitorUrl] = [];
    competitorGroups[c.competitorUrl].push(c);
  }

  // Summary by type — own site only
  const summary: Record<string, { count: number; tracked: number; suggested: number; ignored: number }> = {};
  for (const cta of ownCtas) {
    if (!summary[cta.ctaType]) summary[cta.ctaType] = { count: 0, tracked: 0, suggested: 0, ignored: 0 };
    summary[cta.ctaType].count++;
    if (cta.status === 'TRACKED') summary[cta.ctaType].tracked++;
    else if (cta.status === 'SUGGESTED') summary[cta.ctaType].suggested++;
    else if (cta.status === 'IGNORED') summary[cta.ctaType].ignored++;
  }

  return NextResponse.json({
    ctas: ownCtas,
    competitorCtas,
    competitorGroups,
    competitorCount: Object.keys(competitorGroups).length,
    summary,
    totalPages: new Set(ownCtas.flatMap(c => c.pages)).size,
    totalCtas: ownCtas.length,
    recommendedTrackCount: ownCtas.filter(c => c.recommendation === 'track' && c.status === 'SUGGESTED').length,
    recommendedIgnoreCount: ownCtas.filter(c => c.recommendation === 'ignore' && c.status === 'SUGGESTED').length,
  });
}
