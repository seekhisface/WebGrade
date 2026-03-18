/**
 * lib/report/prompt.ts
 *
 * P1-12: Behavioral Report Prompt Builder
 *
 * Converts aggregated ReportData into structured Claude prompts
 * for each of the three report sections:
 *  1. Executive Summary
 *  2. Action Items (ranked by revenue impact)
 *  3. Growth Plays
 */

import { ReportData } from './aggregator';
import { buildSystemPrompt, estimateDollarImpact } from '@/lib/ai/context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportSection {
  title: string;
  prompt: string;
  maxTokens: number;
}

export interface ReportPromptSet {
  systemPrompt: string;
  sections: ReportSection[];
}

// ---------------------------------------------------------------------------
// Build the full prompt set
// ---------------------------------------------------------------------------

export function buildReportPrompts(data: ReportData): ReportPromptSet {
  // Build a fake SiteContext for the system prompt builder
  const fakeCtx = {
    siteId: data.siteId,
    siteName: data.siteName,
    domain: data.domain,
    url: `https://${data.domain}`,
    businessDescription: data.context.businessDescription,
    targetAudience: data.context.targetAudience,
    primaryValueProp: data.context.primaryValueProp,
    conversionGoalName: data.context.conversionGoalName,
    conversionGoalUrl: data.context.conversionGoalUrl,
    monthlyAdSpend: data.context.monthlyAdSpend,
    averageOrderValue: data.context.averageOrderValue,
    conversionRate: data.context.conversionRate,
    leadToWinRate: data.context.leadToWinRate,
    dataScenario: data.context.dataScenario,
    hasGA4: data.baseline !== null,
    hasGSC: false,
    hasSnippet: data.live.dataSource === 'live',
    hasFullContext: true,
    missingFields: [],
  };

  const systemPrompt = buildSystemPrompt(fakeCtx, 'report');

  const dataBlock = buildDataBlock(data);

  return {
    systemPrompt,
    sections: [
      buildExecutiveSummaryPrompt(data, dataBlock),
      buildActionItemsPrompt(data, dataBlock),
      buildGrowthPlaysPrompt(data, dataBlock),
    ],
  };
}

// ---------------------------------------------------------------------------
// Section 1: Executive Summary
// ---------------------------------------------------------------------------

function buildExecutiveSummaryPrompt(data: ReportData, dataBlock: string): ReportSection {
  const periodLabel = formatPeriod(data.periodStart, data.periodEnd);

  return {
    title: 'Executive Summary',
    maxTokens: 600,
    prompt: `${dataBlock}

Write an executive summary for the WebGrade Interim Report™ covering ${periodLabel}.

The summary should:
- Open with the single most important finding (the one with the highest revenue impact)
- Give a brief overall health assessment in 1-2 sentences
- Name the top 2-3 problems found, with estimated dollar impact where possible
- Close with a clear statement of what happens if these issues are NOT addressed

Format: 3-4 paragraphs. No headers. No bullet points. Write as if briefing a founder who has 60 seconds to read this.

Tone: Direct, confident, specific. Use the business context to make it relevant to their industry and conversion goal.`,
  };
}

// ---------------------------------------------------------------------------
// Section 2: Action Items
// ---------------------------------------------------------------------------

function buildActionItemsPrompt(data: ReportData, dataBlock: string): ReportSection {
  return {
    title: 'Action Items',
    maxTokens: 1200,
    prompt: `${dataBlock}

Generate a prioritized list of action items for this website. These are specific fixes the owner should implement to recover lost conversions.

For each action item, respond in this exact JSON format:
{
  "actions": [
    {
      "rank": 1,
      "title": "Short action title (max 8 words)",
      "problem": "1-2 sentences describing the specific problem found",
      "fix": "1-2 sentences describing exactly what to change or implement",
      "impact": "Estimated monthly revenue impact as a dollar range (e.g. $800–$2,400/mo)",
      "effort": "low|medium|high",
      "pageUrl": "The specific URL this applies to, or null if site-wide",
      "category": "conversion|engagement|speed|seo|ux|content"
    }
  ]
}

Rules:
- Generate 5-8 action items
- Rank by revenue impact (highest first)
- Every fix must be SPECIFIC — name the exact element, copy, or page to change
- Use the actual page URLs from the data
- Base dollar impact on the revenue context provided
- Respond ONLY with the JSON object, no preamble or explanation`,
  };
}

// ---------------------------------------------------------------------------
// Section 3: Growth Plays
// ---------------------------------------------------------------------------

