/**
 * Marks a Prisma migration as applied in _prisma_migrations without using
 * `prisma migrate resolve` (which fails on Supabase's pooler due to advisory
 * locks). Use after running migration SQL manually via `prisma db execute`.
 *
 * Run with:  npx tsx scripts/mark-migration-applied.ts <migration_name>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const name = process.argv[2];
  if (!name) {
    console.error('Usage: npx tsx scripts/mark-migration-applied.ts <migration_name>');
    process.exit(1);
  }

  const exists = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM _prisma_migrations WHERE migration_name = $1`,
    name,
  );
  if (exists.length > 0) {
    console.log(`Already recorded: ${name}`);
    await prisma.$disconnect();
    return;
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES (gen_random_uuid()::text, 'manual-apply', NOW(), $1, null, null, NOW(), 1)`,
    name,
  );
  console.log(`Marked ${name} as applied.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
