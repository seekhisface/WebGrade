// ── Shared style constants ───────────────────────────────────────────────────

/** Severity badge styles for the Alert Center (light theme) */
export const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  CRITICAL: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  HIGH:     { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  MEDIUM:   { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
  LOW:      { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' },
};

/** Severity badge styles used in WebWatch (dark / translucent variant) */
export const SEVERITY_STYLES_DARK: Record<string, { badge: string; dot: string; border: string }> = {
  critical: { badge: 'bg-red-500/15 text-red-400 border-red-500/20', dot: 'bg-red-500', border: 'border-red-500/30' },
  high:     { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20', dot: 'bg-amber-500', border: 'border-amber-500/30' },
  medium:   { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/20', dot: 'bg-blue-500', border: 'border-blue-500/30' },
  low:      { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500', border: 'border-emerald-500/30' },
};

/** Alert type icons */
export const ALERT_ICONS: Record<string, string> = {
  CONVERSION_DROP: '\u{1F4C9}',
  BOUNCE_RATE_SPIKE: '\u{1F504}',
  WASTED_SPEND_DETECTED: '\u{1F4B8}',
  SNIPPET_FIRING_STOPPED: '\u26A1',
  SEO_REGRESSION: '\u{1F50D}',
  NEW_HIGH_VALUE_OPPORTUNITY: '\u{1F3AF}',
};

/** Effort-level badge colours (Interim Report action items) */
export const EFFORT_COLORS: Record<string, string> = {
  low:    'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  high:   'bg-red-50 text-red-700 border-red-200',
};

/** Category badge colours for Growth Plays */
export const GROWTH_PLAY_CATEGORY_COLORS: Record<string, string> = {
  ab_test:   'bg-purple-50 text-purple-700 border-purple-200',
  content:   'bg-blue-50 text-blue-700 border-blue-200',
  audience:  'bg-teal-50 text-teal-700 border-teal-200',
  retention: 'bg-orange-50 text-orange-700 border-orange-200',
  channel:   'bg-green-50 text-green-700 border-green-200',
  product:   'bg-pink-50 text-pink-700 border-pink-200',
};

/** Action-item category icons */
export const ACTION_CATEGORY_ICONS: Record<string, string> = {
  conversion: '\u{1F3AF}',
  engagement: '\u{1F441}',
  speed:      '\u26A1',
  seo:        '\u{1F50D}',
  ux:         '\u2728',
  content:    '\u{1F4DD}',
};

/** Human-readable channel labels (WebOpp) */
export const CHANNEL_LABELS: Record<string, string> = {
  google_ads:        'Google Ads',
  meta_ads:          'Meta Ads',
  seo_organic:       'SEO / Organic',
  content_marketing: 'Content Marketing',
  linkedin_ads:      'LinkedIn Ads',
};

/** Intent distribution config — label + colour per intent class (Dashboard) */
export const INTENT_CONFIG: Record<string, { label: string; color: string }> = {
  HIGH:       { label: 'High Intent',  color: '#0d9488' },
  MEDIUM:     { label: 'Medium',       color: '#b45309' },
  LOW:        { label: 'Low Intent',   color: '#b91c1c' },
  RESEARCHER: { label: 'Researcher',   color: '#7c3aed' },
  COMPETITOR: { label: 'Competitor',   color: '#64748b' },
  BOT:        { label: 'Bot/Filtered', color: '#cbd5e1' },
};
