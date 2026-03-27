export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const preferredRegion = 'auto'
/**
 * P1-09: AI Explanation API
 * POST /api/ai/explain
 *
 * Generates plain-English behavioral explanations using Claude.
 * Consumes onboarding context so insights are specific, not generic.
 *
 * Called by the behavioral dashboard to explain drop-off pages,
 * intent patterns, and recommendations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';



const ExplainRequestSchema = z.object({
  siteId: z.string(),
  type: z.enum([
    'drop_off_page',
    'intent_distribution',
    'ad_source',
    'seo_issue',
    'executive_summary',
    'recommendation',
  ]),
  data: z.record(z.unknown()),
});

export async function POST(req: NextRequest) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = ExplainRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { siteId, type, data } = parsed.data;

  // Load onboarding context — this is the key that makes insights specific
  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      org: { members: { some: { user: { email: session.user.email } } } }
    },
    include: { onboarding: true }
  });

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const onboarding = site.onboarding;

  // Build context string injected into every prompt (OB-05)
  const businessContext = buildBusinessContext(site, onboarding);

  // Build prompt based on explanation type
  const prompt = buildPrompt(type, data, businessContext);

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
    system: `You are WebGrade's AI analyst. You analyze website behavioral data and provide clear, specific, actionable insights for founders and marketing teams.

Rules:
- Be specific — reference the actual business context provided
- Be concise — 2-4 sentences maximum
- Lead with the finding, not a preamble
- End with a concrete, specific recommendation
- Use dollar amounts or percentages when you can estimate them
- Never say "it seems like" or "it appears" — be direct
- Never mention "AI" or "analysis" — just state the insight`,
  });

  const explanation = response.content[0].type === 'text' ? response.content[0].text : '';

  return NextResponse.json({ explanation });
}

// ---------------------------------------------------------------------------
// Context builder (OB-05: injected into all Claude prompts)
// ---------------------------------------------------------------------------

function buildBusinessContext(
  site: { name: string; domain: string },
  onboarding: {
    businessDescription?: string | null;
    targetAudience?: string | null;
    primaryValueProp?: string | null;
    conversionGoalName?: string | null;
    conversionGoalUrl?: string | null;
    monthlyAdSpend?: number | null;
    averageOrderValue?: number | null;
    conversionRate?: number | null;
    leadToWinRate?: number | null;
  } | null
): string {
  if (!onboarding) {
    return `Site: ${site.name} (${site.domain}). No additional business context available.`;
  }

  const parts = [
    `Site: ${site.name} (${site.domain})`,
    onboarding.businessDescription && `Business: ${onboarding.businessDescription}`,
    onboarding.targetAudience && `Target visitor: ${onboarding.targetAudience}`,
    onboarding.primaryValueProp && `Value proposition: ${onboarding.primaryValueProp}`,
    onboarding.conversionGoalName && `Conversion goal: ${onboarding.conversionGoalName} (${onboarding.conversionGoalUrl})`,
    onboarding.monthlyAdSpend && `Monthly ad spend: $${onboarding.monthlyAdSpend.toLocaleString()}`,
    onboarding.averageOrderValue && `Average order value: $${onboarding.averageOrderValue}`,
    onboarding.conversionRate && `Current conversion rate: ${(onboarding.conversionRate * 100).toFixed(1)}%`,
    onboarding.leadToWinRate && `Lead-to-win rate: ${(onboarding.leadToWinRate * 100).toFixed(0)}%`,
  ].filter(Boolean);

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Prompt builders per explanation type
// ---------------------------------------------------------------------------

function buildPrompt(
  type: string,
  data: Record<string, unknown>,
  businessContext: string
): string {
  const ctx = `BUSINESS CONTEXT:\n${businessContext}`;

  switch (type) {
    case 'drop_off_page':
      return `${ctx}

PAGE DATA:
- URL: ${data.url}
- Exit rate: ${data.exitRate}%
- Average scroll depth: ${data.avgScrollDepth}%
- Sessions: ${data.sessions}
- Time on page (avg): ${data.avgTimeOnPageMs ? Math.round((data.avgTimeOnPageMs as number) / 1000) + 's' : 'unknown'}
- Rage clicks detected: ${data.rageClicks ?? 0}
- CTA clicks: ${data.ctaClicks ?? 0}
- Is storyline breakpoint: ${data.isStorylineBreakpoint}

Explain in 2-3 sentences: (1) what the behavioral data reveals about why visitors are leaving this page, (2) what specific fix would reduce the exit rate. Reference the business context.`;

    case 'intent_distribution':
      return `${ctx}

INTENT DISTRIBUTION (% of sessions):
- High intent: ${data.HIGH}%
- Medium intent: ${data.MEDIUM}%
- Low intent: ${data.LOW}%
- Researcher: ${data.RESEARCHER}%
- Competitor: ${data.COMPETITOR}%
- Bot/filtered: ${data.BOT}%
- Average intent score: ${data.avgScore}/100

Explain in 2-3 sentences what this distribution tells us about the quality of traffic coming to this site, and what the most important thing to fix is.`;

    case 'ad_source':
      return `${ctx}

AD SOURCE DATA:
- Source: ${data.source} / ${data.medium}
- Campaign: ${data.campaign ?? 'not set'}
- Quality score: ${data.qualityScore}/100
- Avg intent score: ${data.avgIntentScore}/100
- Conversion rate: ${data.conversionRate}%
- Estimated monthly spend: $${data.platformSpend ?? 'unknown'}
- Wasted spend flags: ${JSON.stringify(data.wasteFlags ?? {})}

Explain in 2-3 sentences: what does this source's behavioral data reveal, and what specific action should be taken (pause, scale, fix landing page, etc.)?`;

    case 'recommendation':
      return `${ctx}

RECOMMENDATION:
- Finding: ${data.finding}
- Proposed fix: ${data.fixAction}
- Expected result: ${data.expectedResult ?? 'not specified'}
- Source: ${data.sourceModule}
- Priority score: ${data.priorityScore}/1000

Write a 1-2 sentence explanation of why this recommendation matters specifically for this business, and what the dollar impact could be.`;

    default:
      return `${ctx}\n\nData: ${JSON.stringify(data)}\n\nProvide a 2-3 sentence insight about this data.`;
  }
}
