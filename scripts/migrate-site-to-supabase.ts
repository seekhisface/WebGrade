#!/usr/bin/env tsx
/**
 * Migrate all data for a single site from one PostgreSQL database to another.
 * Designed for copying staging data into a Supabase dev database.
 *
 * Usage:
 *   SOURCE_DATABASE_URL=<staging-url> TARGET_DATABASE_URL=<supabase-url> \
 *     npx tsx scripts/migrate-site-to-supabase.ts --siteId=<id> [--days=90]
 *
 * What it copies:
 *   - Organization (shell record only, no users/memberships)
 *   - Site (including Google integration connection fields)
 *   - SiteOnboarding, SiteInstallation, SiteBaseline, SiteHealthCheck
 *   - ConversionGoal
 *   - VisitorSession, SessionEvent, PageView (limited by --days)
 *   - SeoKeywordRanking, SeoTrafficSnapshot, SeoCrawl, SeoPageResult
 *   - AdSource, GadsCampaignMetric
 *   - Report, ArchivedReport, Recommendation, MeasurementJob, ImpactReport
 *   - Alert, AlertSetting
 *   - WebOppAnalysis, WebOppKeywordCluster
 *   - MonthlyPerformanceReport, ReportDistribution
 *   - CompetitorSnapshot, SnippetRetentionTarget
 *
 * What it skips:
 *   - Users, accounts, sessions (keep your dev users)
 *   - OrgMember records (keep your dev org memberships)
 *   - DpaAcceptance, DataRetentionLog (not useful for dev)
 *   - Google OAuth tokens (nulled out — re-connect integrations in dev)
 */

import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SOURCE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_URL = process.env.TARGET_DATABASE_URL;

if (!SOURCE_URL || !TARGET_URL) {
  console.error('Error: SOURCE_DATABASE_URL and TARGET_DATABASE_URL must be set');
  process.exit(1);
}

const args = process.argv.slice(2);
const siteId = args.find(a => a.startsWith('--siteId='))?.split('=')[1];
const days = parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1] ?? '90', 10);

if (!siteId) {
  console.error('Usage: npx tsx scripts/migrate-site-to-supabase.ts --siteId=<id> [--days=90]');
  process.exit(1);
}

const source = new PrismaClient({ datasources: { db: { url: SOURCE_URL } } });
const target = new PrismaClient({ datasources: { db: { url: TARGET_URL } } });

