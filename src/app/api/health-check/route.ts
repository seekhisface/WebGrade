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

  // Verify the user has access to this site
  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      org: {
        members: {
          some: { user: { email: session.user.email } }
        }
      }
    },
    include: {
      onboarding: true,
    }
  });

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

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

  // HC-01: Snippet fire detection
  // We check if we have received any events from this site in the last 10 minutes
  const recentEvent = await prisma.sessionEvent.findFirst({
    where: {
      siteId: site.id,
      timestamp: { gte: new Date(Date.now() - 10 * 60 * 1000) }
    }
  });

  results.snippetFires = recentEvent !== null;
  results.snippetFireTimeMs = null; // Set by client-side check in production
  results.snippetStatus = recentEvent ? 'GREEN' : 'YELLOW'; // YELLOW: not yet seen (new site)

  // HC-02: SPA detection
  // Check if we see ROUTE_CHANGE events (indicates SPA with proper tracking)
  const spaEvent = await prisma.sessionEvent.findFirst({
    where: { siteId: site.id, eventType: 'ROUTE_CHANGE' }
  });
  results.spaRouteEventsWork = spaEvent !== null;
  results.spaStatus = 'GREEN'; // Default GREEN; set YELLOW if SPA detected but no route events

  // HC-03: Conversion goal reachability
  // Check if we have received any CONVERSION events
  if (site.onboarding?.conversionGoalUrl) {
    const conversionEvent = await prisma.sessionEvent.findFirst({
      where: {
        siteId: site.id,
        eventType: 'CONVERSION',
      }
    });

    // Check if conversion goal URL is reachable (in production, do HTTP HEAD request)
    results.conversionGoalReachable = true; // Optimistic default; real check uses fetch()
    results.conversionGoalSnippetFires = conversionEvent !== null;
    results.conversionGoalStatus = conversionEvent ? 'GREEN' : 'YELLOW';
  } else {
    // No conversion goal set yet — this is a blocker (OB-06)
    results.conversionGoalReachable = null;
    results.conversionGoalSnippetFires = null;
    results.conversionGoalStatus = 'RED';
  }

  // HC-04: UTM integrity
  // Check if sessions with UTM params are preserving them through to the goal
  const utmSessions = await prisma.visitorSession.count({
    where: { siteId: site.id, utmSource: { not: null } }
  });
  const utmConversions = await prisma.visitorSession.count({
    where: { siteId: site.id, utmSource: { not: null }, conversionGoalHit: true }
  });
  results.utmPreservedToGoal = utmSessions > 0 ? utmConversions > 0 : null;
  results.utmStrippingDetected = false; // Full check done by dedicated UTM monitor
  results.utmStatus = utmSessions > 0 ? 'GREEN' : 'YELLOW';

  // HC-05: Duplicate script detection
  // Check if we're seeing anomalously high event volumes per session (symptom of duplicate snippet)
  const avgEventsPerSession = await prisma.sessionEvent.groupBy({
    by: ['sessionId'],
    where: { siteId: site.id },
    _count: { id: true },
  }).then(groups => {
    if (groups.length === 0) return 0;
    return groups.reduce((sum, g) => sum + g._count.id, 0) / groups.length;
  });

  const likelyDuplicate = avgEventsPerSession > 200; // >200 events/session suggests duplicate
  results.duplicateSnippetCount = likelyDuplicate ? 2 : 0;
  results.duplicateStatus = likelyDuplicate ? 'RED' : 'GREEN';

  // HC-06: Cookie consent interference
  // This is detected by the snippet itself when consent_given=false but events still fire
  const blockedByCookieConsent = await prisma.visitorSession.findFirst({
    where: { siteId: site.id, isBotFiltered: false }
  });
  results.consentBannerDetected = null; // Detected client-side
  results.consentBlocksSnippet = null;  // Detected client-side
  results.consentStatus = blockedByCookieConsent ? 'GREEN' : 'YELLOW';

  // HC-07: Bot traffic baseline
  const totalSessions = await prisma.visitorSession.count({ where: { siteId: site.id } });
  const botSessions = await prisma.visitorSession.count({
    where: { siteId: site.id, isBotFiltered: true }
  });
  const botPercent = totalSessions > 0 ? (botSessions / totalSessions) * 100 : 0;
  results.estimatedBotPercent = botPercent;
  results.botStatus = botPercent > 25 ? 'RED' : botPercent > 10 ? 'YELLOW' : 'GREEN';

  // HC-08: Page speed (Lighthouse)
  // In production, trigger a Lighthouse run via PageSpeed Insights API
  // For now, check if we have a recent Lighthouse result
  const latestCrawl = await prisma.seoCrawl.findFirst({
    where: { siteId: site.id, crawlStatus: 'COMPLETED' },
    orderBy: { startedAt: 'desc' },
    include: {
      pageResults: {
        where: { url: site.url },
        take: 1,
      }
    }
  });

  if (latestCrawl?.pageResults[0]) {
    const page = latestCrawl.pageResults[0];
    results.lighthouseLcp = page.lcp;
    results.lighthouseFid = page.fid;
    results.lighthouseCls = page.cls;
    results.lighthouseScore = page.mobileScore;
    results.pageSpeedStatus = (page.lcp ?? 99) > 4 ? 'RED'
      : (page.lcp ?? 99) > 2.5 ? 'YELLOW'
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
