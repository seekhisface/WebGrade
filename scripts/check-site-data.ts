/**
 * Read-only diagnostic: shows session/event/pageview counts for every site.
 * Run with: npx tsx scripts/check-site-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sites = await prisma.site.findMany({
    select: { id: true, name: true, domain: true, isActive: true, subscriptionTier: true },
    orderBy: { name: 'asc' },
  });

  console.log(`Found ${sites.length} sites.\n`);
  console.log('Site                              Sessions  PageViews  Events   isExit=T  Last 7d');
  console.log('--------------------------------------------------------------------------------------');

  for (const s of sites) {
    const [sessions, pageviews, events, exitFlags, recent] = await Promise.all([
      prisma.visitorSession.count({ where: { siteId: s.id } }),
      prisma.pageView.count({ where: { siteId: s.id } }),
      prisma.sessionEvent.count({ where: { siteId: s.id } }),
      prisma.pageView.count({ where: { siteId: s.id, isExit: true } }),
      prisma.visitorSession.count({
        where: { siteId: s.id, startedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      }),
    ]);

    const tag = s.isActive ? '' : ' (inactive)';
    console.log(
      `${(s.name + tag).padEnd(32)}  ${String(sessions).padStart(8)}  ${String(pageviews).padStart(9)}  ${String(events).padStart(7)}  ${String(exitFlags).padStart(8)}  ${String(recent).padStart(7)}`
    );
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
