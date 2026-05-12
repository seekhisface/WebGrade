// GET /api/dashboard/overview?siteId=xxx&days=30
//
// Returns the single payload that powers the new Overview page (the
// redesigned dashboard front door).  Three things:
//
//   1. The 3-step funnel:  Visitors → Goal Page → Conversions
//      with deltas vs the immediately-preceding period.
//   2. The #1 fix tile:    top-priority OPEN recommendation, sourced
//      from the initial WebAudit during days 1–45 and from rolling
//      WebWatch findings afterwards.
//   3. The empty state:    whether the snippet has produced enough
//      sessions yet to show real numbers.
//
// All three live behind one endpoint so the page paints in one round
// trip — no skeleton-flashing while we wait for individual tiles.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MIN_SESSIONS_FOR_FUNNEL = 50; // Below this we show the empty state.

function toPath(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/$/, '') || '/';
  } catch {
    return url.split('#')[0].split('?')[0].replace(/\/$/, '') || '/';
  }
}

function pctDelta(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return Math.round(((curr - prev) / prev) * 100);
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = req.nextUrl.searchParams.get('siteId');
    const daysParam = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10);
    const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 365 ? daysParam : 30;

    if (!siteId) {
      return NextResponse.json({ error: 'siteId required' }, { status: 400 });
    }

    const access = await verifySiteAccess(session.user.email, siteId);
    if (!access) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        name: true,
        domain: true,
        url: true,
        webauditStartDate: true,
        webauditEndDate: true,
        subscriptionTier: true,
        onboarding: {
          select: {
            conversionGoalUrl: true,
            conversionGoalName: true,
            conversionFormSelector: true,
            averageOrderValue: true,
            leadToWinRate: true,
            monthlyAdSpend: true,
          },
        },
      },
    });

    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    // ---------------------------------------------------------------------
    // Date windows: current period + matching prior period of equal length
    // ---------------------------------------------------------------------

    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 86400000);
    const priorStart = new Date(now.getTime() - days * 2 * 86400000);
    const priorEnd = currentStart;

    // ---------------------------------------------------------------------
    // Visitors (human sessions; bots filtered out)
    // ---------------------------------------------------------------------

    const [visitorsCurr, visitorsPrev] = await Promise.all([
      prisma.visitorSession.count({
        where: { siteId, isBotFiltered: false, startedAt: { gte: currentStart, lte: now } },
      }),
      prisma.visitorSession.count({
        where: { siteId, isBotFiltered: false, startedAt: { gte: priorStart, lt: priorEnd } },
      }),
    ]);

    // ---------------------------------------------------------------------
    // Goal-page reaches
    // ---------------------------------------------------------------------
    // Counted as: distinct sessions whose PageView path matches the
    // onboarding-configured conversionGoalUrl path.  Match on pathname so
    // query strings / fragments don't break the comparison.
    // ---------------------------------------------------------------------

    const goalUrl = site.onboarding?.conversionGoalUrl ?? null;
    const goalPath = goalUrl ? toPath(goalUrl) : null;
    const goalConfigured = !!goalPath;

    let goalCurr = 0;
    let goalPrev = 0;

    if (goalPath) {
      // The pageUrl column may store the full URL, the path, or both with a
      // trailing slash. Use a tolerant raw-SQL match on the trailing-slash-
      // stripped pathname extracted from the stored URL.
      // For sites that already stored pageUrl as path-only, the regex still
      // works because regexp_replace handles either form.
      const [currRows, prevRows] = await Promise.all([
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(DISTINCT pv."sessionId")::bigint AS count
          FROM page_views pv
          JOIN visitor_sessions s ON s.id = pv."sessionId"
          WHERE pv."siteId" = ${siteId}
            AND s."isBotFiltered" = false
            AND pv."timestamp" >= ${currentStart}
            AND pv."timestamp" <= ${now}
            AND (
              regexp_replace(regexp_replace(pv."pageUrl", '\\?.*$', ''), '/$', '') = ${goalPath}
              OR regexp_replace(regexp_replace(pv."pageUrl", '\\?.*$', ''), '/$', '') LIKE ${'%' + goalPath}
            )
        `.catch(() => [{ count: BigInt(0) }]),
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(DISTINCT pv."sessionId")::bigint AS count
          FROM page_views pv
          JOIN visitor_sessions s ON s.id = pv."sessionId"
          WHERE pv."siteId" = ${siteId}
            AND s."isBotFiltered" = false
            AND pv."timestamp" >= ${priorStart}
            AND pv."timestamp" < ${priorEnd}
            AND (
              regexp_replace(regexp_replace(pv."pageUrl", '\\?.*$', ''), '/$', '') = ${goalPath}
              OR regexp_replace(regexp_replace(pv."pageUrl", '\\?.*$', ''), '/$', '') LIKE ${'%' + goalPath}
            )
        `.catch(() => [{ count: BigInt(0) }]),
      ]);

      goalCurr = Number(currRows[0]?.count ?? BigInt(0));
      goalPrev = Number(prevRows[0]?.count ?? BigInt(0));
    }

    // ---------------------------------------------------------------------
    // Conversions
    // ---------------------------------------------------------------------
    // Distinct sessions in range with at least one CONVERSION event. This
    // captures all four conversion sources our snippet emits:
    //   form_submit_auto, calendly_iframe, hubspot_iframe, manual
    // and is more comprehensive than session.conversionGoalHit (which only
    // covers the configured URL-based goal).
    // ---------------------------------------------------------------------

    const [convCurrRows, convPrevRows] = await Promise.all([
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT e."sessionId")::bigint AS count
        FROM session_events e
        JOIN visitor_sessions s ON s.id = e."sessionId"
        WHERE e."siteId" = ${siteId}
          AND s."isBotFiltered" = false
          AND e."eventType" = 'CONVERSION'
          AND e."timestamp" >= ${currentStart}
          AND e."timestamp" <= ${now}
      `.catch(() => [{ count: BigInt(0) }]),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT e."sessionId")::bigint AS count
        FROM session_events e
        JOIN visitor_sessions s ON s.id = e."sessionId"
        WHERE e."siteId" = ${siteId}
          AND s."isBotFiltered" = false
          AND e."eventType" = 'CONVERSION'
          AND e."timestamp" >= ${priorStart}
          AND e."timestamp" < ${priorEnd}
      `.catch(() => [{ count: BigInt(0) }]),
    ]);

    const convCurr = Number(convCurrRows[0]?.count ?? BigInt(0));
    const convPrev = Number(convPrevRows[0]?.count ?? BigInt(0));

    // ---------------------------------------------------------------------
    // #1 fix tile — top-priority recommendation
    // ---------------------------------------------------------------------
    // During days 1–45 of the WebAudit period we prefer a recommendation
    // sourced from the initial audit (so the customer sees the "still #1"
    // promise). After day 45 we pull the highest-priority open finding from
    // any module, which in practice will be WebWatch.
    //
    // The recommendation table doesn't tag rows as "audit vs watch" — we
    // infer it by date: any recommendation created on or before
    // webauditEndDate is considered part of the audit.
    // ---------------------------------------------------------------------

    const inAuditPeriod = !!(site.webauditEndDate && now <= site.webauditEndDate);
    const auditWindowEnd = site.webauditEndDate ?? null;

    let topFix = await prisma.recommendation.findFirst({
      where: {
        siteId,
        implementationStatus: { in: ['OPEN', 'IN_PROGRESS'] },
        ...(inAuditPeriod && auditWindowEnd
          ? { createdAt: { lte: auditWindowEnd } }
          : {}),
      },
      orderBy: { priorityScore: 'desc' },
      select: {
        id: true,
        title: true,
        finding: true,
        fixAction: true,
        expectedResult: true,
        priorityScore: true,
        sourceModule: true,
        createdAt: true,
        baselineMetricValue: true,
        targetMetricValue: true,
      },
    });

    // If we're in the audit window but no audit-period recommendations
    // exist yet (audit still generating), fall back to the latest of any
    // age so we always have something to show.
    if (!topFix) {
      topFix = await prisma.recommendation.findFirst({
        where: { siteId, implementationStatus: { in: ['OPEN', 'IN_PROGRESS'] } },
        orderBy: { priorityScore: 'desc' },
        select: {
          id: true,
          title: true,
          finding: true,
          fixAction: true,
          expectedResult: true,
          priorityScore: true,
          sourceModule: true,
          createdAt: true,
          baselineMetricValue: true,
          targetMetricValue: true,
        },
      });
    }

    // Rough dollar-impact estimate: visitors × delta-conversion-rate × AOV
    // × lead-to-win. We only show this if all the inputs exist so we don't
    // surface bogus "$0/mo" numbers.
    let dollarImpact: number | null = null;
    const aov = site.onboarding?.averageOrderValue ?? null;
    const ltw = site.onboarding?.leadToWinRate ?? null;
    if (topFix && aov && ltw && topFix.baselineMetricValue != null && topFix.targetMetricValue != null && visitorsCurr > 0) {
      // baselineMetricValue / targetMetricValue are stored as 0–1 rates.
      const lift = Math.max(0, topFix.baselineMetricValue - topFix.targetMetricValue);
      const additionalConversions = visitorsCurr * lift;
      // Period→monthly normalization
      const monthlyMultiplier = 30 / days;
      dollarImpact = Math.round(additionalConversions * aov * ltw * monthlyMultiplier);
    }

    // ---------------------------------------------------------------------
    // Most recent audit report (for the "Read your full 45-day audit →" link)
    // ---------------------------------------------------------------------

    const auditReport = await prisma.report.findFirst({
      where: { siteId, type: 'INTERIM', status: 'COMPLETE' },
      orderBy: { periodEnd: 'desc' },
      select: { id: true, periodEnd: true },
    });

    // ---------------------------------------------------------------------
    // Compose response
    // ---------------------------------------------------------------------

    const reachRate = visitorsCurr > 0 ? +((goalCurr / visitorsCurr) * 100).toFixed(1) : 0;
    const reachRatePrev = visitorsPrev > 0 ? +((goalPrev / visitorsPrev) * 100).toFixed(1) : 0;
    const convertRate = goalCurr > 0 ? +((convCurr / goalCurr) * 100).toFixed(1) : 0;
    const convertRatePrev = goalPrev > 0 ? +((convPrev / goalPrev) * 100).toFixed(1) : 0;
    const overallRate = visitorsCurr > 0 ? +((convCurr / visitorsCurr) * 100).toFixed(2) : 0;
    const overallRatePrev = visitorsPrev > 0 ? +((convPrev / visitorsPrev) * 100).toFixed(2) : 0;

    const totalSessionsAllTime = await prisma.visitorSession.count({
      where: { siteId, isBotFiltered: false },
    });
    const isEmpty = totalSessionsAllTime < MIN_SESSIONS_FOR_FUNNEL;
    const emptyReason: 'no_sessions' | 'insufficient_data' | null = isEmpty
      ? (totalSessionsAllTime === 0 ? 'no_sessions' : 'insufficient_data')
      : null;

    return NextResponse.json({
      site: {
        id: site.id,
        name: site.name,
        domain: site.domain,
        url: site.url,
        subscriptionTier: site.subscriptionTier,
      },
      range: {
        start: currentStart.toISOString(),
        end: now.toISOString(),
        days,
        label: `Last ${days} days vs prior ${days}`,
      },
      funnel: {
        visitors: {
          count: visitorsCurr,
          delta: visitorsCurr - visitorsPrev,
          deltaPct: pctDelta(visitorsCurr, visitorsPrev),
        },
        goalPage: {
          count: goalCurr,
          delta: goalCurr - goalPrev,
          deltaPct: pctDelta(goalCurr, goalPrev),
          reachRate,
          reachRateDelta: +(reachRate - reachRatePrev).toFixed(1),
        },
        conversions: {
          count: convCurr,
          delta: convCurr - convPrev,
          deltaPct: pctDelta(convCurr, convPrev),
          convertRate,
          convertRateDelta: +(convertRate - convertRatePrev).toFixed(1),
        },
        overallRate: {
          rate: overallRate,
          delta: +(overallRate - overallRatePrev).toFixed(2),
        },
        goalConfigured,
        goalUrl,
        goalName: site.onboarding?.conversionGoalName ?? null,
      },
      topFix: topFix
        ? {
            available: true,
            source: inAuditPeriod ? 'WEBAUDIT' : 'WEBWATCH',
            recommendationId: topFix.id,
            title: topFix.title,
            finding: topFix.finding,
            fixAction: topFix.fixAction,
            expectedResult: topFix.expectedResult,
            priorityScore: topFix.priorityScore,
            sourceModule: topFix.sourceModule,
            dollarImpactPerMonth: dollarImpact,
          }
        : { available: false },
      auditReport: {
        available: !!auditReport,
        reportId: auditReport?.id ?? null,
        inAuditPeriod,
        auditEndsAt: site.webauditEndDate?.toISOString() ?? null,
      },
      emptyState: {
        isEmpty,
        reason: emptyReason,
        sessionsCollected: totalSessionsAllTime,
        minimumSessions: MIN_SESSIONS_FOR_FUNNEL,
      },
    });
  } catch (err) {
    console.error('Overview API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
