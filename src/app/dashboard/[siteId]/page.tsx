'use client';

import { useState, useEffect, useRef } from 'react';
import { AppNav } from '@/components/nav/AppNav';
import { useSetupState } from '@/hooks/useSetupState';
import { SetupChecklist } from '@/components/dashboard/SetupChecklist';
import { DataBanner } from '@/components/dashboard/DataBanner';

interface Site {
  id: string; name: string; domain: string;
  hasWebWatch: boolean; hasWebOpp: boolean; hasInterimReport: boolean;
}

interface IntentDistribution {
  HIGH: number; MEDIUM: number; LOW: number;
  RESEARCHER: number; COMPETITOR: number; BOT: number;
}

interface DropOffPage {
  url: string; title: string; exitRate: number;
  avgScrollDepth: number; sessions: number;
  isStorylineBreakpoint: boolean; aiExplanation?: string;
}

interface DashboardData {
  site: { id: string; name: string; domain: string; url: string };
  totalSessions: number; totalSessionsChange: number;
  avgIntentScore: number; avgIntentScoreChange: number;
  revenueAtRisk: number;
  intentDistribution: IntentDistribution;
  dropOffPages: DropOffPage[];
  healthStatus: 'GREEN' | 'YELLOW' | 'RED';
}

function useCountUp(target: number, duration = 1800, trigger = true): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let v = 0;
    const step = target / (duration / 16);
    const t = setInterval(() => {
      v += step;
      if (v >= target) { setVal(target); clearInterval(t); }
      else setVal(Math.floor(v));
    }, 16);
    return () => clearInterval(t);
  }, [target, duration, trigger]);
  return val;
}

// ── Fetch dashboard data from API ──────────────────────────────────────────
async function fetchDashboardData(siteId: string): Promise<DashboardData> {
  const res = await fetch(`/api/dashboard?siteId=${siteId}&days=30`);
  if (!res.ok) throw new Error(`Dashboard API error: ${res.status}`);
  return res.json();
}

