// src/lib/seo/broken-links.ts
// Broken Link Detection — scans SEO crawl results for 404s and broken pages.

import { prisma } from '@/lib/db/client';

export interface BrokenLink {
  url: string;
  statusCode: number;
  crawledAt: Date;
  linkedFrom: string[]; // pages that link to this broken URL (from internal links)
  severity: 'critical' | 'high' | 'medium';
}

export interface BrokenLinkReport {
  totalBroken: number;
  links: BrokenLink[];
  crawlDate: Date | null;
}

// ── Detect broken links from the latest crawl ──────────────────────────
export async function detectBrokenLinks(siteId: string): Promise<BrokenLinkReport> {
  // Get the latest completed crawl
  const latestCrawl = await prisma.seoCrawl.findFirst({
    where: { siteId, crawlStatus: 'COMPLETED' },
    orderBy: { startedAt: 'desc' },
    select: { id: true, startedAt: true },
  });

  if (!latestCrawl) {
    return { totalBroken: 0, links: [], crawlDate: null };
  }

  // Find all pages with 4xx or 5xx status codes
  const brokenPages = await prisma.seoPageResult.findMany({
    where: {
      crawlId: latestCrawl.id,
      siteId,
      statusCode: { gte: 400 },
    },
    select: {
      url: true,
      statusCode: true,
      crawledAt: true,
    },
    orderBy: { statusCode: 'asc' },
  });

  // Find pages that link to these broken URLs (internal links)
  // We check which pages reference these broken URLs in their issues
  const brokenUrls = new Set(brokenPages.map(p => p.url));

  // Get all pages from the crawl to find internal links pointing to broken pages
  const allPages = await prisma.seoPageResult.findMany({
    where: {
      crawlId: latestCrawl.id,
      siteId,
      statusCode: { lt: 400 },
    },
    select: {
      url: true,
      issues: true,
    },
  });

  // Build a map of broken URL → pages linking to it
  const linkedFromMap: Record<string, string[]> = {};
  for (const page of allPages) {
    if (Array.isArray(page.issues)) {
      for (const issue of page.issues) {
        const iss = issue as Record<string, unknown>;
        if (iss.type === 'broken_link' && typeof iss.url === 'string' && brokenUrls.has(iss.url)) {
          if (!linkedFromMap[iss.url]) linkedFromMap[iss.url] = [];
          linkedFromMap[iss.url].push(page.url);
        }
      }
    }
  }

  const links: BrokenLink[] = brokenPages.map(p => ({
    url: p.url,
    statusCode: p.statusCode!,
    crawledAt: p.crawledAt,
    linkedFrom: linkedFromMap[p.url] ?? [],
    severity: p.statusCode === 404 ? 'high' : p.statusCode! >= 500 ? 'critical' : 'medium',
  }));

  // Sort: critical first, then high, then by number of linking pages
  links.sort((a, b) => {
    const sevOrder = { critical: 0, high: 1, medium: 2 };
    const diff = sevOrder[a.severity] - sevOrder[b.severity];
    if (diff !== 0) return diff;
    return b.linkedFrom.length - a.linkedFrom.length;
  });

  return {
    totalBroken: links.length,
    links,
    crawlDate: latestCrawl.startedAt,
  };
}
