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
// Vercel Hobby plan caps maxDuration at 60s. Big months can take a while since
// we fetch up to 5000 sessions with their events and build an xlsx workbook.
export const maxDuration = 60;

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
      // Sortable date/time columns. Pivot/filter on Start Date for daily rollups,
      // sort by Duration (sec) numerically, etc.
      { header: 'Start Date', key: 'startDate', width: 12 },
      { header: 'Start Time', key: 'startTime', width: 11 },
      { header: 'End Date', key: 'endDate', width: 12 },
      { header: 'End Time', key: 'endTime', width: 11 },
      { header: 'Duration (sec)', key: 'durationSec', width: 13 },
      { header: 'Country', key: 'country', width: 10 },
      { header: 'Region', key: 'region', width: 12 },
      { header: 'Device', key: 'device', width: 10 },
      { header: 'Browser', key: 'browser', width: 12 },
      { header: 'OS', key: 'os', width: 12 },
      { header: 'Entry Page', key: 'entryPage', width: 36 },
      { header: 'Exit Page', key: 'exitPage', width: 36 },
      { header: 'Page Count', key: 'pageCount', width: 11 },
      { header: 'Event Count', key: 'eventCount', width: 11 },
      // Event-type pivot — quick engagement signal per session without needing the Events tab
      { header: 'Clicks', key: 'clickCount', width: 8 },
      { header: 'CTA Clicks', key: 'ctaClickCount', width: 11 },
      { header: 'Rage Clicks', key: 'rageClickCount', width: 11 },
      { header: 'Hesitations', key: 'hesitationCount', width: 11 },
      { header: 'Scrolls', key: 'scrollCount', width: 9 },
      { header: 'Section Views', key: 'sectionViewCount', width: 13 },
      { header: 'Form Focuses', key: 'formFocusCount', width: 12 },
      { header: 'Form Submits', key: 'formSubmitCount', width: 12 },
      { header: 'Exit Intents', key: 'exitIntentCount', width: 12 },
      { header: 'Conversions', key: 'conversionCount', width: 11 },
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

    function countEventsByType(events: { eventType: string; isCtaClick: boolean }[]) {
      const c = {
        click: 0, ctaClick: 0, rageClick: 0, hesitation: 0, scroll: 0,
        sectionView: 0, formFocus: 0, formSubmit: 0, exitIntent: 0, conversion: 0,
      };
      for (const ev of events) {
        switch (ev.eventType) {
          case 'CLICK': c.click++; if (ev.isCtaClick) c.ctaClick++; break;
          case 'CTA_CLICK': c.ctaClick++; c.click++; break;
          case 'RAGE_CLICK': c.rageClick++; break;
          case 'HESITATION': c.hesitation++; break;
          case 'SCROLL': c.scroll++; break;
          case 'SECTION_VIEW': c.sectionView++; break;
          case 'FORM_FOCUS': c.formFocus++; break;
          case 'FORM_SUBMIT': c.formSubmit++; break;
          case 'EXIT_INTENT': c.exitIntent++; break;
          case 'CONVERSION': c.conversion++; break;
        }
      }
      return c;
    }

    function pad(n: number) { return n < 10 ? `0${n}` : String(n); }
    function dateOnly(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
    function timeOnly(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }

    for (const s of sessions) {
      const durationSec = s.endedAt && s.startedAt
        ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)
        : 0;
      const counts = countEventsByType(s.events);
      sessionsSheet.addRow({
        sessionId: truncateSessionId(s.sessionId),
        startDate: dateOnly(s.startedAt),
        startTime: timeOnly(s.startedAt),
        endDate: s.endedAt ? dateOnly(s.endedAt) : '',
        endTime: s.endedAt ? timeOnly(s.endedAt) : '',
        durationSec: durationSec,
        country: s.country ?? '',
        region: s.region ?? '',
        device: s.deviceType ?? '',
        browser: s.browser ?? '',
        os: s.os ?? '',
        entryPage: toPathOnly(s.entryPage),
        exitPage: toPathOnly(s.exitPage),
        pageCount: s.pageCount,
        eventCount: s.events.length,
        clickCount: counts.click,
        ctaClickCount: counts.ctaClick,
        rageClickCount: counts.rageClick,
        hesitationCount: counts.hesitation,
        scrollCount: counts.scroll,
        sectionViewCount: counts.sectionView,
        formFocusCount: counts.formFocus,
        formSubmitCount: counts.formSubmit,
        exitIntentCount: counts.exitIntent,
        conversionCount: counts.conversion,
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

    // Slim — only fields needed for forensic flow analysis. Use Session ID as
    // the join key back to the Sessions tab via VLOOKUP for everything else.
    const eventsSheet = wb.addWorksheet('Events');
    eventsSheet.columns = [
      { header: 'Session ID', key: 'sessionId', width: 18 },
      { header: 'Session Start', key: 'sessionStart', width: 22 },
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
      const sessionId = truncateSessionId(s.sessionId);
      const sessionStart = s.startedAt.toISOString();

      if (s.events.length === 0) {
        eventsSheet.addRow({
          sessionId,
          sessionStart,
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
          sessionId,
          sessionStart,
          step: i + 1,
          timeInSession: fmtRelative(evTs, s.startedAt),
          eventType: ev.eventType,
          // Strip query strings (e.g. Google Ads auto-tag noise) so the column is readable
          page: toPathOnly(ev.pageUrl),
          pageLastSeg: lastSegment(toPathOnly(ev.pageUrl)),
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
