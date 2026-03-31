// src/app/api/seo/route.ts
// SEO dashboard data API — aggregates traffic snapshots, keyword rankings,
// crawl results, and CWV from the database.
//
// GET /api/seo?siteId=xxx&days=30

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId');
    const days = parseInt(searchParams.get('days') ?? '30', 10);

    if (!siteId) {
      return NextResponse.json({ error: 'siteId required' }, { status: 400 });
    }

    // Verify user access
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        org: {
          members: { some: { user: { email: session.user.email } } },
        },
      },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - days);

    const prevStart = new Date(periodStart);
    prevStart.setDate(prevStart.getDate() - days);

    // ── Parallel queries ────────────────────────────────────────────────
    const [
      trafficSnapshots,
      prevSnapshots,
      latestCrawl,
      keywordRankings,
      prevKeywordRankings,
    ] = await Promise.all([
      // Current period traffic snapshots
      prisma.seoTrafficSnapshot.findMany({
        where: { siteId, date: { gte: periodStart, lte: now } },
        orderBy: { date: 'asc' },
      }),

      // Previous period for comparison
      prisma.seoTrafficSnapshot.findMany({
        where: { siteId, date: { gte: prevStart, lt: periodStart } },
        orderBy: { date: 'asc' },
      }),

      // Latest crawl with page results
      prisma.seoCrawl.findFirst({
        where: { siteId, crawlStatus: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        include: {
          pageResults: {
            select: {
              url: true, lcp: true, fid: true, cls: true, ttfb: true,
              mobileScore: true, desktopScore: true,
              isIndexable: true, statusCode: true,
            },
          },
        },
      }),

      // Current period keyword rankings (latest date per keyword)
      prisma.seoKeywordRanking.findMany({
        where: { siteId, date: { gte: periodStart, lte: now } },
        orderBy: { date: 'desc' },
      }),

      // Previous period keyword rankings
      prisma.seoKeywordRanking.findMany({
        where: { siteId, date: { gte: prevStart, lt: periodStart } },
        orderBy: { date: 'desc' },
      }),
    ]);

    // ── Aggregate current period traffic ────────────────────────────────
    const sumTraffic = (snaps: typeof trafficSnapshots) => {
      if (snaps.length === 0) return { organicSessions: 0, clicks: 0, impressions: 0, avgPosition: 0 };
      const organicSessions = snaps.reduce((s, t) => s + t.organicSessions, 0);
      const clicks = snaps.reduce((s, t) => s + t.clicks, 0);
      const impressions = snaps.reduce((s, t) => s + t.impressions, 0);
      const avgPosition = snaps.reduce((s, t) => s + t.avgPosition, 0) / snaps.length;
      return { organicSessions, clicks, impressions, avgPosition };
    };

    const current = sumTraffic(trafficSnapshots);
    const prev = sumTraffic(prevSnapshots);

    const pctChange = (cur: number, prv: number) =>
      prv > 0 ? Math.round(((cur - prv) / prv) * 1000) / 10 : 0;

    // Latest snapshot for indexing stats
    const latestSnapshot = trafficSnapshots[trafficSnapshots.length - 1] ?? null;

    // ── Aggregate keywords (latest record per keyword) ──────────────────
    const kwMap = new Map<string, typeof keywordRankings[0]>();
    for (const kr of keywordRankings) {
      if (!kwMap.has(kr.keyword)) kwMap.set(kr.keyword, kr);
    }
    const latestKeywords = Array.from(kwMap.values()).sort((a, b) => a.position - b.position);

    // Sum clicks/impressions per keyword across period
    const kwAggMap = new Map<string, { clicks: number; impressions: number }>();
    for (const kr of keywordRankings) {
      const agg = kwAggMap.get(kr.keyword) ?? { clicks: 0, impressions: 0 };
      agg.clicks += kr.clicks;
      agg.impressions += kr.impressions;
      kwAggMap.set(kr.keyword, agg);
    }

    const keywords = latestKeywords.map(kr => {
      const agg = kwAggMap.get(kr.keyword) ?? { clicks: 0, impressions: 0 };
      return {
        keyword: kr.keyword,
        position: Math.round(kr.position * 10) / 10,
        clicks: agg.clicks,
        impressions: agg.impressions,
        ctr: agg.impressions > 0 ? Math.round((agg.clicks / agg.impressions) * 1000) / 10 : 0,
        intent: kr.intent,
        description: kr.description,
        trend: kr.trend,
        positionDelta: kr.positionDelta,
      };
    });

    // Keyword ranking buckets
    const keywordsTop3 = latestKeywords.filter(k => k.position <= 3).length;
    const keywordsTop10 = latestKeywords.filter(k => k.position > 3 && k.position <= 10).length;
    const keywordsTop30 = latestKeywords.filter(k => k.position > 10 && k.position <= 30).length;
    const keywordsTotal = latestKeywords.length;

    // ── CWV from latest crawl ───────────────────────────────────────────
    const cwv = latestCrawl?.pageResults.map(p => ({
      url: p.url,
      lcp: p.lcp,
      fid: p.fid,
      cls: p.cls,
      ttfb: p.ttfb,
      mobileScore: p.mobileScore,
      pass: (p.lcp ?? 99) < 2.5 && (p.cls ?? 99) < 0.1 && (p.fid ?? 999) < 100,
    })) ?? [];

    // Site-wide CWV averages
    const cwvPages = cwv.filter(p => p.lcp != null);
    const avgLcp = cwvPages.length > 0 ? Math.round(cwvPages.reduce((s, p) => s + (p.lcp ?? 0), 0) / cwvPages.length * 10) / 10 : 0;
    const avgFid = cwvPages.length > 0 ? Math.round(cwvPages.reduce((s, p) => s + (p.fid ?? 0), 0) / cwvPages.length) : 0;
    const avgCls = cwvPages.length > 0 ? Math.round(cwvPages.reduce((s, p) => s + (p.cls ?? 0), 0) / cwvPages.length * 100) / 100 : 0;
    const avgTtfb = cwvPages.length > 0 ? Math.round(cwvPages.reduce((s, p) => s + (p.ttfb ?? 0), 0) / cwvPages.length) : 0;
    const cwvPass = avgLcp < 2.5 && avgFid < 100 && avgCls < 0.1;

    // ── Sparkline data (daily organic sessions) ─────────────────────────
    const sparkPoints = trafficSnapshots.map(s => s.organicSessions);

    // CTR for response
    const ctr = current.impressions > 0
      ? Math.round((current.clicks / current.impressions) * 1000) / 10
      : 0;

    return NextResponse.json({
      site: { id: site.id, name: site.name, domain: site.domain },
      days,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),

      // Traffic KPIs
      organicSessions: current.organicSessions,
      organicSessionsDelta: pctChange(current.organicSessions, prev.organicSessions),
      clicks: current.clicks,
      clicksDelta: pctChange(current.clicks, prev.clicks),
      impressions: current.impressions,
      impressionsDelta: pctChange(current.impressions, prev.impressions),
      ctr,
      ctrDelta: pctChange(ctr, prev.impressions > 0 ? Math.round((prev.clicks / prev.impressions) * 1000) / 10 : 0),
      avgPosition: Math.round(current.avgPosition * 10) / 10,
      positionDelta: Math.round((current.avgPosition - prev.avgPosition) * 10) / 10,

      // Keyword ranking buckets
      keywordsTop3,
      keywordsTop10,
      keywordsTop30,
      keywordsTotal,

      // Indexing
      indexedPages: latestSnapshot?.indexedPages ?? 0,
      crawlErrors: latestSnapshot?.crawlErrors ?? 0,
      notIndexed: latestSnapshot?.notIndexed ?? 0,
      newPagesFound: latestSnapshot?.newPagesFound ?? 0,

      // Keywords
      keywords,

      // CWV
      cwv: { lcp: avgLcp, fid: avgFid, cls: avgCls, ttfb: avgTtfb, pass: cwvPass },
      cwvPages: cwv,

      // Crawl scores
      crawlScores: latestCrawl ? {
        overall: latestCrawl.overallSeoScore,
        technical: latestCrawl.technicalScore,
        onPage: latestCrawl.onPageScore,
        content: latestCrawl.contentScore,
        crawlability: latestCrawl.crawlabilityScore,
      } : null,

      // Sparkline
      sparkPoints,
    });
  } catch (err) {
    console.error('[seo] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
