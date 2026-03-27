export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/**
 * POST /api/ai/webopp
 *
 * WO-07: WebOpp™ Report Generator
 *
 * Generates the WebOpp™ market intelligence report using Claude AI.
 * Takes the aggregated search demand + competitor data and produces:
 *  1. Market opportunity summary
 *  2. Top keyword gaps with revenue estimates
 *  3. Channel recommendations
 *  4. Budget model (stair-step plan)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { loadSiteContext, buildSystemPrompt } from '@/lib/ai/context';
import { aggregateSearchDemand, extractSeedKeywords } from '@/lib/webopp/search-demand';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { siteId } = await req.json();
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const ctx = await loadSiteContext(siteId, session.user.email);
  if (!ctx) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const onboarding = await prisma.siteOnboarding.findUnique({ where: { siteId } });
  const competitors = (onboarding?.competitorUrls ?? []).filter(Boolean);

  // ── Gather search demand data ─────────────────────────────────────────────
  let searchData = null;
  try {
    const seeds = extractSeedKeywords({
      domain: ctx.domain,
      businessDescription: ctx.businessDescription,
      competitorDomains: competitors,
    });

    searchData = await aggregateSearchDemand({
      seedKeywords: seeds,
      competitorDomains: competitors,
      ourDomain: ctx.domain,
    });
  } catch (err) {
    console.error('[WebOpp] Search demand aggregation failed:', err);
    // Continue with AI generation even without search data
  }

  // ── Build prompt ──────────────────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(ctx, 'webopp');

  const dataBlock = buildWebOppDataBlock(ctx, searchData, competitors);

  // ── Market Overview ───────────────────────────────────────────────────────
  const overviewPrompt = `${dataBlock}

Write a WebOpp™ market intelligence summary for ${ctx.siteName}.

Cover:
1. The total search demand opportunity in their category (use the data above)
2. The biggest keyword gaps vs their competitors
3. Which traffic channel has the highest ROI opportunity
4. The single biggest untapped opportunity they should pursue first

Format: 3 paragraphs. Direct and specific. Lead with the dollar opportunity.`;

  // ── Keyword clusters ──────────────────────────────────────────────────────
  const clustersPrompt = `${dataBlock}

Generate a prioritized list of keyword opportunity clusters for ${ctx.siteName}.

Respond ONLY in this JSON format:
{
  "clusters": [
    {
      "name": "Cluster name (3-5 words)",
      "primaryKeyword": "The main keyword for this cluster",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "monthlySearchVolume": 5000,
      "avgCpc": 4.50,
      "missedRevenuePerMonth": 8000,
      "currentPosition": null,
      "difficulty": 45,
      "intent": "commercial",
      "rationale": "1 sentence on why this cluster matters for this business"
    }
  ]
}

Generate 5-8 clusters. Rank by missed revenue opportunity. Use the actual keyword data provided. Respond ONLY with JSON.`;

  // ── Budget model ──────────────────────────────────────────────────────────
  const budgetPrompt = `${dataBlock}

Generate a channel budget recommendation for ${ctx.siteName}.

Respond ONLY in this JSON format:
{
  "channels": [
    {
      "channel": "google_ads",
      "currentMonthlySpend": 5000,
      "recommendedMonthlySpend": 8000,
      "expectedLeads": 45,
      "expectedRevenue": 22500,
      "roiTimeline": 2,
      "rationale": "Why this channel + spend level"
    }
  ],
  "totalMissedRevenuePerMonth": 45000,
  "topOpportunityCluster": "The highest-ROI keyword cluster name"
}

Channels to consider: google_ads, meta_ads, seo_organic, content_marketing, linkedin_ads (if B2B).
Base numbers on the business context and search data provided. Respond ONLY with JSON.`;

  // ── Call Claude ───────────────────────────────────────────────────────────
  let overview = '';
  let clusters: unknown[] = [];
  let budget: unknown = {};

  try {
    [overview] = await Promise.all([
      callClaude(systemPrompt, overviewPrompt, 600),
    ]);

    const [clustersRaw, budgetRaw] = await Promise.all([
      callClaude(systemPrompt, clustersPrompt, 1000),
      callClaude(systemPrompt, budgetPrompt, 600),
    ]);

    try { clusters = JSON.parse(cleanJson(clustersRaw)).clusters ?? []; } catch { /* keep empty */ }
    try { budget = JSON.parse(cleanJson(budgetRaw)); } catch { /* keep empty */ }
  } catch (err) {
    console.error('[WebOpp] Claude call failed:', err);
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }

  // ── Save to DB ────────────────────────────────────────────────────────────
  const budgetObj = budget as Record<string, unknown>;

  const analysis = await prisma.webOppAnalysis.create({
    data: {
      siteId,
      status: 'COMPLETE',
      completedAt: new Date(),
      totalMissedRevenuePerMonth: typeof budgetObj.totalMissedRevenuePerMonth === 'number' ? budgetObj.totalMissedRevenuePerMonth : null,
      topOpportunityCluster: typeof budgetObj.topOpportunityCluster === 'string' ? budgetObj.topOpportunityCluster : null,
      totalOpportunitiesFound: Array.isArray(clusters) ? clusters.length : 0,
    },
  });

  // Save keyword clusters
  if (Array.isArray(clusters) && clusters.length > 0) {
    await prisma.webOppKeywordCluster.createMany({
      data: (clusters as Record<string, unknown>[]).map(c => ({
        analysisId: analysis.id,
        siteId,
        clusterName: String(c.name ?? ''),
        primaryKeyword: String(c.primaryKeyword ?? ''),
        keywords: Array.isArray(c.keywords) ? c.keywords.map(String) : [],
        monthlySearchVolume: typeof c.monthlySearchVolume === 'number' ? c.monthlySearchVolume : null,
        avgCpc: typeof c.avgCpc === 'number' ? c.avgCpc : null,
        missedRevenue: typeof c.missedRevenuePerMonth === 'number' ? c.missedRevenuePerMonth : null,
        currentRankPosition: typeof c.currentPosition === 'number' ? c.currentPosition : null,
      })),
    });
  }

  return NextResponse.json({
    analysisId: analysis.id,
    overview,
    clusters,
    budget,
    searchData: searchData ? {
      totalAddressableVolume: searchData.totalAddressableSearchVolume,
      estimatedMonthlyClicks: searchData.estimatedMonthlyClicks,
      topKeyword: searchData.topOpportunity?.keyword,
    } : null,
  });
}

