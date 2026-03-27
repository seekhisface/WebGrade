export const dynamic = 'force-dynamic'
/**
 * POST /api/ai/report
 *
 * P1-12: Behavioral Report Generator
 *
 * Generates the full WebGrade Interim Report™ using Claude AI.
 * Saves the result to the Report model in the database.
 *
 * Body: { siteId }
 *
 * Process:
 * 1. Aggregate all behavioral + GA4 + context data
 * 2. Build structured prompts for each report section
 * 3. Call Claude API for each section (executive, actions, growth plays)
 * 4. Parse and save the report to DB
 * 5. Return the full report
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { aggregateReportData } from '@/lib/report/aggregator';
import { buildReportPrompts } from '@/lib/report/prompt';

export const maxDuration = 120; // 2 min timeout for Vercel

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { siteId } = await req.json();
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  // ── Check if a recent report already exists ──────────────────────────────
  const existingReport = await prisma.report.findFirst({
    where: {
      siteId,
      type: 'INTERIM',
      status: 'COMPLETE',
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // within 24h
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existingReport) {
    return NextResponse.json({ reportId: existingReport.id, cached: true });
  }

  // ── Create a pending report record ───────────────────────────────────────
  const now = new Date();
  const periodStart = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);

  const report = await prisma.report.create({
    data: {
      siteId,
      type: 'INTERIM',
      status: 'GENERATING',
      periodStart,
      periodEnd: now,
      version: 1,
    },
  });

  // ── Aggregate data ───────────────────────────────────────────────────────
  let reportData;
  try {
    reportData = await aggregateReportData(siteId, session.user.email);
    if (!reportData) {
      await prisma.report.update({ where: { id: report.id }, data: { status: 'FAILED' } });
      return NextResponse.json({ error: 'Site not found or no access' }, { status: 404 });
    }
  } catch (err) {
    const msg2 = err instanceof Error ? err.message : String(err);
    console.error('[Report] Data aggregation failed:', msg2);
    await prisma.report.update({ where: { id: report.id }, data: { status: 'FAILED' } });
    return NextResponse.json({ error: `Data aggregation failed: ${msg2}` }, { status: 500 });
  }

  // ── Build prompts ────────────────────────────────────────────────────────
  const { systemPrompt, sections } = buildReportPrompts(reportData);

  // ── Call Claude for each section ─────────────────────────────────────────
  let executiveSummary = '';
  let topFindings: unknown[] = [];
  let topRecommendations: unknown[] = [];
  let growthPlays: unknown[] = [];

  try {
    // Section 1: Executive Summary
    const execRes = await callClaude(systemPrompt, sections[0].prompt, sections[0].maxTokens);
    executiveSummary = execRes;

    // Section 2: Action Items (JSON)
    const actionsRes = await callClaude(systemPrompt, sections[1].prompt, sections[1].maxTokens);
    try {
      const parsed = JSON.parse(cleanJson(actionsRes));
      topRecommendations = parsed.actions ?? [];
      topFindings = topRecommendations.slice(0, 3).map((a: Record<string, unknown>) => ({
        title: a.title,
        problem: a.problem,
        impact: a.impact,
        category: a.category,
      }));
    } catch (e) {
      console.error('[Report] Action items JSON parse failed:', e);
      topRecommendations = [];
    }

    // Section 3: Growth Plays (JSON)
    const growthRes = await callClaude(systemPrompt, sections[2].prompt, sections[2].maxTokens);
    try {
      const parsed = JSON.parse(cleanJson(growthRes));
      growthPlays = parsed.plays ?? [];
    } catch (e) {
      console.error('[Report] Growth plays JSON parse failed:', e);
      growthPlays = [];
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Report] Claude API call failed:', msg);
    await prisma.report.update({ where: { id: report.id }, data: { status: 'FAILED' } });
    return NextResponse.json({ error: `AI generation failed: ${msg}` }, { status: 500 });
  }

  // ── Save completed report ────────────────────────────────────────────────
  const estimatedImpact = reportData.estimatedMonthlyImpact
    ? `$${reportData.estimatedMonthlyImpact.low.toLocaleString()}–$${reportData.estimatedMonthlyImpact.high.toLocaleString()}/mo recoverable`
    : null;

  const completed = await prisma.report.update({
    where: { id: report.id },
    data: {
      status: 'COMPLETE',
      executiveSummary,
      topFindings: topFindings as never,
      topRecommendations: topRecommendations as never,
      behavioralSummary: JSON.stringify({
        growthPlays,
        liveMetrics: reportData.live,
        baselineMetrics: reportData.baseline,
        criticalPages: reportData.criticalPages,
        totalRevenueAtRisk: reportData.totalRevenueAtRisk,
      }),
      estimatedImpact,
    },
  });

  return NextResponse.json({
    reportId: completed.id,
    cached: false,
    sections: {
      executiveSummary,
      actionItems: topRecommendations,
      growthPlays,
    },
    meta: {
      totalRevenueAtRisk: reportData.totalRevenueAtRisk,
      criticalPagesCount: reportData.criticalPages.length,
      dataSource: reportData.live.dataSource,
    },
  });
}

// ── GET — fetch existing report ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const report = await prisma.report.findFirst({
    where: { siteId, type: 'INTERIM' },
    orderBy: { createdAt: 'desc' },
  });

  if (!report) return NextResponse.json({ report: null });

  let growthPlays = [];
  let liveMetrics = null;
  let baselineMetrics = null;
  let criticalPages = [];
  let totalRevenueAtRisk = 0;

  try {
    const behavioral = JSON.parse(report.behavioralSummary ?? '{}');
    growthPlays = behavioral.growthPlays ?? [];
    liveMetrics = behavioral.liveMetrics ?? null;
    baselineMetrics = behavioral.baselineMetrics ?? null;
    criticalPages = behavioral.criticalPages ?? [];
    totalRevenueAtRisk = behavioral.totalRevenueAtRisk ?? 0;
  } catch { /* ignore parse errors */ }

  return NextResponse.json({
    report: {
      id: report.id,
      status: report.status,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      executiveSummary: report.executiveSummary,
      actionItems: report.topRecommendations,
      topFindings: report.topFindings,
      growthPlays,
      estimatedImpact: report.estimatedImpact,
      liveMetrics,
      baselineMetrics,
      criticalPages,
      totalRevenueAtRisk,
      createdAt: report.createdAt,
    },
  });
}

// ---------------------------------------------------------------------------
// Claude API helper
// ---------------------------------------------------------------------------

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

function cleanJson(text: string): string {
  return text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
}
