export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/**
 * POST /api/alerts/test
 *
 * Sends a test alert to verify email/Slack delivery is configured correctly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { sendEmail, buildAlertEmail } from '@/lib/email/sender';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { siteId } = await req.json();
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://webgrade.io';

  const html = buildAlertEmail({
    siteName: site.name,
    domain: site.domain,
    alertType: 'TEST_ALERT',
    severity: 'MEDIUM',
    message: 'This is a test alert from WebGrade. Your alert delivery is configured correctly.',
    dashboardUrl: `${appUrl}/dashboard/${siteId}`,
  });

  const result = await sendEmail({
    to: session.user.email,
    subject: `[TEST] WebGrade Alert Delivery — ${site.name}`,
    html,
  });

  return NextResponse.json({ ok: result.success, error: result.error });
}
