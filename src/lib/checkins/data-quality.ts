/**
 * Rule-based data-quality checks for a site.
 *
 * Used by:
 *   - Phase 2.5: Day 7 / Day 14 check-in modal (gentle / strict severity)
 *   - Phase 3 Section 12: "Data Gaps" section in the WebAudit report
 *
 * Each check is a pure function over the site's actual database state.
 * No LLM. Output is deterministic so two callers with the same inputs see
 * the same result.
 */

import { prisma } from '@/lib/db/client';

export type CheckSeverity = 'pass' | 'warn' | 'fail';

export interface CheckResult {
  id: string;
  label: string;
  severity: CheckSeverity;
  message: string;
  // Optional CTA — a link to the page where the user can fix the issue.
  cta?: { text: string; href: string };
}

export interface DataQualityReport {
  siteId: string;
  generatedAt: Date;
  // 'gentle' = Day 7 (warn instead of fail when borderline)
  // 'strict' = Day 14 (everything that's not pass becomes fail)
  // 'report' = Phase 3 Data Gaps (always strict)
  mode: 'gentle' | 'strict' | 'report';
  checks: CheckResult[];
  overall: 'green' | 'yellow' | 'red';
  failCount: number;
  warnCount: number;
  passCount: number;
}

export async function runDataQualityChecks(
  siteId: string,
  mode: 'gentle' | 'strict' | 'report' = 'strict',
): Promise<DataQualityReport> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { onboarding: true },
  });

  if (!site) {
    throw new Error(`Site not found: ${siteId}`);
  }

  const last7 = new Date(Date.now() - 7 * 86400000);
  const checks: CheckResult[] = [];

  // ── 1. Snippet installed (any sessions in last 7d) ────────────────────────
  const recentSessions = await prisma.visitorSession.count({
    where: { siteId, startedAt: { gte: last7 } },
  });
  checks.push({
    id: 'snippet-firing',
    label: 'Tracking snippet installed',
    severity: recentSessions > 0 ? 'pass' : 'fail',
    message: recentSessions > 0
      ? `${recentSessions} sessions recorded in the last 7 days.`
      : 'No sessions recorded in the last 7 days. The tracking snippet may not be installed or is being blocked.',
    cta: recentSessions > 0 ? undefined : { text: 'Check snippet installation', href: `/dashboard/${siteId}/snippet` },
  });

  // ── 2. Events firing (event_type populated for >50% of sessions) ──────────
  const sessionsWithEvents = await prisma.visitorSession.count({
    where: { siteId, startedAt: { gte: last7 }, events: { some: {} } },
  });
  const eventCoverage = recentSessions > 0 ? (sessionsWithEvents / recentSessions) * 100 : 0;
  checks.push({
    id: 'events-firing',
    label: 'Behavioral events captured',
    severity: recentSessions === 0
      ? 'warn'
      : eventCoverage >= 80 ? 'pass' : eventCoverage >= 50 ? 'warn' : 'fail',
    message: recentSessions === 0
      ? 'Cannot evaluate — no sessions recorded yet.'
      : `${eventCoverage.toFixed(0)}% of recent sessions have event-level data (clicks, scrolls, hesitations).`,
  });

  // ── 3. PageView records exist ─────────────────────────────────────────────
  const sessionsWithPageViews = await prisma.visitorSession.count({
    where: { siteId, startedAt: { gte: last7 }, pageViews: { some: {} } },
  });
  const pvCoverage = recentSessions > 0 ? (sessionsWithPageViews / recentSessions) * 100 : 0;
  checks.push({
    id: 'pageviews-tracked',
    label: 'Entry / exit page tracking',
    severity: recentSessions === 0
      ? 'warn'
      : pvCoverage >= 80 ? 'pass' : pvCoverage >= 50 ? 'warn' : 'fail',
    message: recentSessions === 0
      ? 'Cannot evaluate — no sessions recorded yet.'
      : `${pvCoverage.toFixed(0)}% of recent sessions have entry / exit pages recorded.`,
  });

  // ── 4. Conversion goal URL set in onboarding ──────────────────────────────
  checks.push({
    id: 'conversion-goal',
    label: 'Conversion goal defined',
    severity: site.onboarding?.conversionGoalUrl ? 'pass' : 'fail',
    message: site.onboarding?.conversionGoalUrl
      ? `Goal page: ${site.onboarding.conversionGoalUrl}`
      : 'No conversion goal URL set. Without this, we can\'t tell which sessions actually converted.',
    cta: site.onboarding?.conversionGoalUrl ? undefined : { text: 'Set conversion goal', href: `/dashboard/${siteId}/settings` },
  });

  // ── 5. Revenue questionnaire complete (AOV + lead-to-win) ─────────────────
  const hasRevenueData = !!(site.onboarding?.averageOrderValue && site.onboarding?.leadToWinRate);
  checks.push({
    id: 'revenue-questionnaire',
    label: 'Revenue questionnaire complete',
    severity: hasRevenueData ? 'pass' : 'warn',
    message: hasRevenueData
      ? `AOV $${site.onboarding!.averageOrderValue!.toFixed(0)}, lead-to-win ${(site.onboarding!.leadToWinRate! * 100).toFixed(1)}%.`
      : 'Disengaged Leads will show as visitor count instead of dollars until this is filled in.',
    cta: hasRevenueData ? undefined : { text: 'Complete questionnaire', href: `/dashboard/${siteId}/revenue` },
  });

  // ── 6. Country resolution working (>90% of sessions have country) ─────────
  const sessionsWithCountry = await prisma.visitorSession.count({
    where: { siteId, startedAt: { gte: last7 }, country: { not: null } },
  });
  const countryCoverage = recentSessions > 0 ? (sessionsWithCountry / recentSessions) * 100 : 0;
  checks.push({
    id: 'country-resolution',
    label: 'Geo-IP resolution',
    severity: recentSessions === 0
      ? 'warn'
      : countryCoverage >= 90 ? 'pass' : countryCoverage >= 50 ? 'warn' : 'fail',
    message: recentSessions === 0
      ? 'Cannot evaluate — no sessions recorded yet.'
      : `${countryCoverage.toFixed(0)}% of recent sessions have country resolved.`,
  });

  // ── 7. Bot rate reasonable (under 50%) ────────────────────────────────────
  const botSessions = await prisma.visitorSession.count({
    where: { siteId, startedAt: { gte: last7 }, OR: [{ isBotFiltered: true }, { isBotSuspect: true }] },
  });
  const botPct = recentSessions > 0 ? (botSessions / recentSessions) * 100 : 0;
  checks.push({
    id: 'bot-rate',
    label: 'Bot traffic ratio',
    severity: recentSessions === 0
      ? 'warn'
      : botPct < 30 ? 'pass' : botPct < 50 ? 'warn' : 'fail',
    message: recentSessions === 0
      ? 'Cannot evaluate — no sessions recorded yet.'
      : botPct < 30
        ? `${botPct.toFixed(1)}% of traffic flagged as bot — within healthy range.`
        : `${botPct.toFixed(1)}% of traffic flagged as bot. High bot ratio inflates session counts and skews reports.`,
  });

  // ── 8. GA4 connected and synced recently ──────────────────────────────────
  checks.push({
    id: 'ga4-sync',
    label: 'Google Analytics 4 connected',
    severity: site.ga4Connected
      ? (site.ga4LastSyncAt && Date.now() - site.ga4LastSyncAt.getTime() < 48 * 3600000 ? 'pass' : 'warn')
      : 'warn',
    message: site.ga4Connected
      ? site.ga4LastSyncAt
        ? `Last synced ${formatRelative(site.ga4LastSyncAt)}. ${Date.now() - site.ga4LastSyncAt.getTime() > 48 * 3600000 ? 'Sync is stale (>48h).' : ''}`
        : 'Connected but never synced. Check Inngest configuration.'
      : 'Not connected. GA4 baselines and conversion data will be missing from reports.',
    cta: site.ga4Connected ? undefined : { text: 'Connect GA4', href: `/dashboard/${siteId}/settings` },
  });

  // ── 9. GSC connected and synced recently ──────────────────────────────────
  checks.push({
    id: 'gsc-sync',
    label: 'Google Search Console connected',
    severity: site.gscConnected
      ? (site.gscLastSyncAt && Date.now() - site.gscLastSyncAt.getTime() < 48 * 3600000 ? 'pass' : 'warn')
      : 'warn',
    message: site.gscConnected
      ? site.gscLastSyncAt
        ? `Last synced ${formatRelative(site.gscLastSyncAt)}. ${Date.now() - site.gscLastSyncAt.getTime() > 48 * 3600000 ? 'Sync is stale (>48h).' : ''}`
        : 'Connected but never synced. Check Inngest configuration.'
      : 'Not connected. SEO Performance section will be empty in reports.',
    cta: site.gscConnected ? undefined : { text: 'Connect GSC', href: `/dashboard/${siteId}/settings` },
  });

  // ── 10. Google Ads connected — only fail if paid traffic detected ─────────
  const paidSessions = recentSessions > 0 ? await prisma.visitorSession.count({
    where: { siteId, startedAt: { gte: last7 }, trafficSource: 'paid' },
  }) : 0;
  const adsRequired = paidSessions > 0;
  checks.push({
    id: 'gads-sync',
    label: 'Google Ads connected',
    severity: site.gadsConnected
      ? (site.gadsLastSyncAt && Date.now() - site.gadsLastSyncAt.getTime() < 48 * 3600000 ? 'pass' : 'warn')
      : adsRequired ? 'fail' : 'pass',
    message: site.gadsConnected
      ? site.gadsLastSyncAt
        ? `Last synced ${formatRelative(site.gadsLastSyncAt)}.`
        : 'Connected but never synced. Check Inngest configuration.'
      : adsRequired
        ? `${paidSessions} paid sessions detected in last 7d but Google Ads isn't connected. Spend, ROAS, and gclid resolution unavailable.`
        : 'Not connected. No paid traffic detected — connect only when running paid campaigns.',
    cta: !site.gadsConnected && adsRequired ? { text: 'Connect Google Ads', href: `/dashboard/${siteId}/settings` } : undefined,
  });

  // ── Apply mode-specific severity adjustment ────────────────────────────────
  // Day 7 (gentle): warns stay warns. Day 14 (strict): downgrade lingering warns to fail
  // for the most critical checks so they get fixed before the Day 30 LLM report.
  const criticalForStrict = new Set(['snippet-firing', 'events-firing', 'pageviews-tracked', 'conversion-goal']);
  if (mode === 'strict' || mode === 'report') {
    for (const check of checks) {
      if (check.severity === 'warn' && criticalForStrict.has(check.id)) {
        check.severity = 'fail';
      }
    }
  }

  const passCount = checks.filter(c => c.severity === 'pass').length;
  const warnCount = checks.filter(c => c.severity === 'warn').length;
  const failCount = checks.filter(c => c.severity === 'fail').length;

  let overall: 'green' | 'yellow' | 'red';
  if (failCount > 0) overall = 'red';
  else if (warnCount > 0) overall = 'yellow';
  else overall = 'green';

  return {
    siteId,
    generatedAt: new Date(),
    mode,
    checks,
    overall,
    passCount,
    warnCount,
    failCount,
  };
}

function formatRelative(d: Date): string {
  const hrs = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
