// =============================================================================
// WebGrade — B2B SaaS Behavioral Benchmarks
// P1-07: Drop-off analysis benchmark registry
//
// Sources: Hotjar 2024 SaaS Benchmark Report, CXL Institute, HubSpot
// Benchmarks are medians for B2B SaaS, mid-market segment.
// All values are periodically reviewed and versioned.
// =============================================================================

export const BENCHMARK_VERSION = '2025-Q1';

export type PageCategory =
  | 'home'
  | 'features'
  | 'pricing'
  | 'signup'
  | 'login'
  | 'blog'
  | 'case_study'
  | 'about'
  | 'contact'
  | 'demo'
  | 'landing'
  | 'docs'
  | 'unknown';

export interface PageBenchmark {
  category: PageCategory;
  label: string;                  // Human-readable name for UI
  exitRate: number;               // % — industry median
  exitRateGoodThreshold: number;  // Below this = performing well
  exitRatePoorThreshold: number;  // Above this = needs attention
  scrollDepth: number;            // % — industry median
  scrollDepthGoodThreshold: number;
  scrollDepthPoorThreshold: number;
  avgTimeOnPageSec: number;       // seconds
  conversionRole: 'entry' | 'nurture' | 'convert' | 'support';
  storylinePosition: number;      // 1–10, position in typical buyer journey
  revenueImpactMultiplier: number; // How much fixing this page impacts revenue (1.0 = baseline)
  notes: string;
}

