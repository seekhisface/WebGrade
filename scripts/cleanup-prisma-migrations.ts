/**
 * One-time cleanup: remove orphan rows from _prisma_migrations after squashing
 * the migration history into a single baseline. Keeps only the new baseline row.
 *
 * Run with:  npx tsx scripts/cleanup-prisma-migrations.ts
 *
 * Safe to delete this script after the cleanup runs successfully — it's
 * idempotent (no-op if there are no orphans).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASELINE_NAME = '20260503000000_baseline';

async function main() {
  // List current rows in _prisma_migrations
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; migration_name: string; finished_at: Date | null }>>(
    `SELECT id, migration_name, finished_at FROM _prisma_migrations ORDER BY started_at`,
  );

  console.log(`Found ${rows.length} rows in _prisma_migrations:`);
  for (const r of rows) {
    console.log(`  ${r.migration_name}  (${r.finished_at ? 'applied' : 'FAILED'})`);
  }

  const orphans = rows.filter(r => r.migration_name !== BASELINE_NAME);
  if (orphans.length === 0) {
    console.log('\nNo orphans to clean. Done.');
    await prisma.$disconnect();
    return;
  }

  console.log(`\nRemoving ${orphans.length} orphan row(s) and keeping only ${BASELINE_NAME}...`);
  const result = await prisma.$executeRawUnsafe(
    `DELETE FROM _prisma_migrations WHERE migration_name <> $1`,
    BASELINE_NAME,
  );
  console.log(`Deleted ${result} rows.`);

  // Verify the baseline is recorded as applied
  const baselineRow = await prisma.$queryRawUnsafe<Array<{ id: string; finished_at: Date | null }>>(
    `SELECT id, finished_at FROM _prisma_migrations WHERE migration_name = $1`,
    BASELINE_NAME,
  );
  if (baselineRow.length === 0) {
    console.log(`⚠ Baseline row missing — something went wrong. Re-run prisma migrate resolve --applied ${BASELINE_NAME}`);
  } else {
    console.log(`✓ ${BASELINE_NAME} is the only row, marked ${baselineRow[0].finished_at ? 'applied' : 'PENDING'}.`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
