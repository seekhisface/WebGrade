// POST /api/admin/sessions/export/queue
//
// Kicks off an out-of-band session export. Returns immediately with 202;
// the actual file generation happens inside an Inngest function and the
// customer gets an email with a download link when it's ready.
//
// Used for date ranges large enough to time out the synchronous GET
// endpoint (typically 15k+ sessions on Vercel Hobby).
//
// Body: { siteId, start, end, format }

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';
import { inngest } from '@/lib/jobs/inngest';

export const runtime = 'nodejs';

const Body = z.object({
  siteId: z.string().min(1),
  start: z.string().optional(),
  end: z.string().optional(),
  format: z.enum(['csv', 'xlsx']).default('xlsx'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
    }
    const { siteId, start, end, format } = parsed.data;

    const access = await verifySiteAccess(session.user.email, siteId);
    if (!access) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const siteDetails = await prisma.site.findUnique({
      where: { id: siteId },
      select: { name: true },
    });
    if (!siteDetails) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 86400000);
    const endDate = end ? new Date(end + 'T23:59:59') : new Date();

    // Surface a clear error if blob storage isn't configured rather than
    // failing silently inside the Inngest job (where the customer would
    // never see the failure).
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'Blob storage not configured. Set BLOB_READ_WRITE_TOKEN in Vercel project settings (Storage → Create Blob store).' },
        { status: 503 },
      );
    }

    await inngest.send({
      name: 'webgrade/session-export.requested',
      data: {
        siteId,
        siteName: siteDetails.name,
        recipientEmail: session.user.email,
        startISO: startDate.toISOString(),
        endISO: endDate.toISOString(),
        format,
      },
    });

    return NextResponse.json(
      {
        queued: true,
        recipientEmail: session.user.email,
        message: `We'll email ${session.user.email} when your ${format.toUpperCase()} is ready.`,
      },
      { status: 202 },
    );
  } catch (err) {
    console.error('Export queue error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
