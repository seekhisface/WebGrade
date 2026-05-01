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
      buildFindingsPrompt(data, dataBlock),
    ],
  };
}

// ---------------------------------------------------------------------------
// Section 1: Bottom line  (replaces "Executive Summary")
//
// Hard-rules contract — 3-5 sentences max, banned-word list, conditional Cost
// sentence depending on whether conversion events are firing.
// ---------------------------------------------------------------------------

function buildExecutiveSummaryPrompt(data: ReportData, dataBlock: string): ReportSection {
  const periodLabel = formatPeriod(data.periodStart, data.periodEnd);
  const th = data.trackingHealth;

  const costInstructionLive = `Sentence 3 (Cost): State the modeled revenue-at-risk figure: "$${data.totalRevenueAtRisk.toLocaleString()}/mo at risk based on ${th.conversionEventsCount} conversion event${th.conversionEventsCount === 1 ? '' : 's'} in the period."`;
  const costInstructionDark = `Sentence 3 (Cost): Conversion tracking is NOT firing. DO NOT output any $/mo or revenue-at-risk figure. Sentence 3 MUST state the cost is unquantifiable from this dataset, citing the specific gap (e.g. "no conversion events fired in the period — either no one converted or the conversion-tracking flag is not yet wired up"). Adapt wording to specifics but produce no dollar amount.`;

  return {
    title: 'Bottom line',
    maxTokens: 400,
    prompt: `${dataBlock}

Write the "Bottom line" section of the WebGrade Interim Report covering ${periodLabel}.

# HARD RULES

## Length — strictly enforced
- 3 to 5 sentences. Hard ceiling. If you write 6 sentences, you have failed.
- Each sentence ≤ 25 words.

## Voice
- Numbers BEFORE claims. "116 visitors entered, 116 exited" before "100% same-page exit rate."
- BANNED adjectives unless paired with a specific quantitative anchor: catastrophic, hemorrhaging, concerning, alarming, devastating, dangerous, urgent, critical. Allowed: "critical — accounts for 47% of qualified-visitor loss". Banned: "concerning patterns".
- Hedge honestly. "Likely worse", "we cannot confirm from this dataset because [reason]", "appears to be" are signs of integrity, not weakness.
- Cite the data class for behavioral claims: "27 of 116 (23%) classified as COMPETITOR" — not "many competitors visited".

## Structure (in order)
- Sentence 1 (Context): what was measured, over what window, what the spend was if applicable.
- Sentence 2 (Dominant finding): the single biggest leak, with the number that proves it.
- ${th.conversionEventsFiring ? costInstructionLive : costInstructionDark}
- Sentence 4-5 (Optional caveat): bot %, instrumentation gap, or other reason the picture is "likely worse." Skip if nothing meaningful to add.

# TRACKING HEALTH (use this to write honestly)
- Conversion events firing: ${th.conversionEventsFiring ? `yes (${th.conversionEventsCount} in period)` : 'NO — flag may not be wired up'}
- Bot ratio: ${th.botPct}% of sessions flagged as bot or bot-suspect
- Event data completeness: ${th.eventDataCompleteness}% of non-bot sessions have event-level data

# EXEMPLAR (write in this style)

"781 sessions and $3,300 in paid spend over 11 days produced 2 sessions that touched the demo thanks page. WebGrade marked 0 of 781 as 'converted' — that flag may not yet be wired up, so whether those 2 sessions actually completed the form is unclear. What is clear is the funnel itself: 116 visitors entered on the pricing page and 100% exited from the same page."

# ANTI-PATTERN (do NOT write like this)

"GSV's features page is hemorrhaging potential partnerships, with 68% of visitors exiting after barely engaging with the content—translating to $18,200 in monthly revenue at risk from a single page failure. This represents nearly half of the total $41,200 monthly revenue exposure across the site. Your website's overall health shows concerning patterns…"

The anti-pattern fails because: (1) "hemorrhaging" / "concerning" are adjectives doing work numbers should do; (2) it presents modeled dollar figures as fact when they're modeled and may not be substantiated; (3) too many sentences before the actual point.

Output the prose only — no headers, no preamble, no list bullets, no markdown.`,
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
// Section 4: Findings & insights (long-form)
//
// One 2-3 paragraph deep-dive per top-3 leak. Receives structured page-level
// signals (scroll, intent breakdown, hesitations, rage clicks) so claims are
// anchored in real data rather than hallucinated. Returns JSON.
// ---------------------------------------------------------------------------

function buildFindingsPrompt(data: ReportData, dataBlock: string): ReportSection {
  const leaks = data.topLeaks ?? [];
  const signals = data.leakSignals ?? [];

  // Attach signals to each leak by URL for the prompt
  const leakBlocks = leaks.map((leak, idx) => {
    const sig = signals.find(s => s.url === leak.url) ?? signals[idx];
    return `## Leak #${leak.rank}: ${leak.url}
Severity: ${leak.severity} (${leak.attributablePct.toFixed(1)}% of qualified-visitor loss)
Sessions: ${leak.sessions} | Exit rate: ${leak.exitRate.toFixed(0)}% | HIGH/MED exits: ${leak.qualifiedVisitorsLost}
Avg scroll depth: ${sig?.scrollDepth.toFixed(0) ?? 'unknown'}%
Rage clicks: ${sig?.rageClicks ?? 0} | Hesitation events: ${sig?.hesitations ?? 0}
Intent breakdown: HIGH=${sig?.intentBreakdown.HIGH ?? 0}, MEDIUM=${sig?.intentBreakdown.MEDIUM ?? 0}, LOW=${sig?.intentBreakdown.LOW ?? 0}, RESEARCHER=${sig?.intentBreakdown.RESEARCHER ?? 0}, COMPETITOR=${sig?.intentBreakdown.COMPETITOR ?? 0}, BOT=${sig?.intentBreakdown.BOT ?? 0}`;
  }).join('\n\n');

  return {
    title: 'Findings & Insights',
    maxTokens: 1500,
    prompt: `${dataBlock}

# TOP LEAKS WITH PAGE-LEVEL SIGNALS

${leakBlocks || '(no leaks above the 5% qualified-loss threshold — return empty findings array)'}

# YOUR JOB

For each leak above, write a 2-3 paragraph "finding" with the structure below. Output JSON.

# STRUCTURE (per finding)

Paragraph 1 — Finding statement: Restate the leak with concrete numbers. Lead with traffic + exit + qualified-visitor counts.

Paragraph 2 — The "why": Use the page-level signals (scroll depth, intent breakdown, hesitation, rage clicks, form events). Every behavioral claim MUST trace to a passed-in number. If scroll depth is 30%, say so. If rage clicks are 0, do not mention them. Cite intent class with counts: "27 of 116 (23%) classified as COMPETITOR" — not "many competitors visited".

Paragraph 3 — The qualifier: What this finding does NOT yet tell us. Examples: "We can see they exited but not whether they were comparing pricing or got blocked by a form field." Or: "Conversion tracking is not firing, so we cannot confirm whether any of these visitors completed elsewhere on the site."

# VOICE RULES

- Numbers BEFORE claims.
- BANNED unless paired with a quantitative anchor: catastrophic, hemorrhaging, concerning, alarming, devastating, dangerous, urgent, critical.
- Hedge honestly: "appears to be", "we cannot confirm from this dataset because [reason]".
- Sentence length cap ~25 words. Paragraph cap 4 sentences.

# OUTPUT FORMAT

\`\`\`json
{
  "findings": [
    {
      "rank": 1,
      "url": "/example",
      "title": "Short title (max 10 words)",
      "findingStatement": "Paragraph 1 prose...",
      "why": "Paragraph 2 prose...",
      "qualifier": "Paragraph 3 prose..."
    }
  ]
}
\`\`\`

Output ONLY the JSON object. No preamble. No markdown code fences in the actual output. If there are 0 leaks above threshold, return {"findings": []}.`,
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
