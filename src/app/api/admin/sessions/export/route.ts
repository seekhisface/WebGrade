// src/app/api/admin/sessions/export/route.ts
// GET /api/admin/sessions/export?siteId=xxx&start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns CSV download of session data within the specified date range.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';

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

    // Verify access
    const site = await prisma.site.findFirst({
      where: { id: siteId, org: { members: { some: { user: { email: session.user.email } } } } },
      select: { id: true, name: true },
    });
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    // Date range
    const start = startStr ? new Date(startStr) : new Date(Date.now() - 30 * 86400000);
    const end = endStr ? new Date(endStr + 'T23:59:59') : new Date();

    // Fetch sessions with events (for event list + metadata)
    const sessions = await prisma.visitorSession.findMany({
      where: {
        siteId,
        startedAt: { gte: start, lte: end },
      },
      include: {
        events: {
          select: { eventType: true, pageUrl: true, metadata: true, scrollDepthPct: true, elementTag: true, elementText: true, isCtaClick: true },
          orderBy: { timestamp: 'asc' },
        },
        _count: { select: { events: true, pageViews: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 10000,
    });

    // Helper: format duration as Xm Ys
    function fmtDuration(seconds: number): string {
      if (seconds <= 0) return '0s';
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
    }

    // Helper: extract last path segment
    function lastSegment(path: string | null): string {
      if (!path) return '';
      const clean = path.replace(/\/$/, ''); // strip trailing slash
      const parts = clean.split('/');
      return parts[parts.length - 1] || '/';
    }

    // Build CSV
    const headers = [
      'Session ID', 'Started At', 'Ended At', 'Duration',
      'Country', 'Region', 'Device Type', 'Browser', 'OS',
      'Entry Page', 'Exit Page (last)', 'Page Count', 'Event Count',
      'Event Types', 'Intent Score', 'Intent Class', 'Is Bot', 'Bot Reason',
      'Converted', 'Converted At',
      'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Term', 'UTM Content',
      'Referrer', 'Metadata',
    ];

    const rows = sessions.map(s => {
      const durationSec = s.endedAt && s.startedAt
        ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)
        : 0;

      // Build event type summary: "PAGE_VIEW(3) CLICK(5) SCROLL(2)"
      const eventCounts: Record<string, number> = {};
      for (const ev of s.events) {
        eventCounts[ev.eventType] = (eventCounts[ev.eventType] ?? 0) + 1;
      }
      const eventSummary = Object.entries(eventCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `${type}(${count})`)
        .join(' ');

      // Collect unique metadata across all events (flatten into key=value pairs)
      const metaParts: string[] = [];
      for (const ev of s.events) {
        if (ev.metadata && typeof ev.metadata === 'object') {
          for (const [k, v] of Object.entries(ev.metadata as Record<string, unknown>)) {
            if (v != null && v !== '' && k !== 'section') {
              const str = `${k}=${String(v)}`;
              if (!metaParts.includes(str)) metaParts.push(str);
            }
          }
        }
      }

      return [
        s.sessionId,
        s.startedAt.toISOString(),
        s.endedAt?.toISOString() ?? '',
        fmtDuration(durationSec),
        s.country ?? '',
        s.region ?? '',
        s.deviceType ?? '',
        s.browser ?? '',
        s.os ?? '',
        s.entryPage ?? '',
        lastSegment(s.exitPage),
        s.pageCount,
        s._count.events,
        eventSummary,
        s.intentScore ?? '',
        s.intentClass ?? '',
        s.isBotFiltered ? 'Yes' : 'No',
        s.botReason ?? '',
        s.conversionGoalHit ? 'Yes' : 'No',
        s.convertedAt?.toISOString() ?? '',
        s.utmSource ?? '',
        s.utmMedium ?? '',
        s.utmCampaign ?? '',
        s.utmTerm ?? '',
        s.utmContent ?? '',
        s.referrer ?? '',
        metaParts.join('; '),
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const str = String(cell);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')),
    ].join('\n');

    const filename = `webgrade-sessions-${site.name.replace(/\s+/g, '-').toLowerCase()}-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
