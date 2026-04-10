/**
 * lib/webwatch/monthly-intelligence.ts
 *
 * MONTHLY PERFORMANCE INTELLIGENCE ENGINE
 * =========================================
 *
 * This is the core brain of WebWatch. It runs once per month per site and:
 *
 * 1. GATHERS all current metrics (sessions, intent, conversions, page metrics)
 * 2. COMPARES to the right baseline (baseline vs. MoM vs. YoY by customer age)
 * 3. VERIFIES each open recommendation against current data
 * 4. FLAGS contradictions (customer said done, data disagrees)
 * 5. IDENTIFIES the 3–5 biggest opportunities this month
 * 6. GENERATES an executive narrative via Claude
 * 7. STORES a MonthlyPerformanceReport snapshot
 *
 * COMPARISON MODE LOGIC:
 *   Customer age < 12 months  → VS_BASELINE (compare to first 30 days)
 *   Customer age >= 12 months → VS_PRIOR_YEAR (YoY, with baseline as anchor)
 *   Always available as secondary: VS_PRIOR_MONTH
 *
 * DATA RETENTION:
 *   MonthlyPerformanceReport rows are kept forever (small, text-only)
 *   Raw VisitorSession rows are pruned at 13 months (rolling)
 *   Recommendation metricHistory JSON is capped at 24 entries (2 years)
 */

import { prisma } from '@/lib/db/client';
import { buildSystemPrompt, buildContextString } from '@/lib/ai/context';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonthlyMetrics {
  sessions: number;
  avgIntentScore: number;
  highIntentPct: number;
  conversionRate: number;
  bounceRate: number;
  revenueAtRisk: number;
  topExitPages: Array<{ url: string; exitRate: number; sessions: number }>;
}

interface RecommendationVerdict {
  recId: string;
  title: string;
  fixType: string;
  implementationStatus: string;
  customerNote: string | null;
  baselineValue: number | null;
  currentValue: number | null;
  changePct: number | null;
  verificationStatus: string;
  verificationNote: string;
  contradictionFlag: boolean;
  contradictionNote: string | null;
  estimatedImpact: number | null;
  recoveredValue: number | null;
  daysSinceFlagged: number;
  isRepeatFinding: boolean;
}

interface MonthlyIntelligenceResult {
  comparisonMode: 'VS_BASELINE' | 'VS_PRIOR_YEAR' | 'VS_PRIOR_MONTH';
  baselineLabel: string;
  currentMetrics: MonthlyMetrics;
  baselineMetrics: MonthlyMetrics | null;
  priorMonthMetrics: MonthlyMetrics | null;
  verdicts: RecommendationVerdict[];
  topOpportunities: TopOpportunity[];
  executiveNarrative: string;
  praisePoints: PraisePoint[];
  concernPoints: ConcernPoint[];
  contradictions: ContradictionPoint[];
  performanceGrade: string;
  revenueRecoveredTotal: number;
}

interface TopOpportunity {
  rank: number;
  title: string;
  finding: string;
  metricNow: string;
  metricBaseline: string | null;
  dollarImpact: number;
  isRepeatFromLastMonth: boolean;
  monthsOpen: number;
  recommendationId: string | null;
}

interface PraisePoint {
  title: string;
  detail: string;
  dollarImpact: number | null;
  metricBefore: string;
  metricNow: string;
}

interface ConcernPoint {
  title: string;
  detail: string;
  daysSinceFlag: number;
  estimatedCost: number | null; // cumulative cost of not fixing
  isGettingWorse: boolean;
}

