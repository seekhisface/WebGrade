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
import { detectBotFromUserAgent, classifyDevice } from '@/lib/tracking/bot-filter';
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
  metadata: z.record(z.unknown()).nullish(),
});

const IngestPayloadSchema = z.object({
  snippetId: z.string().min(1),
  sessionId: z.string().min(1).max(100),
  consentGiven: z.boolean(),
  events: z.array(EventSchema).min(1).max(50), // Max 50 events per batch
});

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
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
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
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
  }

  const parsed = IngestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
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
    return NextResponse.json({ error: 'Unknown snippet ID' }, { status: 404 });
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
        pageUrl: event.u,
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
      const url = event.u.split('?')[0]; // strip query params
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
      if (event.t === 'click') pg.clicks++;
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
      sessionUpdates.exitPage = pageViewEvents[pageViewEvents.length - 1].u;
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

      await tx.visitorSession.update({
        where: { id: session.id },
        data: { intentScore: score, intentClass },
      });
    }

    return session.id;
  });

  if (botCheck.isBot) {
    return NextResponse.json({ ok: true, bot: true });
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

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapEventType(type: string): import('@prisma/client').EventType {
  const map: Record<string, import('@prisma/client').EventType> = {
    'page_view': 'PAGE_VIEW',
    'page_exit': 'PAGE_EXIT',
    'scroll': 'SCROLL',
    'click': 'CLICK',
    'hesitation': 'HESITATION',
    'rage_click': 'RAGE_CLICK',
    'form_focus': 'FORM_FOCUS',
    'form_submit': 'FORM_SUBMIT',
    'conversion': 'CONVERSION',
    'route_change': 'ROUTE_CHANGE',
    'section_view': 'SECTION_VIEW',
  };
  return map[type] ?? 'CUSTOM';
}
