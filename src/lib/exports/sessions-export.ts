// Shared streaming generators for the session export.
//
// Exposes two functions:
//
//   streamSessionsAsCsv(siteId, start, end): ReadableStream
//   streamSessionsAsXlsx(siteId, siteName, start, end): ReadableStream
//
// Both return a Web ReadableStream so they can be:
//   - returned directly as the body of a NextResponse (live download path)
//   - piped to Vercel Blob's put() for stash-and-email-link (queue path)
//
// Sessions are pulled in cursor-paged batches of 500 so memory stays
// bounded regardless of how big the date range is. The xlsx path uses
// ExcelJS's streaming WorkbookWriter and commits each row immediately,
// flushing to the underlying PassThrough as it goes.

import { prisma } from '@/lib/db/client';
import ExcelJS from 'exceljs';
import { PassThrough, Readable } from 'node:stream';

const PAGE_SIZE = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  try { const u = new URL(url); return u.pathname || '/'; }
  catch { return url.split('#')[0].split('?')[0] || '/'; }
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
  try { const u = new URL(referrer); return u.hostname + u.pathname; }
  catch { return referrer; }
}

// All exported dates/times are rendered in America/New_York (EST/EDT,
// auto-switches with DST). Vercel runs in UTC, so the previous
// d.getFullYear()/getHours() helpers showed UTC dates, which confused
// users — a 9 PM EDT session would show as "next day 01:00" because UTC
// had already rolled over. Intl.DateTimeFormat with an explicit timeZone
// is the standard fix and needs no extra dependency.
// If we ever ship to customers outside the US Eastern timezone, this
// should become a per-site or per-user setting; for now it's hardcoded
// because this product is operated out of EST.
const REPORT_TZ = 'America/New_York';

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORT_TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: REPORT_TZ,
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
});

function dateOnly(d: Date): string {
  // en-CA gives YYYY-MM-DD
  return dateFmt.format(d);
}

function timeOnly(d: Date): string {
  // en-GB + hour12:false gives HH:MM:SS in 24-hour
  return timeFmt.format(d);
}

// CSV field escape per RFC 4180
function csvField(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

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

// One flat row of session data. Identical shape for csv & xlsx so columns
// stay in lock-step between formats.
function buildSessionRow(s: SessionWithEvents) {
  const durationSec = s.endedAt && s.startedAt
    ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)
    : 0;
  const counts = countEventsByType(s.events);
  return {
    sessionId: truncateSessionId(s.sessionId),
    startDate: dateOnly(s.startedAt),
    startTime: timeOnly(s.startedAt),
    endDate: s.endedAt ? dateOnly(s.endedAt) : '',
    endTime: s.endedAt ? timeOnly(s.endedAt) : '',
    durationSec,
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
  };
}

// ---------------------------------------------------------------------------
// Column shape — source of truth for headers in both formats
// ---------------------------------------------------------------------------

