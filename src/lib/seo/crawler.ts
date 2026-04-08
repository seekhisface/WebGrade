// src/lib/seo/crawler.ts
// Lightweight HTML crawler for SEO health scoring.
// Fetches pages, extracts metadata, checks links, scores quality.
// No Puppeteer — uses fetch + regex/string parsing for speed and low cost.

import { prisma } from '@/lib/db/client';

// ── Types ──────────────────────────────────────────────────────────────

interface CrawlOptions {
  siteId: string;
  startUrl: string;
  maxPages?: number;    // default 50
  timeoutMs?: number;   // per-page fetch timeout, default 10s
}

interface PageResult {
  url: string;
  statusCode: number;
  responseTimeMs: number;
  redirectChain: string[];
  canonicalUrl: string | null;

  // On-page SEO
  title: string | null;
  titleLength: number | null;
  metaDescription: string | null;
  metaDescLength: number | null;
  h1Count: number;
  h1Text: string | null;
  h2Count: number;
  altTextMissing: number;
  internalLinks: number;
  externalLinks: number;
  wordCount: number;
  onPageScore: number;

  // Technical
  isMobileResponsive: boolean;
  renderBlockingScripts: number;
  hasStructuredData: boolean;
  jsRenderRequired: boolean;
  frameworkDetected: string | null;

  // Crawlability
  isIndexable: boolean;
  hasNoindex: boolean;
  robotsTxtBlocked: boolean;
  isInSitemap: boolean;
  crawlDepth: number;

  // Content
  contentScore: number;
  isThinContent: boolean;

  // Issues
  issues: { type: string; severity: string; description: string; fix: string }[];

  // Broken outbound links found on this page
  brokenOutboundLinks: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────

function extractTag(html: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = html.match(regex);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : null;
}

function extractMetaContent(html: string, name: string): string | null {
  // Match both name= and property=
  const regex = new RegExp(`<meta\\s+(?:[^>]*?)(?:name|property)=["']${name}["'][^>]*?content=["']([^"']*)["']`, 'i');
  const match = html.match(regex);
  if (match) return match[1];
  // Try reversed order (content before name)
  const regex2 = new RegExp(`<meta\\s+(?:[^>]*?)content=["']([^"']*)["'][^>]*?(?:name|property)=["']${name}["']`, 'i');
  const match2 = html.match(regex2);
  return match2 ? match2[1] : null;
}

function countTags(html: string, tag: string): number {
  const regex = new RegExp(`<${tag}[\\s>]`, 'gi');
  return (html.match(regex) || []).length;
}

function extractLinks(html: string, baseUrl: string): { internal: string[]; external: string[] } {
  const linkRegex = /href=["']([^"'#]+)["']/gi;
  const internal: string[] = [];
  const external: string[] = [];
  const base = new URL(baseUrl);
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].trim();
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;

    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.hostname === base.hostname) {
        internal.push(resolved.pathname + resolved.search);
      } else {
        external.push(resolved.href);
      }
    } catch { /* invalid URL */ }
  }

  return { internal: [...new Set(internal)], external: [...new Set(external)] };
}

