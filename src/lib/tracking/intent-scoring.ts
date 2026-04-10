/**
 * P1-06: Intent Scoring Engine
 *
 * Scores each session 0–100 and classifies as:
 *   HIGH | MEDIUM | LOW | RESEARCHER | COMPETITOR | BOT
 *
 * The intent score is the most important derived metric in WebGrade.
 * All downstream analysis (ad source quality, drop-off analysis,
 * AI explanations) references intent scores.
 *
 * Scoring factors:
 *   - Scroll depth (max scroll depth reached)
 *   - Engagement depth (time on page)
 *   - Page sequence (did they move through the funnel?)
 *   - Micro-gestures (CTA interactions, hesitation, form focus)
 *   - Conversion actions
 *
 * Called by: Inngest background job after session ends
 */

import type { VisitorSession, SessionEvent, PageView } from '@prisma/client';

export type IntentClass = 'HIGH' | 'MEDIUM' | 'LOW' | 'RESEARCHER' | 'COMPETITOR' | 'BOT';

export interface IntentScoreResult {
  score: number;          // 0–100
  intentClass: IntentClass;
  breakdown: IntentBreakdown;
}

export interface IntentBreakdown {
  scrollScore: number;    // 0–25
  engagementScore: number; // 0–25
  pageSequenceScore: number; // 0–20
  microGestureScore: number; // 0–20
  conversionScore: number;  // 0–10
  total: number;          // 0–100
}

interface SessionData {
  session: VisitorSession;
  events: SessionEvent[];
  pageViews: PageView[];
}

/**
 * Calculate intent score for a completed session.
 *
 * @param data - Session with its events and page views
 * @param conversionGoalUrl - The site's conversion goal URL
 * @returns Score (0–100) and classification
 */