interface ContradictionPoint {
  recId: string;
  title: string;
  customerClaim: string;
  aiFindings: string;
  baselineValue: string;
  currentValue: string;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runMonthlyIntelligence(
  siteId: string,
  year: number,
  month: number,
): Promise<MonthlyIntelligenceResult> {

  // 1. Load site context
  const site = await prisma.site.findFirst({
    where: { id: siteId },
    include: { onboarding: true },
  });
  if (!site) throw new Error(`Site ${siteId} not found`);

  // 2. Determine comparison mode based on customer age
  const firstReport = await prisma.monthlyPerformanceReport.findFirst({
    where: { siteId },
    orderBy: { year: 'asc', month: 'asc' },
    take: 1,
  });

  const customerAgeMonths = firstReport
    ? (year - firstReport.year) * 12 + (month - firstReport.month)
    : 0;

  const comparisonMode: 'VS_BASELINE' | 'VS_PRIOR_YEAR' =
    customerAgeMonths >= 12 ? 'VS_PRIOR_YEAR' : 'VS_BASELINE';

  // 3. Get current period metrics
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59);
  const currentMetrics = await getMetricsForPeriod(siteId, periodStart, periodEnd, site.onboarding);

  // 4. Get comparison baseline metrics
  let baselineMetrics: MonthlyMetrics | null = null;
  let baselineLabel = 'baseline';

  if (comparisonMode === 'VS_BASELINE') {
    const baselineConfig = await prisma.siteBaseline.findFirst({
      where: { siteId, metricKey: 'baseline_config' },
    });
    baselineLabel = baselineConfig?.period ?? 'Initial baseline';
    baselineMetrics = await getBaselineMetrics(siteId);
  } else {
    // YoY: same month last year
    const priorYear = year - 1;
    const priorStart = new Date(priorYear, month - 1, 1);
    const priorEnd = new Date(priorYear, month, 0, 23, 59, 59);
    const priorMonthName = periodStart.toLocaleDateString('en-US', { month: 'long' });
    baselineLabel = `${priorMonthName} ${priorYear} (YoY)`;
    baselineMetrics = await getMetricsForPeriod(siteId, priorStart, priorEnd, site.onboarding);
  }

  // 5. Get prior month metrics (always, as secondary comparison)
  const priorMonthDate = new Date(year, month - 2, 1);
  const priorMonthEnd = new Date(year, month - 1, 0, 23, 59, 59);
  const priorMonthMetrics = await getMetricsForPeriod(siteId, priorMonthDate, priorMonthEnd, site.onboarding);

  // 6. Verify all active recommendations
  const recommendations = await prisma.recommendation.findMany({
    where: {
      siteId,
      implementationStatus: { notIn: ['ABANDONED'] },
    },
    orderBy: { priorityScore: 'desc' },
  });

  const verdicts = await Promise.all(
    recommendations.map(rec => verifyRecommendation(rec, currentMetrics, siteId))
  );

  // Update recommendations in DB with new verification data
  await Promise.all(verdicts.map(v => updateRecommendationVerification(v)));

  // 7. Identify top opportunities this month
  const topOpportunities = await identifyTopOpportunities(
    siteId, currentMetrics, baselineMetrics, verdicts, month, year
  );

  // 8. Build praise, concerns, contradictions
  const praisePoints = buildPraisePoints(verdicts);
  const concernPoints = buildConcernPoints(verdicts, currentMetrics, baselineMetrics);
  const contradictions = buildContradictions(verdicts);

  // 9. Calculate performance grade
  const performanceGrade = calculateGrade(verdicts, currentMetrics, baselineMetrics);

  // 10. Calculate total revenue recovered since baseline
  const revenueRecoveredTotal = verdicts
    .filter(v => v.verificationStatus === 'IMPROVED' || v.verificationStatus === 'PARTIAL')
    .reduce((sum, v) => sum + (v.recoveredValue ?? 0), 0);

  // 11. Generate executive narrative via Claude
  const executiveNarrative = await generateExecutiveNarrative({
    site,
    comparisonMode,
    baselineLabel,
    currentMetrics,
    baselineMetrics,
    priorMonthMetrics,
    verdicts,
    topOpportunities,
    praisePoints,
    concernPoints,
    contradictions,
    performanceGrade,
    revenueRecoveredTotal,
    customerAgeMonths,
    month,
    year,
  });

