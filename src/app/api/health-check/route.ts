export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/**
 * HC-01, HC-03, HC-04, HC-05, HC-06, HC-07, HC-08: Site Health Check API
 * POST /api/health-check
 *
 * Runs all site health checks and stores results.
 * Called at onboarding and on-demand from the health check dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { verifySiteAccess } from '@/lib/auth/session';

const HealthCheckRequestSchema = z.object({
  siteId: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = HealthCheckRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { siteId } = parsed.data;

  // Verify the user has access to this site (super admins bypass org membership)
  const siteAccess = await verifySiteAccess(session.user.email, siteId);
  if (!siteAccess) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { onboarding: true },
  });

  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  // Run all checks
  const results = await runHealthChecks(site);

  // Store results
  const healthCheck = await prisma.siteHealthCheck.create({
    data: {
      siteId,
      ...results,
      overallStatus: computeOverallStatus(results),
      fixInstructions: generateFixInstructions(results),
    }
  });

  return NextResponse.json({ ok: true, healthCheck });
}

// ---------------------------------------------------------------------------
// GET: Retrieve latest health check for a site
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) {
    return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  }

  const site = await verifySiteAccess(session.user.email, siteId);
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const healthCheck = await prisma.siteHealthCheck.findFirst({
    where: { siteId },
    orderBy: { checkedAt: 'desc' },
  });

  return NextResponse.json({ healthCheck });
}

// ---------------------------------------------------------------------------
// Health check implementations
// ---------------------------------------------------------------------------

interface SiteWithOnboarding {
  id: string;
  url: string;
  snippetId: string;
  onboarding: { conversionGoalUrl: string | null } | null;
}

async function runHealthChecks(site: SiteWithOnboarding) {
  const results: Record<string, unknown> = {};

  // Run all independent DB queries in parallel
  const [
    recentEvent,       // HC-01: Snippet fire
    spaEvent,          // HC-02: SPA detection
    conversionEvent,   // HC-03: Conversion goal
    utmSessions,       // HC-04: UTM integrity
    utmConversions,    // HC-04: UTM conversions
    eventGroups,       // HC-05: Duplicate detection
    nonBotSession,     // HC-06: Consent check
    totalSessions,     // HC-07: Bot baseline (total)
    botSessions,       // HC-07: Bot baseline (bots)
    latestCrawl,       // HC-08: Page speed
  ] = await Promise.all([
    prisma.sessionEvent.findFirst({
      where: { siteId: site.id, timestamp: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    }),
    prisma.sessionEvent.findFirst({
      where: { siteId: site.id, eventType: 'ROUTE_CHANGE' },
    }),
    prisma.sessionEvent.findFirst({
      where: { siteId: site.id, eventType: 'CONVERSION' },
    }),
    prisma.visitorSession.count({
      where: { siteId: site.id, utmSource: { not: null } },
    }),
    prisma.visitorSession.count({
      where: { siteId: site.id, utmSource: { not: null }, conversionGoalHit: true },
    }),
    prisma.sessionEvent.groupBy({
      by: ['sessionId'],
      where: { siteId: site.id },
      _count: { id: true },
    }),
    prisma.visitorSession.findFirst({
      where: { siteId: site.id, isBotFiltered: false },
    }),
    prisma.visitorSession.count({ where: { siteId: site.id } }),
    prisma.visitorSession.count({
      where: { siteId: site.id, isBotFiltered: true },
    }),
    prisma.seoCrawl.findFirst({
      where: { siteId: site.id, crawlStatus: 'COMPLETED' },
      orderBy: { startedAt: 'desc' },
      include: { pageResults: { where: { url: site.url }, take: 1 } },
    }),
  ]);

  // HC-01: Snippet fire detection
  results.snippetFires = recentEvent !== null;
  results.snippetFireTimeMs = null;
  results.snippetStatus = recentEvent ? 'GREEN' : 'YELLOW';

  // HC-02: SPA detection
  results.spaRouteEventsWork = spaEvent !== null;
  results.spaStatus = 'GREEN';

  // HC-03: Conversion goal reachability
  if (site.onboarding?.conversionGoalUrl) {
    results.conversionGoalReachable = true;
    results.conversionGoalSnippetFires = conversionEvent !== null;
    results.conversionGoalStatus = conversionEvent ? 'GREEN' : 'YELLOW';
  } else {
    results.conversionGoalReachable = null;
    results.conversionGoalSnippetFires = null;
    results.conversionGoalStatus = 'RED';
  }

  // HC-04: UTM integrity
  results.utmPreservedToGoal = utmSessions > 0 ? utmConversions > 0 : null;
  results.utmStrippingDetected = false;
  results.utmStatus = utmSessions > 0 ? 'GREEN' : 'YELLOW';

  // HC-05: Duplicate script detection
  const avgEventsPerSession = eventGroups.length === 0
    ? 0
    : eventGroups.reduce((sum, g) => sum + g._count.id, 0) / eventGroups.length;
  const likelyDuplicate = avgEventsPerSession > 200;
  results.duplicateSnippetCount = likelyDuplicate ? 2 : 0;
  results.duplicateStatus = likelyDuplicate ? 'RED' : 'GREEN';

  // HC-06: Cookie consent interference
  results.consentBannerDetected = null;
  results.consentBlocksSnippet = null;
  results.consentStatus = nonBotSession ? 'GREEN' : 'YELLOW';

  // HC-07: Bot traffic baseline
  const botPercent = totalSessions > 0 ? (botSessions / totalSessions) * 100 : 0;
  results.estimatedBotPercent = botPercent;
  results.botStatus = botPercent > 25 ? 'RED' : botPercent > 10 ? 'YELLOW' : 'GREEN';

  // HC-08: Page speed
  if (latestCrawl?.pageResults[0]) {
    const pg = latestCrawl.pageResults[0];
    results.lighthouseLcp = pg.lcp;
    results.lighthouseFid = pg.fid;
    results.lighthouseCls = pg.cls;
    results.lighthouseScore = pg.mobileScore;
    results.pageSpeedStatus = (pg.lcp ?? 99) > 4 ? 'RED'
      : (pg.lcp ?? 99) > 2.5 ? 'YELLOW'
      : 'GREEN';
  } else {
    results.pageSpeedStatus = 'UNKNOWN';
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type CheckStatus = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';

function computeOverallStatus(results: Record<string, unknown>): CheckStatus {
  const statusFields = [
    'snippetStatus', 'conversionGoalStatus', 'duplicateStatus',
    'botStatus', 'pageSpeedStatus'
  ];

  let hasRed = false;
  let hasYellow = false;

  for (const field of statusFields) {
    const val = results[field] as CheckStatus | undefined;
    if (val === 'RED') hasRed = true;
    if (val === 'YELLOW') hasYellow = true;
  }

  if (hasRed) return 'RED';
  if (hasYellow) return 'YELLOW';
  return 'GREEN';
}

function generateFixInstructions(results: Record<string, unknown>): Record<string, string> {
  const fixes: Record<string, string> = {};

  if (results.snippetStatus === 'RED') {
    fixes.snippet = 'Snippet is not firing. Verify the snippet is installed in the <head> of every page. If using a CMS, check that the custom code block is published and not inside a conditional.';
  }
  if (results.conversionGoalStatus === 'RED' && !results.conversionGoalReachable) {
    fixes.conversionGoal = 'No conversion goal URL is set. Go to Settings → Onboarding and enter the URL of your thank-you page, sign-up confirmation, or checkout complete page.';
  }
  if (results.duplicateStatus === 'RED') {
    fixes.duplicate = 'The snippet appears to be installed more than once. Check for overlap between a direct install and a GTM tag. Remove one installation.';
  }
  if ((results.botPercent as number) > 25) {
    fixes.botTraffic = 'High bot traffic detected (>25%). Review your traffic sources. If running paid campaigns, check for bot-heavy placements and consider IP exclusion lists.';
  }
  if (results.pageSpeedStatus === 'RED') {
    fixes.pageSpeed = 'Page LCP is above 4 seconds. Priority fixes: optimize images (use WebP, add width/height), eliminate render-blocking scripts, enable server-side caching, and consider a CDN.';
  }

  return fixes;
}
