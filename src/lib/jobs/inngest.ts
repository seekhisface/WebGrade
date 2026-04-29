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
        { session: session as never, events: session.events as never, pageViews: session.pageViews as never },
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
    const { sendDigestEmail } = await import('@/lib/email/digest');

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
        return sendDigestEmail();
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
// GSC-01: Daily Google Search Console sync — 6am UTC
// Syncs keyword rankings and traffic for GSC-connected sites
// ---------------------------------------------------------------------------
export const syncGscDaily = inngest.createFunction(
  { id: 'sync-gsc-daily', retries: 2, concurrency: { limit: 3 } },
  { cron: '0 6 * * *' },
  async ({ step }) => {
    const { prisma } = await import('@/lib/db/client');

    const sites = await step.run('load-gsc-sites', async () => {
      return prisma.site.findMany({
        where: { isActive: true, gscConnected: true, gscPropertyUrl: { not: null } },
        select: { id: true, gscConnectedByUserId: true },
      });
    });

    let synced = 0;
    for (const site of sites) {
      await step.run(`gsc-sync-${site.id}`, async () => {
        // Call the sync endpoint logic directly
        const { syncGscData } = await import('@/lib/gsc/client');
        await syncGscData(site.id);
      }).catch(err => {
        console.error(`[GSC sync] Failed for site ${site.id}:`, err);
      });
      synced++;
    }

    return { sitesSynced: synced };
  }
);

// ---------------------------------------------------------------------------
// GADS: Daily Google Ads sync — every day at 7am UTC
// Syncs campaign spend, clicks, impressions for all connected sites
// ---------------------------------------------------------------------------
export const syncGadsDaily = inngest.createFunction(
  { id: 'sync-gads-daily', retries: 2, concurrency: { limit: 3 } },
  { cron: '0 7 * * *' },
  async ({ step }) => {
    const { prisma } = await import('@/lib/db/client');

    const sites = await step.run('load-gads-sites', async () => {
      return prisma.site.findMany({
        where: { isActive: true, gadsConnected: true, gadsCustomerId: { not: null } },
        select: { id: true, gadsCustomerId: true, gadsConnectedByUserId: true },
      });
    });

    let synced = 0;
    for (const site of sites) {
      if (!site.gadsConnectedByUserId || !site.gadsCustomerId) continue;
      await step.run(`gads-sync-${site.id}`, async () => {
        const { syncCampaignData } = await import('@/lib/gads/client');
        await syncCampaignData(site.id, site.gadsConnectedByUserId!, site.gadsCustomerId!, 7);
      }).catch(err => {
        console.error(`[GAds sync] Failed for site ${site.id}:`, err);
      });
      synced++;
    }

    return { sitesSynced: synced };
  }
);

// ---------------------------------------------------------------------------
// GADS: Daily gclid → campaign resolution — every day at 8am UTC (after Ads sync)
// Resolves auto-tagged Google Ads visits (gclid present, utm_campaign null) by
// querying the Ads API click_view resource. Updates VisitorSession.resolvedCampaign*
// so dashboards can attribute auto-tagged paid traffic to the correct campaign.
//
// click_view only retains 90 days, so unresolved sessions older than that are
// marked "not_found" and skipped on future runs.
// ---------------------------------------------------------------------------
export const resolveGclidsDaily = inngest.createFunction(
  { id: 'resolve-gclids-daily', retries: 2, concurrency: { limit: 3 } },
  { cron: '0 8 * * *' },
  async ({ step }) => {
    const { prisma } = await import('@/lib/db/client');

    const sites = await step.run('load-gads-sites', async () => {
      return prisma.site.findMany({
        where: { isActive: true, gadsConnected: true, gadsCustomerId: { not: null } },
        select: { id: true, gadsCustomerId: true, gadsConnectedByUserId: true },
      });
    });

    const cutoff = new Date(Date.now() - 90 * 86400000);
    let totalResolved = 0;
    let totalAttempted = 0;

    for (const site of sites) {
      if (!site.gadsConnectedByUserId || !site.gadsCustomerId) continue;

      await step.run(`resolve-gclids-${site.id}`, async () => {
        const { resolveGclids } = await import('@/lib/gads/client');

        // Find sessions with a gclid we haven't tried to resolve yet.
        const unresolved = await prisma.visitorSession.findMany({
          where: {
            siteId: site.id,
            clickIdType: 'gclid',
            clickId: { not: null },
            gclidResolvedAt: null,
            startedAt: { gte: cutoff },
          },
          select: { id: true, clickId: true, startedAt: true },
        });

        if (unresolved.length === 0) return;

        // Group by date (Ads click_view requires segments.date = single day).
        const byDate = new Map<string, { id: string; gclid: string }[]>();
        for (const s of unresolved) {
          if (!s.clickId) continue;
          const date = s.startedAt.toISOString().split('T')[0];
          const bucket = byDate.get(date) ?? [];
          bucket.push({ id: s.id, gclid: s.clickId });
          byDate.set(date, bucket);
        }

        const now = new Date();
        for (const [date, rows] of byDate) {
          totalAttempted += rows.length;
          let resolutions: Map<string, { campaignId: string; campaignName: string; adGroupId: string | null }>;
          try {
            const gclids = Array.from(new Set(rows.map(r => r.gclid)));
            resolutions = await resolveGclids(
              site.gadsConnectedByUserId!,
              site.gadsCustomerId!,
              gclids,
              date,
            );
          } catch (err) {
            console.error(`[gclid-resolve] site=${site.id} date=${date}:`, (err as Error).message);
            // Mark this batch as errored so we retry on the next run only if the
            // status is still "error" (not "resolved" / "not_found").
            await prisma.visitorSession.updateMany({
              where: { id: { in: rows.map(r => r.id) } },
              data: { gclidResolvedAt: now, gclidResolutionStatus: 'error' },
            });
            continue;
          }

          for (const row of rows) {
            const hit = resolutions.get(row.gclid);
            if (hit) {
              await prisma.visitorSession.update({
                where: { id: row.id },
                data: {
                  resolvedCampaignId: hit.campaignId,
                  resolvedCampaignName: hit.campaignName,
                  resolvedAdGroupId: hit.adGroupId,
                  gclidResolvedAt: now,
                  gclidResolutionStatus: 'resolved',
                },
              });
              totalResolved++;
            } else {
              await prisma.visitorSession.update({
                where: { id: row.id },
                data: { gclidResolvedAt: now, gclidResolutionStatus: 'not_found' },
              });
            }
          }
        }
      }).catch(err => {
        console.error(`[gclid-resolve] Failed for site ${site.id}:`, err);
      });
    }

    return { sitesProcessed: sites.length, attempted: totalAttempted, resolved: totalResolved };
  }
);

