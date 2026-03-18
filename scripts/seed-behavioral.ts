/**
 * Seeds realistic behavioral data (visitor sessions, events, page views)
 * for the NovaPulse HR demo site.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SITE_ID = 'cmmwg5xig0006ecipqmdivbl0';

// Page definitions with realistic behavioral profiles
// exitProb controls how often this is the EXIT page of a session.
// Benchmarks: pricing poor >58%, signup poor >42%, features poor >60%, home poor >55%
const PAGES = [
  { url: '/pricing', title: 'Pricing', exitProb: 0.92, scrollRange: [20, 55], category: 'pricing', weight: 3 },
  { url: '/features', title: 'Features', exitProb: 0.88, scrollRange: [15, 40], category: 'features', weight: 3 },
  { url: '/signup', title: 'Sign Up', exitProb: 0.80, scrollRange: [60, 85], category: 'signup', weight: 2 },
  { url: '/', title: 'Home', exitProb: 0.40, scrollRange: [30, 70], category: 'home', weight: 2 },
  { url: '/about', title: 'About Us', exitProb: 0.50, scrollRange: [25, 65], category: 'about', weight: 1 },
  { url: '/blog', title: 'Blog', exitProb: 0.60, scrollRange: [10, 50], category: 'blog', weight: 1 },
  { url: '/demo', title: 'Request Demo', exitProb: 0.45, scrollRange: [50, 90], category: 'demo', weight: 1 },
  { url: '/case-studies', title: 'Case Studies', exitProb: 0.50, scrollRange: [35, 75], category: 'case_study', weight: 1 },
  { url: '/contact', title: 'Contact', exitProb: 0.45, scrollRange: [40, 85], category: 'contact', weight: 1 },
  { url: '/integrations', title: 'Integrations', exitProb: 0.55, scrollRange: [20, 60], category: 'features', weight: 1 },
];

// Weighted page picker — high-weight pages appear more often
const WEIGHTED_PAGES: typeof PAGES = [];
for (const page of PAGES) {
  for (let i = 0; i < (page.weight ?? 1); i++) WEIGHTED_PAGES.push(page);
}

const INTENT_WEIGHTS = {
  HIGH: 0.12, MEDIUM: 0.26, LOW: 0.44, RESEARCHER: 0.08, COMPETITOR: 0.04, BOT: 0.06,
};

const UTM_SOURCES = [
  { source: 'google', medium: 'cpc', campaign: 'hr-software-branded' },
  { source: 'google', medium: 'organic', campaign: null },
  { source: 'facebook', medium: 'social', campaign: 'hr-retargeting-q1' },
  { source: 'linkedin', medium: 'cpc', campaign: 'mid-market-hr' },
  { source: 'email', medium: 'newsletter', campaign: 'feb-digest' },
  { source: null, medium: null, campaign: null }, // direct
];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(weights: Record<string, number>): string {
  const r = Math.random();
  let cumulative = 0;
  for (const [key, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (r <= cumulative) return key;
  }
  return Object.keys(weights).pop()!;
}

async function main() {
  console.log('🌱 Seeding behavioral data for NovaPulse HR...\n');

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const SESSION_COUNT = 1200;
  let totalEvents = 0;
  let totalPageViews = 0;

  for (let i = 0; i < SESSION_COUNT; i++) {
    // Random time in last 30 days
    const sessionStart = new Date(
      thirtyDaysAgo.getTime() + Math.random() * (now.getTime() - thirtyDaysAgo.getTime())
    );

    const intentClass = weightedPick(INTENT_WEIGHTS) as any;
    const intentScore = intentClass === 'HIGH' ? rand(70, 95)
      : intentClass === 'MEDIUM' ? rand(40, 69)
      : intentClass === 'LOW' ? rand(10, 39)
      : intentClass === 'RESEARCHER' ? rand(30, 55)
      : intentClass === 'COMPETITOR' ? rand(20, 45)
      : rand(0, 15); // BOT

    const isBotFiltered = intentClass === 'BOT';
    const utmSource = pick(UTM_SOURCES);
    const conversionGoalHit = intentClass === 'HIGH' && Math.random() < 0.18;

    // 60% of sessions are single-page bounces on problem pages (drives exit rates above benchmarks)
    const isBounce = !isBotFiltered && Math.random() < 0.60;
    const pageCount = isBotFiltered ? rand(1, 2) : isBounce ? 1 : rand(2, 6);
    const durationMs = pageCount * rand(8000, 45000);

    const visitedPages = [];
    if (isBounce) {
      // Bounce sessions land on problem pages weighted by how bad they should look
      const bounceUrl = weightedPick({
        '/pricing':  0.30,  // pricing gets most bounces
        '/features': 0.25,
        '/signup':   0.20,
        '/blog':     0.10,
        '/':         0.08,
        '/about':    0.07,
      });
      const bouncePage = PAGES.find(p => p.url === bounceUrl) ?? PAGES[0];
      visitedPages.push(bouncePage);
    } else {
      const entryPage = pick(WEIGHTED_PAGES);
      visitedPages.push(entryPage);
      for (let p = 1; p < pageCount; p++) {
        visitedPages.push(pick(WEIGHTED_PAGES));
      }
    }

    const sessionId = `sess-${i.toString().padStart(5, '0')}`;

    // Create visitor session
    const session = await prisma.visitorSession.create({
      data: {
        siteId: SITE_ID,
        sessionId,
        ipHash: `hash-${rand(1000, 9999)}-${rand(1000, 9999)}`,
        country: pick(['US', 'US', 'US', 'GB', 'CA', 'DE', 'AU']),
        region: pick(['CA', 'NY', 'TX', 'FL', 'WA', 'IL', null]),
        deviceType: pick(['desktop', 'desktop', 'mobile', 'mobile', 'tablet']),
        browser: pick(['Chrome', 'Chrome', 'Safari', 'Firefox', 'Edge']),
        os: pick(['Windows', 'macOS', 'iOS', 'Android', 'Linux']),
        utmSource: utmSource.source,
        utmMedium: utmSource.medium,
        utmCampaign: utmSource.campaign,
        startedAt: sessionStart,
        endedAt: new Date(sessionStart.getTime() + durationMs),
        durationMs,
        intentScore,
        intentClass,
        isBotFiltered,
        pageCount,
        entryPage: visitedPages[0].url,
        exitPage: visitedPages[visitedPages.length - 1].url,
        conversionGoalHit,
        convertedAt: conversionGoalHit ? new Date(sessionStart.getTime() + durationMs - rand(2000, 10000)) : null,
      },
    });

    // Create page views and events for each visited page
    for (let p = 0; p < visitedPages.length; p++) {
      const page = visitedPages[p];
      const isExit = p === visitedPages.length - 1; // last page is always the exit
      const scrollDepth = rand(page.scrollRange[0], page.scrollRange[1]);
      const timeOnPage = rand(5000, 60000);
      const rageClicks = Math.random() < 0.08 ? rand(1, 5) : 0;
      const hesitations = Math.random() < 0.12 ? rand(1, 3) : 0;
      const pageEnteredAt = new Date(sessionStart.getTime() + p * rand(5000, 30000));

      await prisma.pageView.create({
        data: {
          sessionId: session.id,
          siteId: SITE_ID,
          url: page.url,
          title: page.title,
          enteredAt: pageEnteredAt,
          exitedAt: new Date(pageEnteredAt.getTime() + timeOnPage),
          timeOnPageMs: timeOnPage,
          maxScrollDepthPct: scrollDepth,
          clickCount: rand(1, 12),
          rageClickCount: rageClicks,
          hesitationCount: hesitations,
          isExit,
          exitIntentDetected: isExit && Math.random() < 0.3,
          isDropOffPage: false,
          storylineBreakpoint: false,
        },
      });
      totalPageViews++;

      // Create a PAGE_VIEW event
      await prisma.sessionEvent.create({
        data: {
          sessionId: session.id,
          siteId: SITE_ID,
          eventType: 'PAGE_VIEW',
          pageUrl: page.url,
          timestamp: pageEnteredAt,
          scrollDepthPct: scrollDepth,
          timeOnPageMs: timeOnPage,
        },
      });
      totalEvents++;

      // Sometimes add scroll/click/hesitation events
      if (scrollDepth > 50) {
        await prisma.sessionEvent.create({
          data: {
            sessionId: session.id,
            siteId: SITE_ID,
            eventType: 'SCROLL',
            pageUrl: page.url,
            timestamp: new Date(pageEnteredAt.getTime() + rand(2000, timeOnPage)),
            scrollDepthPct: scrollDepth,
          },
        });
        totalEvents++;
      }

      if (rageClicks > 0) {
        await prisma.sessionEvent.create({
          data: {
            sessionId: session.id,
            siteId: SITE_ID,
            eventType: 'RAGE_CLICK',
            pageUrl: page.url,
            timestamp: new Date(pageEnteredAt.getTime() + rand(3000, timeOnPage)),
            rageClickCount: rageClicks,
            elementTag: pick(['button', 'a', 'div']),
            elementText: pick(['Start Free Trial', 'Get Started', 'Learn More', 'Sign Up']),
          },
        });
        totalEvents++;
      }
    }

    if ((i + 1) % 200 === 0) {
      console.log(`  ✓ ${i + 1}/${SESSION_COUNT} sessions created`);
    }
  }

  console.log(`\n✅ Seeded ${SESSION_COUNT} sessions, ${totalPageViews} page views, ${totalEvents} events`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
