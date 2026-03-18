/**
 * OB-05: Context Injection
 *
 * Builds the business context string injected into every Claude API call.
 * Loaded once per request from the site's onboarding data.
 *
 * Used by:
 *   - /api/ai/explain       (drop-off, intent, ad source explanations)
 *   - /api/ai/report        (behavioral report generator — P1-12)
 *   - /api/ai/webopp        (WebOpp report generator — WO-07)
 *   - /api/ai/recommendations (prioritized recommendations)
 */

import { prisma } from '@/lib/db/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SiteContext {
  // Site identity
  siteId: string;
  siteName: string;
  domain: string;
  url: string;

  // Business context (from onboarding)
  businessDescription: string | null;
  targetAudience: string | null;
  primaryValueProp: string | null;
  conversionGoalName: string | null;
  conversionGoalUrl: string | null;

  // Revenue context
  monthlyAdSpend: number | null;
  averageOrderValue: number | null;
  conversionRate: number | null;
  leadToWinRate: number | null;

  // Data availability
  dataScenario: 'A' | 'B' | 'C' | null;
  hasGA4: boolean;
  hasGSC: boolean;
  hasSnippet: boolean;

  // Computed
  hasFullContext: boolean;
  missingFields: string[];
}

// ---------------------------------------------------------------------------
// Load context from DB
// ---------------------------------------------------------------------------

export async function loadSiteContext(
  siteId: string,
  userEmail: string
): Promise<SiteContext | null> {
  // Primary: org-member lookup
  let site = await prisma.site.findFirst({
    where: {
      id: siteId,
      org: { members: { some: { user: { email: userEmail } } } },
    },
    include: { onboarding: true },
  });

  // Fallback: user's org owns the site (covers seed/demo data email mismatches)
  if (!site) {
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { orgMemberships: { select: { orgId: true } } },
    });
    if (user?.orgMemberships?.length) {
      const orgIds = user.orgMemberships.map((m: { orgId: string }) => m.orgId);
      site = await prisma.site.findFirst({
        where: { id: siteId, orgId: { in: orgIds } },
        include: { onboarding: true },
      });
    }
  }

  // Last resort: authenticated user, site exists (single-tenant/demo mode)
  if (!site) {
    site = await prisma.site.findFirst({
      where: { id: siteId },
      include: { onboarding: true },
    });
  }

  if (!site) return null;

  const ob = site.onboarding;
  const missingFields: string[] = [];

  if (!ob?.businessDescription) missingFields.push('business description');
  if (!ob?.targetAudience) missingFields.push('target audience');
  if (!ob?.conversionGoalName) missingFields.push('conversion goal');
  if (!ob?.averageOrderValue) missingFields.push('average order value');

  return {
    siteId: site.id,
    siteName: site.name,
    domain: site.domain,
    url: site.url,

    businessDescription: ob?.businessDescription ?? null,
    targetAudience: ob?.targetAudience ?? null,
    primaryValueProp: ob?.primaryValueProp ?? null,
    conversionGoalName: ob?.conversionGoalName ?? null,
    conversionGoalUrl: ob?.conversionGoalUrl ?? null,

    monthlyAdSpend: ob?.monthlyAdSpend ?? null,
    averageOrderValue: ob?.averageOrderValue ?? null,
    conversionRate: ob?.conversionRate ?? null,
    leadToWinRate: ob?.leadToWinRate ?? null,

    dataScenario: (ob?.dataScenario as 'A' | 'B' | 'C' | null) ?? null,
    hasGA4: ob?.ga4Connected ?? false,
    hasGSC: ob?.gscConnected ?? false,
    hasSnippet: site.snippetInstalled ?? false,

    hasFullContext: missingFields.length === 0,
    missingFields,
  };
}

// ---------------------------------------------------------------------------
// Build context string — injected into Claude system prompt
// ---------------------------------------------------------------------------

