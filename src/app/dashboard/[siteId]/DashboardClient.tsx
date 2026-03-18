'use client';

import { useState, useEffect, useRef } from 'react';
import type { IntentDistribution, DropOffPage, DashboardData } from '@/types';
import { useCountUp } from '@/lib/hooks/useCountUp';
import { INTENT_CONFIG } from '@/lib/constants/styles';

// ── Main client component ─────────────────────────────────────────────────

export function DashboardClient({ siteId, data }: {
  siteId: string;
  data: DashboardData | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [triggered, setTriggered] = useState(false);
  const kpiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!kpiRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setTriggered(true); },
      { threshold: 0.3 }
    );
    observer.observe(kpiRef.current);
    return () => observer.disconnect();
  }, []);

  const sessions    = useCountUp(data?.totalSessions ?? 0, 1600, triggered);
  const intentScore = useCountUp(data?.avgIntentScore ?? 0, 1400, triggered);
  const revenueRisk = useCountUp(data?.revenueAtRisk ?? 0, 1800, triggered);

  if (!data) {
    return (
      <div className="min-h-screen bg-page-bg">
        <div className="px-6 py-8 max-w-7xl mx-auto">
          <h1 className="text-2xl font-black text-nav-bg mb-4">Behavioral Intelligence</h1>
          <p className="text-sm text-slate-500">No data available yet. Install the tracking snippet to start collecting behavioral data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page-bg" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>

      <div className="px-6 py-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-nav-bg">Behavioral Intelligence</h1>
              <HealthBadge status={data.healthStatus} />
            </div>
            <p className="text-sm text-slate-500">
              {data.site.domain} · {data.totalSessions.toLocaleString()} sessions · Last 30 days
            </p>
          </div>
          <a
            href={`/dashboard/${siteId}/report`}
            className="px-4 py-2 bg-nav-bg hover:bg-nav-border text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            View Report →
          </a>
        </div>

        {/* KPI cards */}
        <div ref={kpiRef} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <KpiCard
            label="Total Sessions"
            value={sessions.toLocaleString()}
            change={data.totalSessionsChange}
            baseline={data.baselineSessions > 0 ? `${data.baselineSessions.toLocaleString()} baseline` : undefined}
          />
          <KpiCard
            label="Avg Intent Score"
            value={String(intentScore)}
            suffix="/100"
            change={data.avgIntentScoreChange}
            baseline={data.baselineIntent > 0 ? `${data.baselineIntent} baseline` : undefined}
            valueColor={intentScore >= 70 ? '#0d9488' : intentScore >= 40 ? '#b45309' : '#b91c1c'}
          />
          <KpiCard
            label="Revenue at Risk"
            value={`$${revenueRisk.toLocaleString()}`}
            suffix="/mo"
            change={0}
            baseline={data.revenueAtRisk > 0 ? 'from drop-off analysis' : undefined}
            valueColor="#b91c1c"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Intent distribution */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-page-border p-6 shadow-sm">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5">
              Intent Distribution
            </h2>
            <IntentChart distribution={data.intentDistribution} />
          </div>

          {/* Drop-off map */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-page-border p-6 shadow-sm">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5">
              Drop-off Map · AI Analysis
            </h2>
            {data.dropOffPages.length === 0 ? (
              <p className="text-sm text-slate-500">No drop-off data available yet.</p>
            ) : (
              <div className="space-y-3">
                {data.dropOffPages.map(page => (
                  <DropOffRow
                    key={page.url}
                    page={page}
                    expanded={expanded === page.url}
                    onToggle={() => setExpanded(expanded === page.url ? null : page.url)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Revenue at risk callout */}
        <div className="mt-6 p-5 bg-white border border-page-border rounded-2xl shadow-sm flex items-center justify-between gap-6 flex-wrap">
          <div>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${data.revenueAtRisk > 0 ? 'text-status-red' : 'text-status-green'}`}>
              {data.revenueAtRisk > 0 ? 'Revenue at Risk' : 'Revenue Health'}
            </p>
            <p className="text-sm text-slate-700 max-w-xl">
              {data.revenueAtRisk > 0 ? (
                <>
                  WebGrade has identified <strong className="text-nav-bg">${data.revenueAtRisk.toLocaleString()}/mo</strong> in recoverable revenue across your behavioral data.
                  {data.top3RecoverableRevenue > 0 && (
                    <> Your top 3 fixes could recover an estimated <strong className="text-status-green">${data.top3RecoverableRevenue.toLocaleString()}/mo</strong> within 60 days.</>
                  )}
                </>
              ) : (
                <>All monitored pages are performing within or above industry benchmarks. No significant revenue leakage detected.</>
              )}
            </p>
          </div>
          <a
            href={`/dashboard/${siteId}/report`}
            className="flex-shrink-0 px-5 py-2.5 bg-nav-bg hover:bg-nav-border text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
          >
            {data.revenueAtRisk > 0 ? 'See action plan →' : 'View full report →'}
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function HealthBadge({ status }: { status: 'GREEN' | 'YELLOW' | 'RED' }) {
  const config = {
    GREEN:  { bg: 'bg-[#f0fdf4]', border: 'border-[#bbf7d0]', dot: 'bg-status-green', text: 'text-status-green', label: 'Healthy' },
    YELLOW: { bg: 'bg-[#fffbeb]', border: 'border-[#fde68a]', dot: 'bg-status-yellow', text: 'text-status-yellow', label: 'Attention needed' },
    RED:    { bg: 'bg-[#fef2f2]', border: 'border-[#fecaca]', dot: 'bg-status-red', text: 'text-status-red', label: 'Issues detected' },
  }[status];
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 ${config.bg} border ${config.border} rounded-full`}>
      <div className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse`} />
      <span className={`text-xs font-semibold ${config.text}`}>{config.label}</span>
    </div>
  );
}

function KpiCard({ label, value, change, suffix, baseline, valueColor, changeLabel }: {
  label: string; value: string; change: number;
  suffix?: string; baseline?: string; valueColor?: string; changeLabel?: string;
}) {
  const positive = change >= 0;
  return (
    <div className="bg-white border border-page-border rounded-2xl p-5 shadow-sm">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{label}</p>
      <p className="text-3xl font-black mb-1" style={{ color: valueColor ?? '#0c4a6e' }}>
        {value}
        {suffix && <span className="text-base font-normal text-slate-400 ml-1">{suffix}</span>}
      </p>
      {baseline && (
        <p className="text-[11px] text-slate-400 mb-2">{baseline}</p>
      )}
      {change !== 0 && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${positive ? 'text-status-green' : 'text-status-red'}`}>
          <span>{positive ? '↑' : '↓'}</span>
          <span>{Math.abs(change).toFixed(1)}%</span>
          <span className="text-slate-400 font-normal ml-1">{changeLabel ?? 'vs baseline'}</span>
        </div>
      )}
    </div>
  );
}

function IntentChart({ distribution }: { distribution: IntentDistribution }) {
  const entries = Object.entries(distribution) as Array<[keyof IntentDistribution, number]>;
  const buyingIntent = distribution.HIGH + distribution.MEDIUM;
  const hasData = entries.some(([, pct]) => pct > 0);

  if (!hasData) {
    return <p className="text-sm text-slate-500">No intent data available yet.</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, pct]) => {
        const { label, color } = INTENT_CONFIG[key];
        return (
          <div key={key} className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-slate-700">{label}</span>
                <span className="text-xs font-bold text-slate-900">{pct}%</span>
              </div>
              <div className="h-1.5 bg-page-bg rounded-full overflow-hidden border border-sky-100">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          </div>
        );
      })}
      <div className="pt-4 border-t border-sky-100 flex justify-between">
        <span className="text-xs text-slate-400">6 intent classes</span>
        <span className="text-xs font-semibold text-status-green">{buyingIntent}% buying intent</span>
      </div>
    </div>
  );
}

