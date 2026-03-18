/**
 * lib/email/sender.ts
 *
 * AL-03: Email + Slack Delivery
 *
 * Handles sending emails via Resend and Slack messages via webhooks.
 * Used by:
 *   - Alert delivery (alerts fire → deliver via configured channels)
 *   - Report distribution (weekly digest, monthly WebWatch, etc.)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  fromName?: string;
}

export interface SlackPayload {
  webhookUrl: string;
  text: string;
  blocks?: SlackBlock[];
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  fields?: { type: string; text: string }[];
  elements?: unknown[];
}

export interface DeliveryResult {
  channel: 'email' | 'slack';
  success: boolean;
  messageId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Email via Resend
// ---------------------------------------------------------------------------

export async function sendEmail(payload: EmailPayload): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { channel: 'email', success: false, error: 'RESEND_API_KEY not configured' };
  }

  const from = `${payload.fromName ?? 'WebGrade'} <${process.env.EMAIL_FROM ?? 'alerts@webgrade.io'}>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        reply_to: payload.replyTo,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { channel: 'email', success: false, error: `Resend error: ${err}` };
    }

    const data = await res.json();
    return { channel: 'email', success: true, messageId: data.id };
  } catch (err) {
    return { channel: 'email', success: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Slack via webhook
// ---------------------------------------------------------------------------

export async function sendSlack(payload: SlackPayload): Promise<DeliveryResult> {
  try {
    const body: Record<string, unknown> = { text: payload.text };
    if (payload.blocks) body.blocks = payload.blocks;

    const res = await fetch(payload.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { channel: 'slack', success: false, error: `Slack error: ${await res.text()}` };
    }

    return { channel: 'slack', success: true };
  } catch (err) {
    return { channel: 'slack', success: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Alert email templates
// ---------------------------------------------------------------------------

export function buildAlertEmail(params: {
  siteName: string;
  domain: string;
  alertType: string;
  severity: string;
  message: string;
  dashboardUrl: string;
}): string {
  const severityColor = params.severity === 'CRITICAL' ? '#b91c1c' : params.severity === 'HIGH' ? '#b45309' : '#0369a1';
  const severityBg = params.severity === 'CRITICAL' ? '#fef2f2' : params.severity === 'HIGH' ? '#fffbeb' : '#eff6ff';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #bae6fd;">
    <!-- Header -->
    <div style="background:#0c4a6e;padding:24px 32px;display:flex;align-items:center;gap:12px;">
      <div style="background:rgba(255,255,255,0.15);border-radius:8px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
        <span style="color:white;font-weight:800;font-size:14px;">W</span>
      </div>
      <div>
        <p style="margin:0;color:white;font-weight:700;font-size:15px;">WebGrade Alert</p>
        <p style="margin:0;color:#7dd3fc;font-size:12px;">${params.siteName} · ${params.domain}</p>
      </div>
    </div>

    <!-- Severity badge -->
    <div style="padding:24px 32px 0;">
      <span style="display:inline-block;background:${severityBg};color:${severityColor};border:1px solid ${severityColor}30;border-radius:99px;padding:4px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">
        ${params.severity} · ${params.alertType.replace(/_/g, ' ')}
      </span>
    </div>

    <!-- Message -->
    <div style="padding:16px 32px 24px;">
      <p style="margin:0;color:#1e293b;font-size:15px;line-height:1.6;">${params.message}</p>
    </div>

    <!-- CTA -->
    <div style="padding:0 32px 32px;">
      <a href="${params.dashboardUrl}" style="display:inline-block;background:#0c4a6e;color:white;font-weight:600;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;">
        View in Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e0f2fe;padding:16px 32px;">
      <p style="margin:0;color:#94a3b8;font-size:11px;">You're receiving this because alerts are enabled for ${params.siteName}. <a href="${params.dashboardUrl}/settings" style="color:#0891b2;">Manage alert settings</a></p>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Report distribution email template
// ---------------------------------------------------------------------------

export function buildReportEmail(params: {
  siteName: string;
  domain: string;
  reportType: 'INTERIM' | 'WEBWATCH' | 'WEBOPP' | 'DIGEST';
  periodLabel: string;
  summary: string;
  dashboardUrl: string;
  recipientName?: string;
  customMessage?: string;
}): string {
  const titles: Record<string, string> = {
    INTERIM: 'WebGrade Interim Report™',
    WEBWATCH: 'WebWatch™ Monthly Report',
    WEBOPP: 'WebOpp™ Market Intelligence',
    DIGEST: 'WebGrade Weekly Digest',
  };

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #bae6fd;">
    <!-- Header -->
    <div style="background:#0c4a6e;padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="background:rgba(255,255,255,0.15);border-radius:8px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-weight:800;font-size:14px;">W</span>
        </div>
        <span style="color:#7dd3fc;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">WebGrade</span>
      </div>
      <h1 style="margin:0 0 4px;color:white;font-size:22px;font-weight:800;">${titles[params.reportType]}</h1>
      <p style="margin:0;color:#7dd3fc;font-size:13px;">${params.siteName} · ${params.periodLabel}</p>
    </div>

    <!-- Custom message -->
    ${params.customMessage ? `<div style="padding:20px 32px;background:#eff6ff;border-bottom:1px solid #bae6fd;"><p style="margin:0;color:#0c4a6e;font-size:14px;font-style:italic;">"${params.customMessage}"</p></div>` : ''}

    <!-- Summary -->
    <div style="padding:28px 32px;">
      ${params.recipientName ? `<p style="margin:0 0 16px;color:#64748b;font-size:14px;">Hi ${params.recipientName},</p>` : ''}
      <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.7;">${params.summary}</p>

      <a href="${params.dashboardUrl}" style="display:inline-block;background:#0c4a6e;color:white;font-weight:600;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;">
        View Full Report →
      </a>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e0f2fe;padding:16px 32px;">
      <p style="margin:0;color:#94a3b8;font-size:11px;">WebGrade · <a href="${params.dashboardUrl}/settings/distributions" style="color:#0891b2;">Manage report delivery</a> · <a href="${params.dashboardUrl}/settings/distributions" style="color:#0891b2;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Alert Slack block builder
// ---------------------------------------------------------------------------

export function buildAlertSlackBlocks(params: {
  siteName: string;
  alertType: string;
  severity: string;
  message: string;
  dashboardUrl: string;
}): SlackBlock[] {
  const emoji = params.severity === 'CRITICAL' ? '🚨' : params.severity === 'HIGH' ? '⚠️' : 'ℹ️';

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} ${params.severity} Alert — ${params.siteName}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${params.alertType.replace(/_/g, ' ')}*\n${params.message}` },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in Dashboard' },
          url: params.dashboardUrl,
          style: 'primary',
        },
      ],
    },
  ];
}