export function buildContextString(ctx: SiteContext): string {
  const lines: string[] = [
    `=== BUSINESS CONTEXT ===`,
    `Site: ${ctx.siteName} (${ctx.domain})`,
  ];

  if (ctx.businessDescription) {
    lines.push(`Business: ${ctx.businessDescription}`);
  }
  if (ctx.targetAudience) {
    lines.push(`Target visitor: ${ctx.targetAudience}`);
  }
  if (ctx.primaryValueProp) {
    lines.push(`Value proposition: ${ctx.primaryValueProp}`);
  }
  if (ctx.conversionGoalName) {
    lines.push(`Primary conversion goal: ${ctx.conversionGoalName}${ctx.conversionGoalUrl ? ` (${ctx.conversionGoalUrl})` : ''}`);
  }

  // Revenue context
  const revenueLines: string[] = [];
  if (ctx.monthlyAdSpend) revenueLines.push(`$${ctx.monthlyAdSpend.toLocaleString()}/mo ad spend`);
  if (ctx.averageOrderValue) revenueLines.push(`$${ctx.averageOrderValue} avg order value`);
  if (ctx.conversionRate) revenueLines.push(`${(ctx.conversionRate * 100).toFixed(1)}% conversion rate`);
  if (ctx.leadToWinRate) revenueLines.push(`${(ctx.leadToWinRate * 100).toFixed(0)}% lead-to-win rate`);
  if (revenueLines.length > 0) {
    lines.push(`Revenue context: ${revenueLines.join(' · ')}`);
  }

  // Data availability
  lines.push(`Data scenario: ${ctx.dataScenario ?? 'unknown'} — ${describeScenario(ctx)}`);

  if (ctx.missingFields.length > 0) {
    lines.push(`Note: Missing context for — ${ctx.missingFields.join(', ')}. Be appropriately general on these dimensions.`);
  }

  lines.push(`=== END CONTEXT ===`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Build the Claude system prompt — used by all AI routes
// ---------------------------------------------------------------------------

export function buildSystemPrompt(ctx: SiteContext, mode: 'explain' | 'report' | 'recommend' | 'webopp' = 'explain'): string {
  const contextString = buildContextString(ctx);

  const baseRules = `You are WebGrade's AI analyst. You analyze website behavioral data and provide clear, specific, actionable insights for founders and operators.

${contextString}

Rules:
- Be specific — reference the actual business context above
- Lead with the finding, not a preamble  
- End with a concrete recommendation
- Use dollar amounts or percentages when you can estimate them
- Never say "it seems like" or "it appears" — be direct
- Never mention "AI", "analysis", or "I noticed" — just state the insight
- Never give generic advice that could apply to any website`;

  const modeExtras: Record<string, string> = {
    explain: `- Keep explanations to 2-4 sentences
- One finding, one recommendation per response`,

    report: `- Structure insights as a narrative, not a list
- Connect findings to each other — show cause and effect
- Quantify impact wherever possible
- Prioritize by revenue impact`,

    recommend: `- Every recommendation must include: the problem, the fix, and the estimated impact
- Rank by ROI, not effort
- Be specific about what to change (e.g. "Move the CTA above the fold" not "Improve your CTA")`,

    webopp: `- Focus on market opportunity and revenue potential
- Compare to industry benchmarks where relevant
- Identify the highest-ROI keyword and content gaps
- Frame everything in terms of traffic and revenue, not just rankings`,
  };

  return `${baseRules}\n${modeExtras[mode] ?? ''}`;
}

// ---------------------------------------------------------------------------
// Dollar impact estimator — used in recommendations
// ---------------------------------------------------------------------------

export function estimateDollarImpact(
  ctx: SiteContext,
  params: {
    monthlySessionsAffected: number;
    conversionLiftPct: number; // e.g. 0.15 for 15%
  }
): { low: number; high: number; formatted: string } | null {
  if (!ctx.averageOrderValue || !ctx.conversionRate) return null;

  const baseConversions = params.monthlySessionsAffected * ctx.conversionRate;
  const newConversions = baseConversions * (1 + params.conversionLiftPct);
  const additionalConversions = newConversions - baseConversions;

  const revenuePerConversion = ctx.averageOrderValue * (ctx.leadToWinRate ?? 1);
  const low = Math.round(additionalConversions * revenuePerConversion * 0.7);
  const high = Math.round(additionalConversions * revenuePerConversion * 1.3);

  return {
    low,
    high,
    formatted: `$${low.toLocaleString()}–$${high.toLocaleString()}/mo`,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function describeScenario(ctx: SiteContext): string {
  if (ctx.dataScenario === 'A') return 'GA4 + GSC + behavioral snippet all connected';
  if (ctx.dataScenario === 'B') return 'historical data available, behavioral tracking in progress';
  if (ctx.dataScenario === 'C') return 'clean start — building baseline from snippet data';
  return 'data availability unknown';
}
