/**
 * Read-only — lists every Site in whatever database this Prisma client is
 * connected to, with session/pageview counts and last-seen timestamps.
 *
 * Use this to figure out:
 *   - Which DB are we actually connected to (compare the host in the output
 *     against your Vercel DATABASE_URL)
 *   - Whether duplicate site records exist (e.g. two "CharlieIQ" entries)
 *   - Which sites have actual data
 *
 * Run with:  npx tsx scripts/list-all-sites.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Reveal which database we're connected to (host only, no creds)
  const url = process.env.DATABASE_URL ?? '(unset)';
  const hostMatch = url.match(/@([^/]+)/);
  console.log(`Connected to:  ${hostMatch?.[1] ?? '(could not parse)'}`);
  console.log();

  const sites = await prisma.site.findMany({
    select: { id: true, name: true, domain: true, isActive: true, subscriptionTier: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`${sites.length} sites in this database.\n`);

  const cutoff = new Date(Date.now() - 30 * 86400000);
  console.log('ID                           Name                           Domain                          Active  Tier            Sess(30d) Latest sess');
  console.log('-'.repeat(150));

  for (const s of sites) {
    const sessions = await prisma.visitorSession.count({
      where: { siteId: s.id, startedAt: { gte: cutoff } },
    });
    const latest = await prisma.visitorSession.findFirst({
      where: { siteId: s.id },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    });
    const latestStr = latest?.startedAt.toISOString().split('T')[0] ?? '(none)';

    console.log(
      `${s.id.padEnd(28)}  ${(s.name ?? '').slice(0, 28).padEnd(30)}  ${(s.domain ?? '').slice(0, 30).padEnd(32)}  ${s.isActive ? 'yes' : 'no '}     ${(s.subscriptionTier ?? '').padEnd(15)}  ${String(sessions).padStart(8)}  ${latestStr}`
    );
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