export const SESSION_COLUMNS: { key: keyof ReturnType<typeof buildSessionRow>; header: string; width: number }[] = [
  { key: 'sessionId',            header: 'Session ID',          width: 18 },
  { key: 'startDate',            header: 'Start Date',          width: 12 },
  { key: 'startTime',            header: 'Start Time',          width: 11 },
  { key: 'endDate',              header: 'End Date',            width: 12 },
  { key: 'endTime',              header: 'End Time',            width: 11 },
  { key: 'durationSec',          header: 'Duration (sec)',      width: 13 },
  { key: 'country',              header: 'Country',             width: 10 },
  { key: 'region',               header: 'Region',              width: 12 },
  { key: 'device',               header: 'Device',              width: 10 },
  { key: 'browser',              header: 'Browser',             width: 12 },
  { key: 'os',                   header: 'OS',                  width: 12 },
  { key: 'entryPage',            header: 'Entry Page',          width: 36 },
  { key: 'exitPage',             header: 'Exit Page',           width: 36 },
  { key: 'pageCount',            header: 'Page Count',          width: 11 },
  { key: 'eventCount',           header: 'Event Count',         width: 11 },
  { key: 'clickCount',           header: 'Clicks',              width: 8 },
  { key: 'ctaClickCount',        header: 'CTA Clicks',          width: 11 },
  { key: 'rageClickCount',       header: 'Rage Clicks',         width: 11 },
  { key: 'hesitationCount',      header: 'Hesitations',         width: 11 },
  { key: 'scrollCount',          header: 'Scrolls',             width: 9 },
  { key: 'sectionViewCount',     header: 'Section Views',       width: 13 },
  { key: 'formFocusCount',       header: 'Form Focuses',        width: 12 },
  { key: 'formSubmitCount',      header: 'Form Submits',        width: 12 },
  { key: 'exitIntentCount',      header: 'Exit Intents',        width: 12 },
  { key: 'conversionCount',      header: 'Conversions',         width: 11 },
  { key: 'intentScore',          header: 'Intent Score',        width: 12 },
  { key: 'intentClass',          header: 'Intent Class',        width: 12 },
  { key: 'converted',            header: 'Converted',           width: 11 },
  { key: 'trafficSource',        header: 'Traffic Source',      width: 14 },
  { key: 'isReturning',          header: 'Returning',           width: 11 },
  { key: 'isBounce',             header: 'Bounce',              width: 9 },
  { key: 'isBotFiltered',        header: 'Bot Filtered',        width: 12 },
  { key: 'isBotSuspect',         header: 'Bot Suspect',         width: 12 },
  { key: 'botSuspectReason',     header: 'Bot Suspect Reason',  width: 24 },
  { key: 'utmSource',            header: 'UTM Source',          width: 14 },
  { key: 'utmMedium',            header: 'UTM Medium',          width: 12 },
  { key: 'utmCampaign',          header: 'UTM Campaign',        width: 22 },
  { key: 'utmStale',             header: 'UTM Stale',           width: 11 },
  { key: 'clickId',              header: 'Click ID',            width: 36 },
  { key: 'clickIdType',          header: 'Click ID Type',       width: 12 },
  { key: 'resolvedCampaignName', header: 'Resolved Campaign',   width: 22 },
  { key: 'resolvedCampaignId',   header: 'Resolved Campaign ID', width: 16 },
  { key: 'gclidResolutionStatus', header: 'Gclid Resolution',   width: 14 },
  { key: 'referrer',             header: 'Referrer',            width: 36 },
];

export const EVENT_COLUMNS = [
  { key: 'sessionId',         header: 'Session ID',          width: 18 },
  { key: 'sessionStartDate',  header: 'Session Start Date',  width: 14 },
  { key: 'sessionStartTime',  header: 'Session Start Time',  width: 12 },
  { key: 'eventDate',         header: 'Event Date',          width: 12 },
  { key: 'eventTime',         header: 'Event Time',          width: 11 },
  { key: 'step',              header: 'Step',                width: 7 },
  { key: 'timeInSession',     header: 'Time in Session',     width: 14 },
  { key: 'eventType',         header: 'Event Type',          width: 16 },
  { key: 'page',              header: 'Page',                width: 36 },
  { key: 'pageLastSeg',       header: 'Page (last seg)',     width: 18 },
  { key: 'scrollDepthPct',    header: 'Scroll Depth %',      width: 13 },
  { key: 'elementTag',        header: 'Element Tag',         width: 11 },
  { key: 'elementClass',      header: 'Element Class',       width: 22 },
  { key: 'elementText',       header: 'Element Text',        width: 28 },
  { key: 'isCtaClick',        header: 'Is CTA Click',        width: 12 },
  { key: 'hesitationMs',      header: 'Hesitation (ms)',     width: 14 },
  { key: 'rageClickCount',    header: 'Rage Clicks',         width: 11 },
  { key: 'timeOnPage',        header: 'Time on Page',        width: 12 },
  { key: 'metadata',          header: 'Metadata',            width: 36 },
  { key: 'country',           header: 'Country',             width: 10 },
  { key: 'region',            header: 'Region',              width: 12 },
  { key: 'device',            header: 'Device',              width: 10 },
  { key: 'browser',           header: 'Browser',             width: 12 },
  { key: 'os',                header: 'OS',                  width: 12 },
  { key: 'trafficSource',     header: 'Traffic Source',      width: 14 },
  { key: 'utmSource',         header: 'UTM Source',          width: 14 },
  { key: 'utmMedium',         header: 'UTM Medium',          width: 12 },
  { key: 'utmCampaign',       header: 'UTM Campaign',        width: 22 },
  { key: 'clickIdType',       header: 'Click ID Type',       width: 12 },
  { key: 'resolvedCampaignName', header: 'Resolved Campaign', width: 22 },
  { key: 'intentScore',       header: 'Intent Score',        width: 12 },
  { key: 'intentClass',       header: 'Intent Class',        width: 12 },
  { key: 'converted',         header: 'Converted (Session)', width: 18 },
  { key: 'isBounce',          header: 'Bounce (Session)',    width: 16 },
  { key: 'isBotFiltered',     header: 'Bot Filtered',        width: 12 },
];

