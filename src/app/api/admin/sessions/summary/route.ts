// src/app/api/admin/sessions/summary/route.ts
// GET /api/admin/sessions/summary?siteId=xxx&start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns a formatted PDF summary report with KPI breakdowns.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import PDFDocument from 'pdfkit';
import { verifySiteAccess } from '@/lib/auth/session';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function topTenWithOther(
  counts: Map<string, number>,
  total: number,
): { rank: number; label: string; count: number; pct: string }[] {
  const sorted = [...counts.entries()]
    .filter(([k]) => k !== '' && k !== null)
    .sort((a, b) => b[1] - a[1]);

  const top9 = sorted.slice(0, 9);
  const top9Total = top9.reduce((s, [, c]) => s + c, 0);
  const otherTotal = total - top9Total;

  const rows = top9.map(([key, count], i) => ({
    rank: i + 1,
    label: key,
    count,
    pct: ((count / total) * 100).toFixed(1) + '%',
  }));

  if (otherTotal > 0) {
    rows.push({
      rank: rows.length + 1,
      label: 'All Other',
      count: otherTotal,
      pct: ((otherTotal / total) * 100).toFixed(1) + '%',
    });
  }

  return rows;
}

function cleanPagePath(url: string | null): string {
  if (!url) return '(none)';
  try {
    const u = new URL(url);
    return u.pathname || '/';
  } catch {
    return url.split('#')[0].split('?')[0] || '/';
  }
}

// ---------------------------------------------------------------------------
// PDF rendering helpers
// ---------------------------------------------------------------------------

const COLORS = {
  navy: '#0c4a6e',
  darkText: '#1e293b',
  medText: '#475569',
  lightText: '#94a3b8',
  accent: '#0ea5e9',
  headerBg: '#f1f5f9',
  rowAlt: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
};

type TopRow = { rank: number; label: string; count: number; pct: string };

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.navy);
  doc.text(title, 40, y);
  doc.moveTo(40, y + 16).lineTo(555, y + 16).strokeColor(COLORS.accent).lineWidth(1.5).stroke();
  return y + 24;
}

function drawKpiGrid(
  doc: PDFKit.PDFDocument,
  kpis: { label: string; value: string }[],
  y: number,
): number {
  const cols = 3;
  const cellW = 172;
  const cellH = 48;
  const startX = 40;

  for (let i = 0; i < kpis.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * cellW;
    const cy = y + row * cellH;

    // Cell background
    doc.roundedRect(x, cy, cellW - 8, cellH - 6, 4)
      .fillColor(COLORS.headerBg).fill();

    // Value
    doc.fontSize(16).font('Helvetica-Bold').fillColor(COLORS.navy);
    doc.text(kpis[i].value, x + 10, cy + 6, { width: cellW - 28 });

    // Label
    doc.fontSize(7.5).font('Helvetica').fillColor(COLORS.medText);
    doc.text(kpis[i].label, x + 10, cy + 26, { width: cellW - 28 });
  }

  const totalRows = Math.ceil(kpis.length / cols);
  return y + totalRows * cellH + 8;
}