export const PAGE_BENCHMARKS: Record<PageCategory, PageBenchmark> = {
  home: {
    category: 'home',
    label: 'Homepage',
    exitRate: 38,
    exitRateGoodThreshold: 30,
    exitRatePoorThreshold: 55,
    scrollDepth: 58,
    scrollDepthGoodThreshold: 70,
    scrollDepthPoorThreshold: 40,
    avgTimeOnPageSec: 92,
    conversionRole: 'entry',
    storylinePosition: 1,
    revenueImpactMultiplier: 1.8,
    notes: 'Homepage bounce rate that looks high is often traffic quality, not page quality. Check intent distribution before optimizing.',
  },
  features: {
    category: 'features',
    label: 'Features page',
    exitRate: 44,
    exitRateGoodThreshold: 35,
    exitRatePoorThreshold: 60,
    scrollDepth: 62,
    scrollDepthGoodThreshold: 72,
    scrollDepthPoorThreshold: 45,
    avgTimeOnPageSec: 118,
    conversionRole: 'nurture',
    storylinePosition: 3,
    revenueImpactMultiplier: 1.4,
    notes: 'Low scroll depth here almost always means message mismatch with the traffic source. Check UTM source alignment.',
  },
  pricing: {
    category: 'pricing',
    label: 'Pricing page',
    exitRate: 42,
    exitRateGoodThreshold: 32,
    exitRatePoorThreshold: 58,
    scrollDepth: 68,
    scrollDepthGoodThreshold: 78,
    scrollDepthPoorThreshold: 52,
    avgTimeOnPageSec: 145,
    conversionRole: 'convert',
    storylinePosition: 7,
    revenueImpactMultiplier: 2.2,
    notes: 'Highest revenue impact page. High scroll depth + high exit often means pricing objection, not interest gap. CTA placement and plan ordering are the top levers.',
  },
  signup: {
    category: 'signup',
    label: 'Signup / registration',
    exitRate: 28,
    exitRateGoodThreshold: 20,
    exitRatePoorThreshold: 42,
    scrollDepth: 88,
    scrollDepthGoodThreshold: 92,
    scrollDepthPoorThreshold: 75,
    avgTimeOnPageSec: 74,
    conversionRole: 'convert',
    storylinePosition: 9,
    revenueImpactMultiplier: 2.5,
    notes: 'Form field count is the #1 predictor of exit rate on signup pages. Every additional field costs ~4% more exits. Industry best practice: email + password only for freemium.',
  },
  login: {
    category: 'login',
    label: 'Login page',
    exitRate: 18,
    exitRateGoodThreshold: 12,
    exitRatePoorThreshold: 30,
    scrollDepth: 92,
    scrollDepthGoodThreshold: 95,
    scrollDepthPoorThreshold: 80,
    avgTimeOnPageSec: 28,
    conversionRole: 'support',
    storylinePosition: 10,
    revenueImpactMultiplier: 0.4,
    notes: 'High exit on login often signals password recovery friction or SSO gaps.',
  },
  blog: {
    category: 'blog',
    label: 'Blog / content',
    exitRate: 62,
    exitRateGoodThreshold: 50,
    exitRatePoorThreshold: 78,
    scrollDepth: 52,
    scrollDepthGoodThreshold: 65,
    scrollDepthPoorThreshold: 35,
    avgTimeOnPageSec: 186,
    conversionRole: 'entry',
    storylinePosition: 2,
    revenueImpactMultiplier: 0.8,
    notes: 'Blog exit rates are naturally high. Focus on internal linking to pricing/features and CTA placement at the 60% scroll mark.',
  },
  case_study: {
    category: 'case_study',
    label: 'Case study',
    exitRate: 48,
    exitRateGoodThreshold: 38,
    exitRatePoorThreshold: 62,
    scrollDepth: 71,
    scrollDepthGoodThreshold: 82,
    scrollDepthPoorThreshold: 55,
    avgTimeOnPageSec: 224,
    conversionRole: 'nurture',
    storylinePosition: 5,
    revenueImpactMultiplier: 1.2,
    notes: 'Case studies that end without a CTA lose 60% of conversion opportunity. Always close with a specific, relevant next step.',
  },
  about: {
    category: 'about',
    label: 'About page',
    exitRate: 52,
    exitRateGoodThreshold: 42,
    exitRatePoorThreshold: 68,
    scrollDepth: 64,
    scrollDepthGoodThreshold: 72,
    scrollDepthPoorThreshold: 48,
    avgTimeOnPageSec: 78,
    conversionRole: 'nurture',
    storylinePosition: 4,
    revenueImpactMultiplier: 0.6,
    notes: 'About page visitors have higher intent than average. Include social proof and a clear CTA — most about pages waste this traffic.',
  },
  contact: {
    category: 'contact',
    label: 'Contact page',
    exitRate: 35,
    exitRateGoodThreshold: 25,
    exitRatePoorThreshold: 50,
    scrollDepth: 82,
    scrollDepthGoodThreshold: 88,
    scrollDepthPoorThreshold: 68,
    avgTimeOnPageSec: 58,
    conversionRole: 'convert',
    storylinePosition: 8,
    revenueImpactMultiplier: 1.0,
    notes: 'High exit on contact page almost always means form length or trust signals. Phone number and live chat reduce exit rate by 12–18%.',
  },
  demo: {
    category: 'demo',
    label: 'Demo request page',
    exitRate: 31,
    exitRateGoodThreshold: 22,
    exitRatePoorThreshold: 48,
    scrollDepth: 84,
    scrollDepthGoodThreshold: 90,
    scrollDepthPoorThreshold: 70,
    avgTimeOnPageSec: 88,
    conversionRole: 'convert',
    storylinePosition: 8,
    revenueImpactMultiplier: 2.0,
    notes: 'Calendar embed (Calendly/Chili Piper) reduces demo page exit rate by 22% vs form-only. Immediate scheduling converts 3× better than form-then-follow-up.',
  },
  landing: {
    category: 'landing',
    label: 'Ad landing page',
    exitRate: 46,
    exitRateGoodThreshold: 32,
    exitRatePoorThreshold: 65,
    scrollDepth: 58,
    scrollDepthGoodThreshold: 70,
    scrollDepthPoorThreshold: 42,
    avgTimeOnPageSec: 68,
    conversionRole: 'convert',
    storylinePosition: 6,
    revenueImpactMultiplier: 1.9,
    notes: 'Message match between ad copy and landing page headline is the single biggest lever. Even 20% keyword alignment improvement can cut exit rate by 30%.',
  },
  docs: {
    category: 'docs',
    label: 'Documentation',
    exitRate: 55,
    exitRateGoodThreshold: 44,
    exitRatePoorThreshold: 70,
    scrollDepth: 48,
    scrollDepthGoodThreshold: 62,
    scrollDepthPoorThreshold: 32,
    avgTimeOnPageSec: 142,
    conversionRole: 'support',
    storylinePosition: 10,
    revenueImpactMultiplier: 0.5,
    notes: 'Docs exit rate is expected to be high. Flag only if exit is happening on getting-started pages — that signals onboarding friction.',
  },
  unknown: {
    category: 'unknown',
    label: 'Other page',
    exitRate: 48,
    exitRateGoodThreshold: 38,
    exitRatePoorThreshold: 65,
    scrollDepth: 58,
    scrollDepthGoodThreshold: 70,
    scrollDepthPoorThreshold: 40,
    avgTimeOnPageSec: 95,
    conversionRole: 'nurture',
    storylinePosition: 5,
    revenueImpactMultiplier: 1.0,
    notes: 'Using default benchmarks. Install the snippet to get page-specific classification.',
  },
};

