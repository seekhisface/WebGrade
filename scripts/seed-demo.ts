// =============================================================================
// WebGrade Demo Seed Script
// Creates demo@webgrade.io + NovaPulse HR with realistic data
//
// Usage: npx ts-node --project tsconfig.json scripts/seed-demo.ts
// Or:    npx tsx scripts/seed-demo.ts
//
// Safe to re-run — checks for existing data before inserting.
// To reset: run with --reset flag: npx tsx scripts/seed-demo.ts --reset
// =============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const RESET = process.argv.includes('--reset');

// ── Demo constants ────────────────────────────────────────────────────────────
const DEMO_EMAIL = 'demo@webgrade.io';
const DEMO_NAME  = 'NovaPulse Demo';
const DEMO_ORG   = { name: 'NovaPulse HR', slug: 'novapulse-hr' };
const DEMO_SITE  = {
  name:     'NovaPulse HR',
  domain:   'novapulsehr.com',
  url:      'https://novapulsehr.com',
  industry: 'HR Technology / SaaS',
  platform: 'NEXT_JS' as const,
  timezone: 'America/Chicago',
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 WebGrade Demo Seed Script');
  console.log('─'.repeat(50));

  if (RESET) {
    console.log('⚠️  --reset flag detected. Wiping demo data...');
    await resetDemo();
    console.log('✅ Demo data cleared.\n');
  }

  // 1. User
  const user = await upsertUser();
  console.log(`✅ User: ${user.email}`);

  // 2. Org
  const org = await upsertOrg(user.id);
  console.log(`✅ Org: ${org.name}`);

  // 3. Site
  const site = await upsertSite(org.id);
  console.log(`✅ Site: ${site.name} (${site.domain}) — ID: ${site.id}`);

  // 4. Onboarding
  await upsertOnboarding(site.id);
  console.log('✅ Onboarding: complete');

  // 5. Baselines
  await seedBaselines(site.id);
  console.log('✅ Baselines: seeded');

  // 6. Report + Recommendations
  const report = await seedReport(site.id);
  console.log(`✅ Report: ${report.id}`);

  const recs = await seedRecommendations(site.id, report.id);
  console.log(`✅ Recommendations: ${recs.length} seeded`);

  // 7. Monthly Performance Report
  await seedMonthlyReport(site.id, report.id);
  console.log('✅ Monthly performance report: seeded');

  // 8. Alerts
  await seedAlerts(site.id);
  console.log('✅ Alerts: seeded');

  // 9. Alert settings
  await seedAlertSettings(site.id);
  console.log('✅ Alert settings: seeded');

  // 10. WebOpp analysis
  await seedWebOpp(site.id);
  console.log('✅ WebOpp analysis: seeded');

  // 11. SEO crawl
  await seedSeoCrawl(site.id);
  console.log('✅ SEO crawl: seeded');

  // 12. Report distribution
  await seedReportDistribution(site.id, org.id);
  console.log('✅ Report distribution: seeded');

  console.log('\n' + '─'.repeat(50));
  console.log('🎉 Demo seed complete!\n');
  console.log(`📧 Login: ${DEMO_EMAIL}`);
  console.log(`🔑 Use Supabase dashboard to set password, or magic link`);
  console.log(`🌐 Site ID: ${site.id}`);
  console.log(`🔗 Dashboard: /dashboard/${site.id}`);
  console.log('─'.repeat(50));
}

