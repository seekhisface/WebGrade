/**
 * One-time backfill: recompute entryPage / exitPage from PageView records.
 *
 * For every VisitorSession, set:
 *   entryPage = URL of the earliest PageView (by enteredAt)
 *   exitPage  = URL of the latest PageView (by enteredAt, or by isExit=true if any)
 *
 * Existing data was corrupted by an ingest bug that overwrote entryPage on every
 * page_view, so entry == exit on most sessions. This script fixes existing rows.
 *
 * Run with:  npx tsx scripts/backfill-entry-exit-pages.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function stripHash(url: string): string {
  return url.split('#')[0];
}

async function main() {
  const sessions = await prisma.visitorSession.findMany({
    select: { id: true, entryPage: true, exitPage: true },
  });
  console.log(`Found ${sessions.length} sessions to evaluate.`);

  let updated = 0;
  let skipped = 0;
  let noPageViews = 0;

  for (const s of sessions) {
    const pageViews = await prisma.pageView.findMany({
      where: { sessionId: s.id },
      orderBy: { enteredAt: 'asc' },
      select: { url: true, isExit: true, enteredAt: true },
    });

    if (pageViews.length === 0) {
      noPageViews++;
      continue;
    }

    const newEntryPage = stripHash(pageViews[0].url);
    const exitPv = pageViews.find(pv => pv.isExit) ?? pageViews[pageViews.length - 1];
    const newExitPage = stripHash(exitPv.url);

    // Only update if values differ from what's already in the session row.
    if (s.entryPage === newEntryPage && s.exitPage === newExitPage) {
      skipped++;
      continue;
    }

    await prisma.visitorSession.update({
      where: { id: s.id },
      data: { entryPage: newEntryPage, exitPage: newExitPage },
    });
    updated++;

    if (updated % 500 === 0) {
      console.log(`  ...${updated} sessions updated`);
    }
  }

  console.log();
  console.log('--------------------------------------------------');
  console.log(`Updated:        ${updated}`);
  console.log(`Already correct: ${skipped}`);
  console.log(`No PageViews:   ${noPageViews}`);
  console.log(`Total:          ${sessions.length}`);
  console.log('--------------------------------------------------');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
