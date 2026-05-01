/**
 * lib/report/generator.ts
 *
 * Library function for generating a WebGrade Interim Report. Called directly
 * from the Inngest cron jobs (Day 30, Day 60, monthly WebWatch). No HTTP layer.
 *
 * Manual generation from the UI is no longer supported — reports only fire on
 * schedule. The "View Report" path is read-only and just queries the most recent
 * Report record from the database.
 */

import { prisma } from '@/lib/db/client';
import { aggregateReportData } from './aggregator';
import { buildReportPrompts } from './prompt';

export interface GenerateReportInput {
  siteId: string;
  periodDays: number;
  // Human-readable label persisted alongside the report. Examples:
  //   "Day 30 audit", "Day 60 final audit", "Partial 1st month",
  //   "April 2026", etc.
  reportLabel: string;
  // Optional explicit period override — used by Partial 1st month so the
  // window is webwatchStartDate → end-of-prev-month rather than periodDays back.
  periodStart?: Date;
  periodEnd?: Date;
}

export async function generateReport(input: GenerateReportInput) {
  const { siteId, periodDays, reportLabel } = input;
  const now = new Date();
  const periodEnd = input.periodEnd ?? now;
  const periodStart = input.periodStart ?? new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const report = await prisma.report.create({
    data: {
      siteId,
      type: 'INTERIM',
      status: 'GENERATING',
      periodStart,
      periodEnd,
      version: 1,
    },
  });

  try {
    const reportData = await aggregateReportData(siteId, null, periodDays);
    if (!reportData) {
      await prisma.report.update({ where: { id: report.id }, data: { status: 'FAILED' } });
      throw new Error(`Site not found or no access: ${siteId}`);
    }

    const { systemPrompt, sections } = buildReportPrompts(reportData);

    let executiveSummary = '';
    let topFindings: unknown[] = [];
    let topRecommendations: unknown[] = [];
    let growthPlays: unknown[] = [];

    executiveSummary = await callClaude(systemPrompt, sections[0].prompt, sections[0].maxTokens);

    const actionsRes = await callClaude(systemPrompt, sections[1].prompt, sections[1].maxTokens);
    try {
      const parsed = JSON.parse(cleanJson(actionsRes));
      topRecommendations = parsed.actions ?? [];
      topFindings = topRecommendations.slice(0, 3).map((item: unknown) => {
        const a = item as Record<string, unknown>;
        return { title: a.title, problem: a.problem, impact: a.impact, category: a.category };
      });
    } catch (e) {
      console.error('[generateReport] Action items JSON parse failed:', e);
    }

    const growthRes = await callClaude(systemPrompt, sections[2].prompt, sections[2].maxTokens);
    try {
      const parsed = JSON.parse(cleanJson(growthRes));
      growthPlays = parsed.plays ?? [];
    } catch (e) {
      console.error('[generateReport] Growth plays JSON parse failed:', e);
    }

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
          // Section 2 conditional KPI logic — drives the Revenue at Risk card states.
          trackingHealth: reportData.trackingHealth,
          conversionGoalConfigured: !!reportData.context.conversionGoalUrl,
          reportLabel,
        }),
        estimatedImpact,
      },
    });

    return completed;
  } catch (err) {
    await prisma.report.update({ where: { id: report.id }, data: { status: 'FAILED' } }).catch(() => null);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Claude API helper (private to this module — same shape as the old route handler)
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
  return text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
}
