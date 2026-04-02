/**
 * Seed "Mike's Demo Org" site under Mike Stephens' GSV organization
 * Run with: npx tsx scripts/seed-mike-demo.ts
 *
 * Uses Supabase transaction-mode pooler (port 6543)
 */

import { PrismaClient, IntentClass, ReportStatus, ReportType, SourceModule, FixType, TaskStatus, AlertType, AlertSeverity } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Mike\'s Demo Org...');

  // Find Mike's user and GSV org
  const mike = await prisma.user.findUnique({
    where: { email: 'mike.stephensjr@gmail.com' },
    select: { id: true },
  });
  if (!mike) throw new Error('Mike Stephens not found');

  const membership = await prisma.orgMember.findFirst({
    where: { userId: mike.id },
    select: { orgId: true },
  });
  if (!membership) throw new Error('Mike has no org membership');

  const orgId = membership.orgId;
  console.log('Found Mike in org:', orgId);

  // ── 1. Create the demo site ──────────────────────────────────────────────
  const existingSite = await prisma.site.findFirst({ where: { domain: 'mikes-demo.webgrade.io' } });

  const site = existingSite ?? await prisma.site.create({
    data: {
      orgId,
      name: "Mike's Demo Org",
      domain: 'mikes-demo.webgrade.io',
      url: 'https://mikes-demo.webgrade.io',
      platform: 'NEXT_JS',
      industry: 'HR Software / SaaS',
      hasInterimReport: true,
      hasWebWatch: true,
      hasWebOpp: true,
    },
  });
  console.log('Site created:', site.id);

  // ── 2. Onboarding ────────────────────────────────────────────────────────
  await prisma.siteOnboarding.upsert({
    where: { siteId: site.id },
    update: {},
    create: {
      siteId: site.id,
      conversionGoalUrl: 'https://novapulsehr.com/trial/welcome',
      conversionGoalName: 'Free trial started',
      businessDescription: 'NovaPulse HR is a cloud-based HR platform for mid-market companies (50-500 employees). We replace manual onboarding spreadsheets with automated workflows. Our main competitors are BambooHR and Rippling. Average deal size is $18,000/year.',
      targetAudience: 'HR Directors and VP of People at companies with 50-500 employees, typically in tech, professional services, or healthcare',
      primaryValueProp: 'Cut employee onboarding time from 2 weeks to 2 days with automated workflows',
      competitorUrls: ['https://bamboohr.com', 'https://rippling.com', 'https://workday.com'],
      ga4PropertyId: 'GA4-DEMO-MIKE',
      monthlyAdSpend: 22000,
      averageOrderValue: 18000,
      leadToWinRate: 0.22,
      conversionRate: 0.028,
      isComplete: true,
      completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      completedSteps: [1, 2, 3, 4, 5],
    },
  });
  console.log('Onboarding seeded');

  // ── 3. Baselines ─────────────────────────────────────────────────────────
  const baselineData = [
    { metricKey: 'sessions_90d', value: 48200, period: '2024-Q4', source: 'ga4_import' },
    { metricKey: 'bounce_rate', value: 0.61, period: '2024-Q4', source: 'ga4_import' },
    { metricKey: 'conversion_rate', value: 0.028, period: '2024-Q4', source: 'ga4_import' },
    { metricKey: 'avg_session_duration_s', value: 142, period: '2024-Q4', source: 'ga4_import' },
    { metricKey: 'pages_per_session', value: 2.4, period: '2024-Q4', source: 'ga4_import' },
    { metricKey: 'organic_sessions', value: 18600, period: '2024-Q4', source: 'ga4_import' },
    { metricKey: 'paid_sessions', value: 21400, period: '2024-Q4', source: 'ga4_import' },
  ];

  for (const b of baselineData) {
    await prisma.siteBaseline.upsert({
      where: { id: `baseline-${site.id}-${b.metricKey}` },
      update: {},
      create: { id: `baseline-${site.id}-${b.metricKey}`, siteId: site.id, ...b },
    });
  }
  console.log('Baselines seeded');

  // ── 4. Ad Sources ────────────────────────────────────────────────────────
  const adSources = [
    {
      source: 'google', medium: 'cpc', campaign: 'HR Software - Branded',
      qualityScore: 78, avgIntentScore: 74, conversionRate: 0.041,
      platformSpend: 8400, hasZeroConversions: false, estimatedWastedSpend: 1200,
      landingPageUrl: 'https://novapulsehr.com/lp/google-branded', landingPageAlignScore: 82,
    },
    {
      source: 'google', medium: 'cpc', campaign: 'Competitor - BambooHR Alternative',
      qualityScore: 54, avgIntentScore: 51, conversionRate: 0.009,
      platformSpend: 7200, hasZeroConversions: false, estimatedWastedSpend: 4100,
      hasSlowLandingPage: true,
      landingPageUrl: 'https://novapulsehr.com/lp/bamboohr-alternative', landingPageAlignScore: 41,
    },
    {
      source: 'linkedin', medium: 'paid', campaign: 'HR Director Retargeting',
      qualityScore: 31, avgIntentScore: 29, conversionRate: 0.003,
      platformSpend: 6400, hasZeroConversions: true, estimatedWastedSpend: 5800,
      landingPageUrl: 'https://novapulsehr.com/lp/linkedin', landingPageAlignScore: 28,
    },
  ];

  const adSourceRecords: any[] = [];
  for (const ad of adSources) {
    const record = await prisma.adSource.upsert({
      where: { siteId_source_medium_campaign: { siteId: site.id, source: ad.source, medium: ad.medium, campaign: ad.campaign } },
      update: {},
      create: { siteId: site.id, ...ad },
    });
    adSourceRecords.push(record);
  }
  console.log('Ad sources seeded');

  // ── 5. Visitor Sessions (1,250 sessions over 90 days with PageViews) ────
  const intentClasses: IntentClass[] = ['HIGH', 'HIGH', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'LOW', 'LOW', 'LOW', 'LOW', 'RESEARCHER', 'COMPETITOR', 'BOT'];
  const pageTitles: Record<string, string> = {
    '/': 'Home', '/features': 'Features', '/pricing': 'Pricing', '/about': 'About',
    '/blog/hr-onboarding-guide': 'HR Onboarding Guide', '/signup': 'Sign Up',
    '/contact': 'Contact', '/demo': 'Request Demo',
  };
  const pageUrls = Object.keys(pageTitles);

  const SESSION_COUNT = 1250;
  const sessionBatch: any[] = [];
  const pageViewBatch: any[] = [];

  for (let i = 0; i < SESSION_COUNT; i++) {
    const intentClass = intentClasses[Math.floor(Math.random() * intentClasses.length)];
    const intentScore = intentClass === 'HIGH' ? 75 + Math.floor(Math.random() * 25)
      : intentClass === 'MEDIUM' ? 40 + Math.floor(Math.random() * 30)
      : intentClass === 'LOW' ? 10 + Math.floor(Math.random() * 25)
      : intentClass === 'RESEARCHER' ? 30 + Math.floor(Math.random() * 20)
      : 5 + Math.floor(Math.random() * 15);

    const converted = intentClass === 'HIGH' && Math.random() < 0.1;
    const startedAt = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000);
    const pageCount = 1 + Math.floor(Math.random() * 5);
    const sessionId = `mike-demo-session-${i}`;
    const entryPage = pageUrls[Math.floor(Math.random() * 4)];
    const exitPage = pageUrls[Math.floor(Math.random() * pageUrls.length)];

    sessionBatch.push({
      siteId: site.id,
      sessionId,
      ipHash: `mike-hash-${i}`,
      country: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'][Math.floor(Math.random() * 6)],
      deviceType: ['desktop', 'desktop', 'mobile', 'mobile', 'tablet'][Math.floor(Math.random() * 5)],
      utmSource: ['google', 'linkedin', 'direct', 'organic', 'bing'][Math.floor(Math.random() * 5)],
      utmMedium: ['cpc', 'paid', 'organic', null, null][Math.floor(Math.random() * 5)],
      startedAt,
      durationMs: 30000 + Math.floor(Math.random() * 300000),
      intentScore,
      intentClass,
      isBotFiltered: intentClass === 'BOT',
      pageCount,
      entryPage,
      exitPage,
      conversionGoalHit: converted,
      convertedAt: converted ? new Date(startedAt.getTime() + 180000) : null,
      adSourceId: Math.random() < 0.4 ? adSourceRecords[Math.floor(Math.random() * adSourceRecords.length)].id : null,
    });

    for (let p = 0; p < pageCount; p++) {
      const url = p === 0 ? entryPage : (p === pageCount - 1 ? exitPage : pageUrls[Math.floor(Math.random() * pageUrls.length)]);
      const isExit = p === pageCount - 1;
      const enteredAt = new Date(startedAt.getTime() + p * (30000 + Math.floor(Math.random() * 60000)));

      pageViewBatch.push({
        siteId: site.id,
        sessionId,
        url,
        title: pageTitles[url] ?? url,
        enteredAt,
        exitedAt: isExit ? new Date(enteredAt.getTime() + 10000 + Math.floor(Math.random() * 120000)) : new Date(enteredAt.getTime() + 30000 + Math.floor(Math.random() * 60000)),
        timeOnPageMs: 10000 + Math.floor(Math.random() * 180000),
        maxScrollDepthPct: Math.floor(Math.random() * 100),
        clickCount: Math.floor(Math.random() * 8),
        rageClickCount: Math.random() < 0.05 ? 1 + Math.floor(Math.random() * 3) : 0,
        hesitationCount: Math.random() < 0.15 ? 1 + Math.floor(Math.random() * 2) : 0,
        isExit,
        exitIntentDetected: isExit && Math.random() < 0.3,
        isDropOffPage: isExit && Math.random() < 0.4,
        storylineBreakpoint: isExit && Math.random() < 0.15,
      });
    }
  }

  // Batch insert sessions
  await prisma.visitorSession.createMany({ data: sessionBatch, skipDuplicates: true });
  console.log(`${SESSION_COUNT} visitor sessions seeded`);

  // Fetch back session IDs to map pageviews correctly
  const createdSessions = await prisma.visitorSession.findMany({
    where: { siteId: site.id },
    select: { id: true, sessionId: true },
  });
  const sessionIdMap = new Map(createdSessions.map(s => [s.sessionId, s.id]));

  const mappedPageViews = pageViewBatch.map(pv => ({
    ...pv,
    sessionId: sessionIdMap.get(pv.sessionId) ?? pv.sessionId,
  }));

  await prisma.pageView.createMany({ data: mappedPageViews, skipDuplicates: true });
  console.log(`${mappedPageViews.length} page views seeded`);

  // ── 6. Report ─────────────────────────────────────────────────────────────
  const existingReport = await prisma.report.findFirst({ where: { siteId: site.id } });

  const report = existingReport ?? await prisma.report.create({
    data: {
      siteId: site.id,
      type: ReportType.INTERIM,
      status: ReportStatus.COMPLETE,
      version: 1,
      periodStart: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(),
      executiveSummary: `NovaPulse HR is losing an estimated $41,200/month in recoverable revenue from three fixable issues. Your LinkedIn retargeting campaign is generating zero conversions on $6,400/month of spend — visitor intent scores from this source average 29/100, meaning you're reaching the wrong audience entirely. Your competitor comparison landing page has a 4.2-second load time and 71% exit rate, costing you the highest-intent prospects you're paying most to reach. And your pricing page has an 84% exit rate with average scroll depth of 31% — visitors are leaving before they see your pricing tiers. Fix these three issues and the model projects a 34% increase in trial starts within 60 days.`,
      behavioralSummary: `62% of paid traffic exits on the first page visited. High-intent sessions (scoring 75+) have a 4.1% conversion rate — 3x your site average — but only represent 18% of traffic. The /pricing page has the highest exit rate at 84% with average scroll depth of 31%, meaning most visitors leave before seeing your price tiers. Rage clicks are concentrated on the "See Pricing" CTA on the homepage (47 rage clicks in 30 days), suggesting CTA placement or loading friction.`,
      adSpendSummary: `Total monthly ad spend: $22,000. Estimated wasted spend: $11,100 (50.5%). LinkedIn retargeting ($6,400/mo) is generating 3 conversions in 30 days at $2,133 CPA — 47x your target CPA. The BambooHR Alternative campaign landing page loads in 4.2 seconds on mobile; pages over 3 seconds see a 53% abandonment increase. Google Branded is your only performing campaign at 4.1% CVR and $205 CPA.`,
      totalWastedSpend: 11100,
      topFindings: [
        { id: 1, title: 'LinkedIn retargeting is burning $6,400/mo with near-zero return', severity: 'critical', module: 'AD_SPEND' },
        { id: 2, title: 'Pricing page exits at 84% — visitors leave before seeing prices', severity: 'high', module: 'BEHAVIORAL' },
        { id: 3, title: 'Competitor comparison page loads in 4.2s — losing high-intent traffic', severity: 'high', module: 'AD_SPEND' },
        { id: 4, title: 'Homepage CTA has 47 rage clicks — friction preventing trial starts', severity: 'medium', module: 'BEHAVIORAL' },
        { id: 5, title: '3 high-volume keywords with 0 ranking — 2,400 missed visits/mo', severity: 'medium', module: 'SEO' },
      ],
      topRecommendations: [
        { id: 1, title: 'Pause LinkedIn retargeting immediately', impact: '$6,400/mo recovered', effort: 'low', priority: 980 },
        { id: 2, title: 'Move pricing above the fold on /pricing page', impact: '+18-28% conversion lift', effort: 'low', priority: 890 },
        { id: 3, title: 'Fix BambooHR landing page load time', impact: '$2,800/mo recovered', effort: 'medium', priority: 820 },
        { id: 4, title: 'Fix homepage CTA loading state', impact: '+8-12% click-through', effort: 'low', priority: 760 },
      ],
      estimatedImpact: '$41,200/month recoverable revenue across 4 high-priority fixes',
      generatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });
  console.log('Report seeded');

  // ── 7. Recommendations ───────────────────────────────────────────────────
  const recs = [
    {
      title: 'Pause LinkedIn retargeting campaign immediately',
      finding: 'LinkedIn retargeting is generating 3 conversions in 30 days at $2,133 CPA. Visitor intent scores average 29/100.',
      fixAction: 'Pause the "HR Director Retargeting" LinkedIn campaign. Reallocate $6,400/mo to Google Branded.',
      expectedResult: '$6,400/month freed up immediately.',
      sourceModule: SourceModule.AD_SPEND, fixType: FixType.AD_SPEND,
      impactScore: 10, effortScore: 1, confidenceScore: 10, priorityScore: 980,
    },
    {
      title: 'Move pricing tiers above the fold on /pricing',
      finding: '/pricing has an 84% exit rate and 31% average scroll depth.',
      fixAction: 'Restructure /pricing: Lead with the pricing table, push value prop below.',
      expectedResult: 'Estimated +18-28% increase in trial starts from /pricing.',
      sourceModule: SourceModule.BEHAVIORAL, fixType: FixType.UX,
      impactScore: 9, effortScore: 3, confidenceScore: 8, priorityScore: 890,
    },
    {
      title: 'Fix BambooHR Alternative page load time (4.2s -> <2s)',
      finding: 'Highest-intent paid traffic lands on a page that loads in 4.2 seconds.',
      fixAction: 'Compress hero image, defer non-critical JS, enable lazy loading.',
      expectedResult: 'Projected CVR lift from 0.9% to 2.1%.',
      sourceModule: SourceModule.AD_SPEND, fixType: FixType.TECHNICAL,
      impactScore: 8, effortScore: 4, confidenceScore: 8, priorityScore: 820,
    },
    {
      title: 'Fix homepage "Start Free Trial" CTA loading state',
      finding: '47 rage clicks on the homepage CTA in 30 days.',
      fixAction: 'Add a loading spinner and disabled state to the CTA button.',
      expectedResult: '+8-12% improvement in CTA click-through rate.',
      sourceModule: SourceModule.BEHAVIORAL, fixType: FixType.TECHNICAL,
      impactScore: 7, effortScore: 3, confidenceScore: 7, priorityScore: 760,
    },
  ];

  for (const rec of recs) {
    await prisma.recommendation.create({
      data: { siteId: site.id, reportId: report.id, status: TaskStatus.TODO, ...rec },
    });
  }
  console.log('Recommendations seeded');

  // ── 8. Alerts ────────────────────────────────────────────────────────────
  await prisma.alert.createMany({
    data: [
      {
        siteId: site.id, alertType: AlertType.ZERO_CONVERSION_CAMPAIGN,
        severity: AlertSeverity.CRITICAL, productModule: SourceModule.AD_SPEND,
        message: 'LinkedIn retargeting campaign has generated 0 conversions in the last 14 days on $3,200 spend.',
        triggeredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        siteId: site.id, alertType: AlertType.BOUNCE_RATE_SPIKE,
        severity: AlertSeverity.HIGH, productModule: SourceModule.BEHAVIORAL,
        message: 'Bounce rate on /pricing jumped from 71% to 84% over the last 7 days.',
        triggeredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        siteId: site.id, alertType: AlertType.WASTED_SPEND_DETECTED,
        severity: AlertSeverity.HIGH, productModule: SourceModule.AD_SPEND,
        message: 'Estimated wasted ad spend this month: $11,100 across 2 campaigns.',
        triggeredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ],
    skipDuplicates: true,
  });
  console.log('Alerts seeded');

  console.log('\nDone!');
  console.log(`  Site ID: ${site.id}`);
  console.log(`  Site name: Mike's Demo Org`);
  console.log(`  Dashboard: /dashboard/${site.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