  // 12. Store the monthly report
  const monthLabel = periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  await prisma.monthlyPerformanceReport.upsert({
    where: { siteId_year_month: { siteId, year, month } },
    create: {
      siteId,
      year,
      month,
      label: monthLabel,
      comparisonMode,
      baselineLabel,
      executiveNarrative,
      praisePoints: praisePoints as never,
      concernPoints: concernPoints as never,
      topOpportunities: topOpportunities as never,
      contradictions: contradictions as never,
      sessionsThisMonth: currentMetrics.sessions,
      sessionsBaseline: baselineMetrics?.sessions ?? null,
      intentScoreNow: currentMetrics.avgIntentScore,
      intentScoreBaseline: baselineMetrics?.avgIntentScore ?? null,
      conversionRateNow: currentMetrics.conversionRate,
      conversionRateBaseline: baselineMetrics?.conversionRate ?? null,
      revenueAtRiskNow: currentMetrics.revenueAtRisk,
      revenueRecoveredTotal,
      totalRecs: recommendations.length,
      verifiedFixed: verdicts.filter(v => v.verificationStatus === 'IMPROVED').length,
      inProgress: verdicts.filter(v => v.implementationStatus === 'IN_PROGRESS').length,
      stalled: verdicts.filter(v => v.implementationStatus === 'STALLED').length,
      contradictions2: contradictions.length,
      openUnacted: verdicts.filter(v => v.implementationStatus === 'OPEN').length,
      performanceGrade,
    },
    update: {
      executiveNarrative,
      praisePoints: praisePoints as never,
      concernPoints: concernPoints as never,
      topOpportunities: topOpportunities as never,
      contradictions: contradictions as never,
      sessionsThisMonth: currentMetrics.sessions,
      intentScoreNow: currentMetrics.avgIntentScore,
      conversionRateNow: currentMetrics.conversionRate,
      revenueAtRiskNow: currentMetrics.revenueAtRisk,
      revenueRecoveredTotal,
      performanceGrade,
      updatedAt: new Date(),
    },
  });

  return {
    comparisonMode,
    baselineLabel,
    currentMetrics,
    baselineMetrics,
    priorMonthMetrics,
    verdicts,
    topOpportunities,
    executiveNarrative,
    praisePoints,
    concernPoints,
    contradictions,
    performanceGrade,
    revenueRecoveredTotal,
  };
}

// ── Metric collection ─────────────────────────────────────────────────────────

async function getMetricsForPeriod(
  siteId: string,
  start: Date,
  end: Date,
  onboarding: { averageOrderValue?: number | null; conversionRate?: number | null } | null,
): Promise<MonthlyMetrics> {
  const sessions = await prisma.visitorSession.findMany({
    where: { siteId, startedAt: { gte: start, lte: end }, isBotFiltered: false },
    select: { intentScore: true, convertedAt: true, durationMs: true, entryPage: true, exitPage: true },
  });

  if (sessions.length === 0) {
    return { sessions: 0, avgIntentScore: 0, highIntentPct: 0, conversionRate: 0, bounceRate: 0, revenueAtRisk: 0, topExitPages: [] };
  }

  const total = sessions.length;
  const avgIntent = Math.round(sessions.reduce((s, r) => s + (r.intentScore ?? 0), 0) / total);
  const highIntent = sessions.filter(r => (r.intentScore ?? 0) >= 70).length;
  const conversions = sessions.filter(r => r.convertedAt !== null).length;
  const singlePage = sessions.filter(r => r.entryPage === r.exitPage).length;

  // Exit page analysis
  const exitCounts: Record<string, number> = {};
  const sessionCounts: Record<string, number> = {};
  for (const s of sessions) {
    if (s.exitPage) {
      exitCounts[s.exitPage] = (exitCounts[s.exitPage] ?? 0) + 1;
    }
    if (s.entryPage) {
      sessionCounts[s.entryPage] = (sessionCounts[s.entryPage] ?? 0) + 1;
    }
  }

  const topExitPages = Object.entries(exitCounts)
    .map(([url, exits]) => {
      const sess = sessionCounts[url] ?? exits;
      const rate = sess > 0 ? Math.min((exits / sess) * 100, 100) : 0;
      return { url, exitRate: Math.round(rate * 10) / 10, sessions: sess };
    })
    .filter(p => p.sessions >= 10) // Only pages with meaningful traffic
    .sort((a, b) => b.exitRate - a.exitRate)
    .slice(0, 5);

  // Revenue at risk estimate
  const aov = onboarding?.averageOrderValue ?? 0;
  const baseConvRate = onboarding?.conversionRate ?? (conversions / total);
  const highIntentNotConverting = sessions.filter(r => (r.intentScore ?? 0) >= 70 && r.convertedAt === null).length;
  const revenueAtRisk = Math.round(highIntentNotConverting * baseConvRate * aov * 0.15); // 15% recovery assumption

  return {
    sessions: total,
    avgIntentScore: avgIntent,
    highIntentPct: Math.round((highIntent / total) * 100),
    conversionRate: (conversions / total) * 100,
    bounceRate: Math.round((singlePage / total) * 100),
    revenueAtRisk,
    topExitPages,
  };
}

