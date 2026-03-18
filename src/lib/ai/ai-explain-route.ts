/**
 * P1-09 + OB-05: AI Explanation API
 * POST /api/ai/explain
 *
 * Generates plain-English behavioral explanations using Claude.
 * Uses the central context builder (OB-05) so all insights are
 * specific to the customer's business — never generic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { loadSiteContext, buildSystemPrompt } from '@/lib/ai/context';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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

  // Load full site context (OB-05)
  const ctx = await loadSiteContext(siteId, session.user.email);
  if (!ctx) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const systemPrompt = buildSystemPrompt(ctx, 'explain');
  const userPrompt = buildUserPrompt(type, data);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const explanation = response.content[0].type === 'text' ? response.content[0].text : '';

  // If context is incomplete, append a note
  const note = !ctx.hasFullContext
    ? `\n\n_Note: Some business context is missing (${ctx.missingFields.join(', ')}). Complete your onboarding for more specific insights._`
    : '';

  return NextResponse.json({ explanation: explanation + note, contextScore: ctx.hasFullContext ? 100 : 60 });
}

// ---------------------------------------------------------------------------
// User prompt builders per explanation type
// ---------------------------------------------------------------------------

function buildUserPrompt(type: string, data: Record<string, unknown>): string {
  switch (type) {
    case 'drop_off_page':
      return `PAGE DROP-OFF DATA:
- URL: ${data.url}
- Exit rate: ${data.exitRate}%
- Average scroll depth: ${data.avgScrollDepth}%
- Sessions: ${data.sessions?.toLocaleString()}
- Avg time on page: ${data.avgTimeOnPageMs ? Math.round((data.avgTimeOnPageMs as number) / 1000) + 's' : 'unknown'}
- Rage clicks: ${data.rageClicks ?? 0}
- CTA clicks: ${data.ctaClicks ?? 0}
- Is storyline breakpoint: ${data.isStorylineBreakpoint}

Explain in 2-3 sentences: (1) what the behavioral data reveals about why visitors are leaving, (2) what specific fix would reduce the exit rate for this business.`;

    case 'intent_distribution':
      return `INTENT DISTRIBUTION (% of sessions this week):
- High intent: ${data.HIGH}%
- Medium intent: ${data.MEDIUM}%
- Low intent: ${data.LOW}%
- Researcher: ${data.RESEARCHER}%
- Competitor: ${data.COMPETITOR}%
- Bot/filtered: ${data.BOT}%
- Average intent score: ${data.avgScore}/100
- Change from last week: ${data.weekOverWeekChange ?? 'unknown'}

Explain in 2-3 sentences what this distribution tells us about traffic quality and what the most important thing to fix is.`;

    case 'ad_source':
      return `AD SOURCE PERFORMANCE:
- Source / medium: ${data.source} / ${data.medium}
- Campaign: ${data.campaign ?? 'not set'}
- Avg intent score: ${data.avgIntentScore}/100
- Conversion rate: ${data.conversionRate}%
- Monthly spend: $${data.platformSpend ?? 'unknown'}
- Waste flags: ${JSON.stringify(data.wasteFlags ?? {})}

Explain in 2-3 sentences what this source's behavioral data reveals and what specific action to take.`;

    case 'recommendation':
      return `RECOMMENDATION TO EXPLAIN:
- Finding: ${data.finding}
- Proposed fix: ${data.fixAction}
- Expected result: ${data.expectedResult ?? 'not specified'}
- Source module: ${data.sourceModule}
- Priority score: ${data.priorityScore}/1000

Write 1-2 sentences explaining why this recommendation matters specifically for this business and what the dollar impact could be.`;

    case 'executive_summary':
      return `SITE PERFORMANCE SUMMARY (last 30 days):
${JSON.stringify(data, null, 2)}

Write a 3-4 sentence executive summary of the site's current state, the most critical issue, and the single highest-ROI action to take this week.`;

    default:
      return `Analyze this data and provide a 2-3 sentence insight:\n${JSON.stringify(data, null, 2)}`;
  }
}
