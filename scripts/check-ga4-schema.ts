/**
 * Read-only check: does the prod DB have everything the ga4_migration would add?
 * Run with:   npx tsx scripts/check-ga4-schema.ts
 *
 * This script does NOT modify anything. It just queries information_schema and
 * reports which columns and tables are present vs. missing.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXPECTED_SITE_COLS = [
  'ga4Connected',
  'ga4ConnectedAt',
  'ga4ConnectedByUserId',
  'ga4LastSyncAt',
  'ga4PropertyId',
  'gadsConnected',
  'gadsConnectedAt',
  'gadsConnectedByUserId',
  'gadsCustomerId',
  'gadsLastSyncAt',
];

async function main() {
  // 1. Columns on sites table
  const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sites'
      AND column_name = ANY(${EXPECTED_SITE_COLS})
    ORDER BY column_name;
  `;

  // 2. gads_campaign_metrics table
  const tbl = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gads_campaign_metrics';
  `;

  // 3. _prisma_migrations records
  const migs = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
    SELECT migration_name, finished_at
    FROM _prisma_migrations
    ORDER BY started_at;
  `;

  const present = new Set(cols.map(c => c.column_name));
  const missing = EXPECTED_SITE_COLS.filter(c => !present.has(c));

  console.log('--------------------------------------------------');
  console.log('SITES TABLE — GA4 / Google Ads columns');
  console.log('--------------------------------------------------');
  console.log(`Present (${present.size}/${EXPECTED_SITE_COLS.length}):`);
  for (const c of EXPECTED_SITE_COLS) {
    console.log(`  ${present.has(c) ? '[OK]    ' : '[MISSING]'} ${c}`);
  }
  if (missing.length === 0) {
    console.log('\nAll 10 columns present.');
  } else {
    console.log(`\nMissing ${missing.length} columns: ${missing.join(', ')}`);
  }

  console.log();
  console.log('--------------------------------------------------');
  console.log('gads_campaign_metrics table');
  console.log('--------------------------------------------------');
  console.log(tbl.length > 0 ? '[OK]    Table exists' : '[MISSING] Table does NOT exist');

  console.log();
  console.log('--------------------------------------------------');
  console.log('_prisma_migrations records');
  console.log('--------------------------------------------------');
  for (const m of migs) {
    console.log(`  ${m.finished_at ? '[OK]   ' : '[FAILED]'} ${m.migration_name}`);
  }

  console.log();
  console.log('--------------------------------------------------');
  console.log('VERDICT');
  console.log('--------------------------------------------------');
  if (missing.length === 0 && tbl.length > 0) {
    console.log('Safe to run: npx prisma migrate resolve --applied 20260411205327_ga4_migration');
  } else {
    console.log('NOT safe to mark applied. The ga4_migration would actually change the DB.');
    console.log('Stop here and share this output before running migrate resolve.');
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
