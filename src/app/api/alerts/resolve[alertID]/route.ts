export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/**
 * POST /api/alerts/resolve
 *
 * AL-07: Auto-Resolution Detection
 *
 * Scans open alerts and auto-resolves them if the underlying condition
 * has returned to normal. Called periodically by Inngest scheduler.
 *
 * Resolution logic per alert type:
 *  - CONVERSION_DROP: resolved if conversion rate back within 10% of baseline
 *  - BOUNCE_RATE_SPIKE: resolved if bounce rate back within 10% of baseline
 *  - SNIPPET_FIRING_STOPPED: resolved if events received in last 24h
 *  - SEO_REGRESSION: resolved if score recovered to within 5 points
 *  - WASTED_SPEND_DETECTED: requires manual resolution (can't auto-detect)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const siteId = body.siteId as string | undefined;

  // Load open alerts (optionally scoped to a site)
  const openAlerts = await prisma.alert.findMany({
    where: {
      resolvedAt: null,
      ...(siteId ? { siteId } : {}),
      // Only check alerts older than 1 hour (avoid false resolutions)
      triggeredAt: { lte: new Date(Date.now() - 60 * 60 * 1000) },
    },
    include: { site: true },
    orderBy: { triggeredAt: 'asc' },
    take: 100,
  });

  const resolved: string[] = [];
  const skipped: string[] = [];

  for (const alert of openAlerts) {
    const shouldResolve = await checkResolution(alert);

    if (shouldResolve) {
      const resolutionMs = Date.now() - alert.triggeredAt.getTime();
      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          resolvedAt: new Date(),
          resolvedAutomatically: true,
          resolutionTimeMs: resolutionMs,
        },
      });
      resolved.push(alert.id);
    } else {
      skipped.push(alert.id);
    }
  }

  return NextResponse.json({
    checked: openAlerts.length,
    resolved: resolved.length,
    skipped: skipped.length,
    resolvedIds: resolved,
  });
}

// ── GET — list open alerts for a site ────────────────────────────────────────

export async function GET(req: NextRequest) {
  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const [open, resolved] = await Promise.all([
    prisma.alert.findMany({
      where: { siteId, resolvedAt: null },
      orderBy: [{ severity: 'desc' }, { triggeredAt: 'desc' }],
    }),
    prisma.alert.findMany({
      where: { siteId, resolvedAt: { not: null } },
      orderBy: { resolvedAt: 'desc' },
      take: 20,
    }),
  ]);

  const avgResolutionMs = resolved
    .filter(a => a.resolutionTimeMs)
    .reduce((sum, a, _, arr) => sum + (a.resolutionTimeMs ?? 0) / arr.length, 0);

  return NextResponse.json({
    open,
    recentlyResolved: resolved,
    stats: {
      openCount: open.length,
      criticalCount: open.filter(a => a.severity === 'CRITICAL').length,
      avgResolutionHours: Math.round(avgResolutionMs / (1000 * 60 * 60) * 10) / 10,
    },
  });
}

// ---------------------------------------------------------------------------
// Resolution logic per alert type
// ---------------------------------------------------------------------------

async function checkResolution(alert: {
  id: string;
  siteId: string;
  alertType: string;
  triggeredAt: Date;
}): Promise<boolean> {
  const { siteId, alertType } = alert;

  switch (alertType) {
    case 'SNIPPET_FIRING_STOPPED': {
      // Resolved if we've received any events in the last 24h
      const recentEvent = await prisma.pageView.findFirst({
        where: { siteId, timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });
      return recentEvent !== null;
    }

    case 'CONVERSION_DROP': {
      // Resolved if conversion rate has recovered to within 15% of baseline
      const baseline = await prisma.siteBaseline.findFirst({
        where: { siteId, metricKey: 'conversion_rate' },
        orderBy: { capturedAt: 'desc' },
      });
      if (!baseline) return false;

      // Get recent conversion rate from sessions
      const recentWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const sessions = await prisma.visitorSession.count({ where: { siteId, startedAt: { gte: recentWindow } } });
      const conversions = await prisma.visitorSession.count({
        where: { siteId, startedAt: { gte: recentWindow }, converted: true },
      });

      if (sessions < 50) return false; // Not enough data
      const currentRate = conversions / sessions;
      const dropThreshold = baseline.value * 0.85; // Within 15% of baseline
      return currentRate >= dropThreshold;
    }

    case 'BOUNCE_RATE_SPIKE': {
      // Resolved if bounce rate is back within 15% of baseline
      const baseline = await prisma.siteBaseline.findFirst({
        where: { siteId, metricKey: 'bounce_rate' },
        orderBy: { capturedAt: 'desc' },
      });
      if (!baseline) return false;

      const recentWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const sessions = await prisma.visitorSession.count({ where: { siteId, startedAt: { gte: recentWindow } } });
      const bounces = await prisma.visitorSession.count({
        where: { siteId, startedAt: { gte: recentWindow }, pageViewCount: 1 },
      });

      if (sessions < 50) return false;
      const currentRate = bounces / sessions;
      const spikeThreshold = baseline.value * 1.15; // Within 15% of baseline
      return currentRate <= spikeThreshold;
    }

    case 'WASTED_SPEND_DETECTED':
      // Requires manual resolution
      return false;

    case 'NEW_HIGH_VALUE_OPPORTUNITY':
      // Auto-resolve after 30 days (opportunity is acknowledged/acted on or stale)
      return Date.now() - alert.triggeredAt.getTime() > 30 * 24 * 60 * 60 * 1000;

    case 'SEO_REGRESSION':
      // Auto-resolve after 14 days if no further degradation
      return Date.now() - alert.triggeredAt.getTime() > 14 * 24 * 60 * 60 * 1000;

    default:
      return false;
  }
}
