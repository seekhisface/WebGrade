/**
 * Backfill script for VisitorSession computed fields.
 *
 * Updates existing sessions with:
 *   - durationMs (endedAt - startedAt)
 *   - isBounce (pageCount <= 1 AND durationMs < 10000)
 *   - isReturning (same ipHash + siteId with earlier startedAt)
 *   - trafficSource (classified from referrer/utmSource/utmMedium)
 *   - isBotSuspect / botSuspectReason (behavioral patterns)
 *
 * Run with: npx tsx scripts/backfill-sessions.ts
 */

import { prisma } from '@/lib/db/client';
import { classifyTrafficSource } from '@/lib/tracking/bot-filter';

const BATCH_SIZE = 200;

async function main() {
  const totalCount = await prisma.visitorSession.count();
  console.log(`Total sessions to process: ${totalCount}`);

  let processed = 0;
  let cursor: string | undefined;

  while (true) {
    const sessions = await prisma.visitorSession.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        siteId: true,
        ipHash: true,
        startedAt: true,
        endedAt: true,
        pageCount: true,
        referrer: true,
        utmSource: true,
        utmMedium: true,
      },
    });

    if (sessions.length === 0) break;

    for (const session of sessions) {
      // --- durationMs ---
      let durationMs: number | null = null;
      if (session.endedAt) {
        durationMs = session.endedAt.getTime() - session.startedAt.getTime();
      }

      // --- isBounce ---
      const isBounce =
        session.pageCount <= 1 && (durationMs !== null ? durationMs < 10000 : false);

      // --- isReturning ---
      const earlierSession = await prisma.visitorSession.findFirst({
        where: {
          siteId: session.siteId,
          ipHash: session.ipHash,
          startedAt: { lt: session.startedAt },
          id: { not: session.id },
        },
        select: { id: true },
      });
      const isReturning = !!earlierSession;

      // --- trafficSource ---
      const trafficSource = classifyTrafficSource(
        session.referrer,
        session.utmSource,
        session.utmMedium,
      );

      // --- isBotSuspect / botSuspectReason ---
      let isBotSuspect = false;
      let botSuspectReason: string | null = null;

      // Load events for behavioral analysis
      const events = await prisma.sessionEvent.findMany({
        where: { sessionId: session.id },
        select: { eventType: true },
      });

      const eventTypes = new Set(events.map((e) => e.eventType));
      const eventCount = events.length;
      const hasInteraction =
        eventTypes.has('SCROLL') ||
        eventTypes.has('CLICK') ||
        eventTypes.has('CTA_CLICK') ||
        eventTypes.has('NAV_CLICK') ||
        eventTypes.has('HESITATION');
      const hasMouseEvents =
        eventTypes.has('CLICK') ||
        eventTypes.has('CTA_CLICK') ||
        eventTypes.has('NAV_CLICK') ||
        eventTypes.has('HESITATION') ||
        eventTypes.has('RAGE_CLICK');
      const hasScroll = eventTypes.has('SCROLL');

      // Pattern: instant_exit_no_interaction
      if (
        eventCount <= 3 &&
        !hasInteraction &&
        durationMs !== null &&
        durationMs < 3000
      ) {
        isBotSuspect = true;
        botSuspectReason = 'instant_exit_no_interaction';
      }

      // Pattern: no_scroll_single_page
      if (
        !isBotSuspect &&
        session.pageCount <= 1 &&
        !hasScroll &&
        !hasMouseEvents &&
        durationMs !== null &&
        durationMs >= 3000 &&
        durationMs <= 10000 &&
        eventCount <= 4
      ) {
        isBotSuspect = true;
        botSuspectReason = 'no_scroll_single_page';
      }

      // Pattern: rapid_multipage
      if (
        !isBotSuspect &&
        session.pageCount >= 5 &&
        durationMs !== null &&
        durationMs < 30000
      ) {
        isBotSuspect = true;
        botSuspectReason = 'rapid_multipage';
      }

      // --- Update the session ---
      await prisma.visitorSession.update({
        where: { id: session.id },
        data: {
          durationMs,
          isBounce,
          isReturning,
          trafficSource,
          isBotSuspect,
          botSuspectReason,
        },
      });
    }

    processed += sessions.length;
    cursor = sessions[sessions.length - 1].id;

    if (processed % BATCH_SIZE === 0 || sessions.length < BATCH_SIZE) {
      console.log(`Processed ${processed} / ${totalCount} sessions`);
    }
  }

  console.log(`Done. Backfilled ${processed} sessions.`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
