/**
 * Read-only diagnostic: shows the state of gclid → campaign resolution.
 *
 * Tells us whether the daily resolveGclidsDaily Inngest job has run and what it
 * found, so we can distinguish "cron hasn't fired yet" from "API returned no
 * matches" from "we wrote to a column you're not looking at."
 *
 * Run with:  npx tsx scripts/check-gclid-resolution.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Total gclid sessions
  const totalGclid = await prisma.visitorSession.count({
    where: { clickIdType: 'gclid', clickId: { not: null } },
  });

  // Resolution status breakdown
  const byStatus = await prisma.visitorSession.groupBy({
    by: ['gclidResolutionStatus'],
    where: { clickIdType: 'gclid', clickId: { not: null } },
    _count: { _all: true },
  });

  // Sessions that have a resolved campaign name set
  const withResolvedName = await prisma.visitorSession.count({
    where: {
      clickIdType: 'gclid',
      resolvedCampaignName: { not: null },
    },
  });

  // Top 10 distinct (utm_campaign, resolved_campaign) pairs to see drift
  const drift = await prisma.visitorSession.groupBy({
    by: ['utmCampaign', 'resolvedCampaignName'],
    where: {
      clickIdType: 'gclid',
      resolvedCampaignName: { not: null },
    },
    _count: { _all: true },
    orderBy: { _count: { utmCampaign: 'desc' } },
    take: 10,
  });

  // Most recent resolution attempt
  const lastAttempt = await prisma.visitorSession.findFirst({
    where: { gclidResolvedAt: { not: null } },
    orderBy: { gclidResolvedAt: 'desc' },
    select: { gclidResolvedAt: true, gclidResolutionStatus: true },
  });

  console.log('--------------------------------------------------');
  console.log('GCLID SESSIONS');
  console.log('--------------------------------------------------');
  console.log(`Total sessions with gclid:            ${totalGclid}`);
  console.log(`Sessions with resolvedCampaignName:   ${withResolvedName}`);
  console.log();

  console.log('--------------------------------------------------');
  console.log('RESOLUTION STATUS BREAKDOWN');
  console.log('--------------------------------------------------');
  if (byStatus.length === 0) {
    console.log('  (no rows)');
  } else {
    for (const row of byStatus) {
      const label = row.gclidResolutionStatus ?? '(null - not yet attempted)';
      console.log(`  ${label.padEnd(35)} ${row._count._all}`);
    }
  }
  console.log();

  console.log('--------------------------------------------------');
  console.log('LAST RESOLUTION ATTEMPT');
  console.log('--------------------------------------------------');
  if (lastAttempt) {
    console.log(`  When:   ${lastAttempt.gclidResolvedAt?.toISOString()}`);
    console.log(`  Status: ${lastAttempt.gclidResolutionStatus}`);
  } else {
    console.log('  Never — the daily cron job has not produced any results yet.');
    console.log('  (Cron is `0 8 * * *` UTC. If you just deployed, wait until tomorrow 8am UTC,');
    console.log('   or trigger `resolve-gclids-daily` manually from the Inngest dashboard.)');
  }
  console.log();

  console.log('--------------------------------------------------');
  console.log('CAMPAIGN DRIFT (top 10)');
  console.log('utm_campaign vs resolvedCampaignName');
  console.log('--------------------------------------------------');
  if (drift.length === 0) {
    console.log('  (none — either nothing resolved yet, or every utm_campaign matches Ads)');
  } else {
    for (const row of drift) {
      const utm = row.utmCampaign ?? '(null)';
      const resolved = row.resolvedCampaignName ?? '(null)';
      const match = utm === resolved ? '✓' : '⚠ DRIFT';
      console.log(`  ${match}  ${row._count._all.toString().padStart(5)}  utm="${utm}"  →  resolved="${resolved}"`);
    }
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