// ── Reset ─────────────────────────────────────────────────────────────────────
async function resetDemo() {
  // Delete org by slug (cascades to sites and all child data)
  const org = await prisma.organization.findUnique({ where: { slug: DEMO_ORG.slug } });
  if (org) {
    await prisma.site.deleteMany({ where: { orgId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  }
  // Delete ALL users that have ever been the demo account (typos included)
  await prisma.user.deleteMany({
    where: { email: { in: ['demo@webgrade.io', 'demo@webgrade.com'] } },
  });
}
// ── User ──────────────────────────────────────────────────────────────────────
async function upsertUser() {
  return prisma.user.upsert({
    where:  { email: DEMO_EMAIL },
    update: {},
    create: {
      email:         DEMO_EMAIL,
      name:          DEMO_NAME,
      emailVerified: new Date(),
    },
  });
}

// ── Org ───────────────────────────────────────────────────────────────────────
async function upsertOrg(userId: string) {
  let org = await prisma.organization.findUnique({ where: { slug: DEMO_ORG.slug } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: DEMO_ORG.name, slug: DEMO_ORG.slug },
    });
  }
  // Always ensure membership exists for the current user
  await prisma.orgMember.upsert({
    where:  { orgId_userId: { orgId: org.id, userId } },
    update: { role: 'OWNER' },
    create: { orgId: org.id, userId, role: 'OWNER' },
  });
  return org;
}
// ── Site ──────────────────────────────────────────────────────────────────────
async function upsertSite(orgId: string) {
  const existing = await prisma.site.findFirst({ where: { domain: DEMO_SITE.domain } });
  if (existing) return existing;

  return prisma.site.create({
    data: {
      orgId,
      ...DEMO_SITE,
      description:     'AI-powered HR platform for mid-market teams. Automates onboarding, compliance, and people analytics.',
      dataRegion:      'US',
      isActive:        true,
      hasInterimReport: true,
      hasWebWatch:     true,
      hasWebOpp:       true,
    },
  });
}

// ── Onboarding ────────────────────────────────────────────────────────────────
async function upsertOnboarding(siteId: string) {
  return prisma.siteOnboarding.upsert({
    where:  { siteId },
    update: {},
    create: {
      siteId,
      conversionGoalUrl:   'https://novapulsehr.com/signup',
      conversionGoalName:  'Free trial signup',
      businessDescription: 'NovaPulse HR is a SaaS platform helping mid-market companies (50–500 employees) automate HR workflows, compliance tracking, and people analytics. Primary buyer is the VP of HR or Chief People Officer.',
      targetAudience:      'VP of HR, Chief People Officer, HR Directors at companies with 50–500 employees. Typically evaluating 3–5 HR platforms at once.',
      primaryValueProp:    'Cuts HR admin time by 60% and reduces compliance risk with automated I-9, FMLA, and state law tracking.',
      currentPainPoints:   'High bounce rate on /pricing page. Significant drop-off between /features and /signup. Paid traffic from Google not converting.',
      competitorUrls:      ['https://rippling.com', 'https://gusto.com', 'https://bamboohr.com'],
      ga4PropertyId:       'properties/381204917',
      ga4BaselineImportedAt: new Date('2026-01-15'),
      monthlyAdSpend:      14500,
      averageOrderValue:   18400,
      leadToWinRate:       0.22,
      conversionRate:      0.031,
      isComplete:          true,
      completedAt:         new Date('2026-01-15'),
      completedSteps:      [1, 2, 3, 4, 5],
    },
  });
}

// ── Baselines ────────────────────────────────────────────────────────────────
async function seedBaselines(siteId: string) {
  const existing = await prisma.siteBaseline.findFirst({ where: { siteId } });
  if (existing) return;

  const baselines = [
    { metricKey: 'sessions_90d',      value: 28400,  period: '2025-Q4', source: 'ga4_import' },
    { metricKey: 'bounce_rate',       value: 0.61,   period: '2025-Q4', source: 'ga4_import' },
    { metricKey: 'conversion_rate',   value: 0.031,  period: '2025-Q4', source: 'ga4_import' },
    { metricKey: 'avg_session_duration_s', value: 142, period: '2025-Q4', source: 'ga4_import' },
    { metricKey: 'pages_per_session', value: 2.8,    period: '2025-Q4', source: 'ga4_import' },
    { metricKey: 'intent_score_avg',  value: 38,     period: '2025-Q4', source: 'webgrade_calculated' },
    { metricKey: 'pricing_exit_rate', value: 0.72,   period: '2025-Q4', source: 'webgrade_calculated' },
    { metricKey: 'features_to_signup_dropoff', value: 0.54, period: '2025-Q4', source: 'webgrade_calculated' },
    { metricKey: 'paid_cpc_avg',      value: 4.82,   period: '2025-Q4', source: 'ga4_import' },
    { metricKey: 'paid_conversion_rate', value: 0.018, period: '2025-Q4', source: 'ga4_import' },
    { metricKey: 'organic_sessions',  value: 9200,   period: '2025-Q4', source: 'ga4_import' },
    { metricKey: 'revenue_at_risk_mo', value: 43200, period: '2025-Q4', source: 'webgrade_calculated' },
  ];

  await prisma.siteBaseline.createMany({
    data: baselines.map(b => ({ siteId, ...b, capturedAt: new Date('2026-01-15') })),
  });
}

// ── Report ────────────────────────────────────────────────────────────────────
async function seedReport(siteId: string) {
  const existing = await prisma.report.findFirst({ where: { siteId, type: 'INTERIM' } });
  if (existing) return existing;

  return prisma.report.create({
    data: {
      siteId,
      type:        'INTERIM',
      status:      'COMPLETE',
      version:     1,
      periodStart: new Date('2025-10-01'),
      periodEnd:   new Date('2025-12-31'),
      behavioralSummary: `NovaPulse HR has significant behavioral signal leakage across three critical pages. The /pricing page has a 72% exit rate — 31 points above SaaS benchmark — indicating serious friction at the moment of peak purchase intent. Visitors who reach /pricing are highly qualified (avg intent score 74) but abandoning before CTA engagement. The /features → /signup funnel shows a 54% drop-off, suggesting misalignment between value communicated and commitment required. Combined, these two issues represent the majority of your estimated $43,200/mo revenue at risk.`,
      adSpendSummary: `Of your $14,500/mo paid budget, approximately $4,100 is functionally wasted. Google brand keywords are converting at 0.8x their target efficiency. Your top-spending non-brand campaign (/features landing) has a 68% bounce rate and 1.2% conversion rate — 40% below your account average. Two campaigns targeting "HR software for small business" are driving significant volume but near-zero intent (avg score 22). Reallocating $2,800/mo from these to "HR compliance automation" and "employee onboarding software" terms would project a 34% improvement in cost-per-signup.`,
      seoScore:    61,
      seoIssueCount: 23,
      seoSummary: `Site has 23 SEO issues across technical and on-page dimensions. Most critical: /features has no H1 tag and a meta description at 198 characters (truncated in SERPs). Mobile Lighthouse score is 54 — below the 65 threshold Google uses for ranking signals. Core Web Vitals: LCP at 4.2s (poor), CLS at 0.18 (needs improvement). 6 pages are orphaned with no internal links. Blog content is thin (avg 380 words) and not indexed for any target keywords.`,
      executiveSummary: `WebGrade identified $43,200/mo in recoverable revenue across NovaPulse HR's behavioral data, ad spend, and SEO profile. The highest-impact opportunity is the /pricing page exit rate (72%) which alone accounts for an estimated $18,600/mo in lost trial signups. With 12 prioritized action items, implementing the top 3 fixes (pricing page CTA, feature-to-signup messaging alignment, and paid campaign reallocation) could recover an estimated $28,400/mo within 60 days.`,
      topFindings: [
        { rank: 1, title: 'Pricing page exit rate 72% — 31pts above benchmark', impact: '$18,600/mo', module: 'BEHAVIORAL' },
        { rank: 2, title: '$4,100/mo in wasted paid spend', impact: '$4,100/mo', module: 'AD_SPEND' },
        { rank: 3, title: 'Features → Signup funnel 54% drop-off', impact: '$12,400/mo', module: 'BEHAVIORAL' },
        { rank: 4, title: 'Mobile Lighthouse score 54 — below ranking threshold', impact: 'SEO risk', module: 'SEO' },
        { rank: 5, title: '6 orphaned pages, no internal link equity', impact: 'SEO risk', module: 'SEO' },
      ],
      estimatedImpact: '$43,200/mo recoverable revenue identified',
      generatedAt:     new Date('2026-01-16'),
      createdAt:       new Date('2026-01-16'),
    },
  });
}

// ── Recommendations ───────────────────────────────────────────────────────────
async function seedRecommendations(siteId: string, reportId: string) {
  const existing = await prisma.recommendation.findMany({ where: { siteId } });
  if (existing.length > 0) return existing;

  const recs = [
    {
      sourceModule:   'BEHAVIORAL' as const,
      title:          'Redesign /pricing page CTA — exit rate 72%',
      finding:        'Your /pricing page has a 72% exit rate against a 41% SaaS benchmark. Visitors arriving here have an average intent score of 74 (highly qualified) but are abandoning before clicking any CTA. Heatmap signals show rage-click activity on the primary "Start Free Trial" button, suggesting it may be non-functional on mobile or blocked by a cookie banner.',
      fixAction:      'Audit the "Start Free Trial" CTA on mobile — confirm it fires, is above the fold, and is not blocked. Add a secondary "See a 2-min demo" option for visitors not ready to commit. Add social proof (logos, testimonials) directly above the CTA.',
      expectedResult: 'Reducing exit rate from 72% to 48% (benchmark +7pts) would recover an estimated $18,600/mo in trial signups.',
      impactScore:    10, effortScore: 4, confidenceScore: 9,
      priorityScore:  630,
      fixType:        'UX' as const,
      status:         'TODO' as const,
      implementationStatus: 'OPEN' as const,
      baselineMetricKey:   'pricing_exit_rate',
      baselineMetricValue: 0.72,
      baselineMetricLabel: '72% exit rate',
      targetMetricValue:   0.48,
      estimatedMonthlyImpact: 18600,
      verificationStatus: 'UNVERIFIED' as const,
    },
    {
      sourceModule:   'AD_SPEND' as const,
      title:          'Pause 2 low-intent Google campaigns — $2,800/mo waste',
      finding:        '"HR software for small business" and "HR tools cheap" campaigns are generating 1,840 clicks/mo at $1.52 CPC but converting at 0.3% — 83% below account average. Average intent score of arriving visitors is 22 (Low class). These clicks are consuming $2,800/mo with near-zero return.',
      fixAction:      'Pause both campaigns immediately. Reallocate $2,800/mo to "HR compliance automation" (+$1,800) and "employee onboarding software" (+$1,000) — both showing 3.2x better conversion in your account.',
      expectedResult: 'Stops $2,800/mo waste immediately. Projected 34% improvement in cost-per-signup from reallocation within 30 days.',
      impactScore:    9, effortScore: 2, confidenceScore: 10,
      priorityScore:  810,
      fixType:        'AD_SPEND' as const,
      status:         'IN_PROGRESS' as const,
      implementationStatus: 'IN_PROGRESS' as const,
      baselineMetricKey:   'paid_conversion_rate',
      baselineMetricValue: 0.018,
      baselineMetricLabel: '1.8% paid conversion rate',
      targetMetricValue:   0.032,
      estimatedMonthlyImpact: 4100,
      verificationStatus: 'UNVERIFIED' as const,
      customerNote:   'Paused the two campaigns on Jan 22. Reallocating budget this week.',
      customerUpdatedAt: new Date('2026-01-22'),
    },
    {
      sourceModule:   'BEHAVIORAL' as const,
      title:          'Fix messaging gap between /features and /signup',
      finding:        '54% of visitors navigating from /features to /signup abandon at the signup form. Session replay signals show visitors spending avg 8.4 seconds on the first form field before exiting. The /features page emphasizes "enterprise-grade compliance" but /signup leads with pricing — creating an expectation mismatch.',
      fixAction:      'Add a transition headline at the top of /signup: "Your compliance dashboard is 2 minutes away." Display the 3 features visitors engaged with most on /features (track via click data). Remove the credit card field from the initial signup step.',
      expectedResult: 'Reducing drop-off from 54% to 32% projects an additional $12,400/mo in trial starts.',
      impactScore:    9, effortScore: 5, confidenceScore: 8,
      priorityScore:  504,
      fixType:        'CONTENT' as const,
      status:         'TODO' as const,
      implementationStatus: 'OPEN' as const,
      baselineMetricKey:   'features_to_signup_dropoff',
      baselineMetricValue: 0.54,
      baselineMetricLabel: '54% drop-off rate',
      targetMetricValue:   0.32,
      estimatedMonthlyImpact: 12400,
      verificationStatus: 'UNVERIFIED' as const,
    },
    {
      sourceModule:   'SEO' as const,
      title:          'Fix mobile Lighthouse score — currently 54, below ranking threshold',
      finding:        'Mobile Lighthouse score of 54 is below Google\'s 65-point threshold that correlates with ranking suppression. LCP is 4.2s (benchmark: <2.5s) driven by an unoptimized hero image (1.8MB WebP, no lazy load). CLS of 0.18 is caused by a cookie banner that shifts layout on load.',
      fixAction:      'Compress hero image to <200KB using next/image with priority prop. Add explicit width/height to banner element to prevent CLS. Enable ISR or static generation on /features and /pricing.',
      expectedResult: 'Improving mobile score to 78+ would remove ranking suppression risk and improve organic click-through rate by an estimated 12–18%.',
      impactScore:    8, effortScore: 4, confidenceScore: 8,
      priorityScore:  448,
      fixType:        'TECHNICAL' as const,
      status:         'TODO' as const,
      implementationStatus: 'OPEN' as const,
      baselineMetricKey:   'lcp_s',
      baselineMetricValue: 4.2,
      baselineMetricLabel: '4.2s LCP',
      targetMetricValue:   2.3,
      estimatedMonthlyImpact: 5800,
      verificationStatus: 'UNVERIFIED' as const,
    },
    {
      sourceModule:   'SEO' as const,
      title:          'Add H1 and fix meta description on /features page',
      finding:        '/features has no H1 tag (only H2s and H3s) and a meta description of 198 characters — truncated in SERPs at 160. The page targets "HR software features" but that phrase appears 0 times in body copy. Currently ranking position 34 for this term with 880 monthly searches.',
      fixAction:      'Add H1: "HR Software Built for Mid-Market Teams." Rewrite meta description to 150 characters leading with the primary keyword. Add "HR software" naturally to the first paragraph of body copy.',
      expectedResult: 'Pages with correct H1 + keyword-matched meta average 23% higher CTR. At position 34, even a 2-position improvement could add 180 organic visits/mo.',
      impactScore:    6, effortScore: 2, confidenceScore: 9,
      priorityScore:  486,
      fixType:        'SEO' as const,
      status:         'DONE' as const,
      implementationStatus: 'IMPLEMENTED' as const,
      baselineMetricKey:   'features_page_seo_score',
      baselineMetricValue: 42,
      baselineMetricLabel: 'SEO score 42/100',
      targetMetricValue:   75,
      estimatedMonthlyImpact: 1200,
      verificationStatus: 'IMPROVED' as const,
      verificationNote: 'H1 confirmed present in latest crawl. Meta description now 148 characters with keyword. SEO score improved from 42 to 68.',
      lastVerifiedAt:  new Date('2026-02-15'),
      lastVerifiedValue: 68,
    },
    {
      sourceModule:   'BEHAVIORAL' as const,
      title:          'Add exit-intent capture on /pricing — recover abandoning visitors',
      finding:        '72% of /pricing visitors exit without any engagement. Of these, 34% show high-intent signals (scroll >60%, time on page >45s) before leaving — suggesting they\'re interested but not ready. There\'s currently no mechanism to capture these visitors.',
      fixAction:      'Add an exit-intent modal triggered at 80% scroll + cursor-toward-close. Offer: "Not ready to commit? See a 15-min recorded demo." Capture email only — no phone, no fields. Connect to email nurture sequence.',
      expectedResult: 'Industry average exit-intent capture rate is 3.5–7%. At 1,200 monthly /pricing visitors abandoning, this could capture 42–84 emails/mo for nurture.',
      impactScore:    7, effortScore: 4, confidenceScore: 7,
      priorityScore:  343,
      fixType:        'UX' as const,
      status:         'TODO' as const,
      implementationStatus: 'OPEN' as const,
      estimatedMonthlyImpact: 6200,
      verificationStatus: 'UNVERIFIED' as const,
    },
  ];

  return prisma.recommendation.createMany({
    data: recs.map(r => ({
      siteId,
      reportId,
      ...r,
      createdAt: new Date('2026-01-16'),
      updatedAt: new Date('2026-02-15'),
    })),
  }).then(() => prisma.recommendation.findMany({ where: { siteId } }));
}

// ── Monthly Performance Report ────────────────────────────────────────────────
async function seedMonthlyReport(siteId: string, reportId: string) {
  const existing = await prisma.monthlyPerformanceReport.findFirst({
    where: { siteId, year: 2026, month: 2 },
  });
  if (existing) return existing;

  return prisma.monthlyPerformanceReport.create({
    data: {
      siteId, reportId,
      year: 2026, month: 2,
      label: 'February 2026',
      comparisonMode:   'VS_BASELINE',
      baselineLabel:    'Q4 2025',
      priorPeriodLabel: 'January 2026',
      executiveNarrative: `February marks NovaPulse HR's strongest month since baseline. The ad spend reallocation (Rec #2) is confirmed working — paid conversion rate climbed from 1.8% to 2.6%, recovering an estimated $2,100/mo in previously wasted spend. Intent scores are up 11 points from baseline (38 → 49), suggesting the audience quality improvement from the campaign changes is real.\n\nThe /pricing page remains the biggest open opportunity. Exit rate ticked down from 72% to 68% — likely from organic improvements — but is still 27 points above benchmark. The recommendation has been open for 30 days with no reported action. This should be your #1 priority in March.\n\nSEO fix on /features is confirmed improved: page score from 42 to 68, and we're seeing early ranking movement. Give it another 30 days for full SERP impact.`,
      praisePoints: [
        { title: 'Ad spend reallocation working', detail: 'Paid conversion rate up 44% since Jan 22 campaign pause.', dollarImpact: 2100 },
        { title: 'Intent score improvement', detail: 'Average visitor intent up 11 points — audience quality is improving.', dollarImpact: null },
        { title: '/features SEO fix confirmed', detail: 'Page SEO score 42 → 68. Early ranking signals positive.', dollarImpact: null },
      ],
      concernPoints: [
        { title: '/pricing exit rate still 68%', detail: 'Down 4pts but still 27pts above benchmark. No action taken on Rec #1 in 30 days.', daysSinceFlag: 30, estimatedCost: 18600 },
        { title: 'Signup drop-off unchanged', detail: 'Features → Signup funnel still at 54% drop-off. Rec #3 not started.', daysSinceFlag: 30, estimatedCost: 12400 },
      ],
      topOpportunities: [
        { rank: 1, title: 'Pricing CTA redesign', metricNow: '68% exit', metricBaseline: '72% exit', dollarImpact: 18600, isRepeat: true },
        { rank: 2, title: 'Signup form optimization', metricNow: '54% dropoff', metricBaseline: '54% dropoff', dollarImpact: 12400, isRepeat: true },
        { rank: 3, title: 'Exit-intent capture on /pricing', metricNow: 'Not implemented', metricBaseline: 'N/A', dollarImpact: 6200, isRepeat: false },
      ],
      sessionsThisMonth:    31200,
      sessionsBaseline:     28400,
      sessionsMoM:          0.08,
      sessionsPctBaseline:  0.099,
      intentScoreNow:       49,
      intentScoreBaseline:  38,
      intentScoreMoM:       0.04,
      conversionRateNow:    0.034,
      conversionRateBaseline: 0.031,
      revenueAtRiskNow:     38400,
      revenueRecoveredTotal: 4800,
      totalRecs:   6,
      verifiedFixed: 1,
      inProgress:  1,
      stalled:     0,
      openUnacted: 4,
      performanceGrade: 'B-',
      generatedAt: new Date('2026-03-01'),
    },
  });
}

// ── Alerts ────────────────────────────────────────────────────────────────────
async function seedAlerts(siteId: string) {
  const existing = await prisma.alert.findFirst({ where: { siteId } });
  if (existing) return;

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);

  await prisma.alert.createMany({
    data: [
      {
        siteId,
        alertType:     'CONVERSION_DROP',
        severity:      'HIGH',
        productModule: 'BEHAVIORAL',
        message:       'Trial signup conversion rate dropped 18% week-over-week (0.031 → 0.025). Drop correlates with a layout change deployed on the /signup page on March 8.',
        triggeredAt:   daysAgo(4),
        metadata:      { metric: 'conversion_rate', before: 0.031, after: 0.025, pageCulprit: '/signup', deployDate: '2026-03-08' },
      },
      {
        siteId,
        alertType:     'WASTED_SPEND_DETECTED',
        severity:      'MEDIUM',
        productModule: 'AD_SPEND',
        message:       '"HR tools for startups" campaign has spent $840 this week with 0 conversions. Landing page is returning a 404 error.',
        triggeredAt:   daysAgo(2),
        metadata:      { campaign: 'HR tools for startups', spend: 840, conversions: 0, landingPageStatus: 404 },
      },
      {
        siteId,
        alertType:     'SEO_REGRESSION',
        severity:      'LOW',
        productModule: 'SEO',
        message:       '/blog/hr-compliance-checklist dropped from position 8 to position 19 for "HR compliance checklist." Page was not updated but a competitor published a comprehensive guide.',
        triggeredAt:   daysAgo(7),
        resolvedAt:    daysAgo(3),
        resolvedAutomatically: false,
        metadata:      { page: '/blog/hr-compliance-checklist', keyword: 'HR compliance checklist', before: 8, after: 19 },
      },
      {
        siteId,
        alertType:     'TRAFFIC_ANOMALY',
        severity:      'LOW',
        productModule: 'BEHAVIORAL',
        message:       'Traffic spike detected: 340% above normal between 2am–4am on March 10. Bot filter flagged 94% of sessions. No action required — data excluded from reporting.',
        triggeredAt:   daysAgo(2),
        resolvedAt:    daysAgo(2),
        resolvedAutomatically: true,
        metadata:      { sessionsFiltered: 1840, botPct: 0.94, window: '2026-03-10 02:00–04:00' },
      },
    ],
  });
}

