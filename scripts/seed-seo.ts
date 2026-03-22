/**
 * Seeds realistic SEO data for the NovaPulse HR demo site:
 * - SeoCrawl with overall scores
 * - SeoPageResult with CWV, on-page SEO, crawlability, and issues
 * - SiteBaseline rows for GSC keyword/traffic metrics
 *
 * Usage: npx tsx scripts/seed-seo.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SITE_ID = 'cmmwg5xig0006ecipqmdivbl0';

// ---------------------------------------------------------------------------
// Page definitions with realistic SEO profiles for an HR SaaS site
// ---------------------------------------------------------------------------

const PAGES = [
  {
    url: '/',
    title: 'NovaPulse HR — Modern HR Software for Growing Teams',
    metaDescription: 'NovaPulse HR helps mid-market companies streamline hiring, onboarding, and performance management. Start your free trial today.',
    h1Text: 'HR Software That Grows With Your Team',
    wordCount: 1240,
    lcp: 1.8, fid: 12, cls: 0.04, ttfb: 280,
    mobileScore: 88, desktopScore: 94,
    statusCode: 200, responseTimeMs: 320,
    isIndexable: true, hasNoindex: false, isInSitemap: true,
    internalLinks: 24, externalLinks: 3,
    h1Count: 1, h2Count: 6, altTextMissing: 1,
    hasStructuredData: true, isMobileResponsive: true,
    renderBlockingScripts: 1, jsRenderRequired: false,
    onPageScore: 82, contentScore: 78,
    issues: [
      { type: 'image', severity: 'low', description: '1 image missing alt text on hero section', fix: 'Add descriptive alt text to hero background image' },
    ],
  },
  {
    url: '/pricing',
    title: 'Pricing — NovaPulse HR',
    metaDescription: 'Simple, transparent pricing for NovaPulse HR. Plans starting at $8/employee/month. No hidden fees.',
    h1Text: 'Simple Pricing for Every Team Size',
    wordCount: 680,
    lcp: 2.4, fid: 18, cls: 0.12, ttfb: 310,
    mobileScore: 72, desktopScore: 85,
    statusCode: 200, responseTimeMs: 380,
    isIndexable: true, hasNoindex: false, isInSitemap: true,
    internalLinks: 12, externalLinks: 0,
    h1Count: 1, h2Count: 4, altTextMissing: 0,
    hasStructuredData: true, isMobileResponsive: true,
    renderBlockingScripts: 2, jsRenderRequired: false,
    onPageScore: 71, contentScore: 65,
    issues: [
      { type: 'performance', severity: 'medium', description: 'CLS 0.12 exceeds Good threshold (0.1) — pricing toggle animation causes layout shift', fix: 'Reserve space for pricing toggle content to prevent layout shift' },
      { type: 'performance', severity: 'low', description: '2 render-blocking scripts delaying first paint', fix: 'Defer non-critical JavaScript or move to end of body' },
    ],
  },
  {
    url: '/features',
    title: 'Features — NovaPulse HR',
    metaDescription: 'Explore NovaPulse HR features: applicant tracking, onboarding workflows, performance reviews, time-off management, and more.',
    h1Text: 'Everything You Need to Manage Your Team',
    wordCount: 2100,
    lcp: 3.2, fid: 45, cls: 0.08, ttfb: 420,
    mobileScore: 58, desktopScore: 71,
    statusCode: 200, responseTimeMs: 520,
    isIndexable: true, hasNoindex: false, isInSitemap: true,
    internalLinks: 18, externalLinks: 2,
    h1Count: 1, h2Count: 8, altTextMissing: 4,
    hasStructuredData: false, isMobileResponsive: true,
    renderBlockingScripts: 3, jsRenderRequired: true,
    onPageScore: 54, contentScore: 72,
    issues: [
      { type: 'performance', severity: 'high', description: 'LCP 3.2s — hero image is 1.8MB uncompressed PNG', fix: 'Convert hero image to WebP and add width/height attributes for aspect ratio' },
      { type: 'image', severity: 'medium', description: '4 feature images missing alt text', fix: 'Add descriptive alt text to all feature screenshots' },
      { type: 'technical', severity: 'medium', description: 'Page requires JavaScript rendering — content not available to crawlers without JS', fix: 'Implement server-side rendering or static generation for feature content' },
      { type: 'performance', severity: 'medium', description: '3 render-blocking scripts (420ms delay)', fix: 'Code-split feature section JS and lazy-load below-fold modules' },
    ],
  },
  {
    url: '/bamboohr-alternative',
    title: 'BambooHR Alternative — NovaPulse HR vs BambooHR Comparison',
    metaDescription: 'Looking for a BambooHR alternative? See how NovaPulse HR compares on pricing, features, and support for mid-market companies.',
    h1Text: 'NovaPulse HR vs BambooHR: An Honest Comparison',
    wordCount: 1850,
    lcp: 1.3, fid: 8, cls: 0.02, ttfb: 240,
    mobileScore: 95, desktopScore: 98,
    statusCode: 200, responseTimeMs: 260,
    isIndexable: true, hasNoindex: false, isInSitemap: true,
    internalLinks: 14, externalLinks: 5,
    h1Count: 1, h2Count: 7, altTextMissing: 0,
    hasStructuredData: true, isMobileResponsive: true,
    renderBlockingScripts: 0, jsRenderRequired: false,
    onPageScore: 92, contentScore: 88,
    issues: [],
  },
  {
    url: '/signup',
    title: 'Start Free Trial — NovaPulse HR',
    metaDescription: 'Start your free 14-day trial of NovaPulse HR. No credit card required. Set up in under 5 minutes.',
    h1Text: 'Start Your Free Trial',
    wordCount: 320,
    lcp: 1.1, fid: 6, cls: 0.01, ttfb: 190,
    mobileScore: 96, desktopScore: 99,
    statusCode: 200, responseTimeMs: 210,
    isIndexable: true, hasNoindex: false, isInSitemap: true,
    internalLinks: 4, externalLinks: 0,
    h1Count: 1, h2Count: 1, altTextMissing: 0,
    hasStructuredData: false, isMobileResponsive: true,
    renderBlockingScripts: 0, jsRenderRequired: false,
    onPageScore: 78, contentScore: 55,
    issues: [
      { type: 'content', severity: 'low', description: 'Thin content (320 words) — may not rank independently', fix: 'Add social proof, testimonials, or FAQ section below the signup form' },
      { type: 'seo', severity: 'low', description: 'Missing structured data (Organization or Product schema)', fix: 'Add FAQ or Product structured data to improve SERP appearance' },
    ],
  },
  {
    url: '/blog/hr-onboarding-best-practices',
    title: 'HR Onboarding Best Practices for 2026 — NovaPulse HR Blog',
    metaDescription: 'Learn the top HR onboarding best practices for 2026. Reduce time-to-productivity and improve new hire retention with these proven strategies.',
    h1Text: 'HR Onboarding Best Practices for 2026',
    wordCount: 2400,
    lcp: 1.6, fid: 10, cls: 0.03, ttfb: 290,
    mobileScore: 90, desktopScore: 96,
    statusCode: 200, responseTimeMs: 310,
    isIndexable: true, hasNoindex: false, isInSitemap: true,
    internalLinks: 8, externalLinks: 6,
    h1Count: 1, h2Count: 9, altTextMissing: 2,
    hasStructuredData: true, isMobileResponsive: true,
    renderBlockingScripts: 1, jsRenderRequired: false,
    onPageScore: 85, contentScore: 91,
    issues: [
      { type: 'image', severity: 'low', description: '2 blog images missing alt text', fix: 'Add descriptive alt text to inline blog images' },
    ],
  },
  {
    url: '/blog',
    title: 'HR Insights Blog — NovaPulse HR',
    metaDescription: 'Expert insights on HR management, employee engagement, and workforce technology from the NovaPulse HR team.',
    h1Text: 'HR Insights Blog',
    wordCount: 450,
    lcp: 1.9, fid: 14, cls: 0.06, ttfb: 340,
    mobileScore: 82, desktopScore: 90,
    statusCode: 200, responseTimeMs: 370,
    isIndexable: true, hasNoindex: false, isInSitemap: true,
    internalLinks: 16, externalLinks: 0,
    h1Count: 1, h2Count: 0, altTextMissing: 3,
    hasStructuredData: false, isMobileResponsive: true,
    renderBlockingScripts: 1, jsRenderRequired: false,
    onPageScore: 62, contentScore: 48,
    issues: [
      { type: 'content', severity: 'medium', description: 'Blog index has thin content (450 words) — mostly just links', fix: 'Add category descriptions, featured articles, and intro text' },
      { type: 'image', severity: 'low', description: '3 blog thumbnail images missing alt text', fix: 'Add alt text to all blog post thumbnails' },
      { type: 'seo', severity: 'low', description: 'No H2 headings — flat content structure', fix: 'Add H2 category headings to organize blog index' },
    ],
  },
  {
    url: '/about',
    title: 'About Us — NovaPulse HR',
    metaDescription: 'Learn about the NovaPulse HR team, our mission, and why we built modern HR software for growing companies.',
    h1Text: 'About NovaPulse HR',
    wordCount: 920,
    lcp: 2.1, fid: 11, cls: 0.05, ttfb: 300,
    mobileScore: 84, desktopScore: 92,
    statusCode: 200, responseTimeMs: 330,
    isIndexable: true, hasNoindex: false, isInSitemap: true,
    internalLinks: 10, externalLinks: 4,
    h1Count: 1, h2Count: 4, altTextMissing: 0,
    hasStructuredData: true, isMobileResponsive: true,
    renderBlockingScripts: 0, jsRenderRequired: false,
    onPageScore: 80, contentScore: 74,
    issues: [],
  },
  {
    url: '/contact',
    title: 'Contact Us — NovaPulse HR',
    metaDescription: 'Get in touch with the NovaPulse HR team. We respond within 24 hours.',
    h1Text: 'Contact Us',
    wordCount: 280,
    lcp: 1.2, fid: 7, cls: 0.01, ttfb: 200,
    mobileScore: 94, desktopScore: 98,
    statusCode: 200, responseTimeMs: 220,
    isIndexable: true, hasNoindex: false, isInSitemap: true,
    internalLinks: 6, externalLinks: 0,
    h1Count: 1, h2Count: 2, altTextMissing: 0,
    hasStructuredData: true, isMobileResponsive: true,
    renderBlockingScripts: 0, jsRenderRequired: false,
    onPageScore: 76, contentScore: 52,
    issues: [
      { type: 'content', severity: 'low', description: 'Thin content (280 words)', fix: 'Add FAQ section or office location details to improve content depth' },
    ],
  },
  {
    url: '/integrations',
    title: 'Integrations — NovaPulse HR',
    metaDescription: 'NovaPulse HR integrates with Slack, Google Workspace, Microsoft 365, QuickBooks, and 40+ other tools.',
    h1Text: 'Integrations',
    wordCount: 1100,
    lcp: 2.6, fid: 22, cls: 0.09, ttfb: 360,
    mobileScore: 70, desktopScore: 80,
    statusCode: 200, responseTimeMs: 410,
    isIndexable: true, hasNoindex: false, isInSitemap: true,
    internalLinks: 20, externalLinks: 8,
    h1Count: 1, h2Count: 5, altTextMissing: 6,
    hasStructuredData: false, isMobileResponsive: true,
    renderBlockingScripts: 2, jsRenderRequired: false,
    onPageScore: 58, contentScore: 66,
    issues: [
      { type: 'performance', severity: 'medium', description: 'LCP 2.6s — integration logo grid loads 40+ images synchronously', fix: 'Lazy-load integration logos below the fold and use CSS sprites or SVG' },
      { type: 'image', severity: 'high', description: '6 integration logos missing alt text — hurts accessibility and image SEO', fix: 'Add brand name alt text to all integration logos (e.g., "Slack integration")' },
      { type: 'seo', severity: 'low', description: 'No structured data for software integrations', fix: 'Add SoftwareApplication schema with integration details' },
    ],
  },
  // Pages with issues
  {
    url: '/case-studies',
    title: 'Case Studies — NovaPulse HR',
    metaDescription: null, // Missing meta description
    h1Text: 'Customer Success Stories',
    wordCount: 380,
    lcp: 2.0, fid: 15, cls: 0.07, ttfb: 310,
    mobileScore: 80, desktopScore: 88,
    statusCode: 200, responseTimeMs: 340,
    isIndexable: true, hasNoindex: false, isInSitemap: true,
    internalLinks: 8, externalLinks: 0,
    h1Count: 1, h2Count: 3, altTextMissing: 2,
    hasStructuredData: false, isMobileResponsive: true,
    renderBlockingScripts: 1, jsRenderRequired: false,
    onPageScore: 55, contentScore: 42,
    issues: [
      { type: 'seo', severity: 'high', description: 'Missing meta description — Google will auto-generate one, reducing CTR control', fix: 'Write a compelling meta description under 155 characters highlighting customer results' },
      { type: 'content', severity: 'medium', description: 'Thin content (380 words) — case study index lacks detail', fix: 'Add summary cards with metrics (e.g., "Reduced time-to-hire by 40%") for each case study' },
    ],
  },
  {
    url: '/demo',
    title: 'Request a Demo — NovaPulse HR',
    metaDescription: 'See NovaPulse HR in action. Book a personalized demo with our team.',
    h1Text: 'See NovaPulse HR in Action',
    wordCount: 410,
    lcp: 1.4, fid: 9, cls: 0.02, ttfb: 220,
    mobileScore: 92, desktopScore: 97,
    statusCode: 200, responseTimeMs: 240,
    isIndexable: true, hasNoindex: false, isInSitemap: true,
    internalLinks: 5, externalLinks: 1,
    h1Count: 1, h2Count: 2, altTextMissing: 0,
    hasStructuredData: false, isMobileResponsive: true,
    renderBlockingScripts: 0, jsRenderRequired: false,
    onPageScore: 74, contentScore: 60,
    issues: [
      { type: 'seo', severity: 'low', description: 'No FAQ or review structured data', fix: 'Add FAQ schema with common demo questions to improve SERP real estate' },
    ],
  },
  // Non-indexed / problem pages
  {
    url: '/old-pricing',
    title: 'Pricing — NovaPulse HR',
    metaDescription: 'Old pricing page — redirects to /pricing',
    h1Text: null,
    wordCount: 0,
    lcp: null, fid: null, cls: null, ttfb: null,
    mobileScore: null, desktopScore: null,
    statusCode: 301, responseTimeMs: 120,
    isIndexable: false, hasNoindex: false, isInSitemap: false,
    internalLinks: 0, externalLinks: 0,
    h1Count: 0, h2Count: 0, altTextMissing: 0,
    hasStructuredData: false, isMobileResponsive: null,
    renderBlockingScripts: 0, jsRenderRequired: false,
    onPageScore: null, contentScore: null,
    issues: [],
  },
  {
    url: '/blog/draft-performance-reviews',
    title: 'Performance Reviews Draft',
    metaDescription: null,
    h1Text: 'Draft: Performance Reviews Guide',
    wordCount: 150,
    lcp: 1.5, fid: 8, cls: 0.01, ttfb: 250,
    mobileScore: 90, desktopScore: 95,
    statusCode: 200, responseTimeMs: 270,
    isIndexable: false, hasNoindex: true, isInSitemap: false,
    internalLinks: 0, externalLinks: 0,
    h1Count: 1, h2Count: 0, altTextMissing: 0,
    hasStructuredData: false, isMobileResponsive: true,
    renderBlockingScripts: 0, jsRenderRequired: false,
    onPageScore: 30, contentScore: 20,
    issues: [
      { type: 'crawlability', severity: 'info', description: 'Page has noindex tag — intentionally excluded from search results', fix: 'No action needed if this is intentionally a draft' },
    ],
  },
  {
    url: '/careers',
    title: null, // Missing title
    metaDescription: null,
    h1Text: null,
    wordCount: 0,
    lcp: null, fid: null, cls: null, ttfb: null,
    mobileScore: null, desktopScore: null,
    statusCode: 404, responseTimeMs: 180,
    isIndexable: false, hasNoindex: false, isInSitemap: true,
    internalLinks: 0, externalLinks: 0,
    h1Count: 0, h2Count: 0, altTextMissing: 0,
    hasStructuredData: false, isMobileResponsive: null,
    renderBlockingScripts: 0, jsRenderRequired: false,
    onPageScore: null, contentScore: null,
    issues: [
      { type: 'crawlability', severity: 'high', description: '404 error — page is in sitemap but returns 404', fix: 'Either create the /careers page or remove it from the sitemap' },
    ],
  },
  {
    url: '/login',
    title: 'Login — NovaPulse HR',
    metaDescription: 'Sign in to your NovaPulse HR account.',
    h1Text: 'Sign In',
    wordCount: 120,
    lcp: 0.9, fid: 5, cls: 0.0, ttfb: 170,
    mobileScore: 98, desktopScore: 99,
    statusCode: 200, responseTimeMs: 190,
    isIndexable: false, hasNoindex: true, isInSitemap: false,
    internalLinks: 3, externalLinks: 0,
    h1Count: 1, h2Count: 0, altTextMissing: 0,
    hasStructuredData: false, isMobileResponsive: true,
    renderBlockingScripts: 0, jsRenderRequired: false,
    onPageScore: null, contentScore: null,
    issues: [],
  },
];

// ---------------------------------------------------------------------------
// GSC keyword data stored in SiteBaseline
// ---------------------------------------------------------------------------

const KEYWORDS = [
  { keyword: 'hr software for small business', position: 4, clicks: 312, impressions: 8900, ctr: 3.5, intent: 'commercial', trend: 'up' },
  { keyword: 'bamboohr alternative', position: 6, clicks: 187, impressions: 4200, ctr: 4.5, intent: 'commercial', trend: 'up' },
  { keyword: 'employee management software', position: 9, clicks: 143, impressions: 6800, ctr: 2.1, intent: 'commercial', trend: 'flat' },
  { keyword: 'hr onboarding software', position: 12, clicks: 98, impressions: 3400, ctr: 2.9, intent: 'commercial', trend: 'up' },
  { keyword: 'hr management system mid-market', position: 15, clicks: 76, impressions: 2100, ctr: 3.6, intent: 'commercial', trend: 'flat' },
  { keyword: 'novapulse hr', position: 1, clicks: 241, impressions: 1800, ctr: 13.4, intent: 'navigational', trend: 'flat' },
  { keyword: 'hr software 100 employees', position: 22, clicks: 44, impressions: 1900, ctr: 2.3, intent: 'informational', trend: 'down' },
  { keyword: 'hris software comparison', position: 31, clicks: 18, impressions: 2800, ctr: 0.6, intent: 'commercial', trend: 'flat' },
];

// GSC aggregate traffic metrics
const GSC_METRICS = {
  organic_sessions_30d: 4820,
  organic_sessions_7d: 1180,
  total_clicks_30d: 1119,
  total_impressions_30d: 31900,
  avg_ctr: 3.5,
  avg_position: 12.8,
  keywords_top3: 2,
  keywords_top10: 5,
  keywords_top30: 7,
  keywords_total: 48,
};

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding SEO data for NovaPulse HR...');

  // Verify the site exists
  const site = await prisma.site.findUnique({ where: { id: SITE_ID } });
  if (!site) {
    console.error(`Site ${SITE_ID} not found. Run seed-demo.ts first.`);
    process.exit(1);
  }

  // Clean existing SEO data for this site
  await prisma.seoPageResult.deleteMany({ where: { siteId: SITE_ID } });
  await prisma.seoCrawl.deleteMany({ where: { siteId: SITE_ID } });
  await prisma.siteBaseline.deleteMany({
    where: { siteId: SITE_ID, source: { in: ['gsc_import', 'seo_crawl'] } },
  });

  // ── 1. Create the SEO crawl record ──────────────────────────────────────
  const crawlDate = new Date();
  crawlDate.setDate(crawlDate.getDate() - 1); // Yesterday

  const indexablePages = PAGES.filter(p => p.isIndexable);
  const crawlErrors = PAGES.filter(p => p.statusCode === 404 || (p.statusCode && p.statusCode >= 500));

  const crawl = await prisma.seoCrawl.create({
    data: {
      siteId: SITE_ID,
      startedAt: crawlDate,
      completedAt: new Date(crawlDate.getTime() + 45000), // 45s crawl
      pagesFound: PAGES.length,
      pagesAnalyzed: PAGES.length,
      crawlStatus: 'COMPLETED',
      overallSeoScore: 72,
      technicalScore: 68,
      onPageScore: 70,
      contentScore: 66,
      crawlabilityScore: 82,
    },
  });

  console.log(`  Created SeoCrawl: ${crawl.id}`);

  // ── 2. Create SeoPageResult for each page ──────────────────────────────
  let pageCount = 0;
  for (const page of PAGES) {
    await prisma.seoPageResult.create({
      data: {
        crawlId: crawl.id,
        siteId: SITE_ID,
        url: page.url,
        crawledAt: crawlDate,
        statusCode: page.statusCode,
        responseTimeMs: page.responseTimeMs,
        redirectChain: page.statusCode === 301 ? ['/old-pricing', '/pricing'] : [],
        canonicalUrl: page.isIndexable ? `https://novapulsehr.com${page.url}` : null,
        lcp: page.lcp,
        fid: page.fid,
        cls: page.cls,
        ttfb: page.ttfb,
        mobileScore: page.mobileScore,
        desktopScore: page.desktopScore,
        title: page.title,
        titleLength: page.title?.length ?? null,
        metaDescription: page.metaDescription,
        metaDescLength: page.metaDescription?.length ?? null,
        h1Count: page.h1Count,
        h1Text: page.h1Text,
        h2Count: page.h2Count,
        altTextMissing: page.altTextMissing,
        internalLinks: page.internalLinks,
        externalLinks: page.externalLinks,
        wordCount: page.wordCount,
        onPageScore: page.onPageScore,
        isMobileResponsive: page.isMobileResponsive,
        renderBlockingScripts: page.renderBlockingScripts,
        hasStructuredData: page.hasStructuredData,
        jsRenderRequired: page.jsRenderRequired,
        frameworkDetected: 'Next.js',
        isIndexable: page.isIndexable,
        hasNoindex: page.hasNoindex,
        robotsTxtBlocked: false,
        isInSitemap: page.isInSitemap,
        crawlDepth: page.url === '/' ? 0 : page.url.split('/').length - 1,
        isOrphanPage: false,
        contentScore: page.contentScore,
        searchIntentMatch: page.contentScore ? page.contentScore / 100 * 0.9 : null,
        isThinContent: (page.wordCount ?? 0) < 300 && page.isIndexable,
        isOutdated: false,
        issues: page.issues as any[],
      },
    });
    pageCount++;
  }

  console.log(`  Created ${pageCount} SeoPageResult records`);

  // ── 3. Store GSC keyword data in SiteBaseline ──────────────────────────
  const period = new Date().toISOString().slice(0, 7); // "2026-03"

  // Aggregate metrics
  for (const [key, value] of Object.entries(GSC_METRICS)) {
    await prisma.siteBaseline.create({
      data: {
        siteId: SITE_ID,
        metricKey: `gsc_${key}`,
        value,
        period,
        source: 'gsc_import',
      },
    });
  }

  // Per-keyword data (stored as individual baseline rows)
  for (const kw of KEYWORDS) {
    const safeKey = kw.keyword.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await prisma.siteBaseline.create({
      data: {
        siteId: SITE_ID,
        metricKey: `gsc_kw_position__${safeKey}`,
        value: kw.position,
        period,
        source: 'gsc_import',
      },
    });
    await prisma.siteBaseline.create({
      data: {
        siteId: SITE_ID,
        metricKey: `gsc_kw_clicks__${safeKey}`,
        value: kw.clicks,
        period,
        source: 'gsc_import',
      },
    });
    await prisma.siteBaseline.create({
      data: {
        siteId: SITE_ID,
        metricKey: `gsc_kw_impressions__${safeKey}`,
        value: kw.impressions,
        period,
        source: 'gsc_import',
      },
    });
    await prisma.siteBaseline.create({
      data: {
        siteId: SITE_ID,
        metricKey: `gsc_kw_ctr__${safeKey}`,
        value: kw.ctr,
        period,
        source: 'gsc_import',
      },
    });
  }

  console.log(`  Created ${Object.keys(GSC_METRICS).length + KEYWORDS.length * 4} SiteBaseline records`);

  // ── Summary ────────────────────────────────────────────────────────────
  const indexed = PAGES.filter(p => p.isIndexable).length;
  const notIndexed = PAGES.filter(p => !p.isIndexable).length;
  const errors = PAGES.filter(p => p.statusCode === 404 || (p.statusCode && p.statusCode >= 500)).length;

  console.log('\nSEO Seed Summary:');
  console.log(`  Pages: ${PAGES.length} total (${indexed} indexed, ${notIndexed} not indexed, ${errors} errors)`);
  console.log(`  Keywords: ${KEYWORDS.length} tracked`);
  console.log(`  Overall SEO Score: 72/100`);
  console.log(`  CWV issues: /features (LCP 3.2s), /pricing (CLS 0.12), /integrations (LCP 2.6s)`);
  console.log('\nDone!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