export function scoreSessionIntent(
  data: SessionData,
  conversionGoalUrl: string | null
): IntentScoreResult {
  const { session, events, pageViews } = data;

  // -------------------------------------------------------------------------
  // Factor 1: Scroll depth (0–25 points)
  // High intent visitors scroll deep into pages
  // -------------------------------------------------------------------------
  const scrollEvents = events.filter(e => e.eventType === 'SCROLL' && e.scrollDepthPct != null);
  const maxScrollDepth = scrollEvents.length > 0
    ? Math.max(...scrollEvents.map(e => e.scrollDepthPct!))
    : 0;

  let scrollScore = 0;
  if (maxScrollDepth >= 90) scrollScore = 25;
  else if (maxScrollDepth >= 75) scrollScore = 20;
  else if (maxScrollDepth >= 50) scrollScore = 15;
  else if (maxScrollDepth >= 25) scrollScore = 8;
  else scrollScore = 2;

  // -------------------------------------------------------------------------
  // Factor 2: Engagement depth (0–25 points)
  // Time on site + page depth
  // -------------------------------------------------------------------------
  // Use durationMs if available, otherwise compute from timestamps
  const sessionDurationMs = session.durationMs
    ?? (session.endedAt && session.startedAt
      ? new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
      : 0);
  const pageCount = session.pageCount;

  let engagementScore = 0;

  // Time on site
  if (sessionDurationMs >= 5 * 60 * 1000) engagementScore += 15;       // 5+ min
  else if (sessionDurationMs >= 2 * 60 * 1000) engagementScore += 10;  // 2+ min
  else if (sessionDurationMs >= 60 * 1000) engagementScore += 6;       // 1+ min
  else if (sessionDurationMs >= 30 * 1000) engagementScore += 3;       // 30+ sec
  else engagementScore += 1;

  // Page depth
  if (pageCount >= 5) engagementScore += 10;
  else if (pageCount >= 3) engagementScore += 7;
  else if (pageCount >= 2) engagementScore += 4;
  else engagementScore += 1;

  engagementScore = Math.min(25, engagementScore);

  // -------------------------------------------------------------------------
  // Factor 3: Page sequence (0–20 points)
  // Did the visitor follow a meaningful path through the funnel?
  // -------------------------------------------------------------------------
  let pageSequenceScore = 0;

  // Visited more than just the homepage
  if (pageCount >= 2) pageSequenceScore += 5;

  // Visited a high-intent page (buying signals vary by business type)
  // Ecommerce: pricing, checkout, cart
  // B2B/services: contact, demo, team, about, case studies
  // VC/investing: portfolio, team, contact
  const buyingSignalPages = [
    // Ecommerce / SaaS
    'pricing', 'plans', 'features', 'product', 'buy', 'checkout', 'cart', 'trial', 'signup', 'register',
    // B2B / services / consulting
    'contact', 'demo', 'request', 'schedule', 'book', 'quote', 'consultation', 'get-started',
    // Research / evaluation
    'case-stud', 'testimonial', 'review', 'comparison', 'vs', 'roi', 'results',
    // VC / investing / partnerships
    'portfolio', 'team', 'about', 'thesis', 'approach', 'criteria',
  ];
  const sectionViews = events
    .filter(e => e.eventType === 'SECTION_VIEW' && e.metadata)
    .map(e => {
      const meta = e.metadata as Record<string, unknown> | null;
      return typeof meta?.section === 'string' ? meta.section.toLowerCase() : '';
    })
    .filter(Boolean);

  const visitedBuyingPage = pageViews.some(pv =>
    buyingSignalPages.some(keyword => pv.url.toLowerCase().includes(keyword))
  ) || sectionViews.some(section =>
    buyingSignalPages.some(keyword => section.includes(keyword))
  );
  if (visitedBuyingPage) pageSequenceScore += 10;

  // Section navigation on single-page sites counts as page depth
  if (sectionViews.length >= 2 && pageCount <= 1) pageSequenceScore += 5;

  // Visited the conversion goal page
  if (conversionGoalUrl && pageViews.some(pv => pv.url.includes(conversionGoalUrl))) {
    pageSequenceScore += 5;
  }

  // Deep exploration bonus — 3+ pages AND 2+ min = clearly evaluating, even without
  // hitting a named buying-signal page. Important for sites without pricing/checkout pages.
  if (pageCount >= 3 && sessionDurationMs >= 2 * 60 * 1000 && !visitedBuyingPage) {
    pageSequenceScore += 7;
  }

  pageSequenceScore = Math.min(20, pageSequenceScore);

  // -------------------------------------------------------------------------
  // Factor 4: Micro-gestures (0–20 points)
  // CTA interactions, hesitation (signals consideration), form focus
  // -------------------------------------------------------------------------
  let microGestureScore = 0;

  const ctaClicks = events.filter(e => e.eventType === 'CTA_CLICK' || (e.eventType === 'CLICK' && e.isCtaClick)).length;
  const fileDownloads = events.filter(e => e.eventType === 'FILE_DOWNLOAD').length;
  const copyEvents = events.filter(e => e.eventType === 'COPY_TEXT').length;
  const hesitations = events.filter(e => e.eventType === 'HESITATION').length;
  const formFocuses = events.filter(e => e.eventType === 'FORM_FOCUS').length;
  const formSubmits = events.filter(e => e.eventType === 'FORM_SUBMIT').length;
  const rageClicks = events.filter(e => e.eventType === 'RAGE_CLICK').length;

  microGestureScore += Math.min(8, ctaClicks * 4);      // Up to 8 pts for CTA clicks
  microGestureScore += Math.min(4, hesitations * 2);    // Up to 4 pts for hesitation
  microGestureScore += Math.min(4, formFocuses * 2);    // Up to 4 pts for form focus
  microGestureScore += formSubmits > 0 ? 4 : 0;         // 4 pts for any form submit
  microGestureScore += Math.min(4, fileDownloads * 4);   // Up to 4 pts for file downloads (bottom-funnel)
  microGestureScore += Math.min(3, copyEvents * 2);      // Up to 3 pts for copy text (research intent)

  // Rage clicks are negative signal (frustrated, not buying)
  microGestureScore -= Math.min(4, rageClicks * 2);

  microGestureScore = Math.max(0, Math.min(20, microGestureScore));

  // -------------------------------------------------------------------------
  // Factor 5: Conversion (0–10 points)
  // -------------------------------------------------------------------------
  let conversionScore = 0;
  if (session.conversionGoalHit) conversionScore = 10;

  // -------------------------------------------------------------------------
  // Total score
  // -------------------------------------------------------------------------
  const total = scrollScore + engagementScore + pageSequenceScore + microGestureScore + conversionScore;

  const breakdown: IntentBreakdown = {
    scrollScore,
    engagementScore,
    pageSequenceScore,
    microGestureScore,
    conversionScore,
    total,
  };

  // -------------------------------------------------------------------------
  // Classification
  // -------------------------------------------------------------------------
  const intentClass = classifyIntent(total, session, events);

  return { score: total, intentClass, breakdown };
}