// ── Alert Settings ─────────────────────────────────────────────────────────────
async function seedAlertSettings(siteId: string) {
  const existing = await prisma.alertSetting.findFirst({ where: { siteId } });
  if (existing) return;

  const defaults = [
    { alertType: 'CONVERSION_DROP',        severity: 'HIGH',   emailEnabled: true,  slackEnabled: false },
    { alertType: 'BOUNCE_RATE_SPIKE',      severity: 'MEDIUM', emailEnabled: true,  slackEnabled: false },
    { alertType: 'INTENT_SCORE_DROP',      severity: 'MEDIUM', emailEnabled: true,  slackEnabled: false },
    { alertType: 'TRAFFIC_ANOMALY',        severity: 'LOW',    emailEnabled: false, slackEnabled: false },
    { alertType: 'SEO_REGRESSION',         severity: 'HIGH',   emailEnabled: true,  slackEnabled: false },
    { alertType: 'WASTED_SPEND_DETECTED',  severity: 'HIGH',   emailEnabled: true,  slackEnabled: false },
    { alertType: 'ZERO_CONVERSION_CAMPAIGN', severity: 'CRITICAL', emailEnabled: true, slackEnabled: false },
    { alertType: 'NEW_HIGH_VALUE_OPPORTUNITY', severity: 'MEDIUM', emailEnabled: true, slackEnabled: false },
    { alertType: 'SNIPPET_FIRING_STOPPED', severity: 'CRITICAL', emailEnabled: true, slackEnabled: false },
  ] as const;

  await prisma.alertSetting.createMany({
    data: defaults.map(d => ({
      siteId,
      isEnabled: true,
      emailRecipients: [DEMO_EMAIL],
      ...d,
    })),
  });
}