function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  colWidths: number[],
  y: number,
  rightAlignCols: number[] = [],
): number {
  const startX = 40;
  const rowH = 16;

  // Header row
  doc.fontSize(7).font('Helvetica-Bold').fillColor(COLORS.medText);
  let x = startX;
  for (let c = 0; c < headers.length; c++) {
    const align = rightAlignCols.includes(c) ? 'right' : 'left';
    const textX = align === 'right' ? x : x + 4;
    const textW = align === 'right' ? colWidths[c] - 4 : colWidths[c] - 4;
    doc.text(headers[c], textX, y + 3, { width: textW, align });
    x += colWidths[c];
  }
  y += rowH;
  doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y)
    .strokeColor(COLORS.border).lineWidth(0.5).stroke();

  // Data rows
  for (let r = 0; r < rows.length; r++) {
    // Alternating row background
    if (r % 2 === 0) {
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowH)
        .fillColor(COLORS.rowAlt).fill();
    }

    doc.fontSize(7.5).font('Helvetica').fillColor(COLORS.darkText);
    x = startX;
    for (let c = 0; c < rows[r].length; c++) {
      const align = rightAlignCols.includes(c) ? 'right' : 'left';
      const textX = align === 'right' ? x : x + 4;
      const textW = align === 'right' ? colWidths[c] - 4 : colWidths[c] - 4;

      // Bold the rank column and "All Other" label
      if (c === 0 || rows[r][1] === 'All Other') {
        doc.font('Helvetica-Bold');
      } else {
        doc.font('Helvetica');
      }

      doc.fillColor(COLORS.darkText);
      doc.text(rows[r][c], textX, y + 3, { width: textW, align });
      x += colWidths[c];
    }
    y += rowH;
  }

  return y + 6;
}

