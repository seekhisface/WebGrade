// GET /api/admin/sessions/export?siteId=xxx&start=YYYY-MM-DD&end=YYYY-MM-DD&format=csv|xlsx
//
// Live download endpoint. Streaming generators live in
// src/lib/exports/sessions-export.ts so this route and the Inngest
// queue job (which stashes a generated file to Vercel Blob for the
// email-link path) can share the exact same row shape.
//
// Vercel Hobby caps function duration at 60s. The streaming generators
// keep memory bounded and start shipping bytes within a couple of
// seconds, so this route reliably handles 10–15k sessions even on
// Hobby. For ranges beyond that, use the queue endpoint at
// /api/admin/sessions/export/queue which has no time limit.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';
import {
  streamSessionsAsCsv,
  streamSessionsAsXlsx,
  buildExportFilename,
} from '@/lib/exports/sessions-export';

export const runtime = 'nodejs';
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
    const format = (req.nextUrl.searchParams.get('format') ?? 'xlsx').toLowerCase() as 'csv' | 'xlsx';

    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });
    if (format !== 'csv' && format !== 'xlsx') {
      return NextResponse.json({ error: 'format must be csv or xlsx' }, { status: 400 });
    }

    const access = await verifySiteAccess(session.user.email, siteId);
    if (!access) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const siteDetails = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, name: true },
    });
    if (!siteDetails) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const start = startStr ? new Date(startStr) : new Date(Date.now() - 30 * 86400000);
    const end = endStr ? new Date(endStr + 'T23:59:59') : new Date();

    const filename = buildExportFilename(siteDetails.name, start, end, format);

    if (format === 'csv') {
      const stream = streamSessionsAsCsv(siteId, start, end);
      return new NextResponse(stream as unknown as ReadableStream, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const stream = streamSessionsAsXlsx(siteId, siteDetails.name, start, end);
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
