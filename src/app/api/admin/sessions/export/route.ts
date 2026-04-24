// src/app/api/admin/sessions/export/route.ts
// GET /api/admin/sessions/export?siteId=xxx&start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns CSV with one row per event, grouped by session.
// Sort by Session ID + Step to see the full visitor journey.
// Filter/pivot on Page to see totals by page.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';

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

    // Fetch sessions with ALL event fields
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
      take: 5000, // cap sessions (events expand this significantly)
    });

    // Helpers
    function fmtDuration(seconds: number): string {
      if (seconds <= 0) return '0s';
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
    }

    /** Truncate a session ID for display: first 12 chars + ellipsis */
    function truncateSessionId(id: string): string {
      return id.length > 12 ? id.slice(0, 12) + '...' : id;
    }

    /** Return URL path only, stripping domain, query string, and hash */
    function toPathOnly(url: string | null): string {
      if (!url) return '';
      try {
        const u = new URL(url);
        return u.pathname || '/';
      } catch {
        // Not a full URL — strip hash and query from relative path
        return url.split('#')[0].split('?')[0] || '/';
      }
    }

    /** Strip hash fragments from URLs so tab/filter clicks don't inflate page counts */
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

    // Build CSV — one row per event
    const headers = [
      // Session context (repeated per event for filtering)
      'Session ID', 'Session Start', 'Session Duration',
      'Country', 'Region', 'Device', 'Browser', 'OS',
      'Entry Page', 'Exit Page', 'Total Pages', 'Total Events',
      'Intent Score', 'Intent Class', 'Converted',
      'Traffic Source', 'Is Returning', 'Is Bounce', 'Bot Suspect', 'Bot Suspect Reason',
      'UTM Source', 'UTM Medium', 'UTM Campaign', 'Referrer',
      // Event detail
      'Step', 'Time in Session', 'Event Type', 'Page', 'Page (last segment)',
      'Scroll Depth %', 'Element Tag', 'Element Text', 'Is CTA Click',
      'Hesitation (s)', 'Rage Clicks', 'Time on Page', 'Metadata',
    ];

    const rows: (string | number)[][] = [];

    for (const s of sessions) {
      const durationSec = s.endedAt && s.startedAt
        ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)
        : 0;

      // Session-level fields (same on every row for this session)
      const sessionFields = [
        truncateSessionId(s.sessionId),
        s.startedAt.toISOString(),
        fmtDuration(durationSec),
        s.country ?? '',
        s.region ?? '',
        s.deviceType ?? '',
        s.browser ?? '',
        s.os ?? '',
        toPathOnly(s.entryPage),
        toPathOnly(s.exitPage),
        s.pageCount,
        s.events.length,
        s.intentScore ?? '',
        s.intentClass ?? '',
        s.conversionGoalHit ? 'Yes' : 'No',
        s.trafficSource ?? '',
        s.isReturning ? 'Yes' : 'No',
        s.isBounce ? 'Yes' : 'No',
        s.isBotSuspect ? 'Yes' : '',
        s.botSuspectReason ?? '',
        s.utmSource ?? '',
        s.utmMedium ?? '',
        s.utmCampaign ?? '',
        s.referrer ? (() => { try { const u = new URL(s.referrer!); return u.hostname + u.pathname; } catch { return s.referrer!; } })() : '',
      ];

      if (s.events.length === 0) {
        // Session with no events — still output one row
        rows.push([...sessionFields, 1, '0s', '(no events)', '', '', '', '', '', '', '', '', '', '']);
      } else {
        for (let i = 0; i < s.events.length; i++) {
          const ev = s.events[i];
          const evTs = new Date(ev.timestamp);

          // Flatten metadata
          let meta = '';
          if (ev.metadata && typeof ev.metadata === 'object') {
            const parts = Object.entries(ev.metadata as Record<string, unknown>)
              .filter(([, v]) => v != null && v !== '')
              .map(([k, v]) => `${k}=${String(v)}`);
            meta = parts.join('; ');
          }

          rows.push([
            ...sessionFields,
            i + 1, // Step number (journey order)
            fmtRelative(evTs, s.startedAt),
            ev.eventType,
            stripHash(ev.pageUrl),
            lastSegment(ev.pageUrl),
            ev.scrollDepthPct ?? '',
            ev.elementTag ?? '',
            ev.elementText ?? '',
            ev.isCtaClick ? 'Yes' : '',
            ev.hesitationMs ?? '',
            ev.rageClickCount ?? '',
            ev.timeOnPageMs ? fmtDuration(Math.round(ev.timeOnPageMs / 1000)) : '',
            meta,
          ]);
        }
      }
    }

    // Encode CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Sanitize: strip carriage returns and control chars that break CSV row boundaries
        const str = String(cell).replace(/[\r\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')),
    ].join('\n');

    const filename = `webgrade-events-${siteDetails.name.replace(/\s+/g, '-').toLowerCase()}-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv`;

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
