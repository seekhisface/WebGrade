export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const accessCheck = await verifySiteAccess(session.user.email, siteId);
  if (!accessCheck) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [site, sessionCount] = await prisma.$transaction([
    prisma.site.findUnique({
      where: { id: siteId },
      include: {
        siteInstallations: { orderBy: { installedAt: 'desc' }, take: 1 },
        onboarding: true,
      },
    }),
    // Check if the site has any session data — if so, the snippet is working
    prisma.visitorSession.count({ where: { siteId }, take: 1 }),
  ]);

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const snippetInstalled = site.siteInstallations?.[0]?.status === 'VERIFIED' || sessionCount > 0;
  const ga4Connected = !!(site.onboarding?.ga4BaselineImportedAt);
  const gscConnected = site.gscConnected ?? false;
  const businessContextComplete = !!(
    site.onboarding?.businessDescription &&
    site.onboarding?.conversionGoalUrl
  );

  // Auto-trigger first SEO crawl when snippet is detected as installed
  if (snippetInstalled) {
    try {
      const existingCrawl = await prisma.seoCrawl.findFirst({ where: { siteId } });
      if (!existingCrawl && site.url) {
        // Fire and forget — don't block the response
        import('@/lib/seo/crawler').then(({ crawlSite }) => {
          crawlSite({ siteId, startUrl: site.url, maxPages: 30 }).catch(err =>
            console.error(`[auto-crawl] First crawl failed for ${siteId}:`, err)
          );
        });
      }
    } catch { /* non-fatal */ }
  }

  const ob = site.onboarding;

  // Conversion goal is "set" if ANY of these signals are present:
  //  - Legacy onboarding singular field (oldest path)
  //  - At least one active ConversionGoal record (Settings page multi-goal table)
  //  - At least one SiteCta marked TRACKED (Site Map page approval flow)
  // Any one is sufficient to dismiss the "Set Conversion Goal" banner item.
  const [conversionGoalCount, trackedCtaCount] = await Promise.all([
    prisma.conversionGoal.count({ where: { siteId, isActive: true } }),
    prisma.siteCta.count({ where: { siteId, competitorUrl: '', status: 'TRACKED' } }),
  ]);
  const hasConversionGoal = !!(ob?.conversionGoalUrl || ob?.conversionGoalName)
    || conversionGoalCount > 0
    || trackedCtaCount > 0;
  const hasRevenueData = !!(ob?.averageOrderValue && ob?.conversionRate);
  const hasAdSpend = !!(ob?.monthlyAdSpend && ob.monthlyAdSpend > 0);
  const hasBusinessContext = !!(ob?.businessDescription && ob?.targetAudience);

  // Build list of missing vital items for the banner
  const missingItems: { key: string; label: string; description: string; link: string }[] = [];

  if (!snippetInstalled) {
    missingItems.push({ key: 'snippet', label: 'Install Tracking Snippet', description: 'No behavioral data without the snippet on your site', link: `/dashboard/${siteId}/settings#site-info` });
  }
  if (!hasConversionGoal) {
    missingItems.push({ key: 'conversion', label: 'Set Conversion Goal', description: 'Define what counts as a conversion so we can track it', link: `/dashboard/${siteId}/settings#conversion-goals` });
  }
  if (!hasRevenueData) {
    missingItems.push({ key: 'revenue', label: 'Complete Revenue Questionnaire', description: 'Needed to calculate Revenue at Risk and dollar impact', link: `/dashboard/${siteId}/settings#revenue` });
  }
  if (!gscConnected) {
    missingItems.push({ key: 'gsc', label: 'Connect Google Search Console', description: 'Unlocks keyword rankings, organic traffic, and SEO intelligence', link: `/dashboard/${siteId}/settings#integrations` });
  }
  if (!hasBusinessContext) {
    missingItems.push({ key: 'context', label: 'Add Business Context', description: 'Helps AI generate relevant, specific recommendations', link: `/dashboard/${siteId}/settings#business-context` });
  }
  if (!hasAdSpend) {
    missingItems.push({ key: 'adspend', label: 'Enter Ad Spend Data', description: 'Required for wasted spend analysis and campaign ROI', link: `/dashboard/${siteId}/settings#revenue` });
  }
  if (!ga4Connected) {
    missingItems.push({ key: 'ga4', label: 'Connect Google Analytics', description: 'Import baseline metrics to measure improvement over time', link: `/dashboard/${siteId}/settings#integrations` });
  }
  const gadsConnected = site.gadsConnected ?? false;
  if (!gadsConnected) {
    missingItems.push({ key: 'gads', label: 'Connect Google Ads', description: 'Automatic campaign spend sync — see exactly which ads convert vs. waste money', link: `/dashboard/${siteId}/settings#integrations` });
  }

  // Filter out items the user has permanently opted out of
  const skipped = ob?.skippedSetupItems ?? [];
  const activeMissing = missingItems.filter(item => !skipped.includes(item.key));

  return NextResponse.json({
    snippetInstalled,
    ga4Connected,
    gscConnected,
    businessContextComplete,
    hasConversionGoal,
    hasRevenueData,
    hasAdSpend,
    hasBusinessContext,
    missingItems: activeMissing,
    skippedItems: skipped,
    setupComplete: activeMissing.length === 0,
  });
}
