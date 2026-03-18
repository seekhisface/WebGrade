/**
 * lib/webopp/search-demand.ts
 *
 * WO-01: Search Demand Aggregator
 *
 * Fetches keyword search volumes, CPC, and competition data from DataForSEO.
 * Also crawls competitor ranking data to build keyword gap analysis.
 *
 * Supports multiple keyword research strategies:
 *  1. Seed keywords from business description (NLP extraction)
 *  2. Competitor domain keywords
 *  3. Related keywords / long-tail expansion
 */

export interface KeywordData {
  keyword: string;
  monthlySearchVolume: number;
  competition: number;         // 0–1
  avgCpc: number;              // USD
  trend: number[];             // 12 months of relative search volume
  difficulty: number;          // 0–100
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
}

export interface CompetitorKeyword {
  keyword: string;
  competitorDomain: string;
  competitorPosition: number;
  monthlySearchVolume: number;
  ourPosition: number | null;  // null if we don't rank
  gap: number;                 // positions we're behind
}

export interface SearchDemandResult {
  keywords: KeywordData[];
  competitorKeywords: CompetitorKeyword[];
  totalAddressableSearchVolume: number;
  estimatedMonthlyClicks: number;
  topOpportunity: KeywordData | null;
}

// ---------------------------------------------------------------------------
// DataForSEO API wrapper
// ---------------------------------------------------------------------------

const DATAFORSEO_BASE = 'https://api.dataforseo.com/v3';

