/**
 * Deep crawl orchestrator (Phase: Site Map page).
 *
 * Wraps the existing SEO crawler + CTA detector and:
 *  1. Triggers a full SEO crawl
 *  2. Extracts CTAs from the site (forms, buttons, links)
 *  3. Classifies each CTA into a conversion-relevant type
 *  4. Aggregates per-instance CTAs into LOGICAL CTAs (one row per text+href,
 *     with the list of pages where it appears)
 *  5. Upserts SiteCta records — PRESERVING existing TRACKED/IGNORED status
 *     so user decisions survive re-crawls
 *  6. Marks the SeoCrawl as isDeepCrawl=true and stamps Site.lastDeepCrawlAt
 *
 * Called by:
 *  - POST /api/sitemap/crawl (manual trigger from the Site Map page)
 *  - webwatchMonthlyReport Inngest job (auto-trigger when >90 days since last)
 */

import { prisma } from '@/lib/db/client';
import type { CtaType } from '@prisma/client';
import { crawlSite, detectCtas } from './crawler';

// Keyword precedence is intentional — first match wins. Specific types
// (Demo, Trial) before broader ones (Signup, Contact).
const CTA_CLASSIFIERS: Array<{ type: CtaType; patterns: RegExp[] }> = [
  { type: 'DEMO',      patterns: [/\bdemo\b/i, /book\s+a?\s*demo/i, /request\s+a?\s*demo/i, /schedule\s+a?\s*demo/i] },
  { type: 'TRIAL',     patterns: [/free\s+trial/i, /start\s+(?:free\s+)?trial/i, /try\s+(?:it\s+)?free/i, /\btrial\b/i] },
  { type: 'SIGNUP',    patterns: [/sign\s*up/i, /signup/i, /create\s+account/i, /get\s+started/i, /start\s+free/i, /register/i, /join\s+(?:free|now)/i] },
  { type: 'BUY',       patterns: [/\bbuy\b/i, /purchase/i, /checkout/i, /add\s+to\s+cart/i, /order\s+now/i] },
  { type: 'CONTACT',   patterns: [/contact/i, /get\s+in\s+touch/i, /talk\s+to/i, /reach\s+out/i, /enquire/i, /inquiry/i] },
  { type: 'SUBSCRIBE', patterns: [/subscribe/i, /newsletter/i, /sign\s+up\s+for/i] },
  { type: 'DOWNLOAD',  patterns: [/download/i] },
];

function classifyCta(text: string, href: string | null): CtaType {
  for (const { type, patterns } of CTA_CLASSIFIERS) {
    for (const p of patterns) {
      if (p.test(text)) return type;
    }
  }
  // Href-based fallback for buttons with vague text but obvious destination
  if (href) {
    const h = href.toLowerCase();
    if (h.includes('demo')) return 'DEMO';
    if (h.includes('signup') || h.includes('sign-up') || h.includes('register')) return 'SIGNUP';
    if (h.includes('trial')) return 'TRIAL';
    if (h.includes('contact')) return 'CONTACT';
    if (h.includes('checkout') || h.includes('buy')) return 'BUY';
    if (h.includes('subscribe') || h.includes('newsletter')) return 'SUBSCRIBE';
    if (/\.(pdf|docx?|xlsx?|zip)(\?|$)/i.test(h)) return 'DOWNLOAD';
  }
  return 'OTHER';
}

export interface DeepCrawlResult {
  crawlId: string;
  pagesCrawled: number;
  ctasDetected: number;     // logical CTAs after dedup (own site)
  ctasNew: number;          // first-time-seen CTAs (status SUGGESTED)
  ctasUpdated: number;      // re-seen CTAs (status preserved)
  competitorsCrawled: number;
  competitorCtasDetected: number;
}