// ── WebOpp ─────────────────────────────────────────────────────────────────────
async function seedWebOpp(siteId: string) {
  const existing = await prisma.webOppAnalysis.findFirst({ where: { siteId } });
  if (existing) return;

  const analysis = await prisma.webOppAnalysis.create({
    data: {
      siteId,
      status: 'COMPLETE',
      startedAt:   new Date('2026-01-20'),
      completedAt: new Date('2026-01-20'),
      totalMissedLeadsPerMonth:    184,
      totalMissedRevenuePerMonth:  38200,
      totalOpportunitiesFound:     12,
      topOpportunityCluster:       'Employee Onboarding Software',
    },
  });

  await prisma.webOppKeywordCluster.createMany({
    data: [
      {
        analysisId: analysis.id, siteId,
        clusterName: 'Employee Onboarding Software',
        keywords: ['employee onboarding software', 'onboarding automation', 'new hire onboarding platform', 'digital onboarding hr'],
        primaryKeyword: 'employee onboarding software',
        monthlySearchVolume: 8100, competition: 0.58, avgCpc: 7.20,
        currentRankPosition: null, currentMonthlyClicks: 0,
        topCompetitorUrl: 'rippling.com', competitorRankPosition: 2,
        isCompetitorKeyword: true,
        missedImpressions: 4860, missedClicks: 324, missedLeads: 71, missedRevenue: 14600,
        competitionDifficulty: 6, monthsToRank: 5,
        decision: 'YES' as const,
      },
      {
        analysisId: analysis.id, siteId,
        clusterName: 'HR Compliance Automation',
        keywords: ['hr compliance software', 'hr compliance automation', 'i-9 compliance software', 'fmla tracking software'],
        primaryKeyword: 'hr compliance automation',
        monthlySearchVolume: 3400, competition: 0.42, avgCpc: 9.80,
        currentRankPosition: 28, currentMonthlyClicks: 18,
        topCompetitorUrl: 'bamboohr.com', competitorRankPosition: 4,
        isCompetitorKeyword: true,
        missedImpressions: 2040, missedClicks: 98, missedLeads: 22, missedRevenue: 9200,
        competitionDifficulty: 5, monthsToRank: 4,
        decision: 'YES' as const,
      },
      {
        analysisId: analysis.id, siteId,
        clusterName: 'Mid-Market HR Platform',
        keywords: ['hr platform mid-market', 'hr software 100-500 employees', 'best hr software mid-market'],
        primaryKeyword: 'hr platform mid-market',
        monthlySearchVolume: 1900, competition: 0.31, avgCpc: 11.40,
        currentRankPosition: null, currentMonthlyClicks: 0,
        isCompetitorKeyword: false,
        missedImpressions: 1140, missedClicks: 57, missedLeads: 13, missedRevenue: 8200,
        competitionDifficulty: 3, monthsToRank: 3,
        decision: 'YES' as const,
      },
    ],
  });
}