function DropOffRow({ page, expanded, onToggle }: {
  page: DropOffPage; expanded: boolean; onToggle: () => void;
}) {
  const sev = page.exitRate >= 60 ? 'RED' : page.exitRate >= 40 ? 'YELLOW' : 'GREEN';
  const sevStyle = {
    RED:    'text-status-red bg-[#fef2f2] border-[#fecaca]',
    YELLOW: 'text-status-yellow bg-[#fffbeb] border-[#fde68a]',
    GREEN:  'text-status-green bg-[#f0fdf4] border-[#bbf7d0]',
  }[sev];

  return (
    <div className="border border-page-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 hover:bg-page-bg transition-colors text-left"
      >
        <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-xs font-black ${sevStyle}`}>
          {page.exitRate}% exit
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-slate-900 truncate">{page.title}</span>
            {page.isStorylineBreakpoint && (
              <span className="px-1.5 py-0.5 bg-nav-bg/10 text-nav-bg text-[10px] font-bold rounded flex-shrink-0">
                Storyline break
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500">{page.url}</span>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-slate-500 mb-0.5">Scroll depth</p>
          <p className="text-sm font-bold text-slate-900">{page.avgScrollDepth}%</p>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && page.aiExplanation && (
        <div className="px-4 pb-4 border-t border-sky-100">
          <div className="mt-3 p-4 bg-page-bg border border-page-border rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-nav-bg rounded flex items-center justify-center">
                <span className="text-white text-[9px] font-black">AI</span>
              </div>
              <span className="text-xs font-bold text-nav-bg">WebGrade Analysis</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{page.aiExplanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
