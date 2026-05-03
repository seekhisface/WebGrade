// POST /api/sitemap/crawl
// Body: { siteId: string, includeCompetitors?: boolean, addCompetitorUrls?: string[] }
//
// Triggers a deep crawl. Enforces the 90-day cooldown server-side. If new
// competitor URLs are provided, they're appended to onboarding.competitorUrls
// before the crawl runs.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // deep crawl can take up to 5 minutes (Pro plan)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';
import { runDeepCrawl } from '@/lib/seo/deep-crawl';
import { z } from 'zod';

const Body = z.object({
  siteId: z.string().min(1),
  includeCompetitors: z.boolean().optional(),
  addCompetitorUrls: z.array(z.string().url()).optional(),
});

const COOLDOWN_DAYS = 90;

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

  const { siteId, addCompetitorUrls } = parsed.data;
  const access = await verifySiteAccess(session.user.email, siteId);
  if (!access) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  // Enforce 90-day cooldown
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { lastDeepCrawlAt: true },
  });
  if (site?.lastDeepCrawlAt) {
    const elapsedMs = Date.now() - site.lastDeepCrawlAt.getTime();
    if (elapsedMs < COOLDOWN_DAYS * 86400000) {
      const nextEligible = new Date(site.lastDeepCrawlAt.getTime() + COOLDOWN_DAYS * 86400000);
      return NextResponse.json({
        error: 'Cooldown active',
        message: `Last deep crawl: ${site.lastDeepCrawlAt.toISOString()}. Next eligible: ${nextEligible.toISOString()}.`,
        lastDeepCrawlAt: site.lastDeepCrawlAt.toISOString(),
        nextEligibleAt: nextEligible.toISOString(),
      }, { status: 429 });
    }
  }

  // Append any new competitor URLs to onboarding before the crawl runs.
  if (addCompetitorUrls && addCompetitorUrls.length > 0) {
    const onboarding = await prisma.siteOnboarding.findUnique({ where: { siteId } });
    if (onboarding) {
      const merged = Array.from(new Set([...(onboarding.competitorUrls ?? []), ...addCompetitorUrls]));
      await prisma.siteOnboarding.update({
        where: { siteId },
        data: { competitorUrls: merged.slice(0, 10) }, // hard cap at 10 competitors
      });
    }
  }

  try {
    const result = await runDeepCrawl(siteId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[sitemap/crawl]', err);
    const msg = err instanceof Error ? err.message : 'Deep crawl failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
