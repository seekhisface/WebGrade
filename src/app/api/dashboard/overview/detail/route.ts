// GET /api/dashboard/overview/detail?siteId=xxx&days=30&step=visitors|goal|conversions
//
// Powers the three Overview slide-out panels. One route, one shape per
// step — we return only the primary breakdown the user agreed on for that
// step, not a full report. Keeps the panel readable and the round trip
// small.
//
//   step=visitors    → traffic source breakdown + top entry pages
//   step=goal        → top FROM-pages + reach-vs-bounce on the goal page
//   step=conversions → breakdown by source (form/Calendly/HubSpot/manual)
//                      + top traffic source that converted

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
    const step = req.nextUrl.searchParams.get('step'); // 'visitors' | 'goal' | 'conversions'
    const daysParam = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10);
    const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 365 ? daysParam : 30;

    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });
    if (!step || !['visitors', 'goal', 'conversions'].includes(step)) {
      return NextResponse.json({ error: 'step must be visitors | goal | conversions' }, { status: 400 });
    }

    const access = await verifySiteAccess(session.user.email, siteId);
    if (!access) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const start = new Date(Date.now() - days * 86400000);
    const end = new Date();

    // -----------------------------------------------------------------
    // STEP: visitors — traffic source breakdown + top entry pages
    // -----------------------------------------------------------------
    if (step === 'visitors') {
      const sessions = await prisma.visitorSession.findMany({
        where: { siteId, isBotFiltered: false, startedAt: { gte: start, lte: end } },
        select: { trafficSource: true, entryPage: true, utmSource: true, utmMedium: true },
      });

      // Bucket by trafficSource; fall back to utmMedium → 'direct'
      const sourceBuckets = new Map<string, number>();
      for (const s of sessions) {
        const key = s.trafficSource || s.utmMedium || 'direct';
        sourceBuckets.set(key, (sourceBuckets.get(key) ?? 0) + 1);
      }
      const sources = Array.from(sourceBuckets.entries())
        .map(([source, count]) => ({
          source,
          count,
          pct: sessions.length > 0 ? +((count / sessions.length) * 100).toFixed(1) : 0,
        }))
        .sort((a, b) => b.count - a.count);

      const pageBuckets = new Map<string, number>();
      for (const s of sessions) {
        const path = toPath(s.entryPage);
        if (!path) continue;
        pageBuckets.set(path, (pageBuckets.get(path) ?? 0) + 1);
      }
      const topEntryPages = Array.from(pageBuckets.entries())
        .map(([page, count]) => ({ page, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return NextResponse.json({
        step: 'visitors',
        totalVisitors: sessions.length,
        sources,
        topEntryPages,
      });
    }

    // -----------------------------------------------------------------
    // STEP: goal — top FROM-pages + reach/bounce on the goal page
    // -----------------------------------------------------------------
    if (step === 'goal') {
      const ob = await prisma.siteOnboarding.findUnique({
        where: { siteId },
        select: { conversionGoalUrl: true, conversionGoalName: true },
      });
      const goalUrl = ob?.conversionGoalUrl ?? null;
      const goalPath = goalUrl ? toPath(goalUrl) : null;

      if (!goalPath) {
        return NextResponse.json({
          step: 'goal',
          goalConfigured: false,
          goalName: null,
          goalPath: null,
          reachedSessions: 0,
          convertedAfterReach: 0,
          bouncedAfterReach: 0,
          topFromPages: [],
        });
      }

      // Distinct sessions that reached the goal page in range
      const reachedRows = await prisma.$queryRaw<{ sessionId: string }[]>`
        SELECT DISTINCT pv."sessionId"
        FROM page_views pv
        JOIN visitor_sessions s ON s.id = pv."sessionId"
        WHERE pv."siteId" = ${siteId}
          AND s."isBotFiltered" = false
          AND pv."timestamp" >= ${start}
          AND pv."timestamp" <= ${end}
          AND regexp_replace(regexp_replace(pv."pageUrl", '\\?.*$', ''), '/$', '') LIKE ${'%' + goalPath}
      `.catch(() => []);

      const reachedSessionIds = reachedRows.map(r => r.sessionId);
      const reachedCount = reachedSessionIds.length;

      // Of those reaching sessions, how many converted (had a CONVERSION event)
      let convertedAfterReach = 0;
      if (reachedSessionIds.length > 0) {
        convertedAfterReach = await prisma.sessionEvent.findMany({
          where: {
            siteId,
            sessionId: { in: reachedSessionIds },
            eventType: 'CONVERSION',
          },
          distinct: ['sessionId'],
          select: { sessionId: true },
        }).then(rows => rows.length);
      }
      const bouncedAfterReach = Math.max(0, reachedCount - convertedAfterReach);

      // Top FROM-pages: for each session that reached the goal page, what
      // was the page they viewed immediately BEFORE the first goal-page view?
      const topFromPages = await prisma.$queryRaw<{ fromPage: string; count: bigint }[]>`
        WITH goal_views AS (
          SELECT pv."sessionId",
                 MIN(pv."timestamp") AS goal_time
          FROM page_views pv
          JOIN visitor_sessions s ON s.id = pv."sessionId"
          WHERE pv."siteId" = ${siteId}
            AND s."isBotFiltered" = false
            AND pv."timestamp" >= ${start}
            AND pv."timestamp" <= ${end}
            AND regexp_replace(regexp_replace(pv."pageUrl", '\\?.*$', ''), '/$', '') LIKE ${'%' + goalPath}
          GROUP BY pv."sessionId"
        ),
        from_pages AS (
          SELECT g."sessionId",
                 (SELECT pv2."pageUrl"
                  FROM page_views pv2
                  WHERE pv2."sessionId" = g."sessionId"
                    AND pv2."timestamp" < g.goal_time
                  ORDER BY pv2."timestamp" DESC
                  LIMIT 1) AS "fromPage"
          FROM goal_views g
        )
        SELECT "fromPage", COUNT(*)::bigint AS count
        FROM from_pages
        WHERE "fromPage" IS NOT NULL
        GROUP BY "fromPage"
        ORDER BY count DESC
        LIMIT 10
      `.catch(() => []);

      return NextResponse.json({
        step: 'goal',
        goalConfigured: true,
        goalName: ob?.conversionGoalName ?? null,
        goalPath,
        reachedSessions: reachedCount,
        convertedAfterReach,
        bouncedAfterReach,
        bounceRate: reachedCount > 0 ? +((bouncedAfterReach / reachedCount) * 100).toFixed(1) : 0,
        topFromPages: topFromPages.map(p => ({
          page: toPath(p.fromPage),
          count: Number(p.count),
        })),
      });
    }

    // -----------------------------------------------------------------
    // STEP: conversions — breakdown by source + top converting channel
    // -----------------------------------------------------------------
    if (step === 'conversions') {
      const events = await prisma.sessionEvent.findMany({
        where: {
          siteId,
          eventType: 'CONVERSION',
          timestamp: { gte: start, lte: end },
          session: { isBotFiltered: false },
        },
        select: {
          sessionId: true,
          timestamp: true,
          metadata: true,
          session: {
            select: { trafficSource: true, utmMedium: true, utmCampaign: true },
          },
        },
        orderBy: { timestamp: 'desc' },
      });

      // Bucket by metadata.source
      type SrcKey = 'form_submit_auto' | 'calendly_iframe' | 'hubspot_iframe' | 'manual';
      const bySource: Record<SrcKey, number> = {
        form_submit_auto: 0,
        calendly_iframe: 0,
        hubspot_iframe: 0,
        manual: 0,
      };
      const sessionSeen = new Set<string>();
      // Track top converting traffic channel
      const channelBuckets = new Map<string, number>();
      const recent: { at: string; source: string; channel: string }[] = [];

      for (const e of events) {
        const m = (e.metadata ?? {}) as Record<string, unknown>;
        const src = (m.source as string) ?? '';
        let bucket: SrcKey;
        if (src === 'form_submit_auto') bucket = 'form_submit_auto';
        else if (src === 'calendly_iframe') bucket = 'calendly_iframe';
        else if (src === 'hubspot_iframe') bucket = 'hubspot_iframe';
        else bucket = 'manual';
        bySource[bucket]++;

        // Count converting sessions per traffic channel (once per session)
        if (!sessionSeen.has(e.sessionId)) {
          sessionSeen.add(e.sessionId);
          const channel = e.session.trafficSource || e.session.utmMedium || 'direct';
          channelBuckets.set(channel, (channelBuckets.get(channel) ?? 0) + 1);
        }

        if (recent.length < 10) {
          recent.push({
            at: e.timestamp.toISOString(),
            source: bucket,
            channel: e.session.trafficSource || e.session.utmMedium || 'direct',
          });
        }
      }

      const sources = (Object.keys(bySource) as SrcKey[])
        .map(k => ({
          source: k,
          label:
            k === 'form_submit_auto' ? 'Form submission'
            : k === 'calendly_iframe' ? 'Calendly booking'
            : k === 'hubspot_iframe' ? 'HubSpot form'
            : 'Manual / API',
          count: bySource[k],
        }))
        .filter(s => s.count > 0);

      const topChannels = Array.from(channelBuckets.entries())
        .map(([channel, count]) => ({ channel, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return NextResponse.json({
        step: 'conversions',
        totalConversions: events.length,
        uniqueConvertedSessions: sessionSeen.size,
        sources,
        topChannels,
        recent,
      });
    }

    return NextResponse.json({ error: 'unknown step' }, { status: 400 });
  } catch (err) {
    console.error('Overview detail API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