function buildGrowthPlaysPrompt(data: ReportData, dataBlock: string): ReportSection {
  return {
    title: 'Growth Plays',
    maxTokens: 1000,
    prompt: `${dataBlock}

Generate strategic growth plays — these are opportunities to GROW revenue beyond just fixing what's broken. Think beyond conversion optimization: A/B tests, new content angles, audience expansion, retention plays.

Respond in this exact JSON format:
{
  "plays": [
    {
      "rank": 1,
      "title": "Growth play title (max 8 words)",
      "opportunity": "1-2 sentences describing the opportunity and why it applies to this business",
      "hypothesis": "If we do X, then Y will happen because Z",
      "experiment": "Specific experiment to run to test this hypothesis",
      "upside": "Estimated upside in revenue or traffic if it works",
      "timeToResult": "How long before you'd see results (e.g. '2-4 weeks')",
      "category": "ab_test|content|audience|retention|channel|product"
    }
  ]
}

Rules:
- Generate 4-6 growth plays
- Make them specific to this business, not generic advice
- Rank by potential upside
- Each play should be testable within 30 days
- Use knowledge of the business description, target audience, and competitors
- Respond ONLY with the JSON object, no preamble or explanation`,
  };
}

// ---------------------------------------------------------------------------
// Data block — injected into every prompt
// ---------------------------------------------------------------------------

function buildDataBlock(data: ReportData): string {
  const lines: string[] = ['=== BEHAVIORAL DATA ==='];

  // Period
  lines.push(`Analysis period: ${formatPeriod(data.periodStart, data.periodEnd)} (45 days)`);
  lines.push(`Data source: ${data.live.dataSource === 'live' ? 'Live behavioral tracking' : 'Demo data'}`);

  // Live metrics
  lines.push('');
  lines.push('--- Live Behavioral Metrics ---');
  lines.push(`Total sessions: ${data.live.totalSessions.toLocaleString()}`);
  lines.push(`Total pageviews: ${data.live.totalPageviews.toLocaleString()}`);
  if (data.live.avgIntentScore > 0) {
    lines.push(`Average intent score: ${data.live.avgIntentScore}/100`);
    lines.push(`High-intent sessions (score ≥70): ${data.live.highIntentSessions.toLocaleString()}`);
  }
  lines.push(`Rage click events: ${data.live.rageClickEvents}`);
  lines.push(`Hesitation events: ${data.live.hesitationEvents}`);

  // GA4 baseline
  if (data.baseline) {
    lines.push('');
    lines.push('--- GA4 Historical Baseline (90 days) ---');
    lines.push(`Sessions: ${data.baseline.sessions90d.toLocaleString()}`);
    lines.push(`Bounce rate: ${(data.baseline.bounceRate * 100).toFixed(1)}%`);
    lines.push(`Avg session duration: ${Math.round(data.baseline.avgSessionDuration)}s`);
    lines.push(`Conversions: ${data.baseline.conversions90d}`);
    lines.push(`Conversion rate: ${(data.baseline.conversionRate * 100).toFixed(2)}%`);
  }

  // Revenue at risk
  lines.push('');
  lines.push('--- Revenue Impact ---');
  lines.push(`Total estimated revenue at risk: $${data.totalRevenueAtRisk.toLocaleString()}/mo`);
  if (data.estimatedMonthlyImpact) {
    lines.push(`Estimated recoverable revenue: $${data.estimatedMonthlyImpact.low.toLocaleString()}–$${data.estimatedMonthlyImpact.high.toLocaleString()}/mo`);
  }

  // Top breakpoint
  if (data.topBreakpoint) {
    lines.push('');
    lines.push('--- Primary Storyline Breakpoint ---');
    lines.push(`URL: ${data.topBreakpoint.url}`);
    lines.push(`Sessions: ${data.topBreakpoint.sessions}`);
    lines.push(`Exit rate: ${data.topBreakpoint.exitRate.toFixed(1)}% (severity: ${data.topBreakpoint.severity})`);
    lines.push(`Scroll depth: ${data.topBreakpoint.scrollDepth.toFixed(1)}%`);
    lines.push(`Revenue at risk: $${data.topBreakpoint.revenueAtRisk.toLocaleString()}/mo`);
  }

  // Critical pages
  if (data.criticalPages.length > 0) {
    lines.push('');
    lines.push('--- Critical Pages (top issues) ---');
    data.criticalPages.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.url}`);
      lines.push(`   Exit rate: ${p.exitRate.toFixed(1)}% | Scroll: ${p.scrollDepth.toFixed(1)}% | Revenue at risk: $${p.revenueAtRisk.toLocaleString()}/mo`);
    });
  }

  // All pages summary
  if (data.allPages.length > data.criticalPages.length) {
    lines.push('');
    lines.push(`Additional pages analyzed: ${data.allPages.length - data.criticalPages.length} more pages with lower severity issues`);
  }

  // Alerts
  if (data.alerts.total > 0) {
    lines.push('');
    lines.push('--- Alert History ---');
    lines.push(`Total alerts in period: ${data.alerts.total}`);
    lines.push(`Critical: ${data.alerts.critical} | High: ${data.alerts.high} | Resolved: ${data.alerts.resolved}`);
    if (data.alerts.topAlertType) lines.push(`Most common: ${data.alerts.topAlertType}`);
  }

  // Competitors
  if (data.competitors.length > 0) {
    lines.push('');
    lines.push(`Competitors being tracked: ${data.competitors.join(', ')}`);
  }

  lines.push('');
  lines.push('=== END DATA ===');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPeriod(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}
