/**
 * GET /api/analytics/seo?siteId=xxx
 *
 * Returns SEO data from the database for the Live SEO dashboard:
 * - Latest crawl scores and page results (CWV, on-page, indexing)
 * - GSC keyword and traffic metrics from SiteBaseline
 *
 * All data comes from SeoCrawl, SeoPageResult, and SiteBaseline tables.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiSession, unauthorizedResponse } from '@/lib/auth/api';
import { prisma } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  const auth = await requireApiSession();
  if (!auth) return unauthorizedResponse();

  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  // ── 1. Latest completed crawl ───────────────────────────────────────────
  const crawl = await prisma.seoCrawl.findFirst({
    where: { siteId, crawlStatus: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    include: {
      pageResults: {
        orderBy: { url: 'asc' },
      },
    },
  });

  if (!crawl) {
    return NextResponse.json({ hasSeoData: false });
  }

  // ── 2. GSC metrics from SiteBaseline ────────────────────────────────────
  const baselines = await prisma.siteBaseline.findMany({
    where: { siteId, source: 'gsc_import' },
    orderBy: { capturedAt: 'desc' },
  });

  // Parse aggregate metrics
  const getMetric = (key: string) =>
    baselines.find(b => b.metricKey === `gsc_${key}`)?.value ?? 0;

  const gscTraffic = {
    organicSessions30d: getMetric('organic_sessions_30d'),
    organicSessions7d: getMetric('organic_sessions_7d'),
    totalClicks30d: getMetric('total_clicks_30d'),
    totalImpressions30d: getMetric('total_impressions_30d'),
    avgCtr: getMetric('avg_ctr'),
    avgPosition: getMetric('avg_position'),
    keywordsTop3: getMetric('keywords_top3'),
    keywordsTop10: getMetric('keywords_top10'),
    keywordsTop30: getMetric('keywords_top30'),
    keywordsTotal: getMetric('keywords_total'),
  };

  // Parse per-keyword data
  const kwMap = new Map<string, { position: number; clicks: number; impressions: number; ctr: number }>();
  for (const b of baselines) {
    const match = b.metricKey.match(/^gsc_kw_(position|clicks|impressions|ctr)__(.+)$/);
    if (!match) continue;
    const [, field, safeKey] = match;
    if (!kwMap.has(safeKey)) {
      kwMap.set(safeKey, { position: 0, clicks: 0, impressions: 0, ctr: 0 });
    }
    const entry = kwMap.get(safeKey)!;
    (entry as Record<string, number>)[field] = b.value;
  }

  // Convert safe keys back to readable keywords and build array
  const keywords = Array.from(kwMap.entries()).map(([safeKey, data]) => ({
    keyword: safeKey.replace(/_/g, ' '),
    ...data,
  })).sort((a, b) => a.position - b.position);

  // ── 3. Compute page-level summaries ─────────────────────────────────────
  const indexablePages = crawl.pageResults.filter(p => p.isIndexable);
  const notIndexedPages = crawl.pageResults.filter(p => !p.isIndexable && p.statusCode !== 301);
  const redirectPages = crawl.pageResults.filter(p => p.statusCode === 301);
  const errorPages = crawl.pageResults.filter(p =>
    p.statusCode !== null && (p.statusCode === 404 || p.statusCode >= 500)
  );

  // CWV aggregates (only for pages with CWV data)
  const cwvPages = crawl.pageResults.filter(p => p.lcp !== null);
  const avgLcp = cwvPages.length > 0
    ? cwvPages.reduce((s, p) => s + (p.lcp ?? 0), 0) / cwvPages.length : 0;
  const avgFid = cwvPages.length > 0
    ? cwvPages.reduce((s, p) => s + (p.fid ?? 0), 0) / cwvPages.length : 0;
  const avgCls = cwvPages.length > 0
    ? cwvPages.reduce((s, p) => s + (p.cls ?? 0), 0) / cwvPages.length : 0;
  const avgTtfb = cwvPages.length > 0
    ? cwvPages.reduce((s, p) => s + (p.ttfb ?? 0), 0) / cwvPages.length : 0;

  const cwvPass = avgLcp < 2.5 && avgFid < 100 && avgCls < 0.1;

  // ── 4. Build response ──────────────────────────────────────────────────
  return NextResponse.json({
    hasSeoData: true,

    crawl: {
      id: crawl.id,
      completedAt: crawl.completedAt,
      pagesFound: crawl.pagesFound,
      pagesAnalyzed: crawl.pagesAnalyzed,
      overallSeoScore: crawl.overallSeoScore,
      technicalScore: crawl.technicalScore,
      onPageScore: crawl.onPageScore,
      contentScore: crawl.contentScore,
      crawlabilityScore: crawl.crawlabilityScore,
    },

    cwv: {
      avgLcp: parseFloat(avgLcp.toFixed(1)),
      avgFid: Math.round(avgFid),
      avgCls: parseFloat(avgCls.toFixed(2)),
      avgTtfb: Math.round(avgTtfb),
      cwvPass,
      pages: cwvPages.map(p => ({
        url: p.url,
        lcp: p.lcp,
        fid: p.fid,
        cls: p.cls,
        ttfb: p.ttfb,
        mobileScore: p.mobileScore,
        desktopScore: p.desktopScore,
        pass: (p.lcp ?? 0) < 2.5 && (p.fid ?? 0) < 100 && (p.cls ?? 0) < 0.1,
      })),
    },

    indexing: {
      indexedPages: indexablePages.length,
      notIndexed: notIndexedPages.length,
      redirects: redirectPages.length,
      crawlErrors: errorPages.length,
      inSitemap: crawl.pageResults.filter(p => p.isInSitemap).length,
      pages: crawl.pageResults.map(p => ({
        url: p.url,
        statusCode: p.statusCode,
        isIndexable: p.isIndexable,
        hasNoindex: p.hasNoindex,
        isInSitemap: p.isInSitemap,
        crawlDepth: p.crawlDepth,
        crawledAt: p.crawledAt,
      })),
    },

    traffic: gscTraffic,

    keywords,

    pageResults: crawl.pageResults.map(p => ({
      url: p.url,
      title: p.title,
      statusCode: p.statusCode,
      onPageScore: p.onPageScore,
      contentScore: p.contentScore,
      wordCount: p.wordCount,
      altTextMissing: p.altTextMissing,
      h1Count: p.h1Count,
      h2Count: p.h2Count,
      internalLinks: p.internalLinks,
      externalLinks: p.externalLinks,
      hasStructuredData: p.hasStructuredData,
      issues: p.issues,
    })),
  });
}