export default function DashboardPage({ params }: { params: { siteId: string } }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [triggered, setTriggered] = useState(false);
  const kpiRef = useRef<HTMLDivElement>(null);
  const setup = useSetupState(params.siteId);

  useEffect(() => {
    const el = document.getElementById('__webgrade_sites__');
    const allSites: Site[] = el ? JSON.parse(el.textContent ?? '[]') : [];
    setSites(allSites);
  }, []);

  useEffect(() => {
    fetchDashboardData(params.siteId)
      .then(setData)
      .catch(err => console.error('[dashboard] Failed to load:', err))
      .finally(() => setLoading(false));
  }, [params.siteId]);

  useEffect(() => {
    if (!kpiRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setTriggered(true); },
      { threshold: 0.3 }
    );
    observer.observe(kpiRef.current);
    return () => observer.disconnect();
  }, [setup.loading]);

  const sessions    = useCountUp(data?.totalSessions ?? 0, 1600, triggered);
  const intentScore = useCountUp(data?.avgIntentScore ?? 0, 1400, triggered);
  const revenueRisk = useCountUp(data?.revenueAtRisk ?? 0, 1800, triggered);

  if (setup.loading || loading || !data) {
    return (
      <div className="min-h-screen bg-[#f0f9ff]">
        <div className="px-6 py-8 max-w-7xl mx-auto animate-pulse">
          <div className="h-8 w-64 bg-[#bae6fd] rounded-lg mb-8" />
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-white border border-[#bae6fd] rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (setup.mode === 'setup') {
    return (
      <div className="min-h-screen bg-[#f0f9ff]">
        <AppNav currentSiteId={params.siteId} sites={sites} activePage="behavioral" />
        <SetupChecklist siteId={params.siteId} setup={setup} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f9ff]" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <AppNav currentSiteId={params.siteId} sites={sites} activePage="behavioral" />

      {!setup.isDemo && <DataBanner siteId={params.siteId} tabName="behavioral" />}

      <div className="px-6 py-8 max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-[#0c4a6e]">Behavioral Intelligence</h1>
              <HealthBadge status={data.healthStatus} />
            </div>
            <p className="text-sm text-[#64748b]">
              {setup.isDemo ? data.site.domain : 'Your site'} · {data.totalSessions.toLocaleString()} sessions · Last 30 days
            </p>
          </div>
          <a
            href={`/dashboard/${params.siteId}/report`}
            className="px-4 py-2 bg-[#0c4a6e] hover:bg-[#075985] text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            View Report →
          </a>
        </div>

        <div ref={kpiRef} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <KpiCard label="Total Sessions" value={sessions.toLocaleString()} change={data.totalSessionsChange} baseline="28,400 baseline" />
          <KpiCard label="Avg Intent Score" value={String(intentScore)} suffix="/100" change={data.avgIntentScoreChange} baseline="38 baseline" valueColor={intentScore >= 70 ? '#0d9488' : intentScore >= 40 ? '#b45309' : '#b91c1c'} />
          <KpiCard label="Revenue at Risk" value={`$${revenueRisk.toLocaleString()}`} suffix="/mo" change={-11.1} changeLabel="vs last month" baseline="$43,200 baseline" valueColor="#b91c1c" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#bae6fd] p-6 shadow-sm">
            <h2 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-5">Intent Distribution</h2>
            <IntentChart distribution={data.intentDistribution} />
          </div>
          <div className="lg:col-span-3 bg-white rounded-2xl border border-[#bae6fd] p-6 shadow-sm">
            <h2 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-5">Drop-off Map · AI Analysis</h2>
            <div className="space-y-3">
              {data.dropOffPages.map(page => (
                <DropOffRow key={page.url} page={page} expanded={expanded === page.url} onToggle={() => setExpanded(expanded === page.url ? null : page.url)} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 p-5 bg-white border border-[#bae6fd] rounded-2xl shadow-sm flex items-center justify-between gap-6 flex-wrap">
          <div>
            <p className="text-xs font-bold text-[#b91c1c] uppercase tracking-wider mb-1">Revenue at Risk</p>
            <p className="text-sm text-[#334155] max-w-xl">
              WebGrade has identified <strong className="text-[#0c4a6e]">${data.revenueAtRisk.toLocaleString()}/mo</strong> in recoverable revenue across your behavioral data, ad spend, and SEO profile.
            </p>
          </div>
          <a href={`/dashboard/${params.siteId}/report`} className="flex-shrink-0 px-5 py-2.5 bg-[#0c4a6e] hover:bg-[#075985] text-white text-sm font-bold rounded-xl transition-colors shadow-sm">
            See action plan →
          </a>
        </div>
      </div>
    </div>
  );
}

function HealthBadge({ status }: { status: 'GREEN' | 'YELLOW' | 'RED' }) {
  const config = {
    GREEN:  { bg: 'bg-[#f0fdf4]', border: 'border-[#bbf7d0]', dot: 'bg-[#0d9488]', text: 'text-[#0d9488]', label: 'Healthy' },
    YELLOW: { bg: 'bg-[#fffbeb]', border: 'border-[#fde68a]', dot: 'bg-[#b45309]', text: 'text-[#b45309]', label: 'Attention needed' },
    RED:    { bg: 'bg-[#fef2f2]', border: 'border-[#fecaca]', dot: 'bg-[#b91c1c]', text: 'text-[#b91c1c]', label: 'Issues detected' },
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
    <div className="bg-white border border-[#bae6fd] rounded-2xl p-5 shadow-sm">
      <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-3">{label}</p>
      <p className="text-3xl font-black mb-1" style={{ color: valueColor ?? '#0c4a6e' }}>
        {value}
        {suffix && <span className="text-base font-normal text-[#94a3b8] ml-1">{suffix}</span>}
      </p>
      {baseline && <p className="text-[11px] text-[#94a3b8] mb-2">{baseline}</p>}
      <div className={`flex items-center gap-1 text-xs font-semibold ${positive ? 'text-[#0d9488]' : 'text-[#b91c1c]'}`}>
        <span>{positive ? '↑' : '↓'}</span>
        <span>{Math.abs(change).toFixed(1)}%</span>
        <span className="text-[#94a3b8] font-normal ml-1">{changeLabel ?? 'vs baseline'}</span>
      </div>
    </div>
  );
}

const INTENT_CONFIG: Record<string, { label: string; color: string }> = {
  HIGH:       { label: 'High Intent',  color: '#0d9488' },
  MEDIUM:     { label: 'Medium',       color: '#b45309' },
  LOW:        { label: 'Low Intent',   color: '#b91c1c' },
  RESEARCHER: { label: 'Researcher',   color: '#7c3aed' },
  COMPETITOR: { label: 'Competitor',   color: '#64748b' },
  BOT:        { label: 'Bot/Filtered', color: '#cbd5e1' },
};

function IntentChart({ distribution }: { distribution: IntentDistribution }) {
  const entries = Object.entries(distribution) as Array<[keyof IntentDistribution, number]>;
  const buyingIntent = distribution.HIGH + distribution.MEDIUM;
  return (
    <div className="space-y-3">
      {entries.map(([key, pct]) => {
        const { label, color } = INTENT_CONFIG[key];
        return (
          <div key={key} className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-[#334155]">{label}</span>
                <span className="text-xs font-bold text-[#1e293b]">{pct}%</span>
              </div>
              <div className="h-1.5 bg-[#f0f9ff] rounded-full overflow-hidden border border-[#e0f2fe]">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          </div>
        );
      })}
      <div className="pt-4 border-t border-[#e0f2fe] flex justify-between">
        <span className="text-xs text-[#94a3b8]">6 intent classes</span>
        <span className="text-xs font-semibold text-[#0d9488]">{buyingIntent}% buying intent</span>
      </div>
    </div>
  );
}

function DropOffRow({ page, expanded, onToggle }: { page: DropOffPage; expanded: boolean; onToggle: () => void }) {
  const sev = page.exitRate >= 60 ? 'RED' : page.exitRate >= 40 ? 'YELLOW' : 'GREEN';
  const sevStyle = {
    RED:    'text-[#b91c1c] bg-[#fef2f2] border-[#fecaca]',
    YELLOW: 'text-[#b45309] bg-[#fffbeb] border-[#fde68a]',
    GREEN:  'text-[#0d9488] bg-[#f0fdf4] border-[#bbf7d0]',
  }[sev];
  return (
    <div className="border border-[#bae6fd] rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-4 p-4 hover:bg-[#f0f9ff] transition-colors text-left">
        <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-xs font-black ${sevStyle}`}>{page.exitRate}% exit</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-[#1e293b] truncate">{page.title}</span>
            {page.isStorylineBreakpoint && (
              <span className="px-1.5 py-0.5 bg-[#0c4a6e]/10 text-[#0c4a6e] text-[10px] font-bold rounded flex-shrink-0">Storyline break</span>
            )}
          </div>
          <span className="text-xs text-[#64748b]">{page.url}</span>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-[#64748b] mb-0.5">Scroll depth</p>
          <p className="text-sm font-bold text-[#1e293b]">{page.avgScrollDepth}%</p>
        </div>
        <svg className={`w-4 h-4 text-[#94a3b8] transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && page.aiExplanation && (
        <div className="px-4 pb-4 border-t border-[#e0f2fe]">
          <div className="mt-3 p-4 bg-[#f0f9ff] border border-[#bae6fd] rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-[#0c4a6e] rounded flex items-center justify-center">
                <span className="text-white text-[9px] font-black">AI</span>
              </div>
              <span className="text-xs font-bold text-[#0c4a6e]">WebGrade Analysis</span>
            </div>
            <p className="text-sm text-[#334155] leading-relaxed">{page.aiExplanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