const BATCH = 500;
const since = new Date();
since.setDate(since.getDate() - days);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function upsertBatch<T extends Record<string, any>>(
  label: string,
  records: T[],
  upsertFn: (record: T) => Promise<any>,
) {
  if (records.length === 0) {
    log(`  ${label}: 0 records — skipping`);
    return;
  }
  let count = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    await Promise.all(chunk.map(upsertFn));
    count += chunk.length;
    if (records.length > BATCH) log(`  ${label}: ${count}/${records.length}…`);
  }
  log(`  ${label}: ${records.length} records done`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log(`Starting migration for siteId=${siteId}, last ${days} days of behavioral data`);

  // --- Site + Org -----------------------------------------------------------

  const site = await source.site.findUnique({ where: { id: siteId! } });
  if (!site) {
    console.error(`Site ${siteId} not found in source database`);
    process.exit(1);
  }

  const org = await source.organization.findUnique({ where: { id: site.orgId } });
  if (!org) {
    console.error(`Organization ${site.orgId} not found`);
    process.exit(1);
  }

  log(`Migrating site: ${site.domain} (org: ${org.name})`);

  // Upsert org — shell record only, no users or memberships
  await target.organization.upsert({
    where: { id: org.id },
    create: { id: org.id, name: org.name, plan: org.plan, createdAt: org.createdAt, updatedAt: org.updatedAt },
    update: { name: org.name, plan: org.plan },
  });
  log('  Organization: done');

  // Upsert site — null out Google user references (user IDs won't match in dev)
  await target.site.upsert({
    where: { id: site.id },
    create: {
      ...site,
      gscConnectedByUserId: null,
      gadsConnectedByUserId: null,
      ga4ConnectedByUserId: null,
    },
    update: {
      ...site,
      gscConnectedByUserId: null,
      gadsConnectedByUserId: null,
      ga4ConnectedByUserId: null,
    },
  });
  log('  Site: done');

  // --- Site config tables ---------------------------------------------------

  const onboarding = await source.siteOnboarding.findUnique({ where: { siteId: siteId! } });
  if (onboarding) {
    await target.siteOnboarding.upsert({
      where: { siteId: siteId! },
      // Strip OAuth tokens — re-connect integrations in dev
      create: { ...onboarding, ga4AccessToken: null, ga4RefreshToken: null },
      update: { ...onboarding, ga4AccessToken: null, ga4RefreshToken: null },
    });
    log('  SiteOnboarding: done');
  }

  const installation = await source.siteInstallation.findUnique({ where: { siteId: siteId! } });
  if (installation) {
    await target.siteInstallation.upsert({
      where: { siteId: siteId! },
      create: installation,
      update: installation,
    });
    log('  SiteInstallation: done');
  }

  const healthCheck = await source.siteHealthCheck.findFirst({ where: { siteId: siteId! }, orderBy: { createdAt: 'desc' } });
  if (healthCheck) {
    await target.siteHealthCheck.upsert({
      where: { id: healthCheck.id },
      create: healthCheck,
      update: healthCheck,
    });
    log('  SiteHealthCheck: done');
  }

  const baselines = await source.siteBaseline.findMany({ where: { siteId: siteId! } });
  await upsertBatch('SiteBaseline', baselines, r =>
    target.siteBaseline.upsert({ where: { id: r.id }, create: r, update: r })
  );

  const goals = await source.conversionGoal.findMany({ where: { siteId: siteId! } });
  await upsertBatch('ConversionGoal', goals, r =>
    target.conversionGoal.upsert({ where: { id: r.id }, create: r, update: r })
  );

  // --- Behavioral data (date-limited) ---------------------------------------

  log(`Fetching behavioral data since ${since.toISOString().split('T')[0]}…`);

  const sessions = await source.visitorSession.findMany({
    where: { siteId: siteId!, createdAt: { gte: since } },
  });
  await upsertBatch('VisitorSession', sessions, r =>
    target.visitorSession.upsert({
      where: { siteId_sessionId: { siteId: r.siteId, sessionId: r.sessionId } },
      create: r,
      update: r,
    })
  );

  if (sessions.length > 0) {
    const sessionIds = sessions.map(s => s.sessionId);

    const events = await source.sessionEvent.findMany({
      where: { siteId: siteId!, sessionId: { in: sessionIds } },
    });
    await upsertBatch('SessionEvent', events, r =>
      target.sessionEvent.upsert({ where: { id: r.id }, create: r, update: r })
    );

    const pageViews = await source.pageView.findMany({
      where: { siteId: siteId!, sessionId: { in: sessionIds } },
    });
    await upsertBatch('PageView', pageViews, r =>
      target.pageView.upsert({ where: { id: r.id }, create: r, update: r })
    );
  }

  // --- Google Search Console data -------------------------------------------

  const seoTraffic = await source.seoTrafficSnapshot.findMany({
    where: { siteId: siteId!, date: { gte: since } },
  });
  await upsertBatch('SeoTrafficSnapshot', seoTraffic, r =>
    target.seoTrafficSnapshot.upsert({
      where: { siteId_date: { siteId: r.siteId, date: r.date } },
      create: r,
      update: r,
    })
  );

  const keywords = await source.seoKeywordRanking.findMany({
    where: { siteId: siteId!, date: { gte: since } },
  });
  await upsertBatch('SeoKeywordRanking', keywords, r =>
    target.seoKeywordRanking.upsert({
      where: { siteId_keyword_date: { siteId: r.siteId, keyword: r.keyword, date: r.date } },
      create: r,
      update: r,
    })
  );

  const crawls = await source.seoCrawl.findMany({ where: { siteId: siteId! } });
  await upsertBatch('SeoCrawl', crawls, r =>
    target.seoCrawl.upsert({ where: { id: r.id }, create: r, update: r })
  );

  if (crawls.length > 0) {
    const crawlIds = crawls.map(c => c.id);
    const crawlPages = await source.seoPageResult.findMany({
      where: { siteId: siteId!, crawlId: { in: crawlIds } },
    });
    await upsertBatch('SeoPageResult', crawlPages, r =>
      target.seoPageResult.upsert({ where: { id: r.id }, create: r, update: r })
    );
  }

  // --- Google Ads data ------------------------------------------------------

  const adSources = await source.adSource.findMany({ where: { siteId: siteId! } });
  await upsertBatch('AdSource', adSources, r =>
    target.adSource.upsert({
      where: { siteId_source_medium_campaign: { siteId: r.siteId, source: r.source, medium: r.medium, campaign: r.campaign } },
      create: r,
      update: r,
    })
  );

  const gadsCampaigns = await source.gadsCampaignMetric.findMany({
    where: { siteId: siteId!, date: { gte: since } },
  });
  await upsertBatch('GadsCampaignMetric', gadsCampaigns, r =>
    target.gadsCampaignMetric.upsert({
      where: { siteId_campaignId_date: { siteId: r.siteId, campaignId: r.campaignId, date: r.date } },
      create: r,
      update: r,
    })
  );

  // --- Reports & recommendations --------------------------------------------

  const reports = await source.report.findMany({ where: { siteId: siteId! } });
  await upsertBatch('Report', reports, r =>
    target.report.upsert({ where: { id: r.id }, create: r, update: r })
  );

  const archivedReports = await source.archivedReport.findMany({ where: { siteId: siteId! } });
  await upsertBatch('ArchivedReport', archivedReports, r =>
    target.archivedReport.upsert({ where: { id: r.id }, create: r, update: r })
  );

  const recommendations = await source.recommendation.findMany({ where: { siteId: siteId! } });
  await upsertBatch('Recommendation', recommendations, r =>
    target.recommendation.upsert({ where: { id: r.id }, create: r, update: r })
  );

  const measurementJobs = await source.measurementJob.findMany({ where: { siteId: siteId! } });
  await upsertBatch('MeasurementJob', measurementJobs, r =>
    target.measurementJob.upsert({ where: { id: r.id }, create: r, update: r })
  );

  const impactReports = await source.impactReport.findMany({ where: { siteId: siteId! } });
  await upsertBatch('ImpactReport', impactReports, r =>
    target.impactReport.upsert({ where: { id: r.id }, create: r, update: r })
  );

  const monthlyReports = await source.monthlyPerformanceReport.findMany({ where: { siteId: siteId! } });
  await upsertBatch('MonthlyPerformanceReport', monthlyReports, r =>
    target.monthlyPerformanceReport.upsert({
      where: { siteId_year_month: { siteId: r.siteId, year: r.year, month: r.month } },
      create: r,
      update: r,
    })
  );

  // --- Alerts ---------------------------------------------------------------

  const alerts = await source.alert.findMany({ where: { siteId: siteId! } });
  await upsertBatch('Alert', alerts, r =>
    target.alert.upsert({ where: { id: r.id }, create: r, update: r })
  );

  const alertSettings = await source.alertSetting.findMany({ where: { siteId: siteId! } });
  await upsertBatch('AlertSetting', alertSettings, r =>
    target.alertSetting.upsert({ where: { id: r.id }, create: r, update: r })
  );

  // --- WebOpp ---------------------------------------------------------------

  const webOppAnalyses = await source.webOppAnalysis.findMany({ where: { siteId: siteId! } });
  await upsertBatch('WebOppAnalysis', webOppAnalyses, r =>
    target.webOppAnalysis.upsert({ where: { id: r.id }, create: r, update: r })
  );

  if (webOppAnalyses.length > 0) {
    const analysisIds = webOppAnalyses.map(a => a.id);
    const clusters = await source.webOppKeywordCluster.findMany({
      where: { siteId: siteId!, analysisId: { in: analysisIds } },
    });
    await upsertBatch('WebOppKeywordCluster', clusters, r =>
      target.webOppKeywordCluster.upsert({ where: { id: r.id }, create: r, update: r })
    );
  }

  // --- Misc -----------------------------------------------------------------

  const competitors = await source.competitorSnapshot.findMany({ where: { siteId: siteId! } });
  await upsertBatch('CompetitorSnapshot', competitors, r =>
    target.competitorSnapshot.upsert({ where: { id: r.id }, create: r, update: r })
  );

  const retentionTargets = await source.snippetRetentionTarget.findMany({ where: { siteId: siteId! } });
  await upsertBatch('SnippetRetentionTarget', retentionTargets, r =>
    target.snippetRetentionTarget.upsert({ where: { id: r.id }, create: r, update: r })
  );

  const distributions = await source.reportDistribution.findMany({ where: { siteId: siteId! } });
  await upsertBatch('ReportDistribution', distributions, r =>
    target.reportDistribution.upsert({ where: { id: r.id }, create: r, update: r })
  );

  log('Migration complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
