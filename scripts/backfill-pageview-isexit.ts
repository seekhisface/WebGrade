/**
 * One-time backfill: ensure isExit=true is set on ONLY the latest PageView
 * per session. Multiple PageViews per session currently have isExit=true
 * because the snippet fires page_exit on every navigation, which inflates
 * per-page exit rates and skews the "Top drop-off pages" ranking.
 *
 * For each session: keep isExit=true on the latest PageView (by enteredAt),
 * clear isExit=false on all earlier PageViews.
 *
 * Run with:  npx tsx scripts/backfill-pageview-isexit.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find sessions where more than one PageView has isExit=true
  const dupExitSessions = await prisma.pageView.groupBy({
    by: ['sessionId'],
    where: { isExit: true },
    _count: { _all: true },
    having: { sessionId: { _count: { gt: 1 } } },
  });

  console.log(`Sessions with multiple isExit=true PageViews: ${dupExitSessions.length}`);
  console.log('Cleaning up — keeping isExit on latest PageView per session, clearing on the rest.\n');

  let cleared = 0;
  let processed = 0;

  for (const row of dupExitSessions) {
    const latestPv = await prisma.pageView.findFirst({
      where: { sessionId: row.sessionId },
      orderBy: { enteredAt: 'desc' },
      select: { id: true },
    });

    if (!latestPv) {
      processed++;
      continue;
    }

    const result = await prisma.pageView.updateMany({
      where: { sessionId: row.sessionId, id: { not: latestPv.id }, isExit: true },
      data: { isExit: false, exitedAt: null },
    });

    cleared += result.count;
    processed++;

    if (processed % 500 === 0) {
      console.log(`  ...${processed} sessions processed (${cleared} PageViews cleared)`);
    }
  }

  console.log();
  console.log('--------------------------------------------------');
  console.log(`Sessions processed:        ${processed}`);
  console.log(`PageView rows cleared:     ${cleared}`);
  console.log('--------------------------------------------------');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
