/**
 * Read-only diagnostic for CharlieIQ — answers two questions:
 *
 *   1. Are the cron-driven syncs actually firing? (gscLastSyncAt, ga4LastSyncAt,
 *      gadsLastSyncAt — should be within last 24-48h if Inngest is healthy)
 *   2. Why isn't drop-off showing the demo page? (lists every URL with
 *      session counts so we can see if the threshold is the real issue)
 *
 * Run with:  npx tsx scripts/diagnose-charlieiq.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ── Find CharlieIQ ────────────────────────────────────────────────────────
  const site = await prisma.site.findFirst({
    where: { OR: [{ name: { contains: 'CharlieIQ', mode: 'insensitive' } }, { domain: { contains: 'charlieiq', mode: 'insensitive' } }] },
    select: {
      id: true, name: true, domain: true,
      gscConnected: true, gscPropertyUrl: true, gscLastSyncAt: true,
      ga4Connected: true, ga4PropertyId: true, ga4LastSyncAt: true,
      gadsConnected: true, gadsCustomerId: true, gadsLastSyncAt: true,
      webauditStartDate: true, subscriptionTier: true,
    },
  });

  if (!site) {
    console.log('CharlieIQ site not found.');
    return;
  }

  console.log('--------------------------------------------------');
  console.log(`SITE: ${site.name}  (${site.domain})`);
  console.log(`ID: ${site.id}`);
  console.log(`Tier: ${site.subscriptionTier}    Audit started: ${site.webauditStartDate?.toISOString().split('T')[0] ?? '(none)'}`);
  console.log('--------------------------------------------------');

  console.log('\nINTEGRATION SYNC STATUS');
  console.log('--------------------------------------------------');
  const fmtSync = (d: Date | null) => {
    if (!d) return '(never)';
    const hrs = Math.round((Date.now() - d.getTime()) / 3600000);
    if (hrs < 24) return `${d.toISOString()}  (${hrs}h ago)`;
    return `${d.toISOString()}  (${Math.floor(hrs / 24)}d ago) ⚠ STALE`;
  };
  console.log(`GSC connected:  ${site.gscConnected ? 'yes' : 'NO'}    Last sync: ${fmtSync(site.gscLastSyncAt)}`);
  console.log(`GA4 connected:  ${site.ga4Connected ? 'yes' : 'NO'}    Last sync: ${fmtSync(site.ga4LastSyncAt)}`);
  console.log(`GAds connected: ${site.gadsConnected ? 'yes' : 'NO'}    Last sync: ${fmtSync(site.gadsLastSyncAt)}`);

  // ── Sessions / PageViews / Events totals (last 30d) ───────────────────────
  const cutoff = new Date(Date.now() - 30 * 86400000);
  const [sessions, sessionsBotFiltered, pageviews, events] = await Promise.all([
    prisma.visitorSession.count({ where: { siteId: site.id, startedAt: { gte: cutoff } } }),
    prisma.visitorSession.count({ where: { siteId: site.id, startedAt: { gte: cutoff }, isBotFiltered: false } }),
    prisma.pageView.count({ where: { siteId: site.id, enteredAt: { gte: cutoff } } }),
    prisma.sessionEvent.count({ where: { siteId: site.id, timestamp: { gte: cutoff } } }),
  ]);

  console.log('\nDATA VOLUME (last 30 days)');
  console.log('--------------------------------------------------');
  console.log(`VisitorSessions (all):           ${sessions}`);
  console.log(`VisitorSessions (non-bot):       ${sessionsBotFiltered}`);
  console.log(`PageView records:                ${pageviews}`);
  console.log(`SessionEvent records:            ${events}`);

  // ── Per-URL session counts (this is what dropoff analyzes) ────────────────
  const pageViewsByUrl = await prisma.pageView.findMany({
    where: { siteId: site.id, enteredAt: { gte: cutoff }, session: { isBotFiltered: false } },
    select: { url: true, sessionId: true, isExit: true },
  });

  const urlMap = new Map<string, { sessions: Set<string>; exits: number }>();
  for (const pv of pageViewsByUrl) {
    const key = pv.url.split('?')[0]; // strip query params (matches dropoff logic)
    if (!urlMap.has(key)) urlMap.set(key, { sessions: new Set(), exits: 0 });
    const e = urlMap.get(key)!;
    e.sessions.add(pv.sessionId);
    if (pv.isExit) e.exits++;
  }

  const sorted = Array.from(urlMap.entries())
    .map(([url, agg]) => ({ url, sessions: agg.sessions.size, exits: agg.exits }))
    .sort((a, b) => b.sessions - a.sessions);

  console.log(`\nDISTINCT URLs (non-bot, last 30d):  ${sorted.length}`);
  console.log(`URLs with 10+ sessions:             ${sorted.filter(u => u.sessions >= 10).length}`);
  console.log(`URLs with 5-9 sessions:             ${sorted.filter(u => u.sessions >= 5 && u.sessions < 10).length}`);
  console.log(`URLs with 1-4 sessions:             ${sorted.filter(u => u.sessions < 5).length}`);

  console.log('\nTOP 20 URLs BY SESSION COUNT');
  console.log('--------------------------------------------------');
  console.log('Sessions  Exits  URL');
  for (const row of sorted.slice(0, 20)) {
    console.log(`${String(row.sessions).padStart(8)}  ${String(row.exits).padStart(5)}  ${row.url}`);
  }

  // ── Look for "demo" / "thanks" specifically ───────────────────────────────
  console.log('\nDEMO / THANKS PAGES (any URL containing "demo" or "thank")');
  console.log('--------------------------------------------------');
  const interestingUrls = sorted.filter(u =>
    u.url.toLowerCase().includes('demo') || u.url.toLowerCase().includes('thank')
  );
  if (interestingUrls.length === 0) {
    console.log('(none — neither "demo" nor "thank" appears in any URL)');
  } else {
    for (const row of interestingUrls) {
      console.log(`${String(row.sessions).padStart(8)}  ${String(row.exits).padStart(5)}  ${row.url}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
