/**
 * Google Search Console API client
 * Wraps googleapis to fetch search analytics and property data.
 * Token refresh is handled automatically via the stored Account record.
 */

import { google } from 'googleapis';
import { prisma } from '@/lib/db/client';

// ---------------------------------------------------------------------------
// OAuth2 client for GSC API calls
// ---------------------------------------------------------------------------

async function getOAuth2Client(userId: string) {
  // Prefer the GSC-specific account record; fall back to any google account
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google', providerAccountId: `gsc-${userId}` },
    select: { access_token: true, refresh_token: true, expires_at: true, id: true },
  }) ?? await prisma.account.findFirst({
    where: { userId, provider: 'google' },
    select: { access_token: true, refresh_token: true, expires_at: true, id: true },
  });

  if (!account?.access_token) {
    throw new Error('No Google account linked for this user');
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  // Auto-refresh if expired
  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at < now && account.refresh_token) {
    const { credentials } = await oauth2.refreshAccessToken();
    oauth2.setCredentials(credentials);

    // Persist new tokens
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: credentials.access_token,
        expires_at: credentials.expiry_date
          ? Math.floor(credentials.expiry_date / 1000)
          : undefined,
      },
    });
  }

  return oauth2;
}

// ---------------------------------------------------------------------------
// List available GSC properties for a user
// ---------------------------------------------------------------------------

export interface GscProperty {
  siteUrl: string;
  permissionLevel: string;
}

export async function listGscProperties(userId: string): Promise<GscProperty[]> {
  const auth = await getOAuth2Client(userId);
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const res = await searchconsole.sites.list();
  return (res.data.siteEntry ?? []).map(entry => ({
    siteUrl: entry.siteUrl ?? '',
    permissionLevel: entry.permissionLevel ?? 'unknown',
  }));
}

// ---------------------------------------------------------------------------
// Fetch search analytics — per-keyword per-day
// ---------------------------------------------------------------------------

export interface KeywordRow {
  keyword: string;
  date: string;
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
}

export async function fetchKeywordData(
  userId: string,
  propertyUrl: string,
  startDate: string,
  endDate: string,
): Promise<KeywordRow[]> {
  const auth = await getOAuth2Client(userId);
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const rows: KeywordRow[] = [];
  let startRow = 0;
  const rowLimit = 25000;

  while (true) {
    const res = await searchconsole.searchanalytics.query({
      siteUrl: propertyUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query', 'date'],
        rowLimit,
        startRow,
      },
    });

    const batch = res.data.rows ?? [];
    for (const row of batch) {
      rows.push({
        keyword: row.keys?.[0] ?? '',
        date: row.keys?.[1] ?? '',
        position: row.position ?? 0,
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: (row.ctr ?? 0) * 100, // GSC returns 0-1, we store 0-100
      });
    }

    if (batch.length < rowLimit) break;
    startRow += rowLimit;
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Fetch daily traffic aggregates
// ---------------------------------------------------------------------------

export interface DailyTrafficRow {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function fetchDailyTraffic(
  userId: string,
  propertyUrl: string,
  startDate: string,
  endDate: string,
): Promise<DailyTrafficRow[]> {
  const auth = await getOAuth2Client(userId);
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const res = await searchconsole.searchanalytics.query({
    siteUrl: propertyUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['date'],
      rowLimit: 25000,
    },
  });

  return (res.data.rows ?? []).map(row => ({
    date: row.keys?.[0] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: (row.ctr ?? 0) * 100,
    position: row.position ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Full sync — called by Inngest job and API route
// Fetches GSC data and writes to DB for a given site
// ---------------------------------------------------------------------------

export async function syncGscData(siteId: string): Promise<{ daysImported: number; keywordsImported: number }> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { gscConnected: true, gscPropertyUrl: true, gscConnectedByUserId: true, gscLastSyncAt: true },
  });

  if (!site?.gscConnected || !site.gscPropertyUrl || !site.gscConnectedByUserId) {
    return { daysImported: 0, keywordsImported: 0 };
  }

  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 3); // GSC data delay
  const startDate = site.gscLastSyncAt
    ? new Date(site.gscLastSyncAt)
    : new Date(Date.now() - 90 * 86400000);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  if (startStr >= endStr) return { daysImported: 0, keywordsImported: 0 };

  const [dailyTraffic, keywordRows] = await Promise.all([
    fetchDailyTraffic(site.gscConnectedByUserId, site.gscPropertyUrl, startStr, endStr),
    fetchKeywordData(site.gscConnectedByUserId, site.gscPropertyUrl, startStr, endStr),
  ]);

  // Write traffic snapshots
  if (dailyTraffic.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const day of dailyTraffic) {
        await tx.seoTrafficSnapshot.upsert({
          where: { siteId_date: { siteId, date: new Date(day.date) } },
          create: { siteId, date: new Date(day.date), clicks: day.clicks, impressions: day.impressions, ctr: day.ctr, avgPosition: day.position, organicSessions: day.clicks, totalSessions: day.clicks, organicPct: 100 },
          update: { clicks: day.clicks, impressions: day.impressions, ctr: day.ctr, avgPosition: day.position, organicSessions: day.clicks },
        });
      }
    });
  }

  // Write keyword rankings in chunks
  const CHUNK = 500;
  for (let i = 0; i < keywordRows.length; i += CHUNK) {
    const chunk = keywordRows.slice(i, i + CHUNK);
    await prisma.$transaction(async (tx) => {
      for (const kw of chunk) {
        await tx.seoKeywordRanking.upsert({
          where: { siteId_keyword_date: { siteId, keyword: kw.keyword, date: new Date(kw.date) } },
          create: { siteId, date: new Date(kw.date), keyword: kw.keyword, position: kw.position, clicks: kw.clicks, impressions: kw.impressions, ctr: kw.ctr },
          update: { position: kw.position, clicks: kw.clicks, impressions: kw.impressions, ctr: kw.ctr },
        });
      }
    });
  }

  // Update keyword buckets on latest traffic snapshot
  const latestDate = dailyTraffic.length > 0 ? dailyTraffic[dailyTraffic.length - 1].date : endStr;
  const latestKw = keywordRows.filter(kw => kw.date === latestDate);
  if (latestDate) {
    await prisma.seoTrafficSnapshot.update({
      where: { siteId_date: { siteId, date: new Date(latestDate) } },
      data: {
        keywordsTop3: latestKw.filter(kw => kw.position <= 3).length,
        keywordsTop10: latestKw.filter(kw => kw.position <= 10).length,
        keywordsTop30: latestKw.filter(kw => kw.position <= 30).length,
        keywordsTotal: latestKw.length,
      },
    }).catch(() => {});
  }

  await prisma.site.update({ where: { id: siteId }, data: { gscLastSyncAt: new Date() } });

  return { daysImported: dailyTraffic.length, keywordsImported: keywordRows.length };
}