// ── GET — fetch latest analysis ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const analysis = await prisma.webOppAnalysis.findFirst({
    where: { siteId, status: 'COMPLETE' },
    orderBy: { completedAt: 'desc' },
    include: { keywordClusters: true, budgetModels: true },
  });

  return NextResponse.json({ analysis });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWebOppDataBlock(
  ctx: Awaited<ReturnType<typeof loadSiteContext>>,
  searchData: Awaited<ReturnType<typeof aggregateSearchDemand>> | null,
  competitors: string[],
): string {
  if (!ctx) return '';
  const lines = [
    '=== MARKET DATA ===',
    `Business: ${ctx.businessDescription ?? ctx.siteName}`,
    `Domain: ${ctx.domain}`,
    `Target audience: ${ctx.targetAudience ?? 'Unknown'}`,
  ];

  if (ctx.averageOrderValue) lines.push(`Average order value: $${ctx.averageOrderValue}`);
  if (ctx.conversionRate) lines.push(`Current conversion rate: ${(ctx.conversionRate * 100).toFixed(2)}%`);
  if (competitors.length) lines.push(`Competitors: ${competitors.join(', ')}`);

  if (searchData) {
    lines.push('');
    lines.push('--- Search Demand ---');
    lines.push(`Total addressable search volume: ${searchData.totalAddressableSearchVolume.toLocaleString()} searches/month`);
    lines.push(`Estimated potential monthly clicks: ${searchData.estimatedMonthlyClicks.toLocaleString()}`);

    if (searchData.topOpportunity) {
      lines.push(`Top opportunity keyword: "${searchData.topOpportunity.keyword}" (${searchData.topOpportunity.monthlySearchVolume.toLocaleString()}/mo, $${searchData.topOpportunity.avgCpc} CPC)`);
    }

    if (searchData.keywords.length > 0) {
      lines.push('');
      lines.push('Top keywords by opportunity:');
      searchData.keywords.slice(0, 10).forEach(k => {
        lines.push(`  - "${k.keyword}": ${k.monthlySearchVolume.toLocaleString()}/mo vol · $${k.avgCpc} CPC · ${k.difficulty} difficulty · ${k.intent}`);
      });
    }

    if (searchData.competitorKeywords.length > 0) {
      lines.push('');
      lines.push('Competitor keyword gaps (keywords competitors rank for that we likely don\'t):');
      searchData.competitorKeywords.slice(0, 10).forEach(k => {
        lines.push(`  - "${k.keyword}": ${k.competitorDomain} at position ${k.competitorPosition} · ${k.monthlySearchVolume.toLocaleString()}/mo`);
      });
    }
  }

  lines.push('=== END DATA ===');
  return lines.join('\n');
}

async function callClaude(system: string, user: string, maxTokens: number): Promise<string> {
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
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) throw new Error(`Claude error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

function cleanJson(text: string): string {
  return text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
}
