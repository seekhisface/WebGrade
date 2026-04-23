/**
 * Google Analytics 4 API client
 * Wraps googleapis to fetch GA4 properties and run reports.
 * Token refresh is handled automatically via the stored Account record.
 */

import { google } from 'googleapis';
import { prisma } from '@/lib/db/client';

// ---------------------------------------------------------------------------
// OAuth2 client for GA4 API calls (same pattern as GSC)
// ---------------------------------------------------------------------------

async function getGa4Auth(siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { ga4ConnectedByUserId: true },
  });

  if (!site?.ga4ConnectedByUserId) {
    throw new Error('No GA4 connection found for this site');
  }

  const account = await prisma.account.findFirst({
    where: { userId: site.ga4ConnectedByUserId, provider: 'google' },
    select: { access_token: true, refresh_token: true, expires_at: true, id: true },
  });

  if (!account?.access_token && !account?.refresh_token) {
    throw new Error('No Google account tokens found — please reconnect Google Analytics');
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
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: credentials.access_token,
        expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : undefined,
      },
    });
  }

  return oauth2;
}

// ---------------------------------------------------------------------------
// List accessible GA4 properties via Analytics Admin API
// ---------------------------------------------------------------------------

export interface Ga4Property {
  name: string;       // resource name, e.g. "properties/123456"
  displayName: string;
  account: string;
}

export async function listGa4Properties(siteId: string): Promise<Ga4Property[]> {
  const auth = await getGa4Auth(siteId);
  const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth });

  const res = await analyticsAdmin.accountSummaries.list({ pageSize: 200 });
  const properties: Ga4Property[] = [];

  for (const accountSummary of res.data.accountSummaries ?? []) {
    const accountName = accountSummary.displayName ?? accountSummary.account ?? 'Unknown';
    for (const prop of accountSummary.propertySummaries ?? []) {
      properties.push({
        name: prop.property ?? '',
        displayName: prop.displayName ?? 'Unnamed Property',
        account: accountName,
      });
    }
  }

  return properties;
}

// ---------------------------------------------------------------------------
// Import GA4 baseline — fetches 90 days of metrics and stores in SiteBaseline
// ---------------------------------------------------------------------------

export async function importGa4Baseline(
  siteId: string,
  propertyId: string,
): Promise<{ metricsImported: number }> {
  const auth = await getGa4Auth(siteId);
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });

  // Calculate 90-day date range
  const endDate = new Date();
  const startDate = new Date(Date.now() - 90 * 86400000);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  // Run GA4 Data API report
  const res = await analyticsData.properties.runReport({
    property: propertyId,
    requestBody: {
      dateRanges: [{ startDate: startStr, endDate: endStr }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'conversions' },
        { name: 'screenPageViews' },
      ],
    },
  });

  // Parse the response — GA4 returns rows with metric values
  const row = res.data.rows?.[0];
  if (!row?.metricValues) {
    throw new Error('No data returned from GA4 for the specified date range');
  }

  const metricNames = [
    'sessions_90d',
    'total_users_90d',
    'bounce_rate',
    'avg_session_duration',
    'conversions_90d',
    'page_views_90d',
  ];

  const period = `${startStr}_to_${endStr}`;
  const baselines = metricNames.map((metricKey, i) => ({
    siteId,
    metricKey,
    value: parseFloat(row.metricValues![i]?.value ?? '0'),
    period,
    source: 'ga4_import',
  }));

  // Write baselines in a transaction
  await prisma.$transaction(async (tx) => {
    // Delete existing ga4_import baselines for this site (replace old import)
    await tx.siteBaseline.deleteMany({
      where: { siteId, source: 'ga4_import' },
    });

    // Create new baselines
    await tx.siteBaseline.createMany({ data: baselines });
  });

  // Update site and onboarding records
  await prisma.site.update({
    where: { id: siteId },
    data: { ga4PropertyId: propertyId, ga4LastSyncAt: new Date() },
  });

  await prisma.siteOnboarding.updateMany({
    where: { siteId },
    data: {
      ga4PropertyId: propertyId,
      ga4BaselineImportedAt: new Date(),
    },
  });

  return { metricsImported: baselines.length };
}

// ---------------------------------------------------------------------------
// Daily sync — fetches recent GA4 data for a connected site
// Called by Inngest job
// ---------------------------------------------------------------------------

export async function syncGa4Data(siteId: string): Promise<{ metricsUpdated: number }> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      ga4Connected: true,
      ga4PropertyId: true,
      ga4ConnectedByUserId: true,
      ga4LastSyncAt: true,
    },
  });

  if (!site?.ga4Connected || !site.ga4PropertyId || !site.ga4ConnectedByUserId) {
    return { metricsUpdated: 0 };
  }

  const auth = await getGa4Auth(siteId);
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });

  // Sync last 7 days of data
  const endDate = new Date();
  const startDate = new Date(Date.now() - 7 * 86400000);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const res = await analyticsData.properties.runReport({
    property: site.ga4PropertyId,
    requestBody: {
      dateRanges: [{ startDate: startStr, endDate: endStr }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'conversions' },
        { name: 'screenPageViews' },
      ],
    },
  });

  const rows = res.data.rows ?? [];

  // Store daily snapshots in SiteBaseline with day-level granularity
  for (const row of rows) {
    const date = row.dimensionValues?.[0]?.value ?? '';
    if (!date) continue;

    const metricKeys = [
      'sessions',
      'total_users',
      'bounce_rate',
      'avg_session_duration',
      'conversions',
      'page_views',
    ];

    for (let i = 0; i < metricKeys.length; i++) {
      const value = parseFloat(row.metricValues?.[i]?.value ?? '0');
      const metricKey = `ga4_daily_${metricKeys[i]}`;
      const period = date;

      // Upsert: delete existing then create
      await prisma.siteBaseline.deleteMany({
        where: { siteId, metricKey, period, source: 'ga4_sync' },
      });
      await prisma.siteBaseline.create({
        data: { siteId, metricKey, value, period, source: 'ga4_sync' },
      });
    }
  }

  // Update last sync timestamp
  await prisma.site.update({
    where: { id: siteId },
    data: { ga4LastSyncAt: new Date() },
  });

  return { metricsUpdated: rows.length * 6 };
}