async function getBaselineMetrics(siteId: string): Promise<MonthlyMetrics | null> {
  const rows = await prisma.siteBaseline.findMany({
    where: { siteId, source: 'baseline_establishment' },
  });
  if (rows.length === 0) return null;

  const get = (key: string) => rows.find(r => r.metricKey === key)?.value ?? 0;
  return {
    sessions: get('baseline_sessions'),
    avgIntentScore: get('baseline_intent_score'),
    highIntentPct: get('baseline_high_intent_pct'),
    conversionRate: get('baseline_conversion_rate'),
    bounceRate: get('baseline_bounce_rate'),
    revenueAtRisk: 0,
    topExitPages: [],
  };
}

// ── Recommendation verification ───────────────────────────────────────────────

async function verifyRecommendation(
  rec: {
    id: string; title: string; fixType: string; implementationStatus: string;
    customerNote: string | null; baselineMetricKey: string | null;
    baselineMetricValue: number | null; baselineMetricLabel: string | null;
    targetMetricValue: number | null; estimatedMonthlyImpact: number | null;
    createdAt: Date; reportId: string | null;
  },
  currentMetrics: MonthlyMetrics,
  siteId: string,
): Promise<RecommendationVerdict> {
  const daysSinceFlagged = Math.floor(
    (Date.now() - rec.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Get current value for this metric
  let currentValue: number | null = null;
  let verificationStatus: string = 'UNVERIFIED';
  let verificationNote = '';
  let contradictionFlag = false;
  let contradictionNote: string | null = null;
  let recoveredValue: number | null = null;

  if (rec.baselineMetricKey) {
    currentValue = getCurrentMetricValue(rec.baselineMetricKey, currentMetrics);

    if (currentValue !== null && rec.baselineMetricValue !== null) {
      const baseVal = rec.baselineMetricValue;
      const targVal = rec.targetMetricValue;
      const isLowerBetter = ['exit_rate', 'bounce_rate', 'lcp_ms', 'wasted_spend'].includes(rec.baselineMetricKey);

      const improved = isLowerBetter ? currentValue < baseVal : currentValue > baseVal;
      const changePct = ((currentValue - baseVal) / Math.abs(baseVal)) * 100;
      const atTarget = targVal !== null ? (isLowerBetter ? currentValue <= targVal : currentValue >= targVal) : false;

      if (atTarget || Math.abs(changePct) >= 20) {
        verificationStatus = 'IMPROVED';
        const direction = isLowerBetter ? 'down' : 'up';
        verificationNote = `Metric moved ${direction} ${Math.abs(changePct).toFixed(1)}% from baseline${atTarget ? ' — at target ✓' : ''}`;
        // Estimate recovered value
        if (rec.estimatedMonthlyImpact) {
          recoveredValue = Math.round(rec.estimatedMonthlyImpact * Math.min(Math.abs(changePct) / 100, 1));
        }
      } else if (improved && Math.abs(changePct) >= 5) {
        verificationStatus = 'PARTIAL';
        verificationNote = `Showing improvement (${Math.abs(changePct).toFixed(1)}% from baseline) but not yet at target`;
        recoveredValue = rec.estimatedMonthlyImpact
          ? Math.round(rec.estimatedMonthlyImpact * (Math.abs(changePct) / 100) * 0.5)
          : null;
      } else if (!improved && Math.abs(changePct) >= 5) {
        verificationStatus = 'REGRESSED';
        verificationNote = `Metric has worsened ${Math.abs(changePct).toFixed(1)}% since baseline — needs immediate attention`;
      } else {
        verificationStatus = 'NO_CHANGE';
        verificationNote = 'No meaningful change detected since this was flagged';
      }

      // Contradiction detection: customer said done but metric hasn't moved
      if (
        (rec.implementationStatus === 'IMPLEMENTED' || rec.implementationStatus === 'VERIFIED') &&
        (verificationStatus === 'NO_CHANGE' || verificationStatus === 'REGRESSED')
      ) {
        contradictionFlag = true;
        contradictionNote = `You marked this as ${rec.implementationStatus === 'IMPLEMENTED' ? 'implemented' : 'verified'}, but we're still seeing the original issue. ${rec.baselineMetricLabel ? `The metric is still at ${formatMetricValue(currentValue, rec.baselineMetricKey)} vs. the ${rec.baselineMetricLabel} baseline.` : ''} Worth a second look — the fix may not have deployed, or the root cause may be different than expected.`;
      }
    }
  }

  // Check for repeat finding (same title flagged in prior reports)
  const priorSimilar = await prisma.recommendation.count({
    where: {
      siteId,
      title: { contains: rec.title.split(' ').slice(0, 3).join(' ') },
      createdAt: { lt: rec.createdAt },
    },
  });
  const isRepeatFinding = priorSimilar > 0;

  // Auto-update implementation status
  let implementationStatus = rec.implementationStatus;
  if (implementationStatus === 'IN_PROGRESS' && daysSinceFlagged > 30) {
    implementationStatus = 'STALLED';
  }
  if (implementationStatus === 'OPEN' && daysSinceFlagged > 60) {
    implementationStatus = 'ABANDONED';
  }

  return {
    recId: rec.id,
    title: rec.title,
    fixType: rec.fixType,
    implementationStatus,
    customerNote: rec.customerNote,
    baselineValue: rec.baselineMetricValue,
    currentValue,
    changePct: rec.baselineMetricValue && currentValue !== null
      ? ((currentValue - rec.baselineMetricValue) / Math.abs(rec.baselineMetricValue)) * 100
      : null,
    verificationStatus,
    verificationNote,
    contradictionFlag,
    contradictionNote,
    estimatedImpact: rec.estimatedMonthlyImpact,
    recoveredValue,
    daysSinceFlagged,
    isRepeatFinding,
  };
}

function getCurrentMetricValue(key: string, metrics: MonthlyMetrics): number | null {
  const map: Record<string, number> = {
    'exit_rate': metrics.topExitPages[0]?.exitRate ?? 0,
    'intent_score': metrics.avgIntentScore,
    'conversion_rate': metrics.conversionRate,
    'bounce_rate': metrics.bounceRate,
    'sessions': metrics.sessions,
  };
  return map[key] ?? null;
}

function formatMetricValue(value: number, key: string): string {
  if (key.includes('rate') || key.includes('pct')) return `${(value * 100).toFixed(1)}%`;
  if (key.includes('ms')) return `${value.toFixed(0)}ms`;
  if (key.includes('spend')) return `$${value.toLocaleString()}`;
  return value.toFixed(1);
}

async function updateRecommendationVerification(v: RecommendationVerdict) {
  // Cap metricHistory at 24 entries
  const existing = await prisma.recommendation.findUnique({
    where: { id: v.recId },
    select: { metricHistory: true },
  });

  let history = (existing?.metricHistory as Array<{ month: string; value: number; note: string }>) ?? [];
  const nowLabel = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  history = [...history.filter(h => h.month !== nowLabel), {
    month: nowLabel,
    value: v.currentValue ?? 0,
    note: v.verificationNote,
  }].slice(-24); // keep last 24 months

  await prisma.recommendation.update({
    where: { id: v.recId },
    data: {
      implementationStatus: v.implementationStatus as never,
      verificationStatus: v.verificationStatus as never,
      verificationNote: v.verificationNote,
      lastVerifiedAt: new Date(),
      lastVerifiedValue: v.currentValue ?? undefined,
      contradictionFlag: v.contradictionFlag,
      contradictionNote: v.contradictionNote,
      recoveredMonthlyValue: v.recoveredValue,
      metricHistory: history as never,
    },
  });
}

// ── Opportunity identification ────────────────────────────────────────────────

async function identifyTopOpportunities(
  siteId: string,
  currentMetrics: MonthlyMetrics,
  baselineMetrics: MonthlyMetrics | null,
  verdicts: RecommendationVerdict[],
  month: number,
  year: number,
): Promise<TopOpportunity[]> {
  // Get open/stalled recommendations sorted by estimated impact
  const openRecs = verdicts
    .filter(v => ['OPEN', 'STALLED', 'IN_PROGRESS', 'CONTRADICTION'].includes(v.implementationStatus))
    .sort((a, b) => (b.estimatedImpact ?? 0) - (a.estimatedImpact ?? 0))
    .slice(0, 5);

  // Check if each was in last month's top opportunities
  const lastMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const lastMonthReport = await prisma.monthlyPerformanceReport.findFirst({
    where: { siteId, year: lastMonth.year, month: lastMonth.month },
    select: { topOpportunities: true },
  });

  const lastMonthOpps = (lastMonthReport?.topOpportunities as Array<{ recommendationId: string }>) ?? [];
  const lastMonthRecIds = new Set(lastMonthOpps.map(o => o.recommendationId));

  return openRecs.map((rec, i) => ({
    rank: i + 1,
    title: rec.title,
    finding: rec.verificationNote || 'Ongoing issue detected',
    metricNow: rec.currentValue !== null ? formatMetricValue(rec.currentValue, 'rate') : 'Measuring...',
    metricBaseline: rec.baselineValue !== null ? formatMetricValue(rec.baselineValue, 'rate') : null,
    dollarImpact: rec.estimatedImpact ?? 0,
    isRepeatFromLastMonth: lastMonthRecIds.has(rec.recId),
    monthsOpen: Math.floor(rec.daysSinceFlagged / 30),
    recommendationId: rec.recId,
  }));
}

// ── Narrative building blocks ─────────────────────────────────────────────────

function buildPraisePoints(verdicts: RecommendationVerdict[]): PraisePoint[] {
  return verdicts
    .filter(v => v.verificationStatus === 'IMPROVED' || v.verificationStatus === 'PARTIAL')
    .map(v => ({
      title: v.title,
      detail: v.verificationNote,
      dollarImpact: v.recoveredValue,
      metricBefore: v.baselineValue !== null ? String(v.baselineValue) : 'baseline',
      metricNow: v.currentValue !== null ? String(v.currentValue) : 'current',
    }));
}

function buildConcernPoints(
  verdicts: RecommendationVerdict[],
  current: MonthlyMetrics,
  baseline: MonthlyMetrics | null,
): ConcernPoint[] {
  return verdicts
    .filter(v => v.implementationStatus === 'OPEN' && v.daysSinceFlagged > 14)
    .map(v => ({
      title: v.title,
      detail: v.verificationNote || `This was flagged ${v.daysSinceFlagged} days ago with no action recorded.`,
      daysSinceFlag: v.daysSinceFlagged,
      estimatedCost: v.estimatedImpact
        ? Math.round(v.estimatedImpact * (v.daysSinceFlagged / 30)) // cumulative cost
        : null,
      isGettingWorse: v.verificationStatus === 'REGRESSED',
    }))
    .sort((a, b) => b.daysSinceFlag - a.daysSinceFlag);
}

function buildContradictions(verdicts: RecommendationVerdict[]): ContradictionPoint[] {
  return verdicts
    .filter(v => v.contradictionFlag && v.contradictionNote)
    .map(v => ({
      recId: v.recId,
      title: v.title,
      customerClaim: v.customerNote ?? `Marked as ${v.implementationStatus}`,
      aiFindings: v.contradictionNote!,
      baselineValue: v.baselineValue !== null ? String(v.baselineValue) : 'N/A',
      currentValue: v.currentValue !== null ? String(v.currentValue) : 'N/A',
    }));
}

function calculateGrade(
  verdicts: RecommendationVerdict[],
  current: MonthlyMetrics,
  baseline: MonthlyMetrics | null,
): string {
  if (verdicts.length === 0) return 'N/A';

  const total = verdicts.length;
  const improved = verdicts.filter(v => v.verificationStatus === 'IMPROVED').length;
  const partial = verdicts.filter(v => v.verificationStatus === 'PARTIAL').length;
  const regressed = verdicts.filter(v => v.verificationStatus === 'REGRESSED').length;
  const contradictions = verdicts.filter(v => v.contradictionFlag).length;
  const longUnacted = verdicts.filter(v => v.implementationStatus === 'OPEN' && v.daysSinceFlagged > 30).length;

  // Score out of 100
  let score = 50; // Start neutral
  score += (improved / total) * 30; // Up to +30 for verified improvements
  score += (partial / total) * 15;  // Up to +15 for partial improvements
  score -= (regressed / total) * 20; // Down to -20 for regressions
  score -= (contradictions / total) * 15; // Down to -15 for contradictions
  score -= (longUnacted / total) * 10; // Down to -10 for long-unacted items

  // Intent score bonus/penalty
  if (baseline && current.avgIntentScore > baseline.avgIntentScore + 5) score += 5;
  if (baseline && current.avgIntentScore < baseline.avgIntentScore - 5) score -= 5;

  score = Math.max(0, Math.min(100, score));

  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 55) return 'C+';
  if (score >= 45) return 'C';
  if (score >= 35) return 'C-';
  if (score >= 25) return 'D';
  return 'F';
}

// ── Executive narrative generation ───────────────────────────────────────────

async function generateExecutiveNarrative(params: {
  site: { name: string; domain: string; onboarding: { businessDescription?: string | null; conversionGoalName?: string | null } | null };
  comparisonMode: string;
  baselineLabel: string;
  currentMetrics: MonthlyMetrics;
  baselineMetrics: MonthlyMetrics | null;
  priorMonthMetrics: MonthlyMetrics | null;
  verdicts: RecommendationVerdict[];
  topOpportunities: TopOpportunity[];
  praisePoints: PraisePoint[];
  concernPoints: ConcernPoint[];
  contradictions: ContradictionPoint[];
  performanceGrade: string;
  revenueRecoveredTotal: number;
  customerAgeMonths: number;
  month: number;
  year: number;
}): Promise<string> {

  const monthName = new Date(params.year, params.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prompt = `You are WebGrade's AI analyst writing a monthly performance report for ${params.site.name} (${params.site.domain}).

SITE CONTEXT:
${params.site.onboarding?.businessDescription ? `Business: ${params.site.onboarding.businessDescription}` : ''}
${params.site.onboarding?.conversionGoalName ? `Primary conversion goal: ${params.site.onboarding.conversionGoalName}` : ''}
Customer age: ${params.customerAgeMonths} months
Comparison mode: ${params.comparisonMode === 'VS_BASELINE' ? `vs. ${params.baselineLabel}` : `YoY vs. ${params.baselineLabel}`}

CURRENT MONTH (${monthName}):
- Sessions: ${params.currentMetrics.sessions.toLocaleString()}
- Avg intent score: ${params.currentMetrics.avgIntentScore}/100
- Conversion rate: ${params.currentMetrics.conversionRate.toFixed(2)}%
- Revenue at risk: $${params.currentMetrics.revenueAtRisk.toLocaleString()}/mo
- Performance grade: ${params.performanceGrade}

${params.baselineMetrics ? `BASELINE COMPARISON (${params.baselineLabel}):
- Sessions: ${params.baselineMetrics.sessions.toLocaleString()} → ${params.currentMetrics.sessions.toLocaleString()} (${pctChange(params.currentMetrics.sessions, params.baselineMetrics.sessions)})
- Intent score: ${params.baselineMetrics.avgIntentScore} → ${params.currentMetrics.avgIntentScore} (${params.currentMetrics.avgIntentScore - params.baselineMetrics.avgIntentScore > 0 ? '+' : ''}${params.currentMetrics.avgIntentScore - params.baselineMetrics.avgIntentScore}pts)
- Conversion rate: ${params.baselineMetrics.conversionRate.toFixed(2)}% → ${params.currentMetrics.conversionRate.toFixed(2)}%` : ''}

WINS (${params.praisePoints.length} verified improvements):
${params.praisePoints.map(p => `- ${p.title}: ${p.detail}${p.dollarImpact ? ` (+$${p.dollarImpact.toLocaleString()}/mo recovered)` : ''}`).join('\n') || '- None this month'}

CONTRADICTIONS (customer says fixed, data disagrees):
${params.contradictions.map(c => `- "${c.title}": Customer reported: "${c.customerClaim}". AI findings: ${c.aiFindings}`).join('\n') || '- None'}

STALLED/UNACTED CONCERNS:
${params.concernPoints.map(c => `- "${c.title}": ${c.daysSinceFlag} days since flagged, no movement${c.estimatedCost ? `. Est. cumulative cost: $${c.estimatedCost.toLocaleString()}` : ''}`).join('\n') || '- None'}

TOP OPPORTUNITIES THIS MONTH:
${params.topOpportunities.map(o => `${o.rank}. ${o.title} — Est. $${o.dollarImpact.toLocaleString()}/mo${o.isRepeatFromLastMonth ? ' (repeat from last month)' : ''}${o.monthsOpen > 0 ? ` — open ${o.monthsOpen} month(s)` : ''}`).join('\n') || '- None identified'}

Total revenue recovered since baseline: $${params.revenueRecoveredTotal.toLocaleString()}/mo

INSTRUCTIONS:
Write a 3–5 paragraph executive summary for ${monthName}. Use this structure:
1. HEADLINE (1 sentence): Overall performance this month in plain English. Include the grade.
2. WINS (1 paragraph): Praise what improved. Be specific with metrics and dollar amounts. If nothing improved, say so honestly.
3. CALLS TO ACTION (1 paragraph): Highlight the 2–3 biggest open opportunities ranked by dollar impact. If anything was marked as fixed but data disagrees, call it out politely but directly — e.g. "You marked X as complete in February, but we're still seeing [metric]. Worth a second look."
4. AREAS OF CONCERN (1 paragraph): Name any findings that have been open >30 days with no action. Quantify the cumulative cost where possible. Don't be harsh, but be honest.
5. BOTTOM LINE (1–2 sentences): What's the one thing that would move the needle most this month?

Tone rules:
- Direct and specific. Never generic.
- Reference actual numbers from above.
- Praise is genuine, not hollow.
- Concerns are factual, not preachy.
- Never say "it seems like" or "it appears."
- Never mention AI or that you're an AI.
- Write as a trusted advisor who has studied their site for months, not a first-time consultant.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Claude API ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? fallbackNarrative(params);
  } catch {
    return fallbackNarrative(params);
  }
}

function pctChange(current: number, baseline: number): string {
  if (baseline === 0) return '+∞';
  const pct = ((current - baseline) / baseline) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function fallbackNarrative(params: { currentMetrics: MonthlyMetrics; performanceGrade: string; praisePoints: PraisePoint[]; concernPoints: ConcernPoint[] }): string {
  return `Performance grade: ${params.performanceGrade}. ${params.praisePoints.length} improvements verified this month. ${params.concernPoints.length > 0 ? `${params.concernPoints.length} items flagged with no action — see below.` : 'No outstanding concerns.'} Review the findings below for prioritized next steps.`;
}
