/**
 * POST /api/rt/generate  — generate a win-back / prospect teaser report
 * GET  /api/rt/generate?token=xxx — load by share token (public, no auth)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { loadSiteContext, buildSystemPrompt } from '@/lib/ai/context';
import crypto from 'crypto';

export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId, recipientEmail, recipientName, targetType = 'PROSPECT' } = await req.json();
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const ctx = await loadSiteContext(siteId, session.user.email);
  if (!ctx) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const latestReport = await prisma.report.findFirst({
    where: { siteId, type: 'INTERIM', status: 'COMPLETE' },
    orderBy: { createdAt: 'desc' },
  });

  const findings = (latestReport?.topFindings as Record<string, unknown>[] | null) ?? [];
  let totalRevenueAtRisk = 0;
  try { totalRevenueAtRisk = JSON.parse(latestReport?.behavioralSummary ?? '{}').totalRevenueAtRisk ?? 0; } catch { /**/ }

  const isWinBack = targetType === 'CHURNED' || targetType === 'LAPSED';
  const sys = buildSystemPrompt(ctx, 'report');

  let teaserContent = '';
  let lockedItems: unknown[] = [];

  try {
    const [tRaw, lRaw] = await Promise.all([
      callClaude(sys, teaserPrompt(ctx, findings, totalRevenueAtRisk, isWinBack, recipientName), 500),
      callClaude(sys, lockedPrompt(ctx, findings, totalRevenueAtRisk, isWinBack), 800),
    ]);
    teaserContent = tRaw;
    try { lockedItems = JSON.parse(clean(lRaw)).items ?? []; } catch { lockedItems = []; }
  } catch (err) {
    console.error('[RT-01]', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }

  const shareToken = crypto.randomBytes(24).toString('hex');
  const shareExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const report = await prisma.report.create({
    data: {
      siteId,
      type: 'WINBACK',
      status: 'COMPLETE',
      periodStart: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(),
      executiveSummary: teaserContent,
      topFindings: lockedItems as never,
      behavioralSummary: JSON.stringify({ targetType, isWinBack, totalRevenueAtRisk, recipientName }),
      shareToken,
      shareExpiresAt,
      shareRecipient: recipientEmail ?? null,
      generatedAt: new Date(),
    },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return NextResponse.json({ reportId: report.id, shareToken, reportUrl: `${base}/report/${shareToken}`, expiresAt: shareExpiresAt.toISOString() });
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const report = await prisma.report.findFirst({
    where: { shareToken: token, type: 'WINBACK' },
    include: { site: true },
  });

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let meta: Record<string, unknown> = {};
  try { meta = JSON.parse(report.behavioralSummary ?? '{}'); } catch { /**/ }

  return NextResponse.json({
    report: {
      id: report.id,
      siteName: report.site.name,
      domain: report.site.domain,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      teaserContent: report.executiveSummary,
      lockedItems: report.topFindings,
      totalRevenueAtRisk: meta.totalRevenueAtRisk ?? 0,
      recipientName: meta.recipientName ?? null,
      isWinBack: meta.isWinBack ?? false,
      targetType: meta.targetType ?? 'PROSPECT',
      unlockedAt: report.shareUnlockedAt?.toISOString() ?? null,
      expired: report.shareExpiresAt ? report.shareExpiresAt < new Date() : false,
      expiresAt: report.shareExpiresAt?.toISOString() ?? null,
    },
  });
}

// ─── prompts ────────────────────────────────────────────────────────────────

function teaserPrompt(ctx: Awaited<ReturnType<typeof loadSiteContext>>, findings: Record<string, unknown>[], rev: number, isWB: boolean, name?: string) {
  if (!ctx) return '';
  return `${isWB ? `Win-back report for former customer of ${ctx.siteName}` : `Prospect report for ${ctx.siteName}`}
Top finding: ${findings[0] ? JSON.stringify(findings[0]) : 'none'}
Revenue at risk: $${rev.toLocaleString()}/mo
Business: ${ctx.businessDescription ?? ctx.siteName} — ${ctx.domain}

Write the TEASER (only section visible before paywall). Start: "${name ? `Hi ${name},` : 'Hi there,'}"

2–3 paragraphs. Lead with the single most specific, costly finding. Name the page, metric, dollar amount. End hinting at more. Tone: trusted advisor, direct. ~150 words max. No headers, no bullets.`;
}

function lockedPrompt(ctx: Awaited<ReturnType<typeof loadSiteContext>>, findings: Record<string, unknown>[], rev: number, isWB: boolean) {
  if (!ctx) return '';
  return `Business: ${ctx.businessDescription ?? ctx.siteName} (${ctx.domain})
Findings: ${JSON.stringify(findings.slice(0, 3))}
Revenue at risk: $${rev.toLocaleString()}/mo | Type: ${isWB ? 'win-back' : 'prospect'}

Generate 4–6 locked paywall items. ONLY return this JSON:
{"items":[{"rank":2,"title":"Short title 8 words max","preview":"One teaser sentence hinting at problem not fix","impact":"$X,XXX–$X,XXX/mo","category":"behavioral|seo|adspend|ux|content"}]}`;
}

async function callClaude(system: string, user: string, max: number) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: max, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!r.ok) throw new Error(`Claude ${r.status}`);
  return (await r.json()).content?.[0]?.text ?? '';
}

function clean(t: string) { return t.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim(); }
