// GET /api/dashboard/detail?siteId=xxx&days=30
//
// Powers the new Detail page. Returns ONE payload organized by customer
// question — Traffic / Engagement / Conversion / SEO / Market — so the page
// paints in a single round trip.
//
// Each section is intentionally lean: top-N lists, a few headline metrics.
// Anything that would need its own deep-dive view (full session log,
// keyword research tool, etc.) stays on its existing dedicated page and
// gets a "See more →" link from inside the section.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';

export const runtime = 'nodejs';

function toPath(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/$/, '') || '/';
  } catch {
    return url.split('#')[0].split('?')[0].replace(/\/$/, '') || '/';
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = req.nextUrl.searchParams.get('siteId');
    const daysParam = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10);
    const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 365 ? daysParam : 30;

    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    const access = await verifySiteAccess(session.user.email, siteId);
    if (!access) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const start = new Date(Date.now() - days * 86400000);
    const end = new Date();

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true, name: true,
        gscConnected: true, ga4Connected: true, gscLastSyncAt: true,
        onboarding: { select: { conversionGoalUrl: true, conversionGoalName: true } },
      },
    });
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    // -----------------------------------------------------------------
    // Pull the raw session/event data we need to derive most sections
    // -----------------------------------------------------------------

    const sessions = await prisma.visitorSession.findMany({
      where: { siteId, isBotFiltered: false, startedAt: { gte: start, lte: end } },
      select: {
        id: true, trafficSource: true, utmSource: true, utmMedium: true,
        utmCampaign: true, utmCampaignIsStale: true, entryPage: true,
        country: true, deviceType: true, isBounce: true, conversionGoalHit: true,
        startedAt: true, endedAt: true, intentScore: true, intentClass: true,
      },
    });

    // -----------------------------------------------------------------
    // TRAFFIC — sources, top entry pages, geo, UTM performance
    // -----------------------------------------------------------------

    const sourceBuckets = new Map<string, number>();
    const entryBuckets = new Map<string, number>();
    const countryBuckets = new Map<string, number>();
    const deviceBuckets = new Map<string, number>();
    const campaignBuckets = new Map<string, { sessions: number; stale: boolean }>();

    for (const s of sessions) {
      sourceBuckets.set(s.trafficSource || s.utmMedium || 'direct',
        (sourceBuckets.get(s.trafficSource || s.utmMedium || 'direct') ?? 0) + 1);

      const path = toPath(s.entryPage);
      if (path) entryBuckets.set(path, (entryBuckets.get(path) ?? 0) + 1);

      const country = s.country || 'unknown';
      countryBuckets.set(country, (countryBuckets.get(country) ?? 0) + 1);

      const device = s.deviceType || 'unknown';
      deviceBuckets.set(device, (deviceBuckets.get(device) ?? 0) + 1);

      if (s.utmCampaign) {
        const existing = campaignBuckets.get(s.utmCampaign) ?? { sessions: 0, stale: false };
        campaignBuckets.set(s.utmCampaign, {
          sessions: existing.sessions + 1,
          stale: existing.stale || !!s.utmCampaignIsStale,
        });
      }
    }

    const sortDesc = <T extends { count: number }>(rows: T[]) => rows.sort((a, b) => b.count - a.count);

    const traffic = {
      totalSessions: sessions.length,
      sources: sortDesc(Array.from(sourceBuckets.entries()).map(([source, count]) => ({
        source, count, pct: sessions.length > 0 ? +((count / sessions.length) * 100).toFixed(1) : 0,
      }))),
      topEntryPages: sortDesc(Array.from(entryBuckets.entries()).map(([page, count]) => ({ page, count }))).slice(0, 10),
      countries: sortDesc(Array.from(countryBuckets.entries()).map(([country, count]) => ({ country, count }))).slice(0, 10),
      devices: sortDesc(Array.from(deviceBuckets.entries()).map(([device, count]) => ({ device, count }))),
      campaigns: Array.from(campaignBuckets.entries())
        .map(([campaign, v]) => ({ campaign, sessions: v.sessions, stale: v.stale }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 10),
      staleCampaignCount: Array.from(campaignBuckets.values()).filter(v => v.stale).length,
    };

    // -----------------------------------------------------------------
    // ENGAGEMENT — bounce, duration, scroll, rage clicks, intent
    // -----------------------------------------------------------------

    const totalSessions = sessions.length;
    const bouncedSessions = sessions.filter(s => s.isBounce).length;
    const durations = sessions
      .filter(s => s.endedAt && s.startedAt)
      .map(s => Math.round((s.endedAt!.getTime() - s.startedAt!.getTime()) / 1000));
    const avgDurationSec = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    const medianDurationSec = durations.length > 0
      ? durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)]
      : 0;

    const intentByClass = { HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 };
    let intentSum = 0; let intentCounted = 0;
    for (const s of sessions) {
      const cls = (s.intentClass as keyof typeof intentByClass) ?? 'NONE';
      if (cls in intentByClass) intentByClass[cls]++;
      if (s.intentScore != null) { intentSum += s.intentScore; intentCounted++; }
    }
    const avgIntent = intentCounted > 0 ? Math.round((intentSum / intentCounted) * 10) / 10 : 0;

    // Rage-click and hesitation top pages — small aggregate via raw SQL for speed
    const ragePages = await prisma.$queryRaw<{ pageUrl: string; rage: bigint }[]>`
      SELECT e."pageUrl", COUNT(*)::bigint AS rage
      FROM session_events e
      JOIN visitor_sessions s ON s.id = e."sessionId"
      WHERE e."siteId" = ${siteId}
        AND s."isBotFiltered" = false
        AND e."eventType" = 'RAGE_CLICK'
        AND e."timestamp" >= ${start}
        AND e."timestamp" <= ${end}
      GROUP BY e."pageUrl"
      ORDER BY rage DESC
      LIMIT 5
    `.catch(() => []);

    const engagement = {
      bounceRate: totalSessions > 0 ? +((bouncedSessions / totalSessions) * 100).toFixed(1) : 0,
      avgDurationSec,
      medianDurationSec,
      avgIntentScore: avgIntent,
      intentDistribution: intentByClass,
      topRageClickPages: ragePages.map(r => ({ page: toPath(r.pageUrl), count: Number(r.rage) })),
    };

    // -----------------------------------------------------------------
    // CONVERSION — funnel exploded + sources + CTA clicks
    // -----------------------------------------------------------------

    const goalPath = site.onboarding?.conversionGoalUrl ? toPath(site.onboarding.conversionGoalUrl) : null;
    let goalReachers = 0;
    if (goalPath) {
      goalReachers = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT pv."sessionId")::bigint AS count
        FROM page_views pv
        JOIN visitor_sessions s ON s.id = pv."sessionId"
        WHERE pv."siteId" = ${siteId}
          AND s."isBotFiltered" = false
          AND pv."timestamp" >= ${start}
          AND pv."timestamp" <= ${end}
          AND regexp_replace(regexp_replace(pv."pageUrl", '\\?.*$', ''), '/$', '') LIKE ${'%' + goalPath}
      `.then(rows => Number(rows[0]?.count ?? BigInt(0))).catch(() => 0);
    }

    const convEvents = await prisma.sessionEvent.findMany({
      where: {
        siteId, eventType: 'CONVERSION',
        timestamp: { gte: start, lte: end },
        session: { isBotFiltered: false },
      },
      select: { sessionId: true, metadata: true },
    });
    const ctaClickCount = await prisma.sessionEvent.count({
      where: {
        siteId, eventType: 'CLICK', isCtaClick: true,
        timestamp: { gte: start, lte: end },
        session: { isBotFiltered: false },
      },
    });

    const convBySource: Record<string, number> = {
      form_submit_auto: 0, calendly_iframe: 0, hubspot_iframe: 0, manual: 0,
    };
    const convertedSessionIds = new Set<string>();
    for (const e of convEvents) {
      const m = (e.metadata ?? {}) as Record<string, unknown>;
      const src = (m.source as string) ?? '';
      const k = ['form_submit_auto', 'calendly_iframe', 'hubspot_iframe'].includes(src) ? src : 'manual';
      convBySource[k]++;
      convertedSessionIds.add(e.sessionId);
    }

    const conversion = {
      goalConfigured: !!goalPath,
      goalName: site.onboarding?.conversionGoalName ?? null,
      funnel: {
        visitors: totalSessions,
        ctaClicks: ctaClickCount,
        reachedGoalPage: goalReachers,
        converted: convertedSessionIds.size,
      },
      conversionsBySource: Object.entries(convBySource)
        .filter(([, v]) => v > 0)
        .map(([source, count]) => ({
          source,
          label:
            source === 'form_submit_auto' ? 'Form submission'
            : source === 'calendly_iframe' ? 'Calendly booking'
            : source === 'hubspot_iframe' ? 'HubSpot form'
            : 'Manual / API',
          count,
        }))
        .sort((a, b) => b.count - a.count),
      totalConversionEvents: convEvents.length,
    };

    // -----------------------------------------------------------------
    // SEO — pull latest health-check + GSC summary if connected
    // -----------------------------------------------------------------

    const latestHealth = await prisma.siteHealthCheck.findFirst({
      where: { siteId },
      orderBy: { checkedAt: 'desc' },
      select: {
        snippetStatus: true,
        conversionGoalStatus: true,
        utmStatus: true,
        duplicateStatus: true,
        consentStatus: true,
        botStatus: true,
        pageSpeedStatus: true,
        overallStatus: true,
        lighthouseLcp: true,
        lighthouseCls: true,
        lighthouseFid: true,
        lighthouseScore: true,
        estimatedBotPercent: true,
        checkedAt: true,
      },
    });

    const seo = {
      connected: site.gscConnected,
      lastSyncAt: site.gscLastSyncAt?.toISOString() ?? null,
      health: latestHealth
        ? {
            overall: latestHealth.overallStatus,
            snippet: latestHealth.snippetStatus,
            conversionGoal: latestHealth.conversionGoalStatus,
            utm: latestHealth.utmStatus,
            duplicate: latestHealth.duplicateStatus,
            consent: latestHealth.consentStatus,
            bot: latestHealth.botStatus,
            pageSpeed: latestHealth.pageSpeedStatus,
            lighthouseLcp: latestHealth.lighthouseLcp,
            lighthouseCls: latestHealth.lighthouseCls,
            lighthouseFid: latestHealth.lighthouseFid,
            lighthouseScore: latestHealth.lighthouseScore,
            estimatedBotPercent: latestHealth.estimatedBotPercent,
            checkedAt: latestHealth.checkedAt?.toISOString() ?? null,
          }
        : null,
    };

    // -----------------------------------------------------------------
    // MARKET — most recent WebOpp keyword clusters if any
    // -----------------------------------------------------------------

    const latestAnalysis = await prisma.webOppAnalysis.findFirst({
      where: { siteId, status: 'COMPLETE' },
      orderBy: { completedAt: 'desc' },
      select: {
        id: true,
        totalMissedLeadsPerMonth: true,
        totalMissedRevenuePerMonth: true,
        totalOpportunitiesFound: true,
        topOpportunityCluster: true,
        completedAt: true,
      },
    });

    const gaps = latestAnalysis
      ? await prisma.webOppKeywordCluster.findMany({
          where: { analysisId: latestAnalysis.id, decision: { in: ['YES', 'MAYBE'] } },
          orderBy: [{ missedRevenue: 'desc' }, { monthlySearchVolume: 'desc' }],
          take: 10,
          select: {
            clusterName: true,
            primaryKeyword: true,
            monthlySearchVolume: true,
            currentRankPosition: true,
            competitorRankPosition: true,
            topCompetitorUrl: true,
            missedClicks: true,
            missedRevenue: true,
            decision: true,
          },
        })
      : [];

    const market = {
      hasAnalysis: !!latestAnalysis,
      lastAnalysisAt: latestAnalysis?.completedAt?.toISOString() ?? null,
      totalMissedRevenuePerMonth: latestAnalysis?.totalMissedRevenuePerMonth ?? null,
      totalOpportunitiesFound: latestAnalysis?.totalOpportunitiesFound ?? null,
      topClusterName: latestAnalysis?.topOpportunityCluster ?? null,
      gaps: gaps.map(g => ({
        cluster: g.clusterName,
        keyword: g.primaryKeyword,
        searchVolume: g.monthlySearchVolume,
        currentRank: g.currentRankPosition,
        competitorRank: g.competitorRankPosition,
        competitorUrl: g.topCompetitorUrl,
        missedClicks: g.missedClicks,
        missedRevenue: g.missedRevenue,
        decision: g.decision,
      })),
    };

    return NextResponse.json({
      site: { id: site.id, name: site.name },
      range: { days, start: start.toISOString(), end: end.toISOString() },
      traffic,
      engagement,
      conversion,
      seo,
      market,
    });
  } catch (err) {
    console.error('Detail API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
