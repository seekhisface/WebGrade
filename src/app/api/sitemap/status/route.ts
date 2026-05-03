// GET /api/sitemap/status?siteId=xxx
//
// Returns deep-crawl eligibility state for the modal:
//  - lastDeepCrawlAt
//  - nextEligibleAt (lastDeepCrawlAt + 90 days)
//  - eligible (boolean)
//  - competitorUrls from onboarding (so the modal can pre-populate the list)

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';

const COOLDOWN_DAYS = 90;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const site = await verifySiteAccess(session.user.email, siteId);
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const full = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      lastDeepCrawlAt: true,
      onboarding: { select: { competitorUrls: true } },
    },
  });

  const last = full?.lastDeepCrawlAt ?? null;
  const next = last ? new Date(last.getTime() + COOLDOWN_DAYS * 86400000) : null;
  const eligible = !next || next.getTime() <= Date.now();

  return NextResponse.json({
    lastDeepCrawlAt: last?.toISOString() ?? null,
    nextEligibleAt: next?.toISOString() ?? null,
    eligible,
    cooldownDays: COOLDOWN_DAYS,
    competitorUrls: full?.onboarding?.competitorUrls ?? [],
  });
}
