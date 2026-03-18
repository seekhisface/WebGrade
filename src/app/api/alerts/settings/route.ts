/**
 * GET/PATCH /api/alerts/settings
 *
 * AL-05: Alert Settings management
 * GET: Returns all alert settings for a site
 * PATCH: Updates a specific alert setting
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiSession, unauthorizedResponse } from '@/lib/auth/api';
import { prisma } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  const auth = await requireApiSession();
  if (!auth) return unauthorizedResponse();
  const { userId, email } = auth;

  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const settings = await prisma.alertSetting.findMany({
    where: { siteId },
    orderBy: { alertType: 'asc' },
  });

  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiSession();
  if (!auth) return unauthorizedResponse();
  const { userId, email } = auth;

  const body = await req.json();
  const { siteId, alertType, ...updates } = body;

  if (!siteId || !alertType) {
    return NextResponse.json({ error: 'siteId and alertType required' }, { status: 400 });
  }

  // If alertType is __all__, update all settings for the site (e.g. Slack webhook)
  if (alertType === '__all__') {
    await prisma.alertSetting.updateMany({
      where: { siteId },
      data: updates,
    });
    return NextResponse.json({ ok: true });
  }

  // Upsert individual setting
  const setting = await prisma.alertSetting.upsert({
    where: { siteId_alertType: { siteId, alertType } },
    update: updates,
    create: {
      siteId,
      alertType,
      severity: 'HIGH',
      isEnabled: true,
      emailEnabled: true,
      ...updates,
    },
  });

  return NextResponse.json({ setting });
}
