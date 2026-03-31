// prisma/seed-seo.ts
// Seeds SEO data for the NovaPulse HR demo site:
// - SeoCrawl with SeoPageResults (CWV, on-page, technical)
// - SeoKeywordRankings (daily keyword positions for 90 days)
// - SeoTrafficSnapshots (daily traffic aggregates for 90 days)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Deterministic random for reproducible seeds
function seeded(seed: number, min: number, max: number): number {
  return min + ((Math.sin(seed) * 0.5 + 0.5) * (max - min));
}

function round(v: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

async function main() {
  console.log('🔍 Seeding SEO data...');

  const site = await prisma.site.findFirst({ where: { domain: 'novapulsehr.com' } });
  if (!site) {
    console.error('❌ NovaPulse HR site not found. Run seed-demo.ts first.');
    process.exit(1);
  }

  const siteId = site.id;

  // Clean previous SEO seed data
  await prisma.seoKeywordRanking.deleteMany({ where: { siteId } });
  await prisma.seoTrafficSnapshot.deleteMany({ where: { siteId } });
  await prisma.seoPageResult.deleteMany({ where: { siteId } });
  await prisma.seoCrawl.deleteMany({ where: { siteId } });

  // ── 1. SeoCrawl ─────────────────────────────────────────────────────────
  const crawl = await prisma.seoCrawl.create({
    data: {
      siteId,
      startedAt: new Date('2026-03-29T02:00:00Z'),
      completedAt: new Date('2026-03-29T02:04:32Z'),
      pagesFound: 58,
      pagesAnalyzed: 52,
      crawlStatus: 'COMPLETED',
      overallSeoScore: 64,
      technicalScore: 71,
      onPageScore: 58,
      contentScore: 66,
      crawlabilityScore: 78,
    },
  });
  console.log('✓ SEO crawl created');

  // ── 2. SeoPageResults (CWV + on-page for key pages) ─────────────────────
  const pages = [
    {
      url: '/', title: 'NovaPulse HR — Modern HR Software', titleLength: 40,
      metaDescription: 'All-in-one HR platform for growing teams. Onboarding, payroll, performance reviews, and compliance — built for companies with 50–500 employees.',
      metaDescLength: 148, h1Count: 1, h1Text: 'HR software that grows with your team', h2Count: 6,
      lcp: 1.8, fid: 22, cls: 0.05, ttfb: 0.28, mobileScore: 82, desktopScore: 91,
      wordCount: 1240, internalLinks: 18, externalLinks: 3, altTextMissing: 2,
      onPageScore: 74, contentScore: 70, isIndexable: true, hasNoindex: false,
      isInSitemap: true, crawlDepth: 0, hasStructuredData: true, isMobileResponsive: true,
    },
    {
      url: '/pricing', title: 'Pricing — NovaPulse HR', titleLength: 22,
      metaDescription: 'Transparent pricing for NovaPulse HR. Start free, scale as you grow.',
      metaDescLength: 68, h1Count: 1, h1Text: 'Simple, transparent pricing', h2Count: 3,
      lcp: 2.1, fid: 18, cls: 0.08, ttfb: 0.31, mobileScore: 78, desktopScore: 88,
      wordCount: 680, internalLinks: 12, externalLinks: 0, altTextMissing: 0,
      onPageScore: 82, contentScore: 65, isIndexable: true, hasNoindex: false,
      isInSitemap: true, crawlDepth: 1, hasStructuredData: true, isMobileResponsive: true,
    },
    {
      url: '/features', title: 'Features — NovaPulse HR', titleLength: 24,
      metaDescription: 'Explore NovaPulse HR features: onboarding, payroll, time tracking, performance reviews, and compliance tools.',
      metaDescLength: 108, h1Count: 1, h1Text: 'Everything your HR team needs', h2Count: 8,
      lcp: 2.9, fid: 45, cls: 0.12, ttfb: 0.42, mobileScore: 61, desktopScore: 74,
      wordCount: 1820, internalLinks: 22, externalLinks: 1, altTextMissing: 5,
      onPageScore: 52, contentScore: 72, isIndexable: true, hasNoindex: false,
      isInSitemap: true, crawlDepth: 1, hasStructuredData: false, isMobileResponsive: true,
    },
    {
      url: '/bamboohr-alternative', title: 'BambooHR Alternative — NovaPulse HR', titleLength: 36,
      metaDescription: 'Looking for a BambooHR alternative? NovaPulse HR offers better onboarding, lower cost, and dedicated support for mid-market teams.',
      metaDescLength: 130, h1Count: 1, h1Text: 'The modern BambooHR alternative', h2Count: 5,
      lcp: 1.3, fid: 12, cls: 0.04, ttfb: 0.22, mobileScore: 92, desktopScore: 96,
      wordCount: 2100, internalLinks: 14, externalLinks: 4, altTextMissing: 1,
      onPageScore: 88, contentScore: 84, isIndexable: true, hasNoindex: false,
      isInSitemap: true, crawlDepth: 1, hasStructuredData: true, isMobileResponsive: true,
    },
    {
      url: '/blog', title: 'HR Insights Blog — NovaPulse HR', titleLength: 32,
      metaDescription: 'HR tips, compliance updates, and people management strategies from the NovaPulse team.',
      metaDescLength: 86, h1Count: 1, h1Text: 'HR Insights', h2Count: 0,
      lcp: 1.6, fid: 14, cls: 0.03, ttfb: 0.19, mobileScore: 88, desktopScore: 94,
      wordCount: 340, internalLinks: 24, externalLinks: 0, altTextMissing: 0,
      onPageScore: 68, contentScore: 42, isIndexable: true, hasNoindex: false,
      isInSitemap: true, crawlDepth: 1, hasStructuredData: false, isMobileResponsive: true,
    },
  ];

  for (const p of pages) {
    await prisma.seoPageResult.create({
      data: {
        crawlId: crawl.id,
        siteId,
        url: p.url,
        statusCode: 200,
        responseTimeMs: Math.round(seeded(p.url.length * 7, 120, 480)),
        canonicalUrl: `https://novapulsehr.com${p.url}`,
        lcp: p.lcp, fid: p.fid, cls: p.cls, ttfb: p.ttfb,
        mobileScore: p.mobileScore, desktopScore: p.desktopScore,
        title: p.title, titleLength: p.titleLength,
        metaDescription: p.metaDescription, metaDescLength: p.metaDescLength,
        h1Count: p.h1Count, h1Text: p.h1Text, h2Count: p.h2Count,
        altTextMissing: p.altTextMissing, internalLinks: p.internalLinks,
        externalLinks: p.externalLinks, wordCount: p.wordCount,
        onPageScore: p.onPageScore, contentScore: p.contentScore,
        isIndexable: p.isIndexable, hasNoindex: p.hasNoindex,
        isInSitemap: p.isInSitemap, crawlDepth: p.crawlDepth,
        hasStructuredData: p.hasStructuredData, isMobileResponsive: p.isMobileResponsive,
        robotsTxtBlocked: false, isOrphanPage: false,
        isThinContent: (p.wordCount ?? 0) < 400,
        jsRenderRequired: false,
        renderBlockingScripts: Math.round(seeded(p.url.length * 3, 0, 4)),
      },
    });
  }
  console.log(`✓ ${pages.length} page results seeded`);

  // ── 3. Keywords ─────────────────────────────────────────────────────────
  const KEYWORDS = [
    { kw: 'hr software for small business',  basePos: 4,  baseClicks: 312, intent: 'Commercial', desc: 'High-intent buyers comparing HR tools for SMBs. Visitors arriving via this keyword convert at 3.4×–4.2× the site average — your highest-ROI organic keyword.' },
    { kw: 'bamboohr alternative',             basePos: 6,  baseClicks: 187, intent: 'Commercial', desc: 'Competitor-switching keyword. These visitors are already sold on the category and actively evaluating alternatives — bottom-of-funnel, high close rate.' },
    { kw: 'employee management software',     basePos: 9,  baseClicks: 143, intent: 'Commercial', desc: 'Broad category keyword. High volume, moderate intent. Visitors are early-to-mid funnel. Best converted via a comparison or feature-focused landing page.' },
    { kw: 'hr onboarding software',           basePos: 12, baseClicks: 98,  intent: 'Commercial', desc: 'Feature-specific keyword targeting buyers who need onboarding functionality. Strong product-market fit signal.' },
    { kw: 'hr management system mid-market',  basePos: 15, baseClicks: 76,  intent: 'Commercial', desc: 'Segment-qualified keyword. "Mid-market" signals budget and scale. Worth a dedicated landing page.' },
    { kw: 'novapulse hr',                     basePos: 1,  baseClicks: 241, intent: 'Navigational', desc: 'Branded keyword — people searching directly for you. Position 1. No action needed.' },
    { kw: 'hr software 100 employees',        basePos: 22, baseClicks: 44,  intent: 'Informational', desc: 'Long-tail keyword with strong ICP signal. Ranking #22 means low click share — a content piece could move it to page 1.' },
    { kw: 'hris software comparison',         basePos: 31, baseClicks: 18,  intent: 'Commercial', desc: 'High-value comparison keyword currently off page 1. A comparison landing page could recover 80–120 additional clicks/month.' },
  ];

  const now = new Date();
  const rankings: Array<Record<string, unknown>> = [];

  for (let dayOffset = 89; dayOffset >= 0; dayOffset--) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);

    for (let ki = 0; ki < KEYWORDS.length; ki++) {
      const k = KEYWORDS[ki];
      const seed = dayOffset * 13 + ki * 7;
      const drift = round(seeded(seed, -3, 3));
      const pos = Math.max(1, round(k.basePos + drift, 1));
      const dayClicks = Math.max(0, Math.round((k.baseClicks / 30) * seeded(seed * 2.1, 0.5, 1.5)));
      const dayImpr = Math.round(dayClicks * seeded(seed * 3.3, 12, 30));
      const ctr = dayImpr > 0 ? round((dayClicks / dayImpr) * 100, 1) : 0;
      const trend = drift < -1 ? 'up' : drift > 1 ? 'down' : 'flat';

      rankings.push({
        siteId,
        crawlId: crawl.id,
        date,
        keyword: k.kw,
        position: pos,
        clicks: dayClicks,
        impressions: dayImpr,
        ctr,
        intent: k.intent,
        description: k.desc,
        positionDelta: round(drift, 1),
        trend,
      });
    }
  }

  // Batch insert
  await prisma.seoKeywordRanking.createMany({ data: rankings as any });
  console.log(`✓ ${rankings.length} keyword ranking records seeded (${KEYWORDS.length} keywords × 90 days)`);

  // ── 4. Traffic Snapshots ────────────────────────────────────────────────
  const snapshots: Array<Record<string, unknown>> = [];

  for (let dayOffset = 89; dayOffset >= 0; dayOffset--) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);

    const seed = dayOffset * 17;
    const totalSessions = Math.round(seeded(seed, 62, 94));
    const organicSessions = Math.round(totalSessions * seeded(seed * 1.3, 0.52, 0.71));
    const organicPct = round((organicSessions / totalSessions) * 100, 1);
    const clicks = Math.round(organicSessions * seeded(seed * 1.7, 0.8, 1.3));
    const impressions = Math.round(clicks * seeded(seed * 2.2, 18, 34));
    const ctr = impressions > 0 ? round((clicks / impressions) * 100, 1) : 0;
    const avgPosition = round(seeded(seed * 1.9, 8.2, 22.4), 1);

    // Gradual improvement over time (newer days = slightly better indexing)
    const ageBonus = Math.round((90 - dayOffset) * 0.15);
    const indexedPages = Math.round(seeded(seed * 4.1, 38, 52)) + ageBonus;
    const crawlErrors = Math.max(0, Math.round(seeded(seed * 2.8, 0, 7) - ageBonus * 0.3));
    const notIndexed = Math.max(0, Math.round(seeded(seed * 3.7, 4, 18) - ageBonus * 0.2));
    const newPagesFound = Math.round(seeded(seed * 1.2, 0, 3));

    const top3 = Math.round(seeded(seed * 2.1, 1, 5));
    const top10 = Math.round(seeded(seed * 3.5, 4, 12));
    const top30 = Math.round(seeded(seed * 1.8, 8, 22));
    const keywordsTotal = top3 + top10 + top30 + Math.round(seeded(seed * 4.4, 30, 80));

    snapshots.push({
      siteId,
      date,
      totalSessions,
      organicSessions,
      organicPct,
      clicks,
      impressions,
      ctr,
      avgPosition,
      indexedPages,
      crawlErrors,
      notIndexed,
      newPagesFound,
      keywordsTop3: top3,
      keywordsTop10: top10,
      keywordsTop30: top30,
      keywordsTotal,
    });
  }

  await prisma.seoTrafficSnapshot.createMany({ data: snapshots as any });
  console.log(`✓ ${snapshots.length} traffic snapshot records seeded (90 days)`);

  console.log('\n✅ SEO seed complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