// ── SEO Crawl ─────────────────────────────────────────────────────────────────
async function seedSeoCrawl(siteId: string) {
  const existing = await prisma.seoCrawl.findFirst({ where: { siteId } });
  if (existing) return;

  const crawl = await prisma.seoCrawl.create({
    data: {
      siteId,
      startedAt:    new Date('2026-01-18'),
      completedAt:  new Date('2026-01-18'),
      pagesFound:   47,
      pagesAnalyzed: 47,
      crawlStatus:  'COMPLETED',
      overallSeoScore: 61,
      technicalScore:  54,
      onPageScore:     64,
      contentScore:    58,
      crawlabilityScore: 72,
    },
  });

  await prisma.seoPageResult.createMany({
    data: [
      {
        crawlId: crawl.id, siteId,
        url: 'https://novapulsehr.com',
        statusCode: 200, responseTimeMs: 820,
        lcp: 3.1, cls: 0.12, ttfb: 0.48, mobileScore: 68, desktopScore: 84,
        title: 'NovaPulse HR — Modern HR Software for Growing Teams',
        titleLength: 52, metaDescription: 'HR software that automates onboarding, compliance, and people analytics for mid-market companies.',
        metaDescLength: 94, h1Count: 1, h2Count: 4, altTextMissing: 2,
        internalLinks: 12, externalLinks: 3, wordCount: 840,
        isMobileResponsive: true, isIndexable: true, isInSitemap: true,
        onPageScore: 78, contentScore: 72, crawlDepth: 1,
        issues: [],
      },
      {
        crawlId: crawl.id, siteId,
        url: 'https://novapulsehr.com/features',
        statusCode: 200, responseTimeMs: 1240,
        lcp: 4.2, cls: 0.18, ttfb: 0.92, mobileScore: 54, desktopScore: 71,
        title: 'Features — NovaPulse HR', titleLength: 22,
        metaDescription: 'Explore the full suite of NovaPulse HR features including onboarding workflows, compliance automation, people analytics, benefits management, time tracking, reporting, document management, and integration capabilities.',
        metaDescLength: 198, h1Count: 0, h2Count: 6, altTextMissing: 5,
        internalLinks: 8, externalLinks: 1, wordCount: 620,
        isMobileResponsive: true, isIndexable: true, isInSitemap: true,
        onPageScore: 42, contentScore: 48, crawlDepth: 2,
        issues: [
          { type: 'missing_h1', severity: 'HIGH', description: 'No H1 tag found', fix: 'Add H1: "HR Software Features Built for Mid-Market Teams"' },
          { type: 'meta_description_too_long', severity: 'MEDIUM', description: 'Meta description 198 chars (max 160)', fix: 'Rewrite to 150 chars leading with primary keyword' },
          { type: 'poor_lcp', severity: 'HIGH', description: 'LCP 4.2s — above 2.5s threshold', fix: 'Optimize hero image with next/image priority prop' },
        ],
      },
      {
        crawlId: crawl.id, siteId,
        url: 'https://novapulsehr.com/pricing',
        statusCode: 200, responseTimeMs: 680,
        lcp: 2.8, cls: 0.08, ttfb: 0.41, mobileScore: 72, desktopScore: 88,
        title: 'Pricing — NovaPulse HR', titleLength: 22,
        metaDescription: 'Simple, transparent pricing for HR software. Start free, scale as you grow.',
        metaDescLength: 74, h1Count: 1, h2Count: 3, altTextMissing: 0,
        internalLinks: 6, externalLinks: 0, wordCount: 380,
        isMobileResponsive: true, isIndexable: true, isInSitemap: true,
        onPageScore: 68, contentScore: 54, crawlDepth: 2, isThinContent: true,
        issues: [
          { type: 'thin_content', severity: 'MEDIUM', description: 'Only 380 words — pricing pages ranking well average 620+', fix: 'Add FAQ section, feature comparison table, and ROI calculator' },
        ],
      },
    ],
  });
}

// ── Report Distribution ───────────────────────────────────────────────────────
async function seedReportDistribution(siteId: string, orgId: string) {
  const existing = await prisma.reportDistribution.findFirst({ where: { siteId } });
  if (existing) return;

  await prisma.reportDistribution.create({
    data: {
      siteId, orgId,
      recipientEmail:      DEMO_EMAIL,
      recipientName:       'NovaPulse Demo',
      role:                'OWNER',
      receiveInterimReport: true,
      receiveWebWatch:     true,
      receiveWebOpp:       true,
      receiveWeeklyDigest: true,
      receiveAlerts:       true,
      webWatchFrequency:   'MONTHLY',
      digestDay:           1,
      digestHour:          8,
      deliveryChannel:     'EMAIL',
      isActive:            true,
    },
  });
}

// ── Run ───────────────────────────────────────────────────────────────────────
main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