function drawMiniTable(
  doc: PDFKit.PDFDocument,
  title: string,
  items: { label: string; count: number; pct: string }[],
  x: number,
  y: number,
  width: number,
): number {
  // Title
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.navy);
  doc.text(title, x, y, { width });
  y += 14;

  for (let i = 0; i < items.length; i++) {
    if (i % 2 === 0) {
      doc.rect(x, y - 1, width, 13).fillColor(COLORS.rowAlt).fill();
    }
    doc.fontSize(7.5).font('Helvetica').fillColor(COLORS.darkText);
    doc.text(items[i].label, x + 4, y + 1, { width: width - 70 });
    doc.font('Helvetica-Bold');
    doc.text(`${items[i].count}`, x + width - 65, y + 1, { width: 35, align: 'right' });
    doc.font('Helvetica').fillColor(COLORS.medText);
    doc.text(items[i].pct, x + width - 28, y + 1, { width: 28, align: 'right' });
    y += 13;
  }

  return y + 4;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

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
      select: { id: true, name: true, domain: true },
    });
    if (!siteDetails) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    const { name: siteName, domain: siteDomain } = siteDetails;

    const start = startStr ? new Date(startStr) : new Date(Date.now() - 30 * 86400000);
    const end = endStr ? new Date(endStr + 'T23:59:59') : new Date();

    // -----------------------------------------------------------------
    // Fetch all non-bot sessions in the date range
    // -----------------------------------------------------------------
    const sessions = await prisma.visitorSession.findMany({
      where: {
        siteId,
        startedAt: { gte: start, lte: end },
        isBotFiltered: false,
      },
      select: {
        id: true,
        country: true,
        region: true,
        entryPage: true,
        exitPage: true,
        deviceType: true,
        browser: true,
        intentScore: true,
        intentClass: true,
        conversionGoalHit: true,
        durationMs: true,
        startedAt: true,
        endedAt: true,
        pageCount: true,
        isBounce: true,
        isReturning: true,
        trafficSource: true,
        isBotSuspect: true,
        botSuspectReason: true,
      },
    });

    // Also fetch bot sessions for the bot breakdown
    const botSessions = await prisma.visitorSession.findMany({
      where: {
        siteId,
        startedAt: { gte: start, lte: end },
        isBotFiltered: true,
      },
      select: {
        botReason: true,
        botCategory: true,
      },
    });

    const sessionIds = sessions.map(s => s.id);
    const pageViews = await prisma.pageView.findMany({
      where: { sessionId: { in: sessionIds }, siteId },
      select: { url: true, sessionId: true },
    });

    const totalSessions = sessions.length;
    const totalBots = botSessions.length;
    const totalAll = totalSessions + totalBots;

    // -----------------------------------------------------------------
    // KPI calculations
    // -----------------------------------------------------------------
    const totalPageviews = sessions.reduce((sum, s) => sum + s.pageCount, 0);
    const avgPagesPerSession = totalSessions > 0 ? (totalPageviews / totalSessions).toFixed(1) : '0';
    const conversions = sessions.filter(s => s.conversionGoalHit).length;
    const conversionRate = totalSessions > 0 ? ((conversions / totalSessions) * 100).toFixed(2) + '%' : '0%';

    // Compute duration from timestamps (durationMs field is null on older sessions)
    // Cap at 30 min — sessions left open in background tabs inflate averages
    const MAX_DURATION_MS = 30 * 60 * 1000;
    const durations = sessions.map(s => {
      if (s.endedAt && s.startedAt) {
        const d = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
        return Math.min(d, MAX_DURATION_MS);
      }
      return s.durationMs ? Math.min(s.durationMs, MAX_DURATION_MS) : 0;
    }).filter(d => d > 0);
    const avgDurationSec = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000)
      : 0;
    const avgDuration = avgDurationSec >= 60
      ? `${Math.floor(avgDurationSec / 60)}m ${avgDurationSec % 60}s`
      : `${avgDurationSec}s`;

    // Bounce = single page AND under 10s (compute from timestamps, not stored field)
    const bounces = sessions.filter(s => {
      if (s.pageCount > 1) return false;
      if (s.endedAt && s.startedAt) {
        const d = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
        return d < 10000;
      }
      return s.isBounce; // fallback to stored field
    }).length;
    const bounceRate = totalSessions > 0 ? ((bounces / totalSessions) * 100).toFixed(1) + '%' : '0%';

    // New vs returning
    const returningCount = sessions.filter(s => s.isReturning).length;
    const newCount = totalSessions - returningCount;

    // Traffic source breakdown
    const sourceCounts = new Map<string, number>();
    for (const s of sessions) {
      const src = s.trafficSource ?? 'direct';
      sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
    }
    const sourceSorted = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);

    // Bot category breakdown
    const botCategoryCounts = new Map<string, number>();
    for (const b of botSessions) {
      const cat = b.botCategory ?? b.botReason ?? 'Unknown';
      botCategoryCounts.set(cat, (botCategoryCounts.get(cat) ?? 0) + 1);
    }
    const botCategorySorted = [...botCategoryCounts.entries()].sort((a, b) => b[1] - a[1]);

    // Intent breakdown
    const intentCounts = new Map<string, number>();
    for (const s of sessions) {
      const cls = s.intentClass ?? 'UNSCORED';
      intentCounts.set(cls, (intentCounts.get(cls) ?? 0) + 1);
    }
    const intentSorted = [...intentCounts.entries()].sort((a, b) => b[1] - a[1]);

    // Device breakdown
    const deviceCounts = new Map<string, number>();
    for (const s of sessions) {
      const d = s.deviceType ?? 'unknown';
      deviceCounts.set(d, (deviceCounts.get(d) ?? 0) + 1);
    }
    const deviceSorted = [...deviceCounts.entries()].sort((a, b) => b[1] - a[1]);

    // Location
    const locationCounts = new Map<string, number>();
    for (const s of sessions) {
      let loc: string;
      if (s.country === 'US' && s.region) {
        loc = `US, ${s.region}`;
      } else if (s.country) {
        loc = s.region ? `${s.country}, ${s.region}` : s.country;
      } else {
        loc = 'Unknown';
      }
      locationCounts.set(loc, (locationCounts.get(loc) ?? 0) + 1);
    }
    const locationTop10 = topTenWithOther(locationCounts, totalSessions);

    // Pages visited
    const pageCounts = new Map<string, number>();
    for (const pv of pageViews) {
      const path = cleanPagePath(pv.url);
      pageCounts.set(path, (pageCounts.get(path) ?? 0) + 1);
    }
    const pageTop10 = topTenWithOther(pageCounts, pageViews.length);

    // Entry pages
    const entryCounts = new Map<string, number>();
    for (const s of sessions) {
      const path = cleanPagePath(s.entryPage);
      entryCounts.set(path, (entryCounts.get(path) ?? 0) + 1);
    }
    const entryTop10 = topTenWithOther(entryCounts, totalSessions);

    // Exit pages
    const exitCounts = new Map<string, number>();
    for (const s of sessions) {
      const path = cleanPagePath(s.exitPage);
      exitCounts.set(path, (exitCounts.get(path) ?? 0) + 1);
    }
    const exitTop10 = topTenWithOther(exitCounts, totalSessions);

    // -----------------------------------------------------------------
    // Build PDF
    // -----------------------------------------------------------------
    const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const periodLabel = `${fmtDate(start)} - ${fmtDate(end)}`;

    const doc = new PDFDocument({
      size: 'letter',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      info: {
        Title: `WebGrade Summary - ${siteName}`,
        Author: 'WebGrade',
      },
    });

    // Collect PDF into buffer
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const pdfReady = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // --- Page 1: Header + KPIs + Location + Pages ---

    // Title bar
    doc.rect(0, 0, 612, 70).fill(COLORS.navy);
    doc.fontSize(20).font('Helvetica-Bold').fillColor(COLORS.white);
    doc.text('WebGrade', 40, 16);
    doc.fontSize(9).font('Helvetica').fillColor('#7dd3fc');
    doc.text('Website Intelligence for Owners', 40, 40);

    // Site name + period (right-aligned)
    doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.white);
    doc.text(siteName, 300, 18, { width: 272, align: 'right' });
    doc.fontSize(8).font('Helvetica').fillColor('#7dd3fc');
    doc.text(`${siteDomain}  |  ${periodLabel}`, 300, 36, { width: 272, align: 'right' });

    let y = 85;
    const PAGE_BOTTOM = 740; // usable bottom before margin

    /** Add a new page with slim header bar, reset y */
    function newPage(): number {
      doc.addPage();
      doc.rect(0, 0, 612, 36).fill(COLORS.navy);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.white);
      doc.text(`${siteName} - Session Summary`, 40, 11);
      doc.fontSize(7).font('Helvetica').fillColor('#7dd3fc');
      doc.text(periodLabel, 350, 14, { width: 222, align: 'right' });
      return 52;
    }

    /** Check if we need a page break for the next section */
    function ensureSpace(needed: number): void {
      if (y + needed > PAGE_BOTTOM) {
        y = newPage();
      }
    }

    // Key Metrics
    y = drawSectionTitle(doc, 'Key Metrics', y);
    y = drawKpiGrid(doc, [
      { label: 'Unique Sessions (humans)', value: totalSessions.toLocaleString() },
      { label: 'Total Pageviews', value: totalPageviews.toLocaleString() },
      { label: 'Avg Pages / Session', value: avgPagesPerSession },
      { label: 'Avg Session Duration', value: avgDuration },
      { label: 'Bounce Rate', value: bounceRate },
      { label: 'Conversion Rate', value: conversionRate },
      { label: 'New Visitors', value: newCount.toLocaleString() },
      { label: 'Returning Visitors', value: returningCount.toLocaleString() },
      { label: 'Confirmed Bots (filtered)', value: `${totalBots.toLocaleString()} of ${totalAll.toLocaleString()}` },
    ], y);

    // Traffic Source + Device + Intent + Bot — all in one compact block
    ensureSpace(120);
    y = drawSectionTitle(doc, 'Traffic & Visitor Breakdown', y);
    const breakdownY = y;

    // Traffic source (left side)
    const sourceItems = sourceSorted.map(([src, count]) => ({
      label: src.charAt(0).toUpperCase() + src.slice(1),
      count,
      pct: ((count / totalSessions) * 100).toFixed(1) + '%',
    }));
    const leftY1 = drawMiniTable(doc, 'By Traffic Source', sourceItems, 40, breakdownY, 165);

    // Device (middle)
    const deviceItems = deviceSorted.map(([dev, count]) => ({
      label: dev.charAt(0).toUpperCase() + dev.slice(1),
      count,
      pct: ((count / totalSessions) * 100).toFixed(1) + '%',
    }));
    const midY1 = drawMiniTable(doc, 'By Device', deviceItems, 215, breakdownY, 165);

    // Intent (right side)
    const intentItems = intentSorted.map(([cls, count]) => ({
      label: cls,
      count,
      pct: ((count / totalSessions) * 100).toFixed(1) + '%',
    }));
    const rightY1 = drawMiniTable(doc, 'By Intent', intentItems, 390, breakdownY, 165);

    y = Math.max(leftY1, midY1, rightY1) + 4;

    // Bot + suspect summary line
    const suspectCount = sessions.filter(s => s.isBotSuspect).length;
    doc.fontSize(7.5).font('Helvetica').fillColor(COLORS.medText);
    const botParts: string[] = [];
    if (totalBots > 0) {
      const botSummary = botCategorySorted.slice(0, 5).map(([cat, count]) => `${cat}: ${count}`).join(', ');
      botParts.push(`Confirmed bots filtered: ${totalBots} (${botSummary})`);
    }
    if (suspectCount > 0) {
      const suspectReasons = new Map<string, number>();
      for (const s of sessions) {
        if (s.isBotSuspect && s.botSuspectReason) {
          suspectReasons.set(s.botSuspectReason, (suspectReasons.get(s.botSuspectReason) ?? 0) + 1);
        }
      }
      const reasonStr = [...suspectReasons.entries()].sort((a, b) => b[1] - a[1]).map(([r, c]) => `${r}: ${c}`).join(', ');
      botParts.push(`Suspected bots (not filtered): ${suspectCount} (${reasonStr})`);
    }
    if (botParts.length > 0) {
      for (const line of botParts) {
        doc.text(line, 40, y);
        y += 11;
      }
      y += 4;
    }

    // Top 10 Visitor Locations
    ensureSpace(200);
    y = drawSectionTitle(doc, 'Top Visitor Locations', y);
    const locRows = locationTop10.map(r => [`#${r.rank}`, r.label, r.count.toLocaleString(), r.pct]);
    y = drawTable(doc, ['#', 'Location', 'Sessions', '%'], locRows, [30, 280, 100, 105], y, [2, 3]);

    // Top 10 Pages Visited
    ensureSpace(200);
    y = drawSectionTitle(doc, 'Top Pages Visited', y);
    const pageRows = pageTop10.map(r => [`#${r.rank}`, r.label, r.count.toLocaleString(), r.pct]);
    y = drawTable(doc, ['#', 'Page', 'Views', '%'], pageRows, [30, 280, 100, 105], y, [2, 3]);

    // Top 10 Entry Pages
    ensureSpace(200);
    y = drawSectionTitle(doc, 'Top Entry Pages (where visitors land first)', y);
    const entryRows = entryTop10.map(r => [`#${r.rank}`, r.label, r.count.toLocaleString(), r.pct]);
    y = drawTable(doc, ['#', 'Entry Page', 'Sessions', '%'], entryRows, [30, 280, 100, 105], y, [2, 3]);

    // Top 10 Exit Pages
    ensureSpace(200);
    y = drawSectionTitle(doc, 'Top Exit Pages (where visitors leave)', y);
    const exitRows = exitTop10.map(r => [`#${r.rank}`, r.label, r.count.toLocaleString(), r.pct]);
    y = drawTable(doc, ['#', 'Exit Page', 'Sessions', '%'], exitRows, [30, 280, 100, 105], y, [2, 3]);

    // Footer
    y += 20;
    doc.moveTo(40, y).lineTo(555, y).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    y += 8;
    doc.fontSize(7).font('Helvetica').fillColor(COLORS.lightText);
    doc.text(`Generated by WebGrade on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 40, y);
    doc.text('webgrade.io', 400, y, { width: 155, align: 'right', link: 'https://webgrade.io' });

    doc.end();

    const pdfBuffer = await pdfReady;

    const filename = `webgrade-summary-${siteName.replace(/\s+/g, '-').toLowerCase()}-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Summary export error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