/**
 * Classify intent based on score and session signals.
 * Some classifications override the numeric score.
 */
function classifyIntent(
  score: number,
  session: VisitorSession,
  events: SessionEvent[]
): IntentClass {
  // Bot was already filtered at ingestion, but double-check
  if (session.isBotFiltered) return 'BOT';

  // Researcher: Very long session, many pages, no conversion signals
  // Typical: someone reading docs, comparing options in detail
  const isResearcher =
    (session.durationMs ?? 0) > 10 * 60 * 1000 &&  // 10+ min
    session.pageCount >= 6 &&
    !session.conversionGoalHit &&
    events.filter(e => e.eventType === 'CTA_CLICK' || e.isCtaClick).length === 0;

  if (isResearcher) return 'RESEARCHER';

  // Competitor: Short session focused on pricing with no buying signals.
  // Must meet ALL criteria to avoid mislabeling real prospects:
  //   1. Under 90 seconds
  //   2. Viewed pricing (URL path or #pricing section)
  //   3. Zero interaction depth (no CTA clicks, form focus, or hesitation)
  //   4. Didn't explore other content (fewer than 2 non-pricing pages/sections)
  const durationMs = session.durationMs ?? 0;
  const isShortVisit = durationMs < 90 * 1000;

  const pricingKeywords = ['pricing', 'plans', 'packages', 'cost'];
  const viewedPricing = events.some(e => {
    const url = e.pageUrl?.toLowerCase() ?? '';
    if (pricingKeywords.some(kw => url.includes(kw))) return true;
    // Check section_view metadata for #pricing on single-page sites
    if (e.eventType === 'SECTION_VIEW' && e.metadata) {
      const meta = e.metadata as Record<string, unknown>;
      const section = typeof meta.section === 'string' ? meta.section.toLowerCase() : '';
      if (pricingKeywords.some(kw => section.includes(kw))) return true;
    }
    return false;
  });

  const ctaClicks = events.filter(e => e.eventType === 'CTA_CLICK' || e.isCtaClick).length;
  const formInteractions = events.filter(e => e.eventType === 'FORM_FOCUS' || e.eventType === 'FORM_SUBMIT').length;
  const hesitations = events.filter(e => e.eventType === 'HESITATION').length;
  const noInteraction = ctaClicks === 0 && formInteractions === 0 && hesitations === 0;

  // Count non-pricing content pages/sections visited
  const nonPricingContent = new Set<string>();
  for (const e of events) {
    if (e.eventType === 'PAGE_VIEW' || e.eventType === 'ROUTE_CHANGE') {
      const url = e.pageUrl?.toLowerCase() ?? '';
      if (!pricingKeywords.some(kw => url.includes(kw))) {
        nonPricingContent.add(url);
      }
    }
    if (e.eventType === 'SECTION_VIEW' && e.metadata) {
      const meta = e.metadata as Record<string, unknown>;
      const section = typeof meta.section === 'string' ? meta.section.toLowerCase() : '';
      if (section && !pricingKeywords.some(kw => section.includes(kw))) {
        nonPricingContent.add(section);
      }
    }
  }
  const limitedExploration = nonPricingContent.size < 2;

  const isLikelyCompetitor = isShortVisit && viewedPricing && noInteraction && limitedExploration;

  if (isLikelyCompetitor) return 'COMPETITOR';

  // Standard intent classification
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}
