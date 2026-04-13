/**
 * WebGrade Demo Seed
 * Run with: npx ts-node --project tsconfig.json prisma/seed-demo.ts
 *
 * Creates a full demo account for NovaPulse HR Software —
 * a realistic mid-market SaaS company with 90 days of behavioral data,
 * ad source waste, drop-off issues, and a pre-generated report.
 */

import { PrismaClient, IntentClass, OrgRole, ReportStatus, ReportType, SourceModule, FixType, TaskStatus, AlertType, AlertSeverity } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding WebGrade demo data...');

  // ── 1. Demo user ────────────────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { email: 'demo@webgrade.com' },
    update: {},
    create: {
      email: 'demo@webgrade.com',
      name: 'Demo User',
      image: null,
    },
  });
  console.log('✓ Demo user created');

  // ── 2. Organization ─────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: 'novapulse-demo' },
    update: {},
    create: {
      name: 'NovaPulse HR',
      slug: 'novapulse-demo',
    },
  });

  await prisma.orgMember.upsert({
    where: { orgId_userId: { orgId: org.id, userId: user.id } },
    update: {},
    create: { orgId: org.id, userId: user.id, role: OrgRole.OWNER },
  });
  console.log('✓ Organization created');

  // ── 3. Site ──────────────────────────────────────────────────────────────
  const existingSite = await prisma.site.findFirst({ where: { domain: 'novapulsehr.com' } });

  const site = existingSite ?? await prisma.site.create({
    data: {
      orgId: org.id,
      name: 'NovaPulse HR',
      domain: 'novapulsehr.com',
      url: 'https://novapulsehr.com',
      platform: 'NEXT_JS',
      industry: 'HR Software / SaaS',
      hasInterimReport: true,
      hasWebWatch: true,
      hasWebOpp: true,
      snippetId: 'demo-snippet-001',
    },
  });
  console.log('✓ Site created:', site.id);

  // ── 4. Onboarding ────────────────────────────────────────────────────────
  await prisma.siteOnboarding.upsert({
    where: { siteId: site.id },
    update: {},
    create: {
      siteId: site.id,
      conversionGoalUrl: 'https://novapulsehr.com/trial/welcome',
      conversionGoalName: 'Free trial started',
      businessDescription: 'NovaPulse HR is a cloud-based HR platform for mid-market companies (50–500 employees). We replace manual onboarding spreadsheets with automated workflows. Our main competitors are BambooHR and Rippling. Average deal size is $18,000/year.',
      targetAudience: 'HR Directors and VP of People at companies with 50–500 employees, typically in tech, professional services, or healthcare',
      primaryValueProp: 'Cut employee onboarding time from 2 weeks to 2 days with automated workflows',
      competitorUrls: ['https://bamboohr.com', 'https://rippling.com', 'https://workday.com'],
      ga4PropertyId: 'GA4-DEMO-12345',
      monthlyAdSpend: 22000,
      averageOrderValue: 18000,
      leadToWinRate: 0.22,
      conversionRate: 0.028,
      isComplete: true,
      completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      completedSteps: [1, 2, 3, 4, 5],
    },
  });
  console.log('✓ Onboarding data seeded');

  // ── 5. Baselines ─────────────────────────────────────────────────────────
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
      where: {
        id: `baseline-${site.id}-${b.metricKey}`,
      },
      update: {},
      create: { id: `baseline-${site.id}-${b.metricKey}`, siteId: site.id, ...b },
    });
  }
  console.log('✓ Baselines seeded');

  // ── 6. Ad Sources ────────────────────────────────────────────────────────
  const adSources = [
    {
      source: 'google',
      medium: 'cpc',
      campaign: 'HR Software - Branded',
      qualityScore: 78,
      avgIntentScore: 74,
      conversionRate: 0.041,
      platformSpend: 8400,
      hasZeroConversions: false,
      estimatedWastedSpend: 1200,
      landingPageUrl: 'https://novapulsehr.com/lp/google-branded',
      landingPageAlignScore: 82,
    },
    {
      source: 'google',
      medium: 'cpc',
      campaign: 'Competitor - BambooHR Alternative',
      qualityScore: 54,
      avgIntentScore: 51,
      conversionRate: 0.009,
      platformSpend: 7200,
      hasZeroConversions: false,
      estimatedWastedSpend: 4100,
      hasSlowLandingPage: true,
      landingPageUrl: 'https://novapulsehr.com/lp/bamboohr-alternative',
      landingPageAlignScore: 41,
    },
    {
      source: 'linkedin',
      medium: 'paid',
      campaign: 'HR Director Retargeting',
      qualityScore: 31,
      avgIntentScore: 29,
      conversionRate: 0.003,
      platformSpend: 6400,
      hasZeroConversions: true,
      estimatedWastedSpend: 5800,
      landingPageUrl: 'https://novapulsehr.com/lp/linkedin',
      landingPageAlignScore: 28,
    },
  ];

  const adSourceRecords: any[] = [];
  for (const ad of adSources) {
    const record = await prisma.adSource.upsert({
      where: { siteId_source_medium_campaign: { siteId: site.id, source: ad.source, medium: ad.medium, campaign: ad.campaign! } },
      update: {},
      create: { siteId: site.id, ...ad },
    });
    adSourceRecords.push(record);
  }
  console.log('✓ Ad sources seeded');

  // ── 7. Visitor Sessions (1,250 sessions over 90 days with PageViews) ──────
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
    const sessionId = `demo-session-${i}`;
    const entryPage = pageUrls[Math.floor(Math.random() * 4)];
    const exitPage = pageUrls[Math.floor(Math.random() * pageUrls.length)];

    sessionBatch.push({
      siteId: site.id,
      sessionId,
      ipHash: `hash-${i}`,
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

    // Create pageviews for this session.
    // PageView has a unique constraint on (sessionId, siteId, url), so we can't
    // visit the same URL twice in one session. Track which URLs we've already
    // emitted and pick a different one if we'd collide.
    const usedUrls = new Set<string>();
    for (let p = 0; p < pageCount; p++) {
      let url: string;
      if (p === 0) {
        url = entryPage;
      } else if (p === pageCount - 1) {
        url = exitPage;
      } else {
        url = pageUrls[Math.floor(Math.random() * pageUrls.length)];
      }

      // If this URL was already visited in this session, find an unused one.
      // If every URL has been visited, stop emitting more pageviews for this session.
      if (usedUrls.has(url)) {
        const available = pageUrls.filter(u => !usedUrls.has(u));
        if (available.length === 0) break;
        url = available[Math.floor(Math.random() * available.length)];
      }
      usedUrls.add(url);

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
  await prisma.visitorSession.createMany({ data: sessionBatch });
  console.log(`✓ ${SESSION_COUNT} visitor sessions seeded`);

  // Fetch back session IDs to map pageviews correctly
  const createdSessions = await prisma.visitorSession.findMany({
    where: { siteId: site.id },
    select: { id: true, sessionId: true },
  });
  const sessionIdMap = new Map(createdSessions.map(s => [s.sessionId, s.id]));

  // Remap pageview sessionId from string to actual DB id
  const mappedPageViews = pageViewBatch.map(pv => ({
    ...pv,
    sessionId: sessionIdMap.get(pv.sessionId) ?? pv.sessionId,
  }));

  await prisma.pageView.createMany({ data: mappedPageViews });
  console.log(`✓ ${mappedPageViews.length} page views seeded`);

  // ── 8. Report ─────────────────────────────────────────────────────────────
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
      behavioralSummary: `62% of paid traffic exits on the first page visited. High-intent sessions (scoring 75+) have a 4.1% conversion rate — 3× your site average — but only represent 18% of traffic. The /pricing page has the highest exit rate at 84% with average scroll depth of 31%, meaning most visitors leave before seeing your price tiers. Rage clicks are concentrated on the "See Pricing" CTA on the homepage (47 rage clicks in 30 days), suggesting CTA placement or loading friction.`,
      adSpendSummary: `Total monthly ad spend: $22,000. Estimated wasted spend: $11,100 (50.5%). LinkedIn retargeting ($6,400/mo) is generating 3 conversions in 30 days at $2,133 CPA — 47× your target CPA. The BambooHR Alternative campaign landing page loads in 4.2 seconds on mobile; pages over 3 seconds see a 53% abandonment increase. Google Branded is your only performing campaign at 4.1% CVR and $205 CPA.`,
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
  console.log('✓ Report seeded');

  // ── 9. Recommendations ───────────────────────────────────────────────────
  const recs = [
    {
      title: 'Pause LinkedIn retargeting campaign immediately',
      finding: 'LinkedIn retargeting is generating 3 conversions in 30 days at $2,133 CPA. Visitor intent scores average 29/100 — you\'re reaching people who have no purchase intent. This campaign has been running for 4 months with no optimization.',
      fixAction: 'Pause the "HR Director Retargeting" LinkedIn campaign. Reallocate $6,400/mo to Google Branded (4.1% CVR) or use it to A/B test a new landing page for the competitor comparison campaign.',
      expectedResult: '$6,400/month freed up immediately. Google Branded can absorb the budget with projected 2.1× ROI improvement.',
      sourceModule: SourceModule.AD_SPEND,
      fixType: FixType.AD_SPEND,
      impactScore: 10, effortScore: 1, confidenceScore: 10,
      priorityScore: 980,
    },
    {
      title: 'Move pricing tiers above the fold on /pricing',
      finding: '/pricing has an 84% exit rate and 31% average scroll depth. Visitors are leaving before they can see your pricing tiers, which are positioned 1,800px down the page below three value proposition sections they\'ve already seen on the homepage.',
      fixAction: 'Restructure /pricing: Lead with the pricing table, push the value prop copy below. Add a sticky comparison table header so tiers are always visible on scroll.',
      expectedResult: 'Estimated +18-28% increase in trial starts from /pricing. At current traffic (3,200 sessions/mo to pricing) and AOV of $18,000, this is worth ~$8,100-$12,400/mo.',
      sourceModule: SourceModule.BEHAVIORAL,
      fixType: FixType.UX,
      impactScore: 9, effortScore: 3, confidenceScore: 8,
      priorityScore: 890,
    },
    {
      title: 'Fix BambooHR Alternative page load time (4.2s → <2s)',
      finding: 'Your highest-intent paid traffic — people actively searching for BambooHR alternatives — lands on a page that loads in 4.2 seconds. Pages over 3 seconds lose 53% of mobile visitors before the page finishes loading. This campaign spends $7,200/mo and converts at 0.9%.',
      fixAction: 'Compress hero image (currently 2.1MB), defer non-critical JS, enable lazy loading. Use Vercel Edge for this specific landing page URL. Target <1.8s LCP.',
      expectedResult: 'Projected CVR lift from 0.9% → 2.1% on this campaign. At $7,200 spend and $18,000 AOV, this is worth ~$2,800/mo in additional revenue.',
      sourceModule: SourceModule.AD_SPEND,
      fixType: FixType.TECHNICAL,
      impactScore: 8, effortScore: 4, confidenceScore: 8,
      priorityScore: 820,
    },
    {
      title: 'Fix homepage "Start Free Trial" CTA loading state',
      finding: '47 rage clicks on the homepage CTA in 30 days. Rage clicks indicate visitors are clicking and seeing no response — either a loading delay or the button appearing clickable when it isn\'t. This is on your highest-traffic page (12,400 sessions/mo).',
      fixAction: 'Add a loading spinner and disabled state to the CTA button. Reduce trial form initialization time — currently it loads a 340KB JS bundle on click.',
      expectedResult: '+8-12% improvement in CTA click-through rate. At 12,400 sessions/mo and 2.8% current trial CVR, fixing rage clicks alone could add 28-42 trials/month.',
      sourceModule: SourceModule.BEHAVIORAL,
      fixType: FixType.TECHNICAL,
      impactScore: 7, effortScore: 3, confidenceScore: 7,
      priorityScore: 760,
    },
  ];

  for (const rec of recs) {
    await prisma.recommendation.create({
      data: {
        siteId: site.id,
        reportId: report.id,
        status: TaskStatus.TODO,
        ...rec,
      },
    });
  }
  console.log('✓ Recommendations seeded');

  // ── 10. Alerts ───────────────────────────────────────────────────────────
  await prisma.alert.createMany({
    data: [
      {
        siteId: site.id,
        alertType: AlertType.ZERO_CONVERSION_CAMPAIGN,
        severity: AlertSeverity.CRITICAL,
        productModule: SourceModule.AD_SPEND,
        message: 'LinkedIn retargeting campaign has generated 0 conversions in the last 14 days on $3,200 spend. Consider pausing.',
        triggeredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        siteId: site.id,
        alertType: AlertType.BOUNCE_RATE_SPIKE,
        severity: AlertSeverity.HIGH,
        productModule: SourceModule.BEHAVIORAL,
        message: 'Bounce rate on /pricing jumped from 71% to 84% over the last 7 days — up 13 points. A page change may have introduced friction.',
        triggeredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        siteId: site.id,
        alertType: AlertType.WASTED_SPEND_DETECTED,
        severity: AlertSeverity.HIGH,
        productModule: SourceModule.AD_SPEND,
        message: 'Estimated wasted ad spend this month: $11,100 across 2 campaigns. LinkedIn and BambooHR Alternative are underperforming against CPA targets.',
        triggeredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ],
    skipDuplicates: true,
  });
  console.log('✓ Alerts seeded');

  console.log('\n✅ Demo seed complete!');
  console.log(`   Site ID: ${site.id}`);
  console.log(`   Demo login: demo@webgrade.com`);
  console.log(`   Dashboard: /dashboard/${site.id}`);
  console.log(`\n   To access demo, visit: /demo`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
