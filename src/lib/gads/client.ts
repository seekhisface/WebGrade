/**
 * Google Ads API client for WebGrade.
 *
 * Uses google-ads-api package to fetch:
 * - Accessible customer (account) IDs
 * - Campaign-level spend, clicks, impressions, conversions per day
 *
 * Requires:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET — same OAuth app as GSC
 *   GOOGLE_ADS_DEVELOPER_TOKEN — from Google Ads API Center
 *   Optional: GOOGLE_ADS_LOGIN_CUSTOMER_ID — for MCC (manager) accounts
 */

import { GoogleAdsApi, enums } from 'google-ads-api';
import { google } from 'googleapis';
import { prisma } from '@/lib/db/client';

// ---------------------------------------------------------------------------
// Token management — reuses the same Account table as GSC
// ---------------------------------------------------------------------------

async function getOAuthTokens(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google' },
  });

  if (!account?.refresh_token) {
    throw new Error('No Google account with refresh token found for this user');
  }

  // Check if token needs refresh
  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at < now + 60) {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2.setCredentials({ refresh_token: account.refresh_token });
    const { credentials } = await oauth2.refreshAccessToken();

    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: credentials.access_token,
        expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : undefined,
      },
    });

    return {
      accessToken: credentials.access_token!,
      refreshToken: account.refresh_token,
    };
  }

  return {
    accessToken: account.access_token!,
    refreshToken: account.refresh_token,
  };
}

// ---------------------------------------------------------------------------
// Google Ads API client factory
// ---------------------------------------------------------------------------

function createClient(refreshToken: string) {
  return new GoogleAdsApi({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });
}

function getCustomer(client: GoogleAdsApi, customerId: string, refreshToken: string) {
  return client.Customer({
    customer_id: customerId,
    refresh_token: refreshToken,
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  });
}

// ---------------------------------------------------------------------------
// List accessible Google Ads accounts
// ---------------------------------------------------------------------------

export interface GadsAccount {
  customerId: string;
  descriptiveName: string;
  currencyCode: string;
  isManager: boolean;
}

export async function listAccessibleAccounts(userId: string): Promise<GadsAccount[]> {
  const { refreshToken } = await getOAuthTokens(userId);
  const client = createClient(refreshToken);

  // Use the top-level client method to list accessible customers
  const response = await client.listAccessibleCustomers(refreshToken);
  const resourceNames: string[] = (response as unknown as { resource_names: string[] }).resource_names ?? [];
  const accounts: GadsAccount[] = [];

  for (const resourceName of resourceNames) {
    const customerId = resourceName.replace('customers/', '');
    try {
      const customer = getCustomer(client, customerId, refreshToken);
      const result = await customer.query(`
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.manager
        FROM customer
        LIMIT 1
      `);
      if (result.length > 0) {
        const c = result[0].customer;
        accounts.push({
          customerId: String(c?.id ?? customerId),
          descriptiveName: c?.descriptive_name ?? customerId,
          currencyCode: c?.currency_code ?? 'USD',
          isManager: c?.manager ?? false,
        });
      }
    } catch (err) {
      // Skip accounts we can't access (common with MCC setups)
      console.warn(`[gads] Can't access account ${customerId}:`, (err as Error).message);
    }
  }

  return accounts;
}

// ---------------------------------------------------------------------------
// Fetch campaign-level spend data for a date range
// ---------------------------------------------------------------------------

export interface CampaignDayMetric {
  date: string;         // YYYY-MM-DD
  campaignId: string;
  campaignName: string;
  campaignType: string;
  status: string;
  costMicros: bigint;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
}