export async function runDeepCrawl(siteId: string): Promise<DeepCrawlResult> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      url: true,
      onboarding: { select: { competitorUrls: true } },
    },
  });
  if (!site) throw new Error(`Site not found: ${siteId}`);

  // 1. SEO crawl (creates a new SeoCrawl record + per-page results)
  const crawlOut = await crawlSite({ siteId, startUrl: site.url, maxPages: 50 });

  // Mark this crawl as the deep crawl variant
  await prisma.seoCrawl.update({
    where: { id: crawlOut.crawlId },
    data: { isDeepCrawl: true },
  });

  // 2. CTA detection (independent crawl pass — uses the same fetch infra)
  const detected = await detectCtas(site.url, 12);

  // 3. Persist own-site CTAs
  const now = new Date();
  const own = await persistCtas(siteId, '', detected, now);

  // 4. Crawl competitors (max 3, lightweight) and persist their CTAs separately
  // so the UI can compare side-by-side. Failures are non-fatal.
  const competitorUrls = (site.onboarding?.competitorUrls ?? []).slice(0, 3);
  let competitorsCrawled = 0;
  let competitorCtasDetected = 0;
  for (const compUrl of competitorUrls) {
    try {
      const compDetected = await detectCtas(compUrl, 6);
      const result = await persistCtas(siteId, compUrl, compDetected, now);
      competitorCtasDetected += result.logicalCount;
      competitorsCrawled++;
    } catch (err) {
      console.error(`[deep-crawl] competitor ${compUrl}:`, err);
    }
  }

  // 5. Stamp the deep-crawl timestamp on the site (drives the 90-day cooldown)
  await prisma.site.update({
    where: { id: siteId },
    data: { lastDeepCrawlAt: now },
  });

  return {
    crawlId: crawlOut.crawlId,
    pagesCrawled: crawlOut.pagesFound,
    ctasDetected: own.logicalCount,
    ctasNew: own.created,
    ctasUpdated: own.updated,
    competitorsCrawled,
    competitorCtasDetected,
  };
}

// ---------------------------------------------------------------------------
// Aggregate detected CTAs into logical rows (one per text+href) and upsert,
// preserving user-set status (TRACKED / IGNORED) for the customer's own CTAs.
// Pass competitorUrl='' for the customer's site, or the competitor URL for
// competitor CTAs.
// ---------------------------------------------------------------------------

async function persistCtas(
  siteId: string,
  competitorUrl: string,
  detected: Awaited<ReturnType<typeof detectCtas>>,
  now: Date,
): Promise<{ logicalCount: number; created: number; updated: number }> {
  type Logical = { text: string; href: string; type: CtaType; pages: Set<string> };
  const logical = new Map<string, Logical>();
  for (const c of detected) {
    const text = c.text.trim().slice(0, 200);
    if (!text) continue;
    const href = c.destination ? c.destination.slice(0, 500) : '';
    const key = `${text.toLowerCase()}::${href.toLowerCase()}`;
    let row = logical.get(key);
    if (!row) {
      row = { text, href, type: classifyCta(text, href || null), pages: new Set() };
      logical.set(key, row);
    }
    row.pages.add(c.pageUrl);
  }

  let created = 0;
  let updated = 0;
  for (const row of logical.values()) {
    const pages = Array.from(row.pages);
    const existing = await prisma.siteCta.findUnique({
      where: { siteId_competitorUrl_ctaText_ctaHref: { siteId, competitorUrl, ctaText: row.text, ctaHref: row.href } },
    });

    if (existing) {
      await prisma.siteCta.update({
        where: { id: existing.id },
        data: { ctaType: row.type, pages, pageCount: pages.length, lastDetectedAt: now },
      });
      updated++;
    } else {
      await prisma.siteCta.create({
        data: {
          siteId,
          competitorUrl,
          ctaText: row.text,
          ctaHref: row.href,
          ctaType: row.type,
          pages,
          pageCount: pages.length,
          status: 'SUGGESTED',
          firstDetectedAt: now,
          lastDetectedAt: now,
        },
      });
      created++;
    }
  }

  return { logicalCount: logical.size, created, updated };
}
