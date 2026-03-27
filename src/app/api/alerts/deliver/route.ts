export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/**
 * POST /api/alerts/deliver
 *
 * AL-03: Delivers an alert via its configured channels (email, Slack, SMS).
 * Called by the rules engine when an alert is triggered.
 *
 * Body: { alertId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { sendEmail, sendSlack, buildAlertEmail, buildAlertSlackBlocks } from '@/lib/email/sender';

export async function POST(req: NextRequest) {
  const { alertId } = await req.json();
  if (!alertId) return NextResponse.json({ error: 'alertId required' }, { status: 400 });

  // Load alert + site + alert settings
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: { site: { include: { onboarding: true } } },
  });

  if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });

  const settings = await prisma.alertSetting.findUnique({
    where: { siteId_alertType: { siteId: alert.siteId, alertType: alert.alertType } },
  });

  if (!settings?.isEnabled) {
    return NextResponse.json({ skipped: true, reason: 'Alert type disabled' });
  }

  // Check quiet hours
  const now = new Date();
  const currentHour = now.getHours();
  if (settings.quietHoursStart !== null && settings.quietHoursEnd !== null) {
    const inQuiet = isInQuietHours(currentHour, settings.quietHoursStart, settings.quietHoursEnd);
    if (inQuiet) {
      return NextResponse.json({ skipped: true, reason: 'Quiet hours active' });
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://webgrade.io';
  const dashboardUrl = `${appUrl}/dashboard/${alert.siteId}`;
  const results = [];

  // ── Email delivery ────────────────────────────────────────────────────────
  if (settings.emailEnabled) {
    const recipients = settings.emailRecipients.length > 0
      ? settings.emailRecipients
      : [alert.site.onboarding ? null : null].filter(Boolean) as string[];

    // Also get org owner email
    const orgOwner = await prisma.orgMembership.findFirst({
      where: { orgId: alert.site.orgId, role: 'OWNER' },
      include: { user: true },
    });
    if (orgOwner?.user?.email && !recipients.includes(orgOwner.user.email)) {
      recipients.push(orgOwner.user.email);
    }

    if (recipients.length > 0) {
      const html = buildAlertEmail({
        siteName: alert.site.name,
        domain: alert.site.domain,
        alertType: alert.alertType,
        severity: alert.severity,
        message: alert.message,
        dashboardUrl,
      });

      const result = await sendEmail({
        to: recipients,
        subject: `[${alert.severity}] ${alert.alertType.replace(/_/g, ' ')} — ${alert.site.name}`,
        html,
      });

      results.push(result);

      if (result.success) {
        await prisma.alert.update({
          where: { id: alertId },
          data: { emailSentAt: new Date() },
        });
      }
    }
  }

  // ── Slack delivery ────────────────────────────────────────────────────────
  if (settings.slackEnabled && settings.slackWebhookUrl) {
    const blocks = buildAlertSlackBlocks({
      siteName: alert.site.name,
      alertType: alert.alertType,
      severity: alert.severity,
      message: alert.message,
      dashboardUrl,
    });

    const result = await sendSlack({
      webhookUrl: settings.slackWebhookUrl,
      text: `${alert.severity} Alert — ${alert.site.name}: ${alert.message}`,
      blocks,
    });

    results.push(result);

    if (result.success) {
      await prisma.alert.update({
        where: { id: alertId },
        data: { slackSentAt: new Date() },
      });
    }
  }

  return NextResponse.json({ delivered: results.length, results });
}

// ── GET — test delivery config ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const settings = await prisma.alertSetting.findMany({ where: { siteId } });
  const recentAlerts = await prisma.alert.findMany({
    where: { siteId },
    orderBy: { triggeredAt: 'desc' },
    take: 10,
    select: { id: true, alertType: true, severity: true, triggeredAt: true, emailSentAt: true, slackSentAt: true, resolvedAt: true },
  });

  return NextResponse.json({ settings, recentAlerts });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isInQuietHours(current: number, start: number, end: number): boolean {
  if (start <= end) return current >= start && current < end;
  // Wraps midnight (e.g. 22–6)
  return current >= start || current < end;
}
