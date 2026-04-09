// src/app/api/admin/sessions/summary/route.ts
// GET /api/admin/sessions/summary?siteId=xxx&start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns a KPI summary CSV with top-10 breakdowns for locations,
// pages visited, entry pages, and exit pages.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a top-10 list with "Other" as the 10th bucket */
function topTenWithOther(
  counts: Map<string, number>,
  totalSessions: number,
  labelFn: (key: string) => string = k => k,
): { label: string; count: number; pct: string }[] {
  const sorted = [...counts.entries()]
    .filter(([k]) => k !== '' && k !== null)
    .sort((a, b) => b[1] - a[1]);

  const top9 = sorted.slice(0, 9);
  const top9Total = top9.reduce((s, [, c]) => s + c, 0);
  const otherTotal = totalSessions - top9Total;

  const rows = top9.map(([key, count]) => ({
    label: labelFn(key),
    count,
    pct: ((count / totalSessions) * 100).toFixed(1) + '%',
  }));

  if (otherTotal > 0) {
    rows.push({
      label: 'All Other',
      count: otherTotal,
      pct: ((otherTotal / totalSessions) * 100).toFixed(1) + '%',
    });
  }

  return rows;
}

/** Strip hash + query from a URL to get clean page path */
function cleanPagePath(url: string | null): string {
  if (!url) return '(none)';
  try {
    const u = new URL(url);
    return u.pathname || '/';
  } catch {
    // Already a path like "/about"
    return url.split('#')[0].split('?')[0] || '/';
  }
}

function escCsv(val: string | number): string {
  const str = String(val).replace(/[\r\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
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

    const site = await prisma.site.findFirst({
      where: { id: siteId, org: { members: { some: { user: { email: session.user.email } } } } },
      select: { id: true, name: true, domain: true },
    });
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

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
        pageCount: true,
      },
    });

    // Fetch page views for page breakdown
    const sessionIds = sessions.map(s => s.id);
    const pageViews = await prisma.pageView.findMany({
      where: { sessionId: { in: sessionIds }, siteId },
      select: { url: true, sessionId: true },
    });

    const totalSessions = sessions.length;

    // -----------------------------------------------------------------
    // KPI calculations
    // -----------------------------------------------------------------
    const totalPageviews = sessions.reduce((sum, s) => sum + s.pageCount, 0);
    const avgPagesPerSession = totalSessions > 0 ? (totalPageviews / totalSessions).toFixed(1) : '0';
    const conversions = sessions.filter(s => s.conversionGoalHit).length;
    const conversionRate = totalSessions > 0 ? ((conversions / totalSessions) * 100).toFixed(2) + '%' : '0%';

    const durations = sessions.map(s => s.durationMs ?? 0).filter(d => d > 0);
    const avgDurationSec = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000)
      : 0;
    const avgDuration = avgDurationSec >= 60
      ? `${Math.floor(avgDurationSec / 60)}m ${avgDurationSec % 60}s`
      : `${avgDurationSec}s`;

    const intentCounts = new Map<string, number>();
    for (const s of sessions) {
      const cls = s.intentClass ?? 'UNSCORED';
      intentCounts.set(cls, (intentCounts.get(cls) ?? 0) + 1);
    }

    const deviceCounts = new Map<string, number>();
    for (const s of sessions) {
      const d = s.deviceType ?? 'unknown';
      deviceCounts.set(d, (deviceCounts.get(d) ?? 0) + 1);
    }

    // -----------------------------------------------------------------
    // Location breakdown: Region, State (for US) or Country, Region
    // -----------------------------------------------------------------
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

    // -----------------------------------------------------------------
    // Pages visited breakdown (from PageView records)
    // -----------------------------------------------------------------
    const pageCounts = new Map<string, number>();
    for (const pv of pageViews) {
      const path = cleanPagePath(pv.url);
      pageCounts.set(path, (pageCounts.get(path) ?? 0) + 1);
    }
    const pageTop10 = topTenWithOther(pageCounts, pageViews.length);

    // -----------------------------------------------------------------
    // Entry pages breakdown
    // -----------------------------------------------------------------
    const entryCounts = new Map<string, number>();
    for (const s of sessions) {
      const path = cleanPagePath(s.entryPage);
      entryCounts.set(path, (entryCounts.get(path) ?? 0) + 1);
    }
    const entryTop10 = topTenWithOther(entryCounts, totalSessions);

    // -----------------------------------------------------------------
    // Exit pages breakdown
    // -----------------------------------------------------------------
    const exitCounts = new Map<string, number>();
    for (const s of sessions) {
      const path = cleanPagePath(s.exitPage);
      exitCounts.set(path, (exitCounts.get(path) ?? 0) + 1);
    }
    const exitTop10 = topTenWithOther(exitCounts, totalSessions);

    // -----------------------------------------------------------------
    // Build CSV
    // -----------------------------------------------------------------
    const lines: string[] = [];

    const periodLabel = `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`;

    // Header section
    lines.push(`WebGrade Summary Report — ${site.name} (${site.domain})`);
    lines.push(`Period: ${periodLabel}`);
    lines.push('');

    // KPIs
    lines.push('KEY METRICS');
    lines.push('Metric,Value');
    lines.push(`Unique Sessions,${totalSessions}`);
    lines.push(`Total Pageviews,${totalPageviews}`);
    lines.push(`Avg Pages/Session,${avgPagesPerSession}`);
    lines.push(`Avg Session Duration,${escCsv(avgDuration)}`);
    lines.push(`Conversions,${conversions}`);
    lines.push(`Conversion Rate,${conversionRate}`);
    lines.push('');

    // Intent breakdown
    lines.push('INTENT BREAKDOWN');
    lines.push('Intent Class,Sessions,%');
    const intentSorted = [...intentCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [cls, count] of intentSorted) {
      lines.push(`${cls},${count},${((count / totalSessions) * 100).toFixed(1)}%`);
    }
    lines.push('');

    // Device breakdown
    lines.push('DEVICE BREAKDOWN');
    lines.push('Device,Sessions,%');
    const deviceSorted = [...deviceCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [dev, count] of deviceSorted) {
      lines.push(`${dev},${count},${((count / totalSessions) * 100).toFixed(1)}%`);
    }
    lines.push('');

    // Top 10 locations
    lines.push('TOP 10 VISITOR LOCATIONS');
    lines.push('Rank,Location,Sessions,%');
    locationTop10.forEach((row, i) => {
      lines.push(`${i + 1},${escCsv(row.label)},${row.count},${row.pct}`);
    });
    lines.push('');

    // Top 10 pages visited
    lines.push('TOP 10 PAGES VISITED');
    lines.push('Rank,Page,Views,%');
    pageTop10.forEach((row, i) => {
      lines.push(`${i + 1},${escCsv(row.label)},${row.count},${row.pct}`);
    });
    lines.push('');

    // Top 10 entry pages
    lines.push('TOP 10 ENTRY PAGES (where visitors land first)');
    lines.push('Rank,Entry Page,Sessions,%');
    entryTop10.forEach((row, i) => {
      lines.push(`${i + 1},${escCsv(row.label)},${row.count},${row.pct}`);
    });
    lines.push('');

    // Top 10 exit pages
    lines.push('TOP 10 EXIT PAGES (where visitors leave)');
    lines.push('Rank,Exit Page,Sessions,%');
    exitTop10.forEach((row, i) => {
      lines.push(`${i + 1},${escCsv(row.label)},${row.count},${row.pct}`);
    });

    const csvContent = lines.join('\n');
    const filename = `webgrade-summary-${site.name.replace(/\s+/g, '-').toLowerCase()}-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Summary export error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