// ---------------------------------------------------------------------------
// Cursor-paged session fetch
// ---------------------------------------------------------------------------

type SessionWithEvents = Awaited<ReturnType<typeof fetchSessionsPage>>[number];

async function fetchSessionsPage(siteId: string, start: Date, end: Date, cursorId: string | undefined) {
  return prisma.visitorSession.findMany({
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
    take: PAGE_SIZE,
    ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
  });
}

// ---------------------------------------------------------------------------
// CSV stream — Sessions only, one row per session
// ---------------------------------------------------------------------------

export function streamSessionsAsCsv(siteId: string, start: Date, end: Date): ReadableStream {
  const passthrough = new PassThrough();

  passthrough.write('﻿'); // UTF-8 BOM so Excel auto-detects encoding
  passthrough.write(SESSION_COLUMNS.map(c => csvField(c.header)).join(',') + '\n');

  void (async () => {
    try {
      let cursor: string | undefined;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const batch = await fetchSessionsPage(siteId, start, end, cursor);
        if (batch.length === 0) break;

        for (const s of batch) {
          const row = buildSessionRow(s);
          const line = SESSION_COLUMNS.map(c => csvField(row[c.key])).join(',') + '\n';
          if (!passthrough.write(line)) {
            await new Promise<void>(resolve => passthrough.once('drain', resolve));
          }
        }

        if (batch.length < PAGE_SIZE) break;
        cursor = batch[batch.length - 1].id;
      }
      passthrough.end();
    } catch (err) {
      console.error('CSV stream error:', err);
      passthrough.write('\n# Export interrupted by server error — partial data above\n');
      passthrough.end();
    }
  })();

  return Readable.toWeb(passthrough) as unknown as ReadableStream;
}

// ---------------------------------------------------------------------------
// XLSX stream — three sheets, written incrementally via WorkbookWriter
// ---------------------------------------------------------------------------

