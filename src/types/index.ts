// ── Shared type definitions ──────────────────────────────────────────────────

/** Site record used by AppNav and dashboard layout */
export interface Site {
  id: string;
  name: string;
  domain: string;
  hasWebWatch: boolean;
  hasWebOpp: boolean;
  hasInterimReport: boolean;
}

/** Intent distribution bucket (Dashboard) */
export interface IntentDistribution {
  HIGH: number;
  MEDIUM: number;
  LOW: number;
  RESEARCHER: number;
  COMPETITOR: number;
  BOT: number;
}

/** A page with high exit / drop-off (Dashboard) */
export interface DropOffPage {
  url: string;
  title: string;
  exitRate: number;
  avgScrollDepth: number;
  sessions: number;
  isStorylineBreakpoint: boolean;
  aiExplanation?: string;
}

/** Top-level payload returned by the dashboard API */
export interface DashboardData {
  site: { id: string; name: string; domain: string; url: string };
  totalSessions: number;
  totalSessionsChange: number;
  baselineSessions: number;
  avgIntentScore: number;
  avgIntentScoreChange: number;
  baselineIntent: number;
  revenueAtRisk: number;
  top3RecoverableRevenue: number;
  intentDistribution: IntentDistribution;
  dropOffPages: DropOffPage[];
  healthStatus: 'GREEN' | 'YELLOW' | 'RED';
}

/** Single action item inside an Interim Report */
export interface ActionItem {
  rank: number;
  title: string;
  problem: string;
  fix: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  pageUrl: string | null;
  category: string;
}

/** Growth play inside an Interim Report */
export interface GrowthPlay {
  rank: number;
  title: string;
  opportunity: string;
  hypothesis: string;
  experiment: string;
  upside: string;
  timeToResult: string;
  category: string;
}

/** Critical page entry in a report */
export interface CriticalPage {
  url: string;
  exitRate: number;
  scrollDepth: number;
  revenueAtRisk: number;
  severity: string;
}

/** Full Interim Report payload */
export interface ReportPayload {
  id: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  executiveSummary: string | null;
  actionItems: ActionItem[] | null;
  growthPlays: GrowthPlay[] | null;
  estimatedImpact: string | null;
  liveMetrics: LiveMetrics | null;
  criticalPages: CriticalPage[] | null;
  totalRevenueAtRisk: number;
  createdAt: string;
}

/** Live behavioural metrics embedded in a report */
export interface LiveMetrics {
  totalSessions: number;
  avgIntentScore: number;
  rageClickEvents: number;
  hesitationEvents: number;
  dataSource: 'live' | 'demo';
}

/** UI alert shown in Alert Center */
export interface Alert {
  id: string;
  alertType: string;
  severity: string;
  message: string;
  triggeredAt: string;
  resolvedAt: string | null;
  resolvedAutomatically: boolean;
  acknowledgedAt: string | null;
  emailSentAt: string | null;
  slackSentAt: string | null;
}
