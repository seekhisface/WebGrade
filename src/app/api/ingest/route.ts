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
import { anonymizeRequest } from '@/lib/tracking/anonymize';
import { prisma } from '@/lib/db/client';
import { enqueueEvents } from '@/lib/tracking/posthog';
import { checkRateLimit } from '@/lib/utils/rate-limit';
import { detectBotFromUserAgent, classifyDevice } from '@/lib/tracking/bot-filter';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const EventSchema = z.object({
  t: z.string(),                      // Event type
  ts: z.number(),                     // Timestamp (ms)
  u: z.string().url(),                // Current URL
  ti: z.string().optional(),          // Page title
  pct: z.number().min(0).max(100).optional(),  // Scroll depth
  tag: z.string().optional(),         // Clicked element tag
  txt: z.string().max(200).optional(), // Clicked element text
  cls: z.string().max(200).optional(), // Clicked element class
  cta: z.boolean().optional(),        // Is CTA click
  rage: z.boolean().optional(),       // Is rage click
  hms: z.number().optional(),         // Hesitation ms
  ms: z.number().optional(),          // Time on page (exit events)
  ref: z.string().optional(),         // Referrer
  spa: z.boolean().optional(),        // SPA route change
  type: z.string().optional(),        // Form input type
  name: z.string().optional(),        // Form field name
  metadata: z.record(z.unknown()).optional(),
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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
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

  // 6. Upsert visitor session
  // sessionId from client is pseudonymous — we store it as-is
  const existingSession = await prisma.visitorSession.findFirst({
    where: { siteId: site.id, sessionId },
    select: { id: true, pageCount: true },
  });

  let dbSessionId: string;
  if (existingSession) {
    dbSessionId = existingSession.id;
  } else {
    // Create new session — note: raw IP is NOT passed here
    const newSession = await prisma.visitorSession.create({
      data: {
        siteId: site.id,
        sessionId,
        ipHash,        // DL-01 compliant hash only
        country,
        region,
        userAgent: userAgent.slice(0, 500), // Truncate for storage
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        isBotFiltered: botCheck.isBot,
        botReason: botCheck.reason,
      },
      select: { id: true },
    });
    dbSessionId = newSession.id;
  }

  // 7. If bot, acknowledge but don't process further
  if (botCheck.isBot) {
    return NextResponse.json({ ok: true, bot: true });
  }

  // 8. Process events
  const pageViewEvents: Array<typeof events[0]> = [];
  const exitEvents: Array<typeof events[0]> = [];
  let converted = false;
  let conversionTime: Date | undefined;

  for (const event of events) {
    switch (event.t) {
      case 'page_view':
      case 'route_change':
        pageViewEvents.push(event);
        break;
      case 'page_exit':
        exitEvents.push(event);
        break;
      case 'conversion':
        converted = true;
        conversionTime = new Date(event.ts);
        break;
    }

    // Write individual events to DB for behavioral analysis
    await prisma.sessionEvent.create({
      data: {
        sessionId: dbSessionId,
        siteId: site.id,
        eventType: mapEventType(event.t),
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
        metadata: event.metadata ?? undefined,
      },
    }).catch(() => {
      // Non-fatal: log but don't fail the request
      console.error('[ingest] Failed to write event:', event.t);
    });
  }

  // 9. Update session stats
  const sessionUpdates: Record<string, unknown> = {
    pageCount: { increment: pageViewEvents.length },
    endedAt: new Date(),
  };

  if (pageViewEvents.length > 0) {
    sessionUpdates.exitPage = pageViewEvents[pageViewEvents.length - 1].u;
    if (!existingSession) {
      sessionUpdates.entryPage = pageViewEvents[0].u;
    }
  }

  if (converted) {
    // Check if this is the actual conversion goal URL
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

  await prisma.visitorSession.update({
    where: { id: dbSessionId },
    data: sessionUpdates,
  });

  // 10. Forward to PostHog pipeline for behavioral analysis
  await enqueueEvents({
    siteId: site.id,
    sessionId: dbSessionId,
    events,
    consentGiven,
  }).catch(() => {
    // Non-fatal
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
  };
  return map[type] ?? 'CUSTOM';
}