export function streamSessionsAsXlsx(siteId: string, siteName: string, start: Date, end: Date): ReadableStream {
  const passthrough = new PassThrough();

  void (async () => {
    try {
      const wb = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: passthrough,
        useStyles: true,
        useSharedStrings: false,
      });
      wb.creator = 'WebGrade';
      wb.created = new Date();

      const headerStyle: Partial<ExcelJS.Style> = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C4A6E' } },
        alignment: { vertical: 'middle' },
      };

      const summarySheet = wb.addWorksheet('Summary');
      summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 36 },
        { header: 'Value',  key: 'value',  width: 28 },
      ];
      summarySheet.getRow(1).eachCell(c => Object.assign(c, headerStyle));
      summarySheet.getRow(1).commit();

      // ExcelJS streaming WorksheetWriter exposes `views` as a getter-only
      // property — assigning sheet.views = [...] throws "Cannot set property
      // views of #<...> which has only a getter" once code is minified for
      // production. Pass it via the addWorksheet options object instead;
      // the constructor stores it for the eventual SheetView XML emit.
      const sessionsSheet = wb.addWorksheet('Sessions', { views: [{ state: 'frozen', ySplit: 1 }] });
      sessionsSheet.columns = SESSION_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));
      sessionsSheet.getRow(1).eachCell(c => Object.assign(c, headerStyle));
      sessionsSheet.getRow(1).commit();

      const eventsSheet = wb.addWorksheet('Events', { views: [{ state: 'frozen', ySplit: 1 }] });
      eventsSheet.columns = EVENT_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));
      eventsSheet.getRow(1).eachCell(c => Object.assign(c, headerStyle));
      eventsSheet.getRow(1).commit();

      let totalSessions = 0, botSessions = 0, humanSessions = 0;
      let conversions = 0, bounces = 0, paidSessions = 0;
      let totalEvents = 0, totalPageViews = 0;
      let durationSum = 0, durationCount = 0;
      let intentSum = 0, intentCount = 0;
      const staleSet = new Map<string, number>();
      let gclidPresent = 0, gclidResolved = 0, gclidNotFound = 0;
      let staleTagSessions = 0;

      let cursor: string | undefined;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const batch = await fetchSessionsPage(siteId, start, end, cursor);
        if (batch.length === 0) break;

        for (const s of batch) {
          const row = buildSessionRow(s);
          const xlsxRow = sessionsSheet.addRow(row);
          if (s.utmCampaignIsStale) {
            const cell = xlsxRow.getCell('utmStale');
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            cell.font = { bold: true, color: { argb: 'FF92400E' } };
          }
          xlsxRow.commit();

          const sessionId = truncateSessionId(s.sessionId);
          const sessionStartDate = dateOnly(s.startedAt);
          const sessionStartTime = timeOnly(s.startedAt);
          const sessionCtx = {
            country: s.country ?? '', region: s.region ?? '',
            device: s.deviceType ?? '', browser: s.browser ?? '', os: s.os ?? '',
            trafficSource: s.trafficSource ?? '',
            utmSource: s.utmSource ?? '', utmMedium: s.utmMedium ?? '', utmCampaign: s.utmCampaign ?? '',
            clickIdType: s.clickIdType ?? '', resolvedCampaignName: s.resolvedCampaignName ?? '',
            intentScore: s.intentScore ?? '', intentClass: s.intentClass ?? '',
            converted: s.conversionGoalHit ? 'Yes' : 'No',
            isBounce: s.isBounce ? 'Yes' : 'No',
            isBotFiltered: s.isBotFiltered ? 'Yes' : 'No',
          };

          if (s.events.length === 0) {
            eventsSheet.addRow({
              sessionId, sessionStartDate, sessionStartTime,
              eventDate: '', eventTime: '', step: 1,
              timeInSession: '0s', eventType: '(no events)',
              page: '', pageLastSeg: '', scrollDepthPct: '',
              elementTag: '', elementClass: '', elementText: '',
              isCtaClick: '', hesitationMs: '', rageClickCount: '',
              timeOnPage: '', metadata: '',
              ...sessionCtx,
            }).commit();
          } else {
            for (let i = 0; i < s.events.length; i++) {
              const ev = s.events[i];
              const evTs = new Date(ev.timestamp);
              let meta = '';
              if (ev.metadata && typeof ev.metadata === 'object') {
                meta = Object.entries(ev.metadata as Record<string, unknown>)
                  .filter(([, v]) => v != null && v !== '')
                  .map(([k, v]) => `${k}=${String(v)}`)
                  .join('; ');
              }
              eventsSheet.addRow({
                sessionId, sessionStartDate, sessionStartTime,
                eventDate: dateOnly(evTs),
                eventTime: timeOnly(evTs),
                step: i + 1,
                timeInSession: fmtRelative(evTs, s.startedAt),
                eventType: ev.eventType,
                page: toPathOnly(ev.pageUrl),
                pageLastSeg: lastSegment(toPathOnly(ev.pageUrl)),
                scrollDepthPct: ev.scrollDepthPct ?? '',
                elementTag: ev.elementTag ?? '',
                elementClass: ev.elementClass ?? '',
                elementText: ev.elementText ?? '',
                isCtaClick: ev.isCtaClick ? 'Yes' : '',
                hesitationMs: ev.hesitationMs ?? '',
                rageClickCount: ev.rageClickCount ?? '',
                timeOnPage: ev.timeOnPageMs ? fmtDuration(Math.round(ev.timeOnPageMs / 1000)) : '',
                metadata: meta,
                ...sessionCtx,
              }).commit();
            }
          }

          totalSessions++;
          if (s.isBotFiltered) botSessions++;
          else {
            humanSessions++;
            if (s.conversionGoalHit) conversions++;
            if (s.isBounce) bounces++;
            if (s.trafficSource === 'paid') paidSessions++;
            if (s.utmCampaignIsStale) {
              staleTagSessions++;
              if (s.utmCampaign) staleSet.set(s.utmCampaign, (staleSet.get(s.utmCampaign) ?? 0) + 1);
            }
            if (s.clickIdType === 'gclid') gclidPresent++;
            if (s.gclidResolutionStatus === 'resolved') gclidResolved++;
            if (s.gclidResolutionStatus === 'not_found') gclidNotFound++;
            totalPageViews += s.pageCount;
            if (s.endedAt && s.startedAt) {
              durationSum += Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000);
              durationCount++;
            }
            if (s.intentScore != null) { intentSum += s.intentScore; intentCount++; }
          }
          totalEvents += s.events.length;
        }

        if (batch.length < PAGE_SIZE) break;
        cursor = batch[batch.length - 1].id;
      }

      const avgSessionSec = durationCount > 0 ? Math.round(durationSum / durationCount) : 0;
      const avgIntent = intentCount > 0 ? Math.round((intentSum / intentCount) * 10) / 10 : 0;
      const bounceRate = humanSessions > 0 ? (bounces / humanSessions) * 100 : 0;
      const conversionRate = humanSessions > 0 ? (conversions / humanSessions) * 100 : 0;
      const gclidResolutionRate = gclidPresent > 0 ? (gclidResolved / gclidPresent) * 100 : 0;

      const summaryRows = [
        { metric: 'Site', value: siteName },
        // Date range stays as the user-picked dates (no TZ conversion —
        // they're just calendar bounds the user typed in). Generated-at
        // and all per-session timestamps below are in America/New_York.
        { metric: 'Date range', value: `${start.toISOString().split('T')[0]} → ${end.toISOString().split('T')[0]}` },
        { metric: 'Generated at', value: `${dateOnly(new Date())} ${timeOnly(new Date())} (${REPORT_TZ})` },
        { metric: 'Timezone', value: REPORT_TZ },
        { metric: '', value: '' },
        { metric: 'Total sessions (incl. bots)', value: totalSessions },
        { metric: 'Bot sessions filtered',       value: botSessions },
        { metric: 'Human sessions',              value: humanSessions },
        { metric: 'Total events',                value: totalEvents },
        { metric: 'Total page views',            value: totalPageViews },
        { metric: 'Avg session duration',        value: fmtDuration(avgSessionSec) },
        { metric: 'Avg intent score',            value: avgIntent },
        { metric: 'Bounces',                     value: bounces },
        { metric: 'Bounce rate',                 value: `${bounceRate.toFixed(1)}%` },
        { metric: 'Conversions',                 value: conversions },
        { metric: 'Conversion rate',             value: `${conversionRate.toFixed(2)}%` },
        { metric: '', value: '' },
        { metric: 'Paid sessions (traffic_source=paid)', value: paidSessions },
        { metric: 'Sessions with gclid',          value: gclidPresent },
        { metric: 'Gclids resolved to campaign',  value: gclidResolved },
        { metric: 'Gclids not found in Ads',      value: gclidNotFound },
        { metric: 'Gclid resolution rate',        value: `${gclidResolutionRate.toFixed(1)}%` },
        { metric: '', value: '' },
        { metric: 'Sessions with stale utm_campaign',     value: staleTagSessions },
        { metric: 'Distinct stale utm_campaign values',   value: staleSet.size },
      ];
      for (const r of summaryRows) summarySheet.addRow(r).commit();

      const topStale = Array.from(staleSet.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
      if (topStale.length > 0) {
        summarySheet.addRow({ metric: '', value: '' }).commit();
        const hdr = summarySheet.addRow({ metric: 'Top stale utm_campaign tags', value: 'sessions' });
        hdr.eachCell(c => Object.assign(c, headerStyle));
        hdr.commit();
        for (const [tag, count] of topStale) {
          summarySheet.addRow({ metric: tag, value: count }).commit();
        }
      }

      summarySheet.commit();
      sessionsSheet.commit();
      eventsSheet.commit();
      await wb.commit();
    } catch (err) {
      console.error('XLSX stream error:', err);
      passthrough.destroy(err as Error);
    }
  })();

  return Readable.toWeb(passthrough) as unknown as ReadableStream;
}

// Date-range slug used in filenames for both formats
export function buildExportFilename(siteName: string, start: Date, end: Date, ext: 'csv' | 'xlsx'): string {
  const slug = siteName.replace(/\s+/g, '-').toLowerCase();
  const dateRange = `${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}`;
  return `webgrade-sessions-${slug}-${dateRange}.${ext}`;
}
