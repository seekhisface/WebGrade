/**
 * POST /api/alerts/test
 *
 * Sends a test alert to verify email/Slack delivery is configured correctly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiSession, unauthorizedResponse } from '@/lib/auth/api';
import { prisma } from '@/lib/db/client';
import { sendEmail, buildAlertEmail } from '@/lib/email/sender';

export async function POST(req: NextRequest) {
  const auth = await requireApiSession();
  if (!auth) return unauthorizedResponse();
  const { userId, email } = auth;

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
    to: email,
    subject: `[TEST] WebGrade Alert Delivery — ${site.name}`,
    html,
  });

  return NextResponse.json({ ok: result.success, error: result.error });
}
