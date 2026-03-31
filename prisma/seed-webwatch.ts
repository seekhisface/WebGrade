// prisma/seed-webwatch.ts
// Seeds WebWatch monthly report data for the NovaPulse HR demo site

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📊 Seeding WebWatch data...');

  const site = await prisma.site.findFirst({ where: { domain: 'novapulsehr.com' } });
  if (!site) {
    console.error('❌ NovaPulse HR site not found. Run seed-demo.ts first.');
    process.exit(1);
  }

  const siteId = site.id;

  // Clean previous WebWatch seed data
  await prisma.monthlyPerformanceReport.deleteMany({ where: { siteId } });
  await prisma.recommendation.deleteMany({ where: { siteId } });

  // ── 1. Recommendations (implemented fixes) ────────────────────────────
  const recs = [
    {
      siteId,
      sourceModule: 'AD_SPEND' as const,
      title: 'Paused LinkedIn retargeting',
      finding: 'LinkedIn retargeting campaign was spending $6,400/mo with zero attributable conversions over 90 days. Intent scores of visitors from this channel averaged 18/100 — well below the 40-point threshold for qualified traffic.',
      fixAction: 'Pause LinkedIn retargeting and reallocate budget to Google Branded, which is running at 1.4x CPA efficiency.',
      expectedResult: 'Eliminate $6,400/mo wasted spend. Expected net trial increase of 12-18/mo from budget reallocation.',
      impactScore: 9, effortScore: 2, confidenceScore: 9, priorityScore: 729,
      fixType: 'AD_SPEND' as const,
      status: 'DONE' as const,
      implementationStatus: 'VERIFIED' as const,
      completedAt: new Date('2026-01-14'),
      baselineMetricKey: 'wasted_spend_linkedin',
      baselineMetricValue: 6400,
      baselineMetricLabel: '$6,400/mo wasted spend',
      targetMetricValue: 0,
      lastVerifiedAt: new Date('2026-03-01'),
      lastVerifiedValue: 0,
      verificationStatus: 'IMPROVED' as const,
      verificationNote: 'LinkedIn retargeting fully paused since Jan 14. Budget reallocated to Google Branded. Google Branded now running at 1.4x previous volume.',
      estimatedMonthlyImpact: 6400,
      recoveredMonthlyValue: 6400,
    },
    {
      siteId,
      sourceModule: 'BEHAVIORAL' as const,
      title: 'Moved pricing tiers above the fold',
      finding: '/pricing page had 84% exit rate vs 52-55% benchmark. Scroll depth data showed only 31% of visitors reached the pricing tiers, which were positioned below a 600-word explainer section.',
      fixAction: 'Move pricing tier cards above the fold. Collapse the explainer into a "Learn more" accordion below the tiers.',
      expectedResult: 'Reduce exit rate by 15-25 points. Increase scroll depth to pricing tiers to 60%+.',
      impactScore: 8, effortScore: 3, confidenceScore: 8, priorityScore: 512,
      fixType: 'CONTENT' as const,
      status: 'DONE' as const,
      implementationStatus: 'VERIFIED' as const,
      completedAt: new Date('2026-01-19'),
      baselineMetricKey: 'exit_rate_pricing',
      baselineMetricValue: 0.84,
      baselineMetricLabel: '84% exit rate',
      targetMetricValue: 0.55,
      lastVerifiedAt: new Date('2026-03-01'),
      lastVerifiedValue: 0.61,
      verificationStatus: 'IMPROVED' as const,
      verificationNote: '/pricing exit rate dropped from 84% to 61%. Scroll depth to pricing tiers increased from 31% to 67%. Still above benchmark — monitoring.',
      estimatedMonthlyImpact: 12000,
      recoveredMonthlyValue: 8400,
    },
    {
      siteId,
      sourceModule: 'SEO' as const,
      title: 'Fixed BambooHR landing page load time',
      finding: '/bamboohr-alternative had LCP of 4.2s on mobile (threshold: <2.5s). The page was loading a 2.8MB hero image and 3 render-blocking scripts. This page receives $7,800/mo in ad spend but had only 0.9% CVR — below the 2.5% benchmark for competitor comparison pages.',
      fixAction: 'Compress hero image to WebP (<200KB), defer non-critical scripts, add preconnect hints for CDN.',
      expectedResult: 'Reduce LCP to <1.5s. Expected CVR lift of 1.5-2.5x based on Google speed impact studies.',
      impactScore: 9, effortScore: 4, confidenceScore: 9, priorityScore: 567,
      fixType: 'TECHNICAL' as const,
      status: 'DONE' as const,
      implementationStatus: 'VERIFIED' as const,
      completedAt: new Date('2026-01-22'),
      baselineMetricKey: 'lcp_bamboohr',
      baselineMetricValue: 4.2,
      baselineMetricLabel: '4.2s LCP (mobile)',
      targetMetricValue: 1.5,
      lastVerifiedAt: new Date('2026-03-01'),
      lastVerifiedValue: 1.3,
      verificationStatus: 'IMPROVED' as const,
      verificationNote: 'CVR tripled from 0.9% → 2.8%. Biggest single lift this month. Campaign CPA dropped to $286. CLS also improved from 0.18 to 0.04.',
      estimatedMonthlyImpact: 18000,
      recoveredMonthlyValue: 18000,
    },
    {
      siteId,
      sourceModule: 'BEHAVIORAL' as const,
      title: 'Fixed homepage CTA loading state',
      finding: 'Homepage "Start Free Trial" CTA was generating 47 rage click events per month. The trial signup form loaded asynchronously after click, with a 1.2-1.8s visible delay and no loading indicator. Users were clicking repeatedly.',
      fixAction: 'Preload trial form bundle on idle. Add immediate loading state to CTA button. Target: <80ms response time.',
      expectedResult: 'Eliminate rage clicks on CTA. Expected 3-5% trial lift from reduced friction.',
      impactScore: 7, effortScore: 3, confidenceScore: 8, priorityScore: 448,
      fixType: 'TECHNICAL' as const,
      status: 'DONE' as const,
      implementationStatus: 'VERIFIED' as const,
      completedAt: new Date('2026-01-28'),
      baselineMetricKey: 'rage_clicks_cta',
      baselineMetricValue: 47,
      baselineMetricLabel: '47 rage clicks/mo',
      targetMetricValue: 5,
      lastVerifiedAt: new Date('2026-03-01'),
      lastVerifiedValue: 3,
      verificationStatus: 'IMPROVED' as const,
      verificationNote: 'Trial form bundle now preloaded on idle. CTA response time <80ms. Rage clicks dropped from 47/mo to 3/mo.',
      estimatedMonthlyImpact: 5600,
      recoveredMonthlyValue: 5600,
    },
  ];

  for (const rec of recs) {
    await prisma.recommendation.create({ data: rec });
  }
  console.log(`✓ ${recs.length} recommendations seeded`);

  // ── 2. Monthly Performance Report (February 2026) ─────────────────────
  await prisma.monthlyPerformanceReport.create({
    data: {
      siteId,
      year: 2026,
      month: 2,
      label: 'February 2026',
      comparisonMode: 'VS_BASELINE',
      baselineLabel: 'December 2025',
      priorPeriodLabel: 'January 2026',
      executiveNarrative: 'February marks the first full month with all three high-priority fixes implemented. Trial starts are up 48% versus the December baseline — 187 trials vs 126. Wasted ad spend dropped from $11,100/mo to $2,100/mo after pausing LinkedIn retargeting and reallocating to Google Branded. The BambooHR landing page fix delivered the largest single lift: LCP dropped from 4.2s to 1.3s and that campaign\'s CVR tripled from 0.9% to 2.8%. One new issue has emerged: your /features page is seeing rising exit rates from organic traffic — we\'ve flagged it below for action this month.',
      praisePoints: [
        { title: 'BambooHR page speed fix', detail: 'CVR tripled from 0.9% to 2.8%. Biggest single lift.', dollarImpact: 18000 },
        { title: 'LinkedIn budget reallocation', detail: 'Wasted spend down $9,000/mo. Google Branded scaling well.', dollarImpact: 6400 },
        { title: 'Homepage CTA fix', detail: 'Rage clicks down 94%. Trial form loads in <80ms.', dollarImpact: 5600 },
      ],
      concernPoints: [
        { title: '/features exit rate rising', detail: 'Exit rate climbed from 61% to 74% over 3 months despite organic traffic growth.', daysSinceFlag: 0, estimatedCost: 8400 },
        { title: '/pricing still above benchmark', detail: 'Exit rate improved from 84% to 61% but benchmark is 52-55%.', daysSinceFlag: 45, estimatedCost: 4200 },
      ],
      sessionsThisMonth: 4820,
      sessionsBaseline: 3680,
      sessionsMoM: 8.2,
      sessionsPctBaseline: 31.0,
      intentScoreNow: 63,
      intentScoreBaseline: 51,
      intentScoreMoM: 8.6,
      conversionRateNow: 3.4,
      conversionRateBaseline: 2.1,
      revenueAtRiskNow: 14200,
      revenueRecoveredTotal: 38400,
      totalRecs: 4,
      verifiedFixed: 4,
      inProgress: 0,
      stalled: 0,
      openUnacted: 0,
      performanceGrade: 'A-',
    },
  });
  console.log('✓ Monthly performance report seeded (February 2026)');

  console.log('\n✅ WebWatch seed complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
