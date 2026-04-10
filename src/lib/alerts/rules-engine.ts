/**
 * AL-01: Alert Rules Engine
 *
 * Evaluates 14 alert conditions per site.
 * Runs hourly via Inngest cron job.
 * 24-hour debounce prevents alert spam.
 */

import { prisma } from '@/lib/db/client';
import type { AlertType, AlertSeverity } from '@prisma/client';

interface AlertEvaluation {
  alertType: AlertType;
  severity: AlertSeverity;
  fired: boolean;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Evaluate all alert rules for a site.
 * Returns the number of new alerts fired.
 */
export async function evaluateAlertRules(siteId: string): Promise<number> {
  const [site, settings] = await Promise.all([
    prisma.site.findUnique({
      where: { id: siteId },
      include: {
        onboarding: true,
        _count: { select: { visitorSessions: true } }
      }
    }),
    prisma.alertSetting.findMany({ where: { siteId, isEnabled: true } }),
  ]);

  if (!site) return 0;

  const enabledAlertTypes = new Set(settings.map(s => s.alertType));
  const evaluations = await Promise.all([
    checkConversionDrop(siteId, enabledAlertTypes),
    checkBounceSurge(siteId, enabledAlertTypes),
    checkWastedSpend(siteId, enabledAlertTypes),
    checkSnippetHealth(siteId, enabledAlertTypes),
    checkSeoRegression(siteId, enabledAlertTypes),
  ]);

  let fired = 0;

  for (const eval_ of evaluations) {
    if (!eval_.fired) continue;

    // 24-hour debounce: check if this alert type fired recently
    const recentAlert = await prisma.alert.findFirst({
      where: {
        siteId,
        alertType: eval_.alertType,
        triggeredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        resolvedAt: null,
      },
    });

    if (recentAlert) continue; // Debounced

    // Fire the alert
    await prisma.alert.create({
      data: {
        siteId,
        alertType: eval_.alertType,
        severity: eval_.severity,
        productModule: mapAlertTypeToModule(eval_.alertType),
        message: eval_.message,
        metadata: eval_.metadata as object ?? undefined,
      },
    });

    fired++;
  }

  return fired;
}

// ---------------------------------------------------------------------------
// Individual alert checks
// ---------------------------------------------------------------------------

async function checkConversionDrop(
  siteId: string,
  enabled: Set<AlertType>
): Promise<AlertEvaluation> {
  const type: AlertType = 'CONVERSION_DROP';
  if (!enabled.has(type)) return skip(type);

  // Compare conversion rate: last 24h vs previous 24h
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const [recent, previous] = await Promise.all([
    getConversionRate(siteId, oneDayAgo, now),
    getConversionRate(siteId, twoDaysAgo, oneDayAgo),
  ]);

  if (!recent || !previous || previous.sessions < 20) return skip(type);

  const dropPct = ((previous.rate - recent.rate) / previous.rate) * 100;

  if (dropPct >= 25) { // 25% or more drop
    return {
      alertType: type,
      severity: dropPct >= 50 ? 'CRITICAL' : 'HIGH',
      fired: true,
      message: `Conversion rate dropped ${dropPct.toFixed(0)}% in the last 24 hours (${(previous.rate * 100).toFixed(1)}% → ${(recent.rate * 100).toFixed(1)}%)`,
      metadata: { previousRate: previous.rate, currentRate: recent.rate, dropPct },
    };
  }

  return skip(type);
}

async function checkBounceSurge(
  siteId: string,
  enabled: Set<AlertType>
): Promise<AlertEvaluation> {
  const type: AlertType = 'BOUNCE_RATE_SPIKE';
  if (!enabled.has(type)) return skip(type);

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const [recent, previous] = await Promise.all([
    getBounceRate(siteId, oneDayAgo, new Date()),
    getBounceRate(siteId, twoDaysAgo, oneDayAgo),
  ]);

  if (!recent || !previous || previous.sessions < 30) return skip(type);

  const spikePct = ((recent.rate - previous.rate) / previous.rate) * 100;

  if (spikePct >= 20) {
    return {
      alertType: type,
      severity: 'HIGH',
      fired: true,
      message: `Bounce rate increased ${spikePct.toFixed(0)}% in the last 24 hours`,
      metadata: { previousRate: previous.rate, currentRate: recent.rate, spikePct },
    };
  }

  return skip(type);
}

async function checkWastedSpend(
  siteId: string,
  enabled: Set<AlertType>
): Promise<AlertEvaluation> {
  const type: AlertType = 'WASTED_SPEND_DETECTED';
  if (!enabled.has(type)) return skip(type);

  const wastefulSources = await prisma.adSource.findMany({
    where: {
      siteId,
      OR: [
        { has404LandingPage: true },
        { hasZeroConversions: true, platformSpend: { gt: 100 } },
        { hasSlowLandingPage: true, platformSpend: { gt: 500 } },
      ]
    },
    select: { source: true, campaign: true, estimatedWastedSpend: true }
  });

  const totalWaste = wastefulSources.reduce(
    (sum, s) => sum + (s.estimatedWastedSpend ?? 0), 0
  );

  if (wastefulSources.length > 0 && totalWaste > 100) {
    return {
      alertType: type,
      severity: totalWaste > 1000 ? 'CRITICAL' : 'HIGH',
      fired: true,
      message: `Estimated $${totalWaste.toLocaleString()}/mo in wasted ad spend detected across ${wastefulSources.length} campaign(s)`,
      metadata: { totalWaste, sources: wastefulSources.slice(0, 3) },
    };
  }

  return skip(type);
}

async function checkSnippetHealth(
  siteId: string,
  enabled: Set<AlertType>
): Promise<AlertEvaluation> {
  const type: AlertType = 'SNIPPET_FIRING_STOPPED';
  if (!enabled.has(type)) return skip(type);

  // If no events in last 4 hours but site had events previously
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [recentEvent, historicEvent] = await Promise.all([
    prisma.sessionEvent.findFirst({ where: { siteId, timestamp: { gte: fourHoursAgo } } }),
    prisma.sessionEvent.findFirst({ where: { siteId, timestamp: { gte: weekAgo, lt: fourHoursAgo } } }),
  ]);

  if (!recentEvent && historicEvent) {
    return {
      alertType: type,
      severity: 'CRITICAL',
      fired: true,
      message: 'No tracking events received in the last 4 hours. The WebGrade snippet may have stopped firing.',
      metadata: { lastEventTime: historicEvent.timestamp },
    };
  }

  return skip(type);
}

async function checkSeoRegression(
  siteId: string,
  enabled: Set<AlertType>
): Promise<AlertEvaluation> {
  const type: AlertType = 'SEO_REGRESSION';
  if (!enabled.has(type)) return skip(type);

  // Compare latest two SEO crawls
  const crawls = await prisma.seoCrawl.findMany({
    where: { siteId, crawlStatus: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    take: 2,
    select: { overallSeoScore: true, completedAt: true },
  });

  if (crawls.length < 2) return skip(type);

  const [latest, previous] = crawls;
  if (!latest.overallSeoScore || !previous.overallSeoScore) return skip(type);

  const drop = previous.overallSeoScore - latest.overallSeoScore;

  if (drop >= 5) {
    return {
      alertType: type,
      severity: drop >= 15 ? 'CRITICAL' : 'HIGH',
      fired: true,
      message: `SEO score dropped ${drop} points since the last crawl (${previous.overallSeoScore} → ${latest.overallSeoScore})`,
      metadata: { previousScore: previous.overallSeoScore, currentScore: latest.overallSeoScore, drop },
    };
  }

  return skip(type);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function skip(alertType: AlertType): AlertEvaluation {
  return { alertType, severity: 'LOW', fired: false, message: '' };
}

async function getConversionRate(siteId: string, from: Date, to: Date) {
  const [total, converted] = await Promise.all([
    prisma.visitorSession.count({ where: { siteId, startedAt: { gte: from, lt: to }, isBotFiltered: false } }),
    prisma.visitorSession.count({ where: { siteId, startedAt: { gte: from, lt: to }, conversionGoalHit: true } }),
  ]);
  if (total === 0) return null;
  return { rate: converted / total, sessions: total };
}

async function getBounceRate(siteId: string, from: Date, to: Date) {
  const [total, bounced] = await Promise.all([
    prisma.visitorSession.count({ where: { siteId, startedAt: { gte: from, lt: to }, isBotFiltered: false } }),
    prisma.visitorSession.count({ where: { siteId, startedAt: { gte: from, lt: to }, pageCount: 1, isBotFiltered: false } }),
  ]);
  if (total === 0) return null;
  return { rate: bounced / total, sessions: total };
}

function mapAlertTypeToModule(type: AlertType): import('@prisma/client').SourceModule {
  const map: Record<AlertType, import('@prisma/client').SourceModule> = {
    CONVERSION_DROP: 'BEHAVIORAL',
    BOUNCE_RATE_SPIKE: 'BEHAVIORAL',
    INTENT_SCORE_DROP: 'BEHAVIORAL',
    TRAFFIC_ANOMALY: 'BEHAVIORAL',
    SEO_REGRESSION: 'SEO',
    NEW_CRITICAL_SEO_ISSUE: 'SEO',
    CRAWL_ERROR: 'SEO',
    WASTED_SPEND_DETECTED: 'AD_SPEND',
    ZERO_CONVERSION_CAMPAIGN: 'AD_SPEND',
    UTM_STRIPPING: 'AD_SPEND',
    NEW_HIGH_VALUE_OPPORTUNITY: 'WEBOPP',
    COMPETITOR_ENTERED_CLUSTER: 'WEBOPP',
    DEMAND_SPIKE: 'WEBOPP',
    DEMAND_DECAY: 'WEBOPP',
    SNIPPET_FIRING_STOPPED: 'HEALTH_CHECK',
    CONVERSION_GOAL_UNREACHABLE: 'HEALTH_CHECK',
  };
  return map[type] ?? 'BEHAVIORAL';
}