// ---------------------------------------------------------------------------
// GADS: Daily stale-UTM detection — every day at 9am UTC
// Compares distinct utm_campaign values seen on paid sessions against the
// list of campaign names from GadsCampaignMetric. Anything not present in
// recent Ads data is flagged as stale (a likely-renamed-or-killed campaign
// whose old URL is still circulating in email/social/partner links).
// Writes to StaleUtmCampaign + sets VisitorSession.utmCampaignIsStale.
// ---------------------------------------------------------------------------
export const flagStaleUtmsDaily = inngest.createFunction(
  { id: 'flag-stale-utms-daily', retries: 2, concurrency: { limit: 5 } },
  { cron: '0 9 * * *' },
  async ({ step }) => {
    const { prisma } = await import('@/lib/db/client');

    const sites = await step.run('load-gads-sites', async () => {
      return prisma.site.findMany({
        where: { isActive: true, gadsConnected: true },
        select: { id: true },
      });
    });

    const now = new Date();
    const sessionLookback = new Date(now.getTime() - 90 * 86400000);
    const adsLookback = new Date(now.getTime() - 180 * 86400000);
    let totalStale = 0;

    for (const site of sites) {
      await step.run(`flag-stale-utms-${site.id}`, async () => {
        // Distinct utm_campaign values seen on paid Google traffic in the lookback window.
        const sessionsByCampaign = await prisma.visitorSession.groupBy({
          by: ['utmCampaign'],
          where: {
            siteId: site.id,
            startedAt: { gte: sessionLookback },
            utmSource: 'google',
            utmMedium: 'cpc',
            utmCampaign: { not: null },
            isBotFiltered: false,
          },
          _count: { _all: true },
          _max: { startedAt: true },
        });

        if (sessionsByCampaign.length === 0) return;

        // Campaign names known to Ads in the last 180 days.
        const knownCampaigns = await prisma.gadsCampaignMetric.findMany({
          where: { siteId: site.id, date: { gte: adsLookback } },
          select: { campaignName: true },
          distinct: ['campaignName'],
        });
        const knownSet = new Set(knownCampaigns.map(c => c.campaignName.toLowerCase()));

        const staleCampaigns = sessionsByCampaign.filter(
          row => row.utmCampaign && !knownSet.has(row.utmCampaign.toLowerCase()),
        );

        // Reset stale flags for this site (in case a previously-stale tag came back).
        await prisma.visitorSession.updateMany({
          where: { siteId: site.id, utmCampaignIsStale: true },
          data: { utmCampaignIsStale: false },
        });

        // Drop StaleUtmCampaign rows that no longer apply.
        const staleNames = staleCampaigns.map(s => s.utmCampaign!).filter(Boolean);
        await prisma.staleUtmCampaign.deleteMany({
          where: { siteId: site.id, utmCampaign: { notIn: staleNames.length ? staleNames : ['__none__'] } },
        });

        // Upsert each stale tag and re-flag its sessions.
        for (const row of staleCampaigns) {
          if (!row.utmCampaign) continue;
          const sessionsAffected = row._count._all;
          const lastSeenAt = row._max.startedAt ?? now;

          // Top landing page for this stale tag.
          const topLanding = await prisma.visitorSession.groupBy({
            by: ['entryPage'],
            where: {
              siteId: site.id,
              utmCampaign: row.utmCampaign,
              startedAt: { gte: sessionLookback },
              entryPage: { not: null },
            },
            _count: { _all: true },
            orderBy: { _count: { entryPage: 'desc' } },
            take: 1,
          });

          await prisma.staleUtmCampaign.upsert({
            where: { siteId_utmCampaign: { siteId: site.id, utmCampaign: row.utmCampaign } },
            create: {
              siteId: site.id,
              utmCampaign: row.utmCampaign,
              sessionsAffected,
              firstDetectedAt: now,
              lastSeenAt,
              topLandingPage: topLanding[0]?.entryPage ?? null,
            },
            update: {
              sessionsAffected,
              lastSeenAt,
              topLandingPage: topLanding[0]?.entryPage ?? null,
            },
          });

          await prisma.visitorSession.updateMany({
            where: { siteId: site.id, utmCampaign: row.utmCampaign },
            data: { utmCampaignIsStale: true },
          });

          totalStale += sessionsAffected;
        }
      }).catch(err => {
        console.error(`[stale-utms] Failed for site ${site.id}:`, err);
      });
    }

    return { sitesProcessed: sites.length, sessionsFlaggedStale: totalStale };
  }
);

