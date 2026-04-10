export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/**
 * P1-04: Server-Side Event Ingestion API
 * POST /api/ingest
 *
 * Receives behavioral events from the client-side snippet.
 * Validates, anonymizes IPs (DL-01), rate limits, and enqueues to PostHog.
 *
 * CRITICAL: anonymizeRequest() MUST be called before any DB write.
 * Raw IPs never reach the database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { anonymizeRequest } from '@/lib/tracking/anonymize';
import { prisma } from '@/lib/db/client';
import { enqueueEvents } from '@/lib/tracking/posthog';
import { checkRateLimit } from '@/lib/utils/rate-limit';
import { detectBotFromUserAgent, classifyDevice, classifyTrafficSource } from '@/lib/tracking/bot-filter';
import { scoreSessionIntent } from '@/lib/tracking/intent-scoring';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const EventSchema = z.object({
  t: z.string(),                      // Event type
  ts: z.number(),                     // Timestamp (ms)
  u: z.string().url(),                // Current URL
  ti: z.string().nullish(),           // Page title
  pct: z.number().min(0).max(100).nullish(),  // Scroll depth
  tag: z.string().nullish(),          // Clicked element tag
  txt: z.string().max(200).nullish(), // Clicked element text
  cls: z.string().max(200).nullish(), // Clicked element class
  cta: z.boolean().nullish(),         // Is CTA click
  rage: z.boolean().nullish(),        // Is rage click
  hms: z.number().nullish(),          // Hesitation ms
  ms: z.number().nullish(),           // Time on page (exit events)
  ref: z.string().nullish(),          // Referrer
  spa: z.boolean().nullish(),         // SPA route change
  type: z.string().nullish(),         // Form input type
  name: z.string().nullish(),         // Form field name
  section: z.string().nullish(),     // Hash section name (section_view events)
  href: z.string().nullish(),        // Link destination (click events)
  entry: z.string().nullish(),       // Entry page path (first page_view)
  utm: z.record(z.string()).nullish(), // UTM parameters {utm_source, utm_medium, etc.}
  metadata: z.record(z.unknown()).nullish(),
});

const IngestPayloadSchema = z.object({
  snippetId: z.string().min(1),
  sessionId: z.string().min(1).max(100),
  consentGiven: z.boolean(),
  events: z.array(EventSchema).min(1).max(50), // Max 50 events per batch
});

// ---------------------------------------------------------------------------
// CORS — the snippet runs on customer sites, so all origins must be allowed
// ---------------------------------------------------------------------------

function getCorsHeaders(req?: NextRequest) {
  const origin = req?.headers.get('origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function json(data: unknown, status = 200, req?: NextRequest) {
  return NextResponse.json(data, { status, headers: getCorsHeaders(req) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Rate limiting — per IP (hashed)
  // We rate limit BEFORE parsing body to prevent abuse
  const rawIpForRateLimit = req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]
    || '127.0.0.1';

  const rateLimitOk = await checkRateLimit(rawIpForRateLimit, 'ingest', 100); // 100 req/min
  if (!rateLimitOk) {
    return json({ error: 'Rate limit exceeded' }, 429, req);
  }

  // 2. Parse and validate body
  // sendBeacon may send as text/plain, so fall back to reading as text
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    try {
      const text = await req.text();
      body = JSON.parse(text);
    } catch {
      return json({ error: 'Invalid JSON' }, 400, req);
    }
  }

  const parsed = IngestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'Validation failed', issues: parsed.error.issues }, 400, req);
  }

  const { snippetId, sessionId, consentGiven, events } = parsed.data;

  // 3. Look up site by snippet ID
  const site = await prisma.site.findUnique({
    where: { snippetId },
    select: {
      id: true,
      orgId: true,
      isActive: true,
      hasWebWatch: true,
      hasInterimReport: true,
      posthogEnabled: true,
      posthogApiKey: true,
      onboarding: {
        select: { conversionGoalUrl: true }
      }
    },
  });

  if (!site || !site.isActive) {
    return json({ error: 'Unknown snippet ID' }, 404, req);
  }

  // 4. DL-01: Anonymize IP — must happen before any DB write
  const { ipHash, country, region } = anonymizeRequest(req.headers, site.id);

  // 5. Bot detection from user agent (server-side, P1-05)
  const userAgent = req.headers.get('user-agent') || '';
  const botCheck = detectBotFromUserAgent(userAgent);
  const deviceInfo = classifyDevice(userAgent);

  // 6. Classify events before DB work
  const pageViewEvents: Array<typeof events[0]> = [];
  let converted = false;
  let conversionTime: Date | undefined;

  for (const event of events) {
    switch (event.t) {
      case 'page_view':
      case 'route_change':
        pageViewEvents.push(event);
        break;
      case 'conversion':
        converted = true;
        conversionTime = new Date(event.ts);
        break;
    }
  }

  // 7. All DB writes in a single transaction (one connection held, not many)
  const dbSessionId = await prisma.$transaction(async (tx) => {
    // Upsert session — uses @@unique([siteId, sessionId])
    // Check if this visitor (ipHash) has been seen before on this site
    const priorVisit = await tx.visitorSession.findFirst({
      where: { siteId: site.id, ipHash, sessionId: { not: sessionId } },
      select: { id: true },
    });

    const session = await tx.visitorSession.upsert({
      where: { siteId_sessionId: { siteId: site.id, sessionId } },
      create: {
        siteId: site.id,
        sessionId,
        ipHash,
        country,
        region,
        userAgent: userAgent.slice(0, 500),
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        isBotFiltered: botCheck.isBot,
        botReason: botCheck.reason,
        botCategory: botCheck.category,
        isReturning: priorVisit !== null,
      },
      update: {},
      select: { id: true },
    });

    // If bot, skip event writes
    if (botCheck.isBot) return session.id;

    // Batch write all events
    await tx.sessionEvent.createMany({
      data: events.map(event => ({
        sessionId: session.id,
        siteId: site.id,
        eventType: event.t === 'click' && event.rage ? 'RAGE_CLICK' : mapEventType(event.t),
        pageUrl: stripUrlHash(event.u),
        timestamp: new Date(event.ts),
        scrollDepthPct: event.pct,
        elementTag: event.tag,
        elementText: event.txt,
        elementClass: event.cls,
        isCtaClick: event.cta ?? false,
        rageClickCount: event.rage ? 1 : 0,
        hesitationMs: event.hms,
        timeOnPageMs: event.ms,
        metadata: ({
          ...event.metadata,
          ...(event.section ? { section: event.section } : {}),
          ...(event.href ? { href: event.href } : {}),
        }) as Prisma.InputJsonValue | undefined,
      })),
    });

    // Aggregate PageView records for drop-off analysis
    // Group events by page URL to build per-page engagement metrics
    const pageUrlMap = new Map<string, {
      title: string | null | undefined;
      enteredAt: Date;
      scrollDepth: number;
      clicks: number;
      rageClicks: number;
      hesitations: number;
      timeOnPageMs: number | null | undefined;
      isExit: boolean;
      exitIntent: boolean;
    }>();

    for (const event of events) {
      const url = stripUrlHash(event.u).split('?')[0]; // strip hash + query params
      if (!pageUrlMap.has(url)) {
        pageUrlMap.set(url, {
          title: event.ti,
          enteredAt: new Date(event.ts),
          scrollDepth: 0,
          clicks: 0,
          rageClicks: 0,
          hesitations: 0,
          timeOnPageMs: undefined,
          isExit: false,
          exitIntent: false,
        });
      }
      const pg = pageUrlMap.get(url)!;

      if (event.pct && event.pct > pg.scrollDepth) pg.scrollDepth = event.pct;
      if (event.t === 'click' || event.t === 'cta_click' || event.t === 'nav_click' || event.t === 'file_download') pg.clicks++;
      if (event.t === 'click' && event.rage) pg.rageClicks++;
      if (event.t === 'hesitation') pg.hesitations++;
      if (event.t === 'page_exit') {
        pg.isExit = true;
        pg.timeOnPageMs = event.ms;
      }
      if (event.t === 'exit_intent') pg.exitIntent = true;
    }

    // Upsert a PageView for each page URL — uses @@unique([sessionId, siteId, url])
    // Single upsert per URL instead of findFirst + conditional create/update
    for (const [url, pg] of pageUrlMap) {
      await tx.pageView.upsert({
        where: { sessionId_siteId_url: { sessionId: session.id, siteId: site.id, url } },
        create: {
          sessionId: session.id,
          siteId: site.id,
          url,
          title: pg.title ?? undefined,
          enteredAt: pg.enteredAt,
          maxScrollDepthPct: pg.scrollDepth || undefined,
          clickCount: pg.clicks,
          rageClickCount: pg.rageClicks,
          hesitationCount: pg.hesitations,
          timeOnPageMs: pg.timeOnPageMs ?? undefined,
          isExit: pg.isExit,
          exitIntentDetected: pg.exitIntent,
          exitedAt: pg.isExit ? new Date() : undefined,
        },
        update: {
          clickCount: { increment: pg.clicks },
          rageClickCount: { increment: pg.rageClicks },
          hesitationCount: { increment: pg.hesitations },
          ...(pg.scrollDepth > 0 ? { maxScrollDepthPct: pg.scrollDepth } : {}),
          ...(pg.timeOnPageMs ? { timeOnPageMs: pg.timeOnPageMs } : {}),
          ...(pg.isExit ? { isExit: true, exitedAt: new Date() } : {}),
          ...(pg.exitIntent ? { exitIntentDetected: true } : {}),
        },
      });
    }

    // Update session stats
    const sessionUpdates: Record<string, unknown> = {
      pageCount: { increment: pageViewEvents.length },
      endedAt: new Date(),
    };

    if (pageViewEvents.length > 0) {
      sessionUpdates.exitPage = stripUrlHash(pageViewEvents[pageViewEvents.length - 1].u);

      // Set entry page from first page_view (only if not already set)
      const firstPv = pageViewEvents[0];
      if (firstPv.entry) {
        sessionUpdates.entryPage = firstPv.entry;
      }

      // Capture UTM parameters + ad click IDs from first page_view
      const utm = firstPv.utm as Record<string, string> | undefined;
      if (utm) {
        if (utm.utm_source) sessionUpdates.utmSource = utm.utm_source;
        if (utm.utm_medium) sessionUpdates.utmMedium = utm.utm_medium;
        if (utm.utm_campaign) sessionUpdates.utmCampaign = utm.utm_campaign;
        if (utm.utm_term) sessionUpdates.utmTerm = utm.utm_term;
        if (utm.utm_content) sessionUpdates.utmContent = utm.utm_content;
        if (utm._click_id) sessionUpdates.clickIdType = utm._click_id;
        if (utm._click_id_value) sessionUpdates.clickId = utm._click_id_value;
      }

      // Capture referrer
      if (firstPv.ref && !sessionUpdates.referrer) {
        sessionUpdates.referrer = firstPv.ref;
      }

      // Classify traffic source from UTM + referrer
      const utmForSource = firstPv.utm as Record<string, string> | undefined;
      sessionUpdates.trafficSource = classifyTrafficSource(
        firstPv.ref,
        utmForSource?.utm_source,
        utmForSource?.utm_medium,
      );
    }

    if (converted) {
      const goalUrl = site.onboarding?.conversionGoalUrl;
      const conversionEvent = events.find(e => e.t === 'conversion');
      const isGoalHit = goalUrl
        ? conversionEvent?.u?.includes(goalUrl) ?? false
        : true;

      if (isGoalHit) {
        sessionUpdates.conversionGoalHit = true;
        sessionUpdates.convertedAt = conversionTime;
      }
    }

    await tx.visitorSession.update({
      where: { id: session.id },
      data: sessionUpdates,
    });

    // Re-score intent inside the same transaction (no extra connections)
    const fullSession = await tx.visitorSession.findUnique({
      where: { id: session.id },
      include: { events: true, pageViews: true },
    });

    if (fullSession) {
      const conversionGoalUrl = site.onboarding?.conversionGoalUrl ?? null;
      const { score, intentClass } = scoreSessionIntent(
        { session: fullSession, events: fullSession.events, pageViews: fullSession.pageViews },
        conversionGoalUrl,
      );

      // Bounce = single page view, < 10s duration
      const durationMs = fullSession.endedAt && fullSession.startedAt
        ? fullSession.endedAt.getTime() - fullSession.startedAt.getTime()
        : 0;
      const isBounce = fullSession.pageCount <= 1 && durationMs < 10000;

      // Behavioral bot suspect detection — flag sessions that look non-human
      // but passed the UA check. These stay in human counts but are flagged.
      let isBotSuspect = false;
      let botSuspectReason: string | null = null;

      const evTypes = new Set(fullSession.events.map(e => e.eventType));
      const hasScroll = evTypes.has('SCROLL');
      const hasClick = evTypes.has('CLICK') || evTypes.has('CTA_CLICK') || evTypes.has('NAV_CLICK');
      const hasHesitation = evTypes.has('HESITATION');
      const hasMouse = hasClick || hasHesitation;
      const eventCount = fullSession.events.length;

      // Pattern 1: PAGE_VIEW + PAGE_EXIT only, no interaction, under 3s
      // Classic scraper that runs JS but doesn't interact
      if (eventCount <= 3 && !hasScroll && !hasMouse && durationMs < 3000 && durationMs > 0) {
        isBotSuspect = true;
        botSuspectReason = 'instant_exit_no_interaction';
      }

      // Pattern 2: Single page, no scroll at all, 3-10s duration
      // Could be a human glance, but suspicious without any scroll
      if (!isBotSuspect && fullSession.pageCount <= 1 && !hasScroll && !hasMouse
          && durationMs >= 3000 && durationMs < 10000 && eventCount <= 4) {
        isBotSuspect = true;
        botSuspectReason = 'no_scroll_single_page';
      }

      // Pattern 3: Many pages visited very fast (> 5 pages in < 30s)
      // Programmatic crawling with JS execution
      if (!isBotSuspect && fullSession.pageCount >= 5 && durationMs < 30000 && durationMs > 0) {
        isBotSuspect = true;
        botSuspectReason = 'rapid_multipage';
      }

      await tx.visitorSession.update({
        where: { id: session.id },
        data: { intentScore: score, intentClass, isBounce, durationMs, isBotSuspect, botSuspectReason },
      });
    }

    return session.id;
  });

  if (botCheck.isBot) {
    return json({ ok: true, bot: true }, 200, req);
  }

  // 9. Forward to PostHog (non-blocking, outside transaction, no extra DB query)
  await enqueueEvents({
    siteId: site.id,
    sessionId: dbSessionId,
    events,
    consentGiven,
    posthogEnabled: site.posthogEnabled,
    posthogApiKey: site.posthogApiKey,
  }).catch(() => {
    console.error('[ingest] PostHog enqueue failed');
  });

  return json({ ok: true }, 200, req);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapEventType(type: string): import('@prisma/client').EventType {
  const map: Record<string, import('@prisma/client').EventType> = {
    'page_view': 'PAGE_VIEW',
    'page_exit': 'PAGE_EXIT',
    'page_load_complete': 'PAGE_LOAD_COMPLETE',
    'scroll': 'SCROLL',
    'click': 'CLICK',
    'cta_click': 'CTA_CLICK',
    'nav_click': 'NAV_CLICK',
    'hesitation': 'HESITATION',
    'rage_click': 'RAGE_CLICK',
    'form_focus': 'FORM_FOCUS',
    'form_submit': 'FORM_SUBMIT',
    'conversion': 'CONVERSION',
    'route_change': 'ROUTE_CHANGE',
    'section_view': 'SECTION_VIEW',
    'exit_intent': 'EXIT_INTENT',
    'tab_blur': 'TAB_BLUR',
    'tab_focus': 'TAB_FOCUS',
    'copy_text': 'COPY_TEXT',
    'file_download': 'FILE_DOWNLOAD',
  };
  return map[type] ?? 'CUSTOM';
}

/** Strip hash fragments from URLs for consistent page grouping */
function stripUrlHash(url: string): string {
  return url.split('#')[0];
}
