// src/app/api/seo/crawl/route.ts
// POST /api/seo/crawl — trigger an SEO crawl for a site.
// GET /api/seo/crawl?siteId=xxx — get latest crawl status.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { crawlSite } from '@/lib/seo/crawler';

export const runtime = 'nodejs';
export const maxDuration = 120; // crawling can take a while

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId } = await req.json();
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    // Verify access
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        org: { members: { some: { user: { email: session.user.email } } } },
      },
      select: { id: true, url: true },
    });

    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    // Check for recent crawl (throttle to 1 per hour)
    const recentCrawl = await prisma.seoCrawl.findFirst({
      where: {
        siteId,
        startedAt: { gte: new Date(Date.now() - 3600000) },
      },
    });

    if (recentCrawl) {
      return NextResponse.json({ error: 'Crawl already running or completed recently. Try again later.', crawlId: recentCrawl.id }, { status: 429 });
    }

    // Start crawl
    const result = await crawlSite({ siteId, startUrl: site.url, maxPages: 50 });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Crawl error:', err);
    return NextResponse.json({ error: 'Crawl failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = req.nextUrl.searchParams.get('siteId');
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    const latestCrawl = await prisma.seoCrawl.findFirst({
      where: { siteId },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        crawlStatus: true,
        startedAt: true,
        completedAt: true,
        pagesFound: true,
        pagesAnalyzed: true,
        overallSeoScore: true,
        technicalScore: true,
        onPageScore: true,
        contentScore: true,
        crawlabilityScore: true,
      },
    });

    return NextResponse.json({ crawl: latestCrawl });
  } catch (err) {
    console.error('Crawl status error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
