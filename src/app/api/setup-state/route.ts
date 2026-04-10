export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const [site, sessionCount] = await prisma.$transaction([
    prisma.site.findFirst({
      where: {
        id: siteId,
        org: { members: { some: { user: { email: session.user.email } } } },
      },
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
  const ga4Connected = false;
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
  const hasConversionGoal = !!(ob?.conversionGoalUrl || ob?.conversionGoalName);
  const hasRevenueData = !!(ob?.averageOrderValue && ob?.conversionRate);
  const hasAdSpend = !!(ob?.monthlyAdSpend && ob.monthlyAdSpend > 0);
  const hasBusinessContext = !!(ob?.businessDescription && ob?.targetAudience);

  // Build list of missing vital items for the banner
  const missingItems: { key: string; label: string; description: string; link: string }[] = [];

  if (!snippetInstalled) {
    missingItems.push({ key: 'snippet', label: 'Install Tracking Snippet', description: 'No behavioral data without the snippet on your site', link: `/dashboard/${siteId}/settings` });
  }
  if (!hasConversionGoal) {
    missingItems.push({ key: 'conversion', label: 'Set Conversion Goal', description: 'Define what counts as a conversion so we can track it', link: `/onboarding?siteId=${siteId}&step=1` });
  }
  if (!hasRevenueData) {
    missingItems.push({ key: 'revenue', label: 'Complete Revenue Questionnaire', description: 'Needed to calculate Revenue at Risk and dollar impact', link: `/dashboard/${siteId}/revenue` });
  }
  if (!gscConnected) {
    missingItems.push({ key: 'gsc', label: 'Connect Google Search Console', description: 'Unlocks keyword rankings, organic traffic, and SEO intelligence', link: `/onboarding?siteId=${siteId}&step=4` });
  }
  if (!hasBusinessContext) {
    missingItems.push({ key: 'context', label: 'Add Business Context', description: 'Helps AI generate relevant, specific recommendations', link: `/onboarding?siteId=${siteId}&step=2` });
  }
  if (!hasAdSpend) {
    missingItems.push({ key: 'adspend', label: 'Enter Ad Spend Data', description: 'Required for wasted spend analysis and campaign ROI', link: `/dashboard/${siteId}/revenue` });
  }

  return NextResponse.json({
    snippetInstalled,
    ga4Connected,
    gscConnected,
    businessContextComplete,
    hasConversionGoal,
    hasRevenueData,
    hasAdSpend,
    hasBusinessContext,
    missingItems,
    setupComplete: missingItems.length === 0,
  });
}
