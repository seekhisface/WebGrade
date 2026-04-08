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

  return NextResponse.json({
    snippetInstalled,
    ga4Connected,
    gscConnected,
    businessContextComplete,
  });
}
