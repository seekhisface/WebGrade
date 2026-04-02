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
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google' },
    select: {
      access_token: true,
      refresh_token: true,
      expires_at: true,
      id: true,
    },
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
