// src/lib/webopp/cache.ts
// DataForSEO keyword volume cache + usage tracking.
// Caches keyword volumes for 30 days to avoid redundant API calls.
// Logs every API call for cost monitoring.

import { prisma } from '@/lib/db/client';

// ── Cache: check if keyword volumes are already stored ─────────────────
export async function getCachedKeywordVolumes(
  keywords: string[],
  locationCode: number
): Promise<{ cached: Map<string, CachedVolume>; uncached: string[] }> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const cached = await prisma.keywordVolumeCache.findMany({
    where: {
      keyword: { in: keywords.map(k => k.toLowerCase()) },
      locationCode,
      fetchedAt: { gte: thirtyDaysAgo },
    },
  });

  const cachedMap = new Map<string, CachedVolume>();
  for (const c of cached) {
    cachedMap.set(c.keyword, {
      keyword: c.keyword,
      monthlySearchVolume: c.monthlySearchVolume,
      competition: c.competition,
      avgCpc: c.avgCpc,
      difficulty: c.difficulty,
    });
  }

  const uncached = keywords.filter(k => !cachedMap.has(k.toLowerCase()));
  return { cached: cachedMap, uncached };
}

// ── Cache: store keyword volumes ───────────────────────────────────────
export async function cacheKeywordVolumes(
  volumes: CachedVolume[],
  locationCode: number
): Promise<void> {
  for (const v of volumes) {
    await prisma.keywordVolumeCache.upsert({
      where: {
        keyword_locationCode: {
          keyword: v.keyword.toLowerCase(),
          locationCode,
        },
      },
      create: {
        keyword: v.keyword.toLowerCase(),
        locationCode,
        monthlySearchVolume: v.monthlySearchVolume,
        competition: v.competition,
        avgCpc: v.avgCpc,
        difficulty: v.difficulty,
        fetchedAt: new Date(),
      },
      update: {
        monthlySearchVolume: v.monthlySearchVolume,
        competition: v.competition,
        avgCpc: v.avgCpc,
        difficulty: v.difficulty,
        fetchedAt: new Date(),
      },
    });
  }
}

// ── Usage logging ──────────────────────────────────────────────────────
export async function logApiUsage(
  provider: string,
  endpoint: string,
  siteId: string | null,
  keywordsQueried: number,
  estimatedCost: number,
): Promise<void> {
  await prisma.apiUsageLog.create({
    data: { provider, endpoint, siteId, keywordsQueried, estimatedCost },
  });
}

// ── Daily rate check ───────────────────────────────────────────────────
export async function checkDailyRateLimit(provider: string, maxPerDay: number = 50): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const count = await prisma.apiUsageLog.count({
    where: { provider, calledAt: { gte: todayStart } },
  });

  return count < maxPerDay;
}

// ── Get usage stats ────────────────────────────────────────────────────
export async function getUsageStats(provider: string, days: number = 30): Promise<{
  totalCalls: number;
  totalKeywords: number;
  estimatedCost: number;
}> {
  const since = new Date(Date.now() - days * 86400000);
  const agg = await prisma.apiUsageLog.aggregate({
    where: { provider, calledAt: { gte: since } },
    _count: true,
    _sum: { keywordsQueried: true, estimatedCost: true },
  });

  return {
    totalCalls: agg._count,
    totalKeywords: agg._sum.keywordsQueried ?? 0,
    estimatedCost: agg._sum.estimatedCost ?? 0,
  };
}

interface CachedVolume {
  keyword: string;
  monthlySearchVolume: number;
  competition: number;
  avgCpc: number;
  difficulty: number;
}
