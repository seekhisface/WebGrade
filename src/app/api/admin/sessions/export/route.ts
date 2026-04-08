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

    // Fetch sessions with event counts
    const sessions = await prisma.visitorSession.findMany({
      where: {
        siteId,
        startedAt: { gte: start, lte: end },
      },
      include: {
        _count: { select: { events: true, pageViews: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 10000, // cap at 10k rows
    });

    // Build CSV
    const headers = [
      'Session ID', 'Started At', 'Ended At', 'Duration (s)',
      'Country', 'Region', 'Device Type', 'Browser', 'OS',
      'Entry Page', 'Exit Page', 'Page Count', 'Event Count',
      'Intent Score', 'Intent Class', 'Is Bot', 'Bot Reason',
      'Converted', 'Converted At',
      'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Term', 'UTM Content',
      'Referrer',
    ];

    const rows = sessions.map(s => {
      const duration = s.endedAt && s.startedAt
        ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)
        : '';
      return [
        s.sessionId,
        s.startedAt.toISOString(),
        s.endedAt?.toISOString() ?? '',
        duration,
        s.country ?? '',
        s.region ?? '',
        s.deviceType ?? '',
        s.browser ?? '',
        s.os ?? '',
        s.entryPage ?? '',
        s.exitPage ?? '',
        s.pageCount,
        s._count.events,
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