// ---------------------------------------------------------------------------
// GA4-01: Daily Google Analytics 4 sync — 8am UTC
// Syncs daily metrics for GA4-connected sites
// ---------------------------------------------------------------------------
export const syncGa4Daily = inngest.createFunction(
  { id: 'sync-ga4-daily', retries: 2, concurrency: { limit: 3 } },
  { cron: '0 8 * * *' },
  async ({ step }) => {
    const { prisma } = await import('@/lib/db/client');

    const sites = await step.run('load-ga4-sites', async () => {
      return prisma.site.findMany({
        where: { isActive: true, ga4Connected: true, ga4PropertyId: { not: null } },
        select: { id: true, ga4ConnectedByUserId: true },
      });
    });

    let synced = 0;
    for (const site of sites) {
      if (!site.ga4ConnectedByUserId) continue;
      await step.run(`ga4-sync-${site.id}`, async () => {
        const { syncGa4Data } = await import('@/lib/ga4/client');
        await syncGa4Data(site.id);
      }).catch(err => {
        console.error(`[GA4 sync] Failed for site ${site.id}:`, err);
      });
      synced++;
    }

    return { sitesSynced: synced };
  }
);

// ---------------------------------------------------------------------------
// SEO-01: Weekly SEO crawl — every Sunday at 3am UTC
// Crawls all active sites for SEO health scoring
// ---------------------------------------------------------------------------
export const runWeeklySeoCrawl = inngest.createFunction(
  { id: 'run-weekly-seo-crawl', retries: 1, concurrency: { limit: 2 } },
  { cron: '0 3 * * 0' },
  async ({ step }) => {
    const { prisma } = await import('@/lib/db/client');
    const { crawlSite } = await import('@/lib/seo/crawler');

    const sites = await step.run('load-active-sites', async () => {
      return prisma.site.findMany({
        where: { isActive: true },
        select: { id: true, url: true },
      });
    });

    let crawled = 0;
    for (const site of sites) {
      await step.run(`crawl-${site.id}`, async () => {
        return crawlSite({ siteId: site.id, startUrl: site.url, maxPages: 50 });
      }).catch(err => {
        console.error(`[SEO crawl] Failed for site ${site.id}:`, err);
      });
      crawled++;
    }

    return { sitesCrawled: crawled };
  }
);

// ---------------------------------------------------------------------------
// RM-01: Daily fix verification — checks pending measurement jobs
// Runs daily at 7am UTC
// ---------------------------------------------------------------------------
export const runDailyVerification = inngest.createFunction(
  { id: 'run-daily-verification', retries: 2 },
  { cron: '0 7 * * *' },
  async ({ step }) => {
    const { evaluatePendingMeasurements } = await import('@/lib/verification/engine');

    const result = await step.run('evaluate-measurements', async () => {
      return evaluatePendingMeasurements();
    });

    return result;
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
  syncGscDaily,
  syncGadsDaily,
  resolveGclidsDaily,
  flagStaleUtmsDaily,
  syncGa4Daily,
  runWeeklySeoCrawl,
  runDailyVerification,
];
