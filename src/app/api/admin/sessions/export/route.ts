// src/app/api/admin/sessions/export/route.ts
// GET /api/admin/sessions/export?siteId=xxx&start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns an .xlsx workbook with three sheets:
//   1. Summary    — totals & high-level stats for the date range
//   2. Sessions   — one row per session with aggregated columns
//   3. Events     — one row per event with the full session context (forensic detail)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = req.nextUrl.searchParams.get('siteId');
    const startStr = req.nextUrl.searchParams.get('start');
    const endStr = req.nextUrl.searchParams.get('end');

    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    const site = await verifySiteAccess(session.user.email, siteId);
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const siteDetails = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, name: true },
    });
    if (!siteDetails) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const start = startStr ? new Date(startStr) : new Date(Date.now() - 30 * 86400000);
    const end = endStr ? new Date(endStr + 'T23:59:59') : new Date();

    const sessions = await prisma.visitorSession.findMany({
      where: { siteId, startedAt: { gte: start, lte: end } },
      include: {
        events: {
          select: {
            eventType: true, pageUrl: true, timestamp: true,
            scrollDepthPct: true, elementTag: true, elementText: true,
            elementClass: true, isCtaClick: true, hesitationMs: true,
            rageClickCount: true, timeOnPageMs: true, metadata: true,
          },
          orderBy: { timestamp: 'asc' },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 5000,
    });

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    function fmtDuration(seconds: number): string {
      if (seconds <= 0) return '0s';
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
    }

    function truncateSessionId(id: string): string {
      return id.length > 12 ? id.slice(0, 12) + '...' : id;
    }

    function toPathOnly(url: string | null): string {
      if (!url) return '';
      try {
        const u = new URL(url);
        return u.pathname || '/';
      } catch {
        return url.split('#')[0].split('?')[0] || '/';
      }
    }

    function stripHash(url: string | null): string {
      if (!url) return '';
      return url.split('#')[0];
    }

    function lastSegment(path: string | null): string {
      if (!path) return '';
      const clean = stripHash(path).replace(/\/$/, '');
      const parts = clean.split('/');
      return parts[parts.length - 1] || '/';
    }

    function fmtRelative(eventTs: Date, sessionStart: Date): string {
      const diff = Math.round((eventTs.getTime() - sessionStart.getTime()) / 1000);
      if (diff <= 0) return '0s';
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      return m > 0 ? `+${m}m ${s}s` : `+${s}s`;
    }

    function fmtReferrer(referrer: string | null): string {
      if (!referrer) return '';
      try {
        const u = new URL(referrer);
        return u.hostname + u.pathname;
      } catch {
        return referrer;
      }
    }

    // -----------------------------------------------------------------------
    // Workbook setup
    // -----------------------------------------------------------------------

    const wb = new ExcelJS.Workbook();
    wb.creator = 'WebGrade';
    wb.created = new Date();

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C4A6E' } },
      alignment: { vertical: 'middle' },
    };

    // -----------------------------------------------------------------------
    // Sheet 1: Summary
    // -----------------------------------------------------------------------

    const totalSessions = sessions.length;
    const botSessions = sessions.filter(s => s.isBotFiltered).length;
    const humanSessions = sessions.filter(s => !s.isBotFiltered);
    const conversions = humanSessions.filter(s => s.conversionGoalHit).length;
    const bounces = humanSessions.filter(s => s.isBounce).length;
    const paidSessions = humanSessions.filter(s => s.trafficSource === 'paid').length;
    const staleTagSessions = humanSessions.filter(s => s.utmCampaignIsStale).length;
    const gclidPresent = humanSessions.filter(s => s.clickIdType === 'gclid').length;
    const gclidResolved = humanSessions.filter(s => s.gclidResolutionStatus === 'resolved').length;
    const gclidNotFound = humanSessions.filter(s => s.gclidResolutionStatus === 'not_found').length;
    const totalEvents = sessions.reduce((sum, s) => sum + s.events.length, 0);
    const totalPageViews = humanSessions.reduce((sum, s) => sum + s.pageCount, 0);
    const avgSessionSec = humanSessions.length > 0
      ? Math.round(
          humanSessions.reduce((sum, s) => {
            const d = s.endedAt && s.startedAt
              ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)
              : 0;
            return sum + d;
          }, 0) / humanSessions.length,
        )
      : 0;
    const intentScores = humanSessions.filter(s => s.intentScore != null).map(s => s.intentScore!);
    const avgIntent = intentScores.length > 0
      ? Math.round((intentScores.reduce((a, b) => a + b, 0) / intentScores.length) * 10) / 10
      : 0;

    // Distinct stale tag list (for the summary sheet)
    const staleSet = new Map<string, number>();
    for (const s of humanSessions) {
      if (s.utmCampaignIsStale && s.utmCampaign) {
        staleSet.set(s.utmCampaign, (staleSet.get(s.utmCampaign) ?? 0) + 1);
      }
    }
    const topStale = Array.from(staleSet.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const summary = wb.addWorksheet('Summary');
    summary.columns = [
      { header: 'Metric', key: 'metric', width: 36 },
      { header: 'Value', key: 'value', width: 28 },
    ];
    summary.getRow(1).eachCell(c => Object.assign(c, headerStyle));

    const bounceRate = humanSessions.length > 0 ? (bounces / humanSessions.length) * 100 : 0;
    const conversionRate = humanSessions.length > 0 ? (conversions / humanSessions.length) * 100 : 0;
    const gclidResolutionRate = gclidPresent > 0 ? (gclidResolved / gclidPresent) * 100 : 0;

    summary.addRows([
      { metric: 'Site', value: siteDetails.name },
      { metric: 'Date range', value: `${start.toISOString().split('T')[0]} → ${end.toISOString().split('T')[0]}` },
      { metric: 'Generated at', value: new Date().toISOString() },
      { metric: '', value: '' },
      { metric: 'Total sessions (incl. bots)', value: totalSessions },
      { metric: 'Bot sessions filtered', value: botSessions },
      { metric: 'Human sessions', value: humanSessions.length },
      { metric: 'Total events', value: totalEvents },
      { metric: 'Total page views', value: totalPageViews },
      { metric: 'Avg session duration', value: fmtDuration(avgSessionSec) },
      { metric: 'Avg intent score', value: avgIntent },
      { metric: 'Bounces', value: bounces },
      { metric: 'Bounce rate', value: `${bounceRate.toFixed(1)}%` },
      { metric: 'Conversions', value: conversions },
      { metric: 'Conversion rate', value: `${conversionRate.toFixed(2)}%` },
      { metric: '', value: '' },
      { metric: 'Paid sessions (traffic_source=paid)', value: paidSessions },
      { metric: 'Sessions with gclid', value: gclidPresent },
      { metric: 'Gclids resolved to campaign', value: gclidResolved },
      { metric: 'Gclids not found in Ads', value: gclidNotFound },
      { metric: 'Gclid resolution rate', value: `${gclidResolutionRate.toFixed(1)}%` },
      { metric: '', value: '' },
      { metric: 'Sessions with stale utm_campaign', value: staleTagSessions },
      { metric: 'Distinct stale utm_campaign values', value: staleSet.size },
    ]);

    if (topStale.length > 0) {
      summary.addRow({ metric: '', value: '' });
      summary.addRow({ metric: 'Top stale utm_campaign tags', value: 'sessions' });
      const headerRow = summary.lastRow!;
      headerRow.eachCell(c => Object.assign(c, headerStyle));
      for (const [tag, count] of topStale) {
        summary.addRow({ metric: tag, value: count });
      }
    }

    // -----------------------------------------------------------------------
    // Sheet 2: Sessions (one row per session)
    // -----------------------------------------------------------------------

    const sessionsSheet = wb.addWorksheet('Sessions');
    sessionsSheet.columns = [
      { header: 'Session ID', key: 'sessionId', width: 18 },
      { header: 'Started At', key: 'startedAt', width: 22 },
      { header: 'Duration', key: 'duration', width: 12 },
      { header: 'Country', key: 'country', width: 10 },
      { header: 'Region', key: 'region', width: 12 },
      { header: 'Device', key: 'device', width: 10 },
      { header: 'Browser', key: 'browser', width: 12 },
      { header: 'OS', key: 'os', width: 12 },
      { header: 'Entry Page', key: 'entryPage', width: 36 },
      { header: 'Exit Page', key: 'exitPage', width: 36 },
      { header: 'Page Count', key: 'pageCount', width: 11 },
      { header: 'Event Count', key: 'eventCount', width: 11 },
      { header: 'Intent Score', key: 'intentScore', width: 12 },
      { header: 'Intent Class', key: 'intentClass', width: 12 },
      { header: 'Converted', key: 'converted', width: 11 },
      { header: 'Traffic Source', key: 'trafficSource', width: 14 },
      { header: 'Returning', key: 'isReturning', width: 11 },
      { header: 'Bounce', key: 'isBounce', width: 9 },
      { header: 'Bot Filtered', key: 'isBotFiltered', width: 12 },
      { header: 'Bot Suspect', key: 'isBotSuspect', width: 12 },
      { header: 'Bot Suspect Reason', key: 'botSuspectReason', width: 24 },
      { header: 'UTM Source', key: 'utmSource', width: 14 },
      { header: 'UTM Medium', key: 'utmMedium', width: 12 },
      { header: 'UTM Campaign', key: 'utmCampaign', width: 22 },
      { header: 'UTM Stale', key: 'utmStale', width: 11 },
      { header: 'Click ID', key: 'clickId', width: 36 },
      { header: 'Click ID Type', key: 'clickIdType', width: 12 },
      { header: 'Resolved Campaign', key: 'resolvedCampaignName', width: 22 },
      { header: 'Resolved Campaign ID', key: 'resolvedCampaignId', width: 16 },
      { header: 'Gclid Resolution', key: 'gclidResolutionStatus', width: 14 },
      { header: 'Referrer', key: 'referrer', width: 36 },
    ];
    sessionsSheet.getRow(1).eachCell(c => Object.assign(c, headerStyle));
    sessionsSheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const s of sessions) {
      const durationSec = s.endedAt && s.startedAt
        ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)
        : 0;
      sessionsSheet.addRow({
        sessionId: truncateSessionId(s.sessionId),
        startedAt: s.startedAt.toISOString(),
        duration: fmtDuration(durationSec),
        country: s.country ?? '',
        region: s.region ?? '',
        device: s.deviceType ?? '',
        browser: s.browser ?? '',
        os: s.os ?? '',
        entryPage: toPathOnly(s.entryPage),
        exitPage: toPathOnly(s.exitPage),
        pageCount: s.pageCount,
        eventCount: s.events.length,
        intentScore: s.intentScore ?? '',
        intentClass: s.intentClass ?? '',
        converted: s.conversionGoalHit ? 'Yes' : 'No',
        trafficSource: s.trafficSource ?? '',
        isReturning: s.isReturning ? 'Yes' : 'No',
        isBounce: s.isBounce ? 'Yes' : 'No',
        isBotFiltered: s.isBotFiltered ? 'Yes' : 'No',
        isBotSuspect: s.isBotSuspect ? 'Yes' : '',
        botSuspectReason: s.botSuspectReason ?? '',
        utmSource: s.utmSource ?? '',
        utmMedium: s.utmMedium ?? '',
        utmCampaign: s.utmCampaign ?? '',
        utmStale: s.utmCampaignIsStale ? 'STALE' : '',
        clickId: s.clickId ?? '',
        clickIdType: s.clickIdType ?? '',
        resolvedCampaignName: s.resolvedCampaignName ?? '',
        resolvedCampaignId: s.resolvedCampaignId ?? '',
        gclidResolutionStatus: s.gclidResolutionStatus ?? '',
        referrer: fmtReferrer(s.referrer),
      });
      // Highlight stale rows so they're easy to spot when scrolling.
      if (s.utmCampaignIsStale) {
        const row = sessionsSheet.lastRow!;
        row.getCell('utmStale').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEF3C7' },
        };
        row.getCell('utmStale').font = { bold: true, color: { argb: 'FF92400E' } };
      }
    }

    // -----------------------------------------------------------------------
    // Sheet 3: Events (one row per event with session context)
    // -----------------------------------------------------------------------

    const eventsSheet = wb.addWorksheet('Events');
    eventsSheet.columns = [
      { header: 'Session ID', key: 'sessionId', width: 18 },
      { header: 'Session Start', key: 'sessionStart', width: 22 },
      { header: 'Session Duration', key: 'sessionDuration', width: 14 },
      { header: 'Country', key: 'country', width: 10 },
      { header: 'Region', key: 'region', width: 12 },
      { header: 'Device', key: 'device', width: 10 },
      { header: 'Browser', key: 'browser', width: 12 },
      { header: 'OS', key: 'os', width: 12 },
      { header: 'Entry Page', key: 'entryPage', width: 28 },
      { header: 'Exit Page', key: 'exitPage', width: 28 },
      { header: 'Total Pages', key: 'totalPages', width: 11 },
      { header: 'Total Events', key: 'totalEvents', width: 11 },
      { header: 'Intent Score', key: 'intentScore', width: 11 },
      { header: 'Intent Class', key: 'intentClass', width: 12 },
      { header: 'Converted', key: 'converted', width: 11 },
      { header: 'Traffic Source', key: 'trafficSource', width: 14 },
      { header: 'Returning', key: 'isReturning', width: 11 },
      { header: 'Bounce', key: 'isBounce', width: 9 },
      { header: 'Bot Suspect', key: 'isBotSuspect', width: 12 },
      { header: 'Bot Suspect Reason', key: 'botSuspectReason', width: 22 },
      { header: 'UTM Source', key: 'utmSource', width: 14 },
      { header: 'UTM Medium', key: 'utmMedium', width: 12 },
      { header: 'UTM Campaign', key: 'utmCampaign', width: 22 },
      { header: 'UTM Stale', key: 'utmStale', width: 11 },
      { header: 'Resolved Campaign', key: 'resolvedCampaignName', width: 22 },
      { header: 'Referrer', key: 'referrer', width: 28 },
      // Event detail
      { header: 'Step', key: 'step', width: 7 },
      { header: 'Time in Session', key: 'timeInSession', width: 14 },
      { header: 'Event Type', key: 'eventType', width: 16 },
      { header: 'Page', key: 'page', width: 36 },
      { header: 'Page (last seg)', key: 'pageLastSeg', width: 18 },
      { header: 'Scroll Depth %', key: 'scrollDepthPct', width: 13 },
      { header: 'Element Tag', key: 'elementTag', width: 11 },
      { header: 'Element Text', key: 'elementText', width: 28 },
      { header: 'Is CTA Click', key: 'isCtaClick', width: 12 },
      { header: 'Hesitation (ms)', key: 'hesitationMs', width: 13 },
      { header: 'Rage Clicks', key: 'rageClickCount', width: 11 },
      { header: 'Time on Page', key: 'timeOnPage', width: 12 },
      { header: 'Metadata', key: 'metadata', width: 36 },
    ];
    eventsSheet.getRow(1).eachCell(c => Object.assign(c, headerStyle));
    eventsSheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const s of sessions) {
      const durationSec = s.endedAt && s.startedAt
        ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)
        : 0;

      const sessionContext = {
        sessionId: truncateSessionId(s.sessionId),
        sessionStart: s.startedAt.toISOString(),
        sessionDuration: fmtDuration(durationSec),
        country: s.country ?? '',
        region: s.region ?? '',
        device: s.deviceType ?? '',
        browser: s.browser ?? '',
        os: s.os ?? '',
        entryPage: toPathOnly(s.entryPage),
        exitPage: toPathOnly(s.exitPage),
        totalPages: s.pageCount,
        totalEvents: s.events.length,
        intentScore: s.intentScore ?? '',
        intentClass: s.intentClass ?? '',
        converted: s.conversionGoalHit ? 'Yes' : 'No',
        trafficSource: s.trafficSource ?? '',
        isReturning: s.isReturning ? 'Yes' : 'No',
        isBounce: s.isBounce ? 'Yes' : 'No',
        isBotSuspect: s.isBotSuspect ? 'Yes' : '',
        botSuspectReason: s.botSuspectReason ?? '',
        utmSource: s.utmSource ?? '',
        utmMedium: s.utmMedium ?? '',
        utmCampaign: s.utmCampaign ?? '',
        utmStale: s.utmCampaignIsStale ? 'STALE' : '',
        resolvedCampaignName: s.resolvedCampaignName ?? '',
        referrer: fmtReferrer(s.referrer),
      };

      if (s.events.length === 0) {
        eventsSheet.addRow({
          ...sessionContext,
          step: 1,
          timeInSession: '0s',
          eventType: '(no events)',
          page: '',
          pageLastSeg: '',
          scrollDepthPct: '',
          elementTag: '',
          elementText: '',
          isCtaClick: '',
          hesitationMs: '',
          rageClickCount: '',
          timeOnPage: '',
          metadata: '',
        });
        continue;
      }

      for (let i = 0; i < s.events.length; i++) {
        const ev = s.events[i];
        const evTs = new Date(ev.timestamp);

        let meta = '';
        if (ev.metadata && typeof ev.metadata === 'object') {
          const parts = Object.entries(ev.metadata as Record<string, unknown>)
            .filter(([, v]) => v != null && v !== '')
            .map(([k, v]) => `${k}=${String(v)}`);
          meta = parts.join('; ');
        }

        eventsSheet.addRow({
          ...sessionContext,
          step: i + 1,
          timeInSession: fmtRelative(evTs, s.startedAt),
          eventType: ev.eventType,
          page: stripHash(ev.pageUrl),
          pageLastSeg: lastSegment(ev.pageUrl),
          scrollDepthPct: ev.scrollDepthPct ?? '',
          elementTag: ev.elementTag ?? '',
          elementText: ev.elementText ?? '',
          isCtaClick: ev.isCtaClick ? 'Yes' : '',
          hesitationMs: ev.hesitationMs ?? '',
          rageClickCount: ev.rageClickCount ?? '',
          timeOnPage: ev.timeOnPageMs ? fmtDuration(Math.round(ev.timeOnPageMs / 1000)) : '',
          metadata: meta,
        });
      }
    }

    // -----------------------------------------------------------------------
    // Stream out
    // -----------------------------------------------------------------------

    const buffer = await wb.xlsx.writeBuffer();
    const slug = siteDetails.name.replace(/\s+/g, '-').toLowerCase();
    const filename = `webgrade-sessions-${slug}-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