export async function fetchCampaignMetrics(
  userId: string,
  customerId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string,
): Promise<CampaignDayMetric[]> {
  const { refreshToken } = await getOAuthTokens(userId);
  const client = createClient(refreshToken);
  const customer = getCustomer(client, customerId.replace(/-/g, ''), refreshToken);

  const results = await customer.query(`
    SELECT
      segments.date,
      campaign.id,
      campaign.name,
      campaign.advertising_channel_type,
      campaign.status,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date DESC, metrics.cost_micros DESC
  `);

  return results.map(row => ({
    date: row.segments?.date ?? startDate,
    campaignId: String(row.campaign?.id ?? ''),
    campaignName: row.campaign?.name ?? 'Unknown',
    campaignType: row.campaign?.advertising_channel_type
      ? String(enums.AdvertisingChannelType[row.campaign.advertising_channel_type] ?? row.campaign.advertising_channel_type)
      : 'UNKNOWN',
    status: row.campaign?.status
      ? String(enums.CampaignStatus[row.campaign.status] ?? row.campaign.status)
      : 'UNKNOWN',
    costMicros: BigInt(row.metrics?.cost_micros ?? 0),
    impressions: row.metrics?.impressions ?? 0,
    clicks: row.metrics?.clicks ?? 0,
    conversions: row.metrics?.conversions ?? 0,
    conversionValue: row.metrics?.conversions_value ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Sync campaign data to database
// ---------------------------------------------------------------------------

export async function syncCampaignData(
  siteId: string,
  userId: string,
  customerId: string,
  daysBack = 30,
): Promise<{ synced: number; totalSpend: number }> {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - daysBack * 86400000).toISOString().split('T')[0];

  const metrics = await fetchCampaignMetrics(userId, customerId, startDate, endDate);

  let totalSpend = 0;

  // Batch upsert
  for (const m of metrics) {
    const costUsd = Number(m.costMicros) / 1_000_000;
    totalSpend += costUsd;

    await prisma.gadsCampaignMetric.upsert({
      where: {
        siteId_campaignId_date: {
          siteId,
          campaignId: m.campaignId,
          date: new Date(m.date),
        },
      },
      create: {
        siteId,
        date: new Date(m.date),
        campaignId: m.campaignId,
        campaignName: m.campaignName,
        campaignType: m.campaignType,
        status: m.status,
        costMicros: m.costMicros,
        impressions: m.impressions,
        clicks: m.clicks,
        conversions: m.conversions,
        conversionValue: m.conversionValue,
        cpc: m.clicks > 0 ? costUsd / m.clicks : null,
        ctr: m.impressions > 0 ? m.clicks / m.impressions : null,
        costPerConversion: m.conversions > 0 ? costUsd / m.conversions : null,
      },
      update: {
        campaignName: m.campaignName,
        campaignType: m.campaignType,
        status: m.status,
        costMicros: m.costMicros,
        impressions: m.impressions,
        clicks: m.clicks,
        conversions: m.conversions,
        conversionValue: m.conversionValue,
        cpc: m.clicks > 0 ? costUsd / m.clicks : null,
        ctr: m.impressions > 0 ? m.clicks / m.impressions : null,
        costPerConversion: m.conversions > 0 ? costUsd / m.conversions : null,
      },
    });
  }

  // Also sync totals into the AdSource table for wasted spend analysis
  const campaignTotals = new Map<string, { spend: number; clicks: number; impressions: number }>();
  for (const m of metrics) {
    const key = m.campaignName;
    const existing = campaignTotals.get(key) ?? { spend: 0, clicks: 0, impressions: 0 };
    existing.spend += Number(m.costMicros) / 1_000_000;
    existing.clicks += m.clicks;
    existing.impressions += m.impressions;
    campaignTotals.set(key, existing);
  }

  for (const [campaign, totals] of campaignTotals) {
    await prisma.adSource.upsert({
      where: { siteId_source_medium_campaign: { siteId, source: 'google', medium: 'cpc', campaign } },
      create: {
        siteId,
        source: 'google',
        medium: 'cpc',
        campaign,
        platformSpend: totals.spend,
        platformClicks: totals.clicks,
        platformImpressions: totals.impressions,
        platformCpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
      },
      update: {
        platformSpend: totals.spend,
        platformClicks: totals.clicks,
        platformImpressions: totals.impressions,
        platformCpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
      },
    });
  }

  // Update site sync timestamp
  await prisma.site.update({
    where: { id: siteId },
    data: { gadsLastSyncAt: new Date() },
  });

  return { synced: metrics.length, totalSpend: Math.round(totalSpend * 100) / 100 };
}