async function dataForSEORequest(endpoint: string, body: unknown): Promise<unknown> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    throw new Error('DataForSEO credentials not configured');
  }

  const auth = Buffer.from(`${login}:${password}`).toString('base64');

  const res = await fetch(`${DATAFORSEO_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`DataForSEO error ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Keyword search volume lookup
// ---------------------------------------------------------------------------

export async function getKeywordVolumes(
  keywords: string[],
  locationCode = 2840, // United States
  languageCode = 'en',
): Promise<KeywordData[]> {
  if (keywords.length === 0) return [];

  // Batch into groups of 100 (DataForSEO limit)
  const batches = chunk(keywords, 100);
  const results: KeywordData[] = [];

  for (const batch of batches) {
    try {
      const data = await dataForSEORequest('/keywords_data/google_ads/search_volume/live', [
        {
          keywords: batch,
          location_code: locationCode,
          language_code: languageCode,
        },
      ]) as { tasks?: { result?: Array<{
        keyword: string;
        search_volume: number;
        competition: number;
        cpc: number;
        monthly_searches: Array<{ year: number; month: number; search_volume: number }>;
      }> }[] };

      const taskResult = data?.tasks?.[0]?.result ?? [];
      for (const item of taskResult) {
        if (!item) continue;

        const trend = (item.monthly_searches ?? [])
          .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
          .map(m => m.search_volume ?? 0);

        results.push({
          keyword: item.keyword,
          monthlySearchVolume: item.search_volume ?? 0,
          competition: item.competition ?? 0,
          avgCpc: item.cpc ?? 0,
          trend,
          difficulty: estimateDifficulty(item.competition ?? 0, item.search_volume ?? 0),
          intent: classifyIntent(item.keyword),
        });
      }
    } catch (err) {
      console.error('[SearchDemand] Volume lookup failed:', err);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Competitor keyword gap analysis
// ---------------------------------------------------------------------------

export async function getCompetitorKeywords(
  competitorDomains: string[],
  ourDomain: string,
  locationCode = 2840,
): Promise<CompetitorKeyword[]> {
  const gaps: CompetitorKeyword[] = [];

  for (const domain of competitorDomains.slice(0, 3)) {
    try {
      const data = await dataForSEORequest('/dataforseo_labs/google/domain_rank_overview/live', [
        {
          target: domain,
          location_code: locationCode,
          language_code: 'en',
          limit: 50,
          filters: [['ranked_serp_element.serp_item.rank_group', '<=', 20]],
          order_by: ['ranked_serp_element.serp_item.etv,desc'],
        },
      ]) as { tasks?: { result?: Array<{
        keyword: string;
        ranked_serp_element?: { serp_item?: { rank_group: number; etv: number } };
        keyword_data?: { keyword_info?: { search_volume: number } };
      }[]>; }[] };

      const items = data?.tasks?.[0]?.result ?? [];
      for (const item of items) {
        if (!item) continue;

        gaps.push({
          keyword: item.keyword,
          competitorDomain: domain,
          competitorPosition: item.ranked_serp_element?.serp_item?.rank_group ?? 99,
          monthlySearchVolume: item.keyword_data?.keyword_info?.search_volume ?? 0,
          ourPosition: null, // Would require checking our own rankings
          gap: item.ranked_serp_element?.serp_item?.rank_group ?? 99,
        });
      }
    } catch (err) {
      console.error(`[SearchDemand] Competitor keywords failed for ${domain}:`, err);
    }
  }

  return gaps;
}

// ---------------------------------------------------------------------------
// Main aggregator — called by the WebOpp analysis job
// ---------------------------------------------------------------------------

export async function aggregateSearchDemand(params: {
  seedKeywords: string[];
  competitorDomains: string[];
  ourDomain: string;
  locationCode?: number;
}): Promise<SearchDemandResult> {
  const [keywordData, competitorKeywords] = await Promise.all([
    getKeywordVolumes(params.seedKeywords, params.locationCode),
    getCompetitorKeywords(params.competitorDomains, params.ourDomain, params.locationCode),
  ]);

  // Sort by opportunity score (volume × (1 - difficulty) × cpc_signal)
  const scored = keywordData
    .filter(k => k.monthlySearchVolume > 50)
    .sort((a, b) => opportunityScore(b) - opportunityScore(a));

  const totalVolume = scored.reduce((sum, k) => sum + k.monthlySearchVolume, 0);
  // Estimate clicks at ~3% CTR for page 1 position 5
  const estimatedClicks = Math.round(totalVolume * 0.03);

  return {
    keywords: scored,
    competitorKeywords: competitorKeywords.sort((a, b) => b.monthlySearchVolume - a.monthlySearchVolume),
    totalAddressableSearchVolume: totalVolume,
    estimatedMonthlyClicks: estimatedClicks,
    topOpportunity: scored[0] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Seed keyword extractor — pulls keywords from business description
// ---------------------------------------------------------------------------

export function extractSeedKeywords(params: {
  domain: string;
  businessDescription: string | null;
  competitorDomains: string[];
}): string[] {
  const seeds: string[] = [];

  // Extract from domain
  const domainWords = params.domain
    .replace(/\.(com|io|co|net|org)$/, '')
    .split(/[-_.]/)
    .filter(w => w.length > 2);
  seeds.push(...domainWords);

  // Extract meaningful phrases from business description
  if (params.businessDescription) {
    // Simple extraction: nouns and noun phrases longer than 3 chars
    const words = params.businessDescription
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w));

    // Add individual words
    seeds.push(...words.slice(0, 10));

    // Add bigrams
    for (let i = 0; i < Math.min(words.length - 1, 5); i++) {
      seeds.push(`${words[i]} ${words[i + 1]}`);
    }
  }

  return [...new Set(seeds)].slice(0, 30);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function opportunityScore(k: KeywordData): number {
  const volumeScore = Math.min(k.monthlySearchVolume / 1000, 10);
  const difficultyPenalty = k.difficulty / 100;
  const cpcSignal = Math.min(k.avgCpc / 5, 2);
  return volumeScore * (1 - difficultyPenalty * 0.5) * (1 + cpcSignal);
}

function estimateDifficulty(competition: number, volume: number): number {
  // Rough estimate: high competition + high volume = high difficulty
  const competitionScore = competition * 60;
  const volumeScore = Math.min(volume / 10000, 1) * 30;
  return Math.round(Math.min(competitionScore + volumeScore + 10, 100));
}

function classifyIntent(keyword: string): KeywordData['intent'] {
  const k = keyword.toLowerCase();
  if (/buy|purchase|price|cost|cheap|deal|discount|order/.test(k)) return 'transactional';
  if (/best|top|review|vs|compare|alternative|software|tool|service/.test(k)) return 'commercial';
  if (/how|what|why|when|where|guide|tutorial|tips|learn/.test(k)) return 'informational';
  return 'navigational';
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

const STOP_WORDS = new Set(['this', 'that', 'with', 'from', 'they', 'will', 'have', 'been', 'were', 'their', 'about', 'which', 'when', 'also', 'into', 'more', 'some', 'than', 'then', 'them', 'these', 'those']);