function countMissingAlt(html: string): number {
  const imgRegex = /<img\s[^>]*>/gi;
  const imgs = html.match(imgRegex) || [];
  return imgs.filter(img => !img.includes('alt=') || /alt=["']\s*["']/i.test(img)).length;
}

function countWords(html: string): number {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.split(' ').filter(w => w.length > 0).length;
}

function detectFramework(html: string): string | null {
  if (html.includes('__next') || html.includes('_next/static')) return 'Next.js';
  if (html.includes('__nuxt') || html.includes('/_nuxt/')) return 'Nuxt.js';
  if (html.includes('ng-version') || html.includes('ng-app')) return 'Angular';
  if (html.includes('data-reactroot') || html.includes('_reactListening')) return 'React';
  if (html.includes('data-v-') || html.includes('Vue.js')) return 'Vue.js';
  if (html.includes('wp-content') || html.includes('wp-includes')) return 'WordPress';
  if (html.includes('Shopify.') || html.includes('cdn.shopify.com')) return 'Shopify';
  if (html.includes('squarespace.com') || html.includes('sqs-block')) return 'Squarespace';
  if (html.includes('wix.com') || html.includes('wixsite')) return 'Wix';
  if (html.includes('webflow.com') || html.includes('w-')) return 'Webflow';
  return null;
}

function scoreOnPage(p: { titleLength: number | null; metaDescLength: number | null; h1Count: number; altTextMissing: number; wordCount: number }): number {
  let score = 100;
  // Title
  if (!p.titleLength) score -= 20;
  else if (p.titleLength < 30 || p.titleLength > 70) score -= 10;
  // Meta description
  if (!p.metaDescLength) score -= 15;
  else if (p.metaDescLength < 80 || p.metaDescLength > 160) score -= 8;
  // H1
  if (p.h1Count === 0) score -= 15;
  else if (p.h1Count > 1) score -= 5;
  // Alt text
  if (p.altTextMissing > 0) score -= Math.min(15, p.altTextMissing * 3);
  // Word count
  if (p.wordCount < 300) score -= 15;
  else if (p.wordCount < 600) score -= 5;
  return Math.max(0, score);
}

function scoreContent(wordCount: number, h2Count: number): number {
  let score = 100;
  if (wordCount < 200) score -= 30;
  else if (wordCount < 500) score -= 15;
  if (h2Count === 0 && wordCount > 300) score -= 10;
  return Math.max(0, score);
}

// ── Main crawl function ─────────────────────────────────────────────────

export async function crawlSite(options: CrawlOptions): Promise<{ crawlId: string; pagesFound: number; issues: number }> {
  const { siteId, startUrl, maxPages = 50, timeoutMs = 10000 } = options;

  // Create crawl record
  const crawl = await prisma.seoCrawl.create({
    data: {
      siteId,
      crawlStatus: 'RUNNING',
      pagesFound: 0,
      pagesAnalyzed: 0,
    },
  });

  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];
  const results: PageResult[] = [];
  const base = new URL(startUrl);
  let totalIssues = 0;

  // Check robots.txt
  let robotsBlocked: Set<string> = new Set();
  try {
    const robotsRes = await fetch(`${base.origin}/robots.txt`, { signal: AbortSignal.timeout(5000) });
    if (robotsRes.ok) {
      const robotsTxt = await robotsRes.text();
      const disallowRegex = /Disallow:\s*(.+)/gi;
      let m;
      while ((m = disallowRegex.exec(robotsTxt)) !== null) {
        robotsBlocked.add(m[1].trim());
      }
    }
  } catch { /* no robots.txt */ }

  // Check sitemap
  let sitemapUrls = new Set<string>();
  try {
    const smRes = await fetch(`${base.origin}/sitemap.xml`, { signal: AbortSignal.timeout(5000) });
    if (smRes.ok) {
      const smText = await smRes.text();
      const locRegex = /<loc>([^<]+)<\/loc>/gi;
      let m;
      while ((m = locRegex.exec(smText)) !== null) {
        try { sitemapUrls.add(new URL(m[1]).pathname); } catch { /* invalid */ }
      }
    }
  } catch { /* no sitemap */ }

  // Crawl loop
  while (queue.length > 0 && visited.size < maxPages) {
    const { url, depth } = queue.shift()!;
    const normalizedPath = new URL(url, startUrl).pathname;

    if (visited.has(normalizedPath)) continue;
    visited.add(normalizedPath);

    const fullUrl = new URL(normalizedPath, startUrl).href;
    const startTime = Date.now();

    try {
      const res = await fetch(fullUrl, {
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
        headers: { 'User-Agent': 'WebGrade-Crawler/1.0 (+https://webgrade.io/bot)' },
      });
      const elapsed = Date.now() - startTime;
      const html = await res.text();
      const contentType = res.headers.get('content-type') || '';

      // Skip non-HTML
      if (!contentType.includes('text/html')) continue;

      const title = extractTag(html, 'title');
      const metaDesc = extractMetaContent(html, 'description');
      const canonical = extractMetaContent(html, 'canonical') || html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] || null;
      const h1Text = extractTag(html, 'h1');
      const h1Count = countTags(html, 'h1');
      const h2Count = countTags(html, 'h2');
      const altMissing = countMissingAlt(html);
      const links = extractLinks(html, fullUrl);
      const wordCount = countWords(html);
      const framework = detectFramework(html);
      const hasNoindex = /noindex/i.test(extractMetaContent(html, 'robots') || '');
      const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html);
      const hasStructuredData = /<script[^>]*type=["']application\/ld\+json["']/i.test(html);
      const renderBlocking = (html.match(/<script(?![^>]*(?:async|defer))[^>]*src=/gi) || []).length;
      const jsRender = !!(framework && ['Next.js', 'React', 'Angular', 'Vue.js', 'Nuxt.js'].includes(framework));
      const isBlocked = [...robotsBlocked].some(path => normalizedPath.startsWith(path));

      const onPage = scoreOnPage({ titleLength: title?.length ?? null, metaDescLength: metaDesc?.length ?? null, h1Count, altTextMissing: altMissing, wordCount });
      const content = scoreContent(wordCount, h2Count);

      // Build issues list
      const issues: PageResult['issues'] = [];
      if (!title) issues.push({ type: 'missing_title', severity: 'high', description: 'Page has no title tag', fix: 'Add a unique <title> tag between 30-70 characters' });
      else if (title.length > 70) issues.push({ type: 'title_too_long', severity: 'medium', description: `Title is ${title.length} chars (max 70)`, fix: 'Shorten the title to under 70 characters' });
      else if (title.length < 30) issues.push({ type: 'title_too_short', severity: 'medium', description: `Title is only ${title.length} chars`, fix: 'Expand the title to at least 30 characters' });
      if (!metaDesc) issues.push({ type: 'missing_meta_desc', severity: 'high', description: 'No meta description', fix: 'Add a <meta name="description"> tag between 80-160 characters' });
      if (h1Count === 0) issues.push({ type: 'missing_h1', severity: 'high', description: 'No H1 tag found', fix: 'Add a single H1 heading that describes the page content' });
      if (h1Count > 1) issues.push({ type: 'multiple_h1', severity: 'low', description: `${h1Count} H1 tags found`, fix: 'Use only one H1 per page' });
      if (altMissing > 0) issues.push({ type: 'missing_alt', severity: 'medium', description: `${altMissing} images missing alt text`, fix: 'Add descriptive alt text to all images' });
      if (wordCount < 300) issues.push({ type: 'thin_content', severity: 'medium', description: `Only ${wordCount} words on page`, fix: 'Add more substantive content (aim for 600+ words on key pages)' });
      if (hasNoindex) issues.push({ type: 'noindex', severity: 'high', description: 'Page has noindex directive', fix: 'Remove the noindex tag if this page should be indexed' });
      if (isBlocked) issues.push({ type: 'robots_blocked', severity: 'high', description: 'Blocked by robots.txt', fix: 'Update robots.txt to allow crawling of this page' });
      if (renderBlocking > 2) issues.push({ type: 'render_blocking', severity: 'medium', description: `${renderBlocking} render-blocking scripts`, fix: 'Add async or defer attributes to non-critical scripts' });
      if (elapsed > 3000) issues.push({ type: 'slow_response', severity: 'medium', description: `Response time: ${elapsed}ms`, fix: 'Optimize server response time (target under 1s)' });
      if (res.status >= 400) issues.push({ type: 'http_error', severity: 'critical', description: `HTTP ${res.status} error`, fix: 'Fix the page to return a 200 status code' });

      // Check outbound links for broken ones (sample first 20)
      const brokenOutbound: string[] = [];
      const externalSample = links.external.slice(0, 20);
      const linkChecks = await Promise.allSettled(
        externalSample.map(async (link) => {
          try {
            const r = await fetch(link, { method: 'HEAD', signal: AbortSignal.timeout(5000), redirect: 'follow' });
            if (r.status >= 400) return link;
          } catch { return link; }
          return null;
        })
      );
      for (const check of linkChecks) {
        if (check.status === 'fulfilled' && check.value) {
          brokenOutbound.push(check.value);
          issues.push({ type: 'broken_link', severity: 'medium', description: `Broken outbound link: ${check.value}`, fix: 'Remove or update the broken link', url: check.value } as PageResult['issues'][0] & { url: string });
        }
      }

      totalIssues += issues.length;

      results.push({
        url: normalizedPath,
        statusCode: res.status,
        responseTimeMs: elapsed,
        redirectChain: [],
        canonicalUrl: canonical,
        title, titleLength: title?.length ?? null,
        metaDescription: metaDesc, metaDescLength: metaDesc?.length ?? null,
        h1Count, h1Text, h2Count,
        altTextMissing: altMissing,
        internalLinks: links.internal.length,
        externalLinks: links.external.length,
        wordCount,
        onPageScore: onPage,
        isMobileResponsive: hasViewport,
        renderBlockingScripts: renderBlocking,
        hasStructuredData,
        jsRenderRequired: jsRender,
        frameworkDetected: framework,
        isIndexable: !hasNoindex && !isBlocked && res.status < 400,
        hasNoindex,
        robotsTxtBlocked: isBlocked,
        isInSitemap: sitemapUrls.has(normalizedPath),
        crawlDepth: depth,
        contentScore: content,
        isThinContent: wordCount < 300,
        issues,
        brokenOutboundLinks: brokenOutbound,
      });

      // Add internal links to queue (limit depth to 3)
      if (depth < 3) {
        for (const path of links.internal) {
          if (!visited.has(path) && !path.match(/\.(pdf|jpg|png|gif|svg|css|js|ico|woff|woff2|ttf|eot)$/i)) {
            queue.push({ url: path, depth: depth + 1 });
          }
        }
      }
    } catch (err) {
      // Timeout or network error
      const elapsed = Date.now() - startTime;
      results.push({
        url: normalizedPath, statusCode: 0, responseTimeMs: elapsed, redirectChain: [],
        canonicalUrl: null, title: null, titleLength: null, metaDescription: null,
        metaDescLength: null, h1Count: 0, h1Text: null, h2Count: 0, altTextMissing: 0,
        internalLinks: 0, externalLinks: 0, wordCount: 0, onPageScore: 0,
        isMobileResponsive: false, renderBlockingScripts: 0, hasStructuredData: false,
        jsRenderRequired: false, frameworkDetected: null, isIndexable: false, hasNoindex: false,
        robotsTxtBlocked: false, isInSitemap: false, crawlDepth: depth, contentScore: 0,
        isThinContent: true,
        issues: [{ type: 'fetch_failed', severity: 'critical', description: `Failed to fetch: ${err instanceof Error ? err.message : 'Unknown error'}`, fix: 'Check if the page is accessible' }],
        brokenOutboundLinks: [],
      });
      totalIssues++;
    }
  }

  // ── Calculate crawl-level scores ──────────────────────────────────────
  const validPages = results.filter(r => r.statusCode >= 200 && r.statusCode < 400);
  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const technicalScore = avg(validPages.map(p => {
    let s = 100;
    if (p.responseTimeMs > 3000) s -= 20;
    else if (p.responseTimeMs > 1500) s -= 10;
    if (p.renderBlockingScripts > 2) s -= 15;
    if (!p.isMobileResponsive) s -= 20;
    if (p.statusCode >= 300) s -= 15;
    return Math.max(0, s);
  }));

  const onPageAvg = avg(validPages.map(p => p.onPageScore));
  const contentAvg = avg(validPages.map(p => p.contentScore));

  const crawlabilityScore = (() => {
    let s = 100;
    const indexable = validPages.filter(p => p.isIndexable).length;
    const indexRate = validPages.length > 0 ? indexable / validPages.length : 0;
    if (indexRate < 0.5) s -= 30;
    else if (indexRate < 0.8) s -= 15;
    const inSitemap = validPages.filter(p => p.isInSitemap).length;
    if (sitemapUrls.size === 0) s -= 15;
    else if (inSitemap / validPages.length < 0.5) s -= 10;
    return Math.max(0, s);
  })();

  const overallScore = Math.round((technicalScore + onPageAvg + contentAvg + crawlabilityScore) / 4);

  // ── Save results to database ──────────────────────────────────────────
  for (const r of results) {
    await prisma.seoPageResult.create({
      data: {
        crawlId: crawl.id,
        siteId,
        url: r.url,
        statusCode: r.statusCode,
        responseTimeMs: r.responseTimeMs,
        redirectChain: r.redirectChain,
        canonicalUrl: r.canonicalUrl,
        title: r.title,
        titleLength: r.titleLength,
        metaDescription: r.metaDescription,
        metaDescLength: r.metaDescLength,
        h1Count: r.h1Count,
        h1Text: r.h1Text,
        h2Count: r.h2Count,
        altTextMissing: r.altTextMissing,
        internalLinks: r.internalLinks,
        externalLinks: r.externalLinks,
        wordCount: r.wordCount,
        onPageScore: r.onPageScore,
        isMobileResponsive: r.isMobileResponsive,
        renderBlockingScripts: r.renderBlockingScripts,
        hasStructuredData: r.hasStructuredData,
        jsRenderRequired: r.jsRenderRequired,
        frameworkDetected: r.frameworkDetected,
        isIndexable: r.isIndexable,
        hasNoindex: r.hasNoindex,
        robotsTxtBlocked: r.robotsTxtBlocked,
        isInSitemap: r.isInSitemap,
        crawlDepth: r.crawlDepth,
        contentScore: r.contentScore,
        isThinContent: r.isThinContent,
        issues: r.issues,
      },
    });
  }

  // Update crawl record
  await prisma.seoCrawl.update({
    where: { id: crawl.id },
    data: {
      crawlStatus: 'COMPLETED',
      completedAt: new Date(),
      pagesFound: results.length,
      pagesAnalyzed: validPages.length,
      overallSeoScore: overallScore,
      technicalScore,
      onPageScore: onPageAvg,
      contentScore: contentAvg,
      crawlabilityScore,
    },
  });

  return { crawlId: crawl.id, pagesFound: results.length, issues: totalIssues };
}