// ---------------------------------------------------------------------------
// Classifier — maps a URL path to a PageCategory
// ---------------------------------------------------------------------------
export function classifyPageUrl(url: string): PageCategory {
  const lower = url.toLowerCase().replace(/^https?:\/\/[^/]+/, '');
  const path = lower.split('?')[0];

  // For single-page sites: check the #hash fragment as a section name
  // e.g. "/#pricing" or "/#features" should classify the same as "/pricing"
  const hashIdx = path.indexOf('#');
  const fragment = hashIdx >= 0 ? path.slice(hashIdx + 1) : null;

  const patterns: [RegExp, PageCategory][] = [
    [/(pricing|plans?|packages?|cost|subscription)/i,   'pricing'],
    [/(signup|sign-up|register|create-account|start|trial|free)/i, 'signup'],
    [/(login|sign-in|signin|log-in)/i,                  'login'],
    [/(features?|capabilities|how-it-works|product)/i,  'features'],
    [/(demo|book-demo|schedule|request-demo)/i,         'demo'],
    [/(about|team|story|company|mission|values)/i,      'about'],
    [/(contact|get-in-touch|reach-us|support)/i,        'contact'],
    [/(case-stud|customer|success-stor|testimonial)/i,  'case_study'],
    [/(blog|news|insights|articles?|posts?)/i,          'blog'],
    [/(docs?|documentation|guides?|help|kb|knowledge)/i,'docs'],
    [/(lp\/|landing|campaign)/i,                        'landing'],
  ];

  // Check hash fragment first (most specific for single-page sites)
  if (fragment) {
    for (const [pattern, category] of patterns) {
      if (pattern.test(fragment)) return category;
    }
  }

  // Then check the full path
  const pathWithoutHash = hashIdx >= 0 ? path.slice(0, hashIdx) : path;
  if (pathWithoutHash === '/' || pathWithoutHash === '') {
    // Only classify as home if there's no meaningful hash
    if (!fragment) return 'home';
    return 'unknown';
  }

  for (const [pattern, category] of patterns) {
    if (pattern.test(pathWithoutHash)) return category;
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Gap calculators — return signed gap vs benchmark (positive = worse than benchmark)
// ---------------------------------------------------------------------------
export function exitRateGap(actual: number, benchmark: PageBenchmark): number {
  return actual - benchmark.exitRate;
}

export function scrollDepthGap(actual: number, benchmark: PageBenchmark): number {
  return benchmark.scrollDepth - actual; // positive = below benchmark
}

export type GapSeverity = 'critical' | 'warning' | 'ok' | 'good';

export function exitRateSeverity(actual: number, benchmark: PageBenchmark): GapSeverity {
  if (actual <= benchmark.exitRateGoodThreshold) return 'good';
  if (actual <= benchmark.exitRate + 5)          return 'ok';
  if (actual <= benchmark.exitRatePoorThreshold) return 'warning';
  return 'critical';
}

export function scrollDepthSeverity(actual: number, benchmark: PageBenchmark): GapSeverity {
  if (actual >= benchmark.scrollDepthGoodThreshold) return 'good';
  if (actual >= benchmark.scrollDepth - 5)          return 'ok';
  if (actual >= benchmark.scrollDepthPoorThreshold) return 'warning';
  return 'critical';
}

// ---------------------------------------------------------------------------
// Revenue impact estimator
// Rough formula: sessions × (exitGap/100) × avgOrderValue × leadToWinRate × multiplier
// ---------------------------------------------------------------------------
export function estimateMonthlyRevenueAtRisk(params: {
  sessions: number;
  exitRateActual: number;
  exitRateBenchmark: number;
  avgOrderValue: number;      // $ — from onboarding
  leadToWinRate: number;      // 0.0–1.0 — from onboarding
  revenueImpactMultiplier: number;
}): number {
  const { sessions, exitRateActual, exitRateBenchmark, avgOrderValue, leadToWinRate, revenueImpactMultiplier } = params;
  const lostVisitors = sessions * ((exitRateActual - exitRateBenchmark) / 100);
  if (lostVisitors <= 0) return 0;
  return Math.round(lostVisitors * avgOrderValue * leadToWinRate * revenueImpactMultiplier);
}
