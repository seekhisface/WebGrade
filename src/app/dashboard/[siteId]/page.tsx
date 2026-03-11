'use client';

import { useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IntentDistribution {
  HIGH: number;
  MEDIUM: number;
  LOW: number;
  RESEARCHER: number;
  COMPETITOR: number;
  BOT: number;
}

interface DropOffPage {
  url: string;
  title: string;
  exitRate: number;
  avgScrollDepth: number;
  sessions: number;
  isStorylineBreakpoint: boolean;
  aiExplanation?: string;
}

interface DashboardData {
  site: {
    id: string;
    name: string;
    domain: string;
    url: string;
  };
  period: { start: string; end: string };
  totalSessions: number;
  totalSessionsChange: number; // % vs previous period
  avgIntentScore: number;
  avgIntentScoreChange: number;
  conversionRate: number;
  conversionRateChange: number;
  topIntentClass: keyof IntentDistribution;
  intentDistribution: IntentDistribution;
  dropOffPages: DropOffPage[];
  healthStatus: 'GREEN' | 'YELLOW' | 'RED';
  snippetInstalled: boolean;
}

// ---------------------------------------------------------------------------
// Mock data for development (replaced by real API call in production)
// ---------------------------------------------------------------------------

function getMockData(siteId: string): DashboardData {
  return {
    site: {
      id: siteId,
      name: 'HelloNote',
      domain: 'hellonote.com',
      url: 'https://hellonote.com',
    },
    period: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString(),
    },
    totalSessions: 4821,
    totalSessionsChange: 12.4,
    avgIntentScore: 42,
    avgIntentScoreChange: -3.1,
    conversionRate: 2.3,
    conversionRateChange: -0.4,
    topIntentClass: 'LOW',
    intentDistribution: {
      HIGH: 8,
      MEDIUM: 22,
      LOW: 51,
      RESEARCHER: 9,
      COMPETITOR: 4,
      BOT: 6,
    },
    dropOffPages: [
      {
        url: '/features',
        title: 'Features',
        exitRate: 68,
        avgScrollDepth: 34,
        sessions: 1820,
        isStorylineBreakpoint: true,
        aiExplanation: 'Visitors are arriving from ads that promise "simple note-taking" but the features page leads with enterprise capabilities. This message mismatch is causing 68% to exit before reaching pricing.',
      },
      {
        url: '/pricing',
        title: 'Pricing',
        exitRate: 54,
        avgScrollDepth: 71,
        sessions: 943,
        isStorylineBreakpoint: false,
        aiExplanation: 'Strong scroll depth (71%) suggests interest, but visitors are not clicking the CTA. The $29/mo plan is positioned above the free tier — reversing this order typically lifts conversions by 12-18% for freemium products.',
      },
      {
        url: '/signup',
        title: 'Sign Up',
        exitRate: 41,
        avgScrollDepth: 82,
        sessions: 512,
        isStorylineBreakpoint: false,
        aiExplanation: 'High exit rate on the signup form. The form has 7 fields before the first submit — industry average for freemium SaaS is 3. Reducing to email + password alone could recover ~130 signups/month at current traffic.',
      },
    ],
    healthStatus: 'YELLOW',
    snippetInstalled: true,
  };
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage({ params }: { params: { siteId: string } }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPage, setExpandedPage] = useState<string | null>(null);

  useEffect(() => {
    // In production: fetch from /api/dashboard/[siteId]
    // For now: use mock data
    setTimeout(() => {
      setData(getMockData(params.siteId));
      setLoading(false);
    }, 600);
  }, [params.siteId]);

  if (loading) return <DashboardSkeleton />;
  if (!data) return <div>Error loading dashboard</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Nav */}
      <nav className="px-8 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-brand-600 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xs">W</span>
            </div>
            <span className="font-semibold text-white text-sm">WebGrade</span>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <NavTab label="Behavioral" active />
            <NavTab label="SEO" />
            <NavTab label="Ad Spend" />
            <NavTab label="WebOpp™" badge="New" />
            <NavTab label="Reports" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <HealthBadge status={data.healthStatus} />
          <div className="text-sm text-white/40">{data.site.domain}</div>
        </div>
      </nav>

      <div className="px-8 py-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Behavioral Intelligence</h1>
            <p className="text-sm text-white/40">
              {data.totalSessions.toLocaleString()} sessions · Last 7 days
            </p>
          </div>
          <button className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors">
            Generate Report →
          </button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <KpiCard
            label="Total Sessions"
            value={data.totalSessions.toLocaleString()}
            change={data.totalSessionsChange}
          />
          <KpiCard
            label="Avg Intent Score"
            value={data.avgIntentScore.toString()}
            change={data.avgIntentScoreChange}
            suffix="/100"
            valueColor={scoreColor(data.avgIntentScore)}
          />
          <KpiCard
            label="Conversion Rate"
            value={data.conversionRate.toFixed(1) + '%'}
            change={data.conversionRateChange}
            changeUnit="pp"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-5 gap-6 mb-8">
          {/* Intent distribution — spans 2 cols */}
          <div className="col-span-2 bg-white/3 border border-white/8 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-5">
              Intent Distribution
            </h2>
            <IntentChart distribution={data.intentDistribution} />
          </div>

          {/* Drop-off pages — spans 3 cols */}
          <div className="col-span-3 bg-white/3 border border-white/8 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-5">
              Drop-off Map · AI Analysis
            </h2>
            <div className="space-y-3">
              {data.dropOffPages.map(page => (
                <DropOffRow
                  key={page.url}
                  page={page}
                  expanded={expandedPage === page.url}
                  onToggle={() => setExpandedPage(
                    expandedPage === page.url ? null : page.url
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Snippet install CTA if not installed */}
        {!data.snippetInstalled && (
          <div className="p-5 bg-brand-950/50 border border-brand-700/30 rounded-xl flex items-center justify-between">
            <div>
              <p className="font-medium text-white text-sm">Install the tracking snippet to see live data</p>
              <p className="text-xs text-white/40 mt-0.5">Paste one line of code into your site&apos;s &lt;head&gt;</p>
            </div>
            <button className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors">
              Get snippet →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NavTab({ label, active, badge }: { label: string; active?: boolean; badge?: string }) {
  return (
    <button
      className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1.5 ${
        active ? 'bg-white/8 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/4'
      }`}
    >
      {label}
      {badge && (
        <span className="px-1.5 py-0.5 bg-brand-600/30 text-brand-400 text-[10px] font-medium rounded">
          {badge}
        </span>
      )}
    </button>
  );
}

function HealthBadge({ status }: { status: 'GREEN' | 'YELLOW' | 'RED' }) {
  const config = {
    GREEN: { color: 'text-status-green', bg: 'bg-status-green/10', label: 'Healthy' },
    YELLOW: { color: 'text-status-yellow', bg: 'bg-status-yellow/10', label: 'Attention needed' },
    RED: { color: 'text-status-red', bg: 'bg-status-red/10', label: 'Issues detected' },
  }[status];

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 ${config.bg} rounded-full`}>
      <div className={`w-1.5 h-1.5 rounded-full ${
        status === 'GREEN' ? 'bg-status-green' :
        status === 'YELLOW' ? 'bg-status-yellow' : 'bg-status-red'
      } animate-pulse-slow`} />
      <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
    </div>
  );
}

function KpiCard({
  label, value, change, suffix, valueColor, changeUnit = '%'
}: {
  label: string;
  value: string;
  change: number;
  suffix?: string;
  valueColor?: string;
  changeUnit?: string;
}) {
  const isPositive = change >= 0;
  return (
    <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
      <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">{label}</p>
      <p className={`text-3xl font-bold mb-2 ${valueColor ?? 'text-white'}`}>
        {value}
        {suffix && <span className="text-lg font-normal text-white/40 ml-1">{suffix}</span>}
      </p>
      <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-status-green' : 'text-status-red'}`}>
        <span>{isPositive ? '↑' : '↓'}</span>
        <span>{Math.abs(change).toFixed(1)}{changeUnit}</span>
        <span className="text-white/30">vs last week</span>
      </div>
    </div>
  );
}

const INTENT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  HIGH:       { label: 'High Intent',  color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  MEDIUM:     { label: 'Medium',       color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  LOW:        { label: 'Low Intent',   color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  RESEARCHER: { label: 'Researcher',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  COMPETITOR: { label: 'Competitor',   color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  BOT:        { label: 'Bot/Filtered', color: '#374151', bg: 'rgba(55,65,81,0.15)' },
};

function IntentChart({ distribution }: { distribution: IntentDistribution }) {
  const entries = Object.entries(distribution) as Array<[keyof IntentDistribution, number]>;
  const total = entries.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-3">
      {entries.map(([key, pct]) => {
        const { label, color, bg } = INTENT_LABELS[key];
        return (
          <div key={key} className="flex items-center gap-3">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/60">{label}</span>
                <span className="text-xs font-semibold text-white">{pct}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
                    boxShadow: `0 0 6px ${color}60`,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}

      {/* Summary */}
      <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
        <span className="text-xs text-white/30">{total}% classified</span>
        <span className="text-xs text-white/30">
          {distribution.HIGH + distribution.MEDIUM}% buying intent
        </span>
      </div>
    </div>
  );
}

function DropOffRow({
  page, expanded, onToggle
}: {
  page: DropOffPage;
  expanded: boolean;
  onToggle: () => void;
}) {
  const severity = page.exitRate >= 60 ? 'RED' : page.exitRate >= 40 ? 'YELLOW' : 'GREEN';
  const severityColor = severity === 'RED' ? 'text-status-red' : severity === 'YELLOW' ? 'text-status-yellow' : 'text-status-green';
  const severityBg = severity === 'RED' ? 'bg-status-red/10 border-status-red/20' : severity === 'YELLOW' ? 'bg-status-yellow/10 border-status-yellow/20' : 'bg-status-green/10 border-status-green/20';

  return (
    <div className="border border-white/8 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 hover:bg-white/3 transition-colors text-left"
      >
        {/* Exit rate badge */}
        <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-xs font-bold ${severityBg} ${severityColor}`}>
          {page.exitRate}% exit
        </div>

        {/* Page info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-white truncate">{page.title}</span>
            {page.isStorylineBreakpoint && (
              <span className="px-1.5 py-0.5 bg-brand-600/20 text-brand-400 text-[10px] font-medium rounded flex-shrink-0">
                Storyline break
              </span>
            )}
          </div>
          <span className="text-xs text-white/30 truncate block">{page.url}</span>
        </div>

        {/* Scroll depth */}
        <div className="flex-shrink-0 text-right">
          <p className="text-xs text-white/40 mb-0.5">Scroll depth</p>
          <p className="text-sm font-semibold text-white">{page.avgScrollDepth}%</p>
        </div>

        {/* Expand toggle */}
        <div className={`text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ↓
        </div>
      </button>

      {/* AI explanation */}
      {expanded && page.aiExplanation && (
        <div className="px-4 pb-4 border-t border-white/5">
          <div className="mt-3 p-4 bg-brand-950/30 border border-brand-800/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 bg-brand-600/30 rounded flex items-center justify-center">
                <span className="text-brand-400 text-[8px] font-bold">AI</span>
              </div>
              <span className="text-xs font-medium text-brand-400">WebGrade Analysis</span>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">{page.aiExplanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] p-8 animate-pulse">
      <div className="max-w-7xl mx-auto">
        <div className="h-8 w-64 bg-white/5 rounded-lg mb-8" />
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-white/3 border border-white/5 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-2 h-80 bg-white/3 border border-white/5 rounded-2xl" />
          <div className="col-span-3 h-80 bg-white/3 border border-white/5 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 70) return 'text-status-green';
  if (score >= 40) return 'text-status-yellow';
  return 'text-status-red';
}
