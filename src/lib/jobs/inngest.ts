/**
 * P1-10: Inngest Background Jobs
 * All async WebGrade processing runs through Inngest.
 *
 * Jobs defined here:
 *   - score-session-intent    (P1-06)
 *   - run-seo-crawl           (P2-01, P2-10)
 *   - run-health-check        (HC-01 through HC-09)
 *   - generate-report         (P4-01)
 *   - run-webopp-analysis     (WO-01 through WO-07)
 *   - delete-old-events       (DL-04: 90-day retention)
 *   - run-competitor-snapshot (OB-04: monthly refresh)
 *   - send-alert-email        (AL-03)
 *   - run-measurement-job     (RM-04: re-analysis)
 *   - send-weekly-digest      (EP-07)
 */

import { Inngest } from 'inngest';

// Create the Inngest client
export const inngest = new Inngest({
  id: 'webgrade',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// ---------------------------------------------------------------------------
// P1-06: Score session intent after session ends
// Triggered when a session receives a page_exit event
// ---------------------------------------------------------------------------
export const scoreSessionIntent = inngest.createFunction(
  { id: 'score-session-intent', retries: 3 },
  { event: 'webgrade/session.ended' },
  async ({ event, step }) => {
    const { sessionId, siteId } = event.data as { sessionId: string; siteId: string };

    const { prisma } = await import('@/lib/db/client');
    const { scoreSessionIntent: scoreIntent } = await import('@/lib/tracking/intent-scoring');

    const session = await step.run('load-session', async () => {
      return prisma.visitorSession.findUnique({
        where: { id: sessionId },
        include: {
          events: true,
          pageViews: true,
        },
      });
    });

    if (!session) return { error: 'Session not found' };

    const site = await step.run('load-site', async () => {
      return prisma.site.findUnique({
        where: { id: siteId },
        include: { onboarding: { select: { conversionGoalUrl: true } } },
      });
    });

    const result = await step.run('score-intent', async () => {
      return scoreIntent(
        { session, events: session.events, pageViews: session.pageViews },
        site?.onboarding?.conversionGoalUrl ?? null
      );
    });

    await step.run('save-score', async () => {
      return prisma.visitorSession.update({
        where: { id: sessionId },
        data: {
          intentScore: result.score,
          intentClass: result.intentClass,
        },
      });
    });

    return { score: result.score, class: result.intentClass };
  }
);

// ---------------------------------------------------------------------------
// DL-04: Automated data retention — delete raw events older than 90 days
// Runs daily at 2am UTC
// ---------------------------------------------------------------------------
export const deleteOldEvents = inngest.createFunction(
  { id: 'delete-old-events', retries: 2 },
  { cron: '0 2 * * *' },
  async ({ step }) => {
    const { prisma } = await import('@/lib/db/client');

    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const deletedEvents = await step.run('delete-session-events', async () => {
      const result = await prisma.sessionEvent.deleteMany({
        where: { timestamp: { lt: cutoff } },
      });
      return result.count;
    });

    const deletedPageViews = await step.run('delete-page-views', async () => {
      const result = await prisma.pageView.deleteMany({
        where: { enteredAt: { lt: cutoff } },
      });
      return result.count;
    });

    // Log deletions (DL-04: all deletions must be logged)
    await step.run('log-deletion', async () => {
      const sites = await prisma.site.findMany({ select: { id: true } });
      await prisma.dataRetentionLog.createMany({
        data: sites.map(site => ({
          siteId: site.id,
          deletionType: 'session_events_90d',
          recordsDeleted: deletedEvents + deletedPageViews,
          periodCovered: `before ${cutoff.toISOString().split('T')[0]}`,
        })),
      });
    });

    return { deletedEvents, deletedPageViews };
  }
);

// ---------------------------------------------------------------------------
// P2-10: Scheduled SEO crawl — weekly per site
// ---------------------------------------------------------------------------
export const runScheduledSeoCrawl = inngest.createFunction(
  { id: 'run-seo-crawl', retries: 2, concurrency: { limit: 3 } },
  { event: 'webgrade/seo.crawl.requested' },
  async ({ event, step }) => {
    const { siteId } = event.data as { siteId: string };

    // This triggers the Puppeteer crawler (P2-01)
    // Full implementation in src/lib/seo/crawler.ts
    await step.run('start-crawl', async () => {
      const { prisma } = await import('@/lib/db/client');
      return prisma.seoCrawl.create({
        data: {
          siteId,
          crawlStatus: 'RUNNING',
        },
      });
    });

    // Crawl logic runs in separate worker
    // This job coordinates and tracks completion
    return { siteId, status: 'crawl_started' };
  }
);

// ---------------------------------------------------------------------------
// AL-01: Alert rules engine — runs hourly per site
// ---------------------------------------------------------------------------
export const runAlertRules = inngest.createFunction(
  { id: 'run-alert-rules', retries: 1 },
  { cron: '0 * * * *' },  // Every hour
  async ({ step }) => {
    const { prisma } = await import('@/lib/db/client');
    const { evaluateAlertRules } = await import('@/lib/alerts/rules-engine');

    const sites = await step.run('load-active-sites', async () => {
      return prisma.site.findMany({
        where: { isActive: true },
        select: { id: true, hasWebWatch: true },
      });
    });

    let alertsFired = 0;

    for (const site of sites) {
      const fired = await step.run(`evaluate-alerts-${site.id}`, async () => {
        return evaluateAlertRules(site.id);
      });
      alertsFired += fired;
    }

    return { sitesEvaluated: sites.length, alertsFired };
  }
);

// ---------------------------------------------------------------------------
// EP-07: Weekly email digest — runs every Monday 9am
// ---------------------------------------------------------------------------
export const sendWeeklyDigest = inngest.createFunction(
  { id: 'send-weekly-digest', retries: 2 },
  { cron: '0 9 * * 1' },  // Monday 9am UTC
  async ({ step }) => {
    const { prisma } = await import('@/lib/db/client');
    const { sendWeeklyDigestEmail } = await import('@/lib/email/digest');

    const sites = await step.run('load-sites-with-email', async () => {
      return prisma.site.findMany({
        where: { isActive: true, hasWebWatch: true },
        include: {
          org: {
            include: {
              members: {
                where: { role: { in: ['OWNER', 'ADMIN'] } },
                include: { user: { select: { email: true, name: true } } }
              }
            }
          }
        }
      });
    });

    let emailsSent = 0;
    for (const site of sites) {
      await step.run(`digest-${site.id}`, async () => {
        return sendWeeklyDigestEmail(site);
      }).catch(() => null); // Non-fatal per site
      emailsSent++;
    }

    return { emailsSent };
  }
);

// ---------------------------------------------------------------------------
// BL-01: Monthly baseline capture — 1st of every month at 2am UTC
// Captures previous month's metrics for WebWatch/WebOpp sites
// ---------------------------------------------------------------------------
export const captureMonthlyBaseline = inngest.createFunction(
  { id: 'capture-monthly-baseline', retries: 2 },
  { cron: '0 2 1 * *' },
  async ({ step }) => {
    const { prisma } = await import('@/lib/db/client');
    const { captureBaseline } = await import('@/lib/baseline/engine');

    const sites = await step.run('load-webwatch-sites', async () => {
      return prisma.site.findMany({
        where: {
          isActive: true,
          subscriptionTier: { in: ['WEBWATCH', 'WEBWATCH_WEBOPP'] },
        },
        select: { id: true },
      });
    });

    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const period = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    let captured = 0;
    for (const site of sites) {
      await step.run(`baseline-${site.id}`, async () => {
        return captureBaseline(site.id, period, 'webgrade_calculated', 30);
      }).catch(() => null);
      captured++;
    }

    return { sitesCaptured: captured, period };
  }
);

// ---------------------------------------------------------------------------
// BL-02: Annual baseline reset — runs daily at 3am UTC
// Resets baselines for sites past their anniversary date
// ---------------------------------------------------------------------------
export const annualBaselineReset = inngest.createFunction(
  { id: 'annual-baseline-reset', retries: 2 },
  { cron: '0 3 * * *' },
  async ({ step }) => {
    const { prisma } = await import('@/lib/db/client');
    const { captureBaseline, shouldResetBaseline } = await import('@/lib/baseline/engine');

    const sites = await step.run('load-sites-due-reset', async () => {
      return prisma.site.findMany({
        where: {
          isActive: true,
          subscriptionTier: { in: ['WEBWATCH', 'WEBWATCH_WEBOPP'] },
        },
        select: { id: true, baselineResetDate: true, webwatchStartDate: true },
      });
    });

    let resets = 0;
    for (const site of sites) {
      if (!shouldResetBaseline(site)) continue;

      await step.run(`reset-${site.id}`, async () => {
        const year = new Date().getFullYear();
        await captureBaseline(site.id, `${year}-annual`, 'webgrade_calculated', 365);

        // Set next reset date to one year from now
        const nextReset = new Date();
        nextReset.setFullYear(nextReset.getFullYear() + 1);
        await prisma.site.update({
          where: { id: site.id },
          data: { baselineResetDate: nextReset },
        });
      }).catch(() => null);
      resets++;
    }

    return { sitesReset: resets };
  }
);

// ---------------------------------------------------------------------------
// BL-03: WebAudit snapshots — Day 30 and Day 60 checkpoints
// Runs daily at 4am UTC
// ---------------------------------------------------------------------------
export const webauditSnapshot = inngest.createFunction(
  { id: 'webaudit-snapshot', retries: 2 },
  { cron: '0 4 * * *' },
  async ({ step }) => {
    const { prisma } = await import('@/lib/db/client');
    const { captureBaseline } = await import('@/lib/baseline/engine');

    const sites = await step.run('load-webaudit-sites', async () => {
      return prisma.site.findMany({
        where: {
          isActive: true,
          subscriptionTier: 'WEBAUDIT',
          webauditStartDate: { not: null },
        },
        select: { id: true, webauditStartDate: true },
      });
    });

    let snapshots = 0;
    const now = new Date();

    for (const site of sites) {
      if (!site.webauditStartDate) continue;
      const daysSinceStart = Math.floor(
        (now.getTime() - new Date(site.webauditStartDate).getTime()) / 86400000
      );

      if (daysSinceStart === 30) {
        await step.run(`snapshot-30d-${site.id}`, async () => {
          return captureBaseline(site.id, 'webaudit_30d', 'webgrade_calculated', 30);
        }).catch(() => null);
        snapshots++;
      }

      if (daysSinceStart === 60) {
        await step.run(`snapshot-60d-${site.id}`, async () => {
          await captureBaseline(site.id, 'webaudit_baseline', 'webgrade_calculated', 60);
          // Expire the WebAudit subscription
          await prisma.site.update({
            where: { id: site.id },
            data: {
              subscriptionTier: 'WEBAUDIT_EXPIRED',
              webauditEndDate: now,
            },
          });
        }).catch(() => null);
        snapshots++;
      }
    }

    return { snapshotsTaken: snapshots };
  }
);

// ---------------------------------------------------------------------------
// RA-01: Monthly report archival — 2nd of every month at 5am UTC
// Auto-archives the latest report for WebWatch sites
// ---------------------------------------------------------------------------
export const archiveMonthlyReport = inngest.createFunction(
  { id: 'archive-monthly-report', retries: 2 },
  { cron: '0 5 2 * *' },
  async ({ step }) => {
    const { prisma } = await import('@/lib/db/client');

    const sites = await step.run('load-webwatch-sites', async () => {
      return prisma.site.findMany({
        where: {
          isActive: true,
          subscriptionTier: { in: ['WEBWATCH', 'WEBWATCH_WEBOPP'] },
        },
        select: { id: true, name: true },
      });
    });

    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
    const monthLabel = prevMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    let archived = 0;

    for (const site of sites) {
      await step.run(`archive-${site.id}`, async () => {
        // Find the latest complete report
        const latestReport = await prisma.report.findFirst({
          where: { siteId: site.id, status: 'COMPLETE' },
          orderBy: { createdAt: 'desc' },
        });

        if (!latestReport) return null;

        // Compute KPI snapshot
        const sessions = await prisma.visitorSession.findMany({
          where: {
            siteId: site.id,
            isBotFiltered: false,
            startedAt: { gte: prevMonth, lte: periodEnd },
          },
          select: { intentScore: true, pageCount: true },
        });

        const totalSessions = sessions.length;
        const bounceCount = sessions.filter(s => s.pageCount <= 1).length;
        const intentScores = sessions.filter(s => s.intentScore != null).map(s => s.intentScore!);
        const avgIntent = intentScores.length > 0
          ? intentScores.reduce((a, b) => a + b, 0) / intentScores.length
          : 0;

        const kpiSnapshot = {
          sessions: totalSessions,
          bounceRate: totalSessions > 0 ? (bounceCount / totalSessions) * 100 : 0,
          intentScore: Math.round(avgIntent * 10) / 10,
          revenueAtRisk: latestReport.estimatedImpact ? parseFloat(latestReport.estimatedImpact) || 0 : 0,
        };

        // Check for duplicate archive for this month
        const existing = await prisma.archivedReport.findFirst({
          where: { siteId: site.id, title: `WebWatch — ${monthLabel}` },
        });
        if (existing) return null;

        return prisma.archivedReport.create({
          data: {
            siteId: site.id,
            type: 'webwatch',
            title: `WebWatch — ${monthLabel}`,
            periodStart: prevMonth,
            periodEnd,
            summary: latestReport.executiveSummary ?? '',
            kpiSnapshot,
            findings: latestReport.topFindings ?? [],
            actionItems: latestReport.topRecommendations ?? [],
          },
        });
      }).catch(() => null);
      archived++;
    }

    return { sitesArchived: archived, month: monthLabel };
  }
);

// ---------------------------------------------------------------------------
// Export all functions for the Inngest handler
// ---------------------------------------------------------------------------
export const inngestFunctions = [
  scoreSessionIntent,
  deleteOldEvents,
  runScheduledSeoCrawl,
  runAlertRules,
  sendWeeklyDigest,
  captureMonthlyBaseline,
  annualBaselineReset,
  webauditSnapshot,
  archiveMonthlyReport,
];
