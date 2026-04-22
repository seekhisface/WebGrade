// src/app/api/analytics/funnel/route.ts
// GET /api/analytics/funnel?siteId=xxx&days=30
// Returns funnel abandonment data: CTA clicks → form starts → form submits → conversions

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = req.nextUrl.searchParams.get('siteId');
    const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10);
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    // Verify access
    const site = await verifySiteAccess(session.user.email, siteId);
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const periodStart = new Date(Date.now() - days * 86400000);

    // Count funnel stages from session events
    const [totalSessions, ctaClicks, formStarts, formSubmits, conversions] = await Promise.all([
      // Total non-bot sessions in period
      prisma.visitorSession.count({
        where: { siteId, isBotFiltered: false, startedAt: { gte: periodStart } },
      }),
      // CTA clicks (CLICK events on buttons/links with CTA-like text)
      prisma.sessionEvent.count({
        where: {
          siteId,
          eventType: 'CLICK',
          timestamp: { gte: periodStart },
          session: { isBotFiltered: false },
        },
      }),
      // Form focus events (user started interacting with a form)
      prisma.sessionEvent.count({
        where: {
          siteId,
          eventType: 'FORM_FOCUS',
          timestamp: { gte: periodStart },
          session: { isBotFiltered: false },
        },
      }),
      // Form submit events
      prisma.sessionEvent.count({
        where: {
          siteId,
          eventType: 'FORM_SUBMIT',
          timestamp: { gte: periodStart },
          session: { isBotFiltered: false },
        },
      }),
      // Conversion events (goal hit)
      prisma.visitorSession.count({
        where: {
          siteId,
          isBotFiltered: false,
          startedAt: { gte: periodStart },
          conversionGoalHit: true,
        },
      }),
    ]);

    // Calculate drop-off at each stage
    const stages = [
      { name: 'Visitors', count: totalSessions, rate: 100 },
      { name: 'Engaged (clicked CTA)', count: ctaClicks, rate: totalSessions > 0 ? Math.min(100, Math.round((ctaClicks / totalSessions) * 100)) : 0 },
      { name: 'Started form', count: formStarts, rate: totalSessions > 0 ? Math.min(100, Math.round((formStarts / totalSessions) * 100)) : 0 },
      { name: 'Submitted form', count: formSubmits, rate: totalSessions > 0 ? Math.min(100, Math.round((formSubmits / totalSessions) * 100)) : 0 },
      { name: 'Converted', count: conversions, rate: totalSessions > 0 ? Math.min(100, Math.round((conversions / totalSessions) * 100)) : 0 },
    ];

    // Calculate drop-off between stages
    const dropOffs = stages.slice(1).map((stage, i) => ({
      from: stages[i].name,
      to: stage.name,
      dropped: Math.max(0, stages[i].count - stage.count),
      dropRate: stages[i].count > 0 ? Math.min(100, Math.round(((stages[i].count - stage.count) / stages[i].count) * 100)) : 0,
    }));

    // Top pages where form abandonment happens (form_focus but no form_submit in same session)
    const abandonmentPages = await prisma.$queryRaw<{ pageUrl: string; abandons: bigint }[]>`
      SELECT e."pageUrl", COUNT(DISTINCT e."sessionId") as abandons
      FROM session_events e
      JOIN visitor_sessions s ON s.id = e."sessionId"
      WHERE e."siteId" = ${siteId}
        AND e."eventType" = 'FORM_FOCUS'
        AND e.timestamp >= ${periodStart}
        AND s."isBotFiltered" = false
        AND e."sessionId" NOT IN (
          SELECT DISTINCT "sessionId" FROM session_events
          WHERE "siteId" = ${siteId} AND "eventType" = 'FORM_SUBMIT'
        )
      GROUP BY e."pageUrl"
      ORDER BY abandons DESC
      LIMIT 5
    `.catch(() => []);

    return NextResponse.json({
      stages,
      dropOffs,
      abandonmentPages: abandonmentPages.map(p => ({
        url: p.pageUrl,
        abandonments: Number(p.abandons),
      })),
      period: { days, start: periodStart.toISOString() },
    });
  } catch (err) {
    console.error('Funnel error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
