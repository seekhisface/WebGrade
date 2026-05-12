// The new dashboard front door.
//
// Two tiles above the fold:
//   1. The 3-step funnel — Visitors → Goal Page → Conversions, with deltas
//   2. The #1 fix right now — sourced from the WebAudit during days 1–45,
//      and from rolling WebWatch findings thereafter
//
// Click any funnel number → slide-out detail panel (added in a follow-up
// commit; the cards are already wired to call openSlideOut(step)).
//
// Empty state shows when the site has < 50 sessions collected — surfaces
// the snippet install path so customers don't see "0 / 0 / 0" and bounce.

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types — mirror the API response shape
// ---------------------------------------------------------------------------

interface OverviewData {
  site: { id: string; name: string; domain: string; url: string; subscriptionTier: string };
  range: { start: string; end: string; days: number; label: string };
  funnel: {
    visitors: { count: number; delta: number; deltaPct: number };
    goalPage: { count: number; delta: number; deltaPct: number; reachRate: number; reachRateDelta: number };
    conversions: { count: number; delta: number; deltaPct: number; convertRate: number; convertRateDelta: number };
    overallRate: { rate: number; delta: number };
    goalConfigured: boolean;
    goalUrl: string | null;
    goalName: string | null;
  };
  topFix:
    | {
        available: true;
        source: 'WEBAUDIT' | 'WEBWATCH';
        recommendationId: string;
        title: string;
        finding: string;
        fixAction: string;
        expectedResult: string | null;
        priorityScore: number;
        sourceModule: string;
        dollarImpactPerMonth: number | null;
      }
    | { available: false };
  auditReport: {
    available: boolean;
    reportId: string | null;
    inAuditPeriod: boolean;
    auditEndsAt: string | null;
  };
  emptyState: {
    isEmpty: boolean;
    reason: 'no_sessions' | 'insufficient_data' | null;
    sessionsCollected: number;
    minimumSessions: number;
  };
}

type Range = 7 | 30 | 90;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params?.siteId as string;

  const [days, setDays] = useState<Range>(30);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    fetch(`/api/dashboard/overview?siteId=${siteId}&days=${days}`)
      .then(r => r.ok ? r.json() : r.json().then(b => Promise.reject(b)))
      .then(setData)
      .catch(e => setError(typeof e?.error === 'string' ? e.error : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [siteId, days]);

  // ---- Loading & error ---------------------------------------------------

  if (loading && !data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-slate-200 rounded" />
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-40 bg-slate-100 rounded-2xl" />
            ))}
          </div>
          <div className="h-48 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-red-600">Couldn&apos;t load the overview: {error ?? 'unknown error'}</p>
      </div>
    );
  }

  // ---- Empty state -------------------------------------------------------

  if (data.emptyState.isEmpty) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <OverviewHeader site={data.site} days={days} onDaysChange={setDays} />
        <EmptyState
          siteId={siteId}
          sessionsCollected={data.emptyState.sessionsCollected}
          minimumSessions={data.emptyState.minimumSessions}
        />
      </div>
    );
  }

  // ---- Main render -------------------------------------------------------

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <OverviewHeader site={data.site} days={days} onDaysChange={setDays} />

      {/* Goal-not-configured nudge */}
      {!data.funnel.goalConfigured && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">No conversion goal page set yet.</p>
          <p className="mt-1">
            Set the page that signals a successful conversion (your demo/signup page) in{' '}
            <Link href={`/dashboard/${siteId}/settings`} className="underline">
              Settings
            </Link>{' '}
            so we can show you the middle step of the funnel.
          </p>
        </div>
      )}

      {/* THE FUNNEL */}
      <FunnelRow data={data.funnel} siteId={siteId} router={router} />

      {/* THE #1 FIX */}
      <TopFixTile fix={data.topFix} audit={data.auditReport} siteId={siteId} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header — site name + range selector
// ---------------------------------------------------------------------------

function OverviewHeader({
  site, days, onDaysChange,
}: {
  site: OverviewData['site'];
  days: Range;
  onDaysChange: (d: Range) => void;
}) {
  return (
    <div className="flex items-end justify-between mb-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-[#4a9ebe] mb-1">Overview</p>
        <h1 className="text-3xl font-bold text-[#082f49]">{site.name}</h1>
      </div>
      <RangePicker value={days} onChange={onDaysChange} />
    </div>
  );
}

function RangePicker({ value, onChange }: { value: Range; onChange: (d: Range) => void }) {
  const options: { value: Range; label: string }[] = [
    { value: 7, label: 'Last 7 days' },
    { value: 30, label: 'Last 30 days' },
    { value: 90, label: 'Last 90 days' },
  ];
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white overflow-hidden text-sm">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 transition-colors ${
            value === o.value
              ? 'bg-[#0c4a6e] text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnel — 3 click-through cards
// ---------------------------------------------------------------------------

function FunnelRow({
  data, siteId, router,
}: {
  data: OverviewData['funnel'];
  siteId: string;
  router: ReturnType<typeof useRouter>;
}) {
  // Slide-out panels land in a follow-up commit. For now each card routes
  // into the closest existing detail page so the click does *something*
  // useful and we don't ship dead UI.
  function openVisitorsDetail() {
    router.push(`/dashboard/${siteId}/admin/sessions`);
  }
  function openGoalPageDetail() {
    router.push(`/dashboard/${siteId}`);
  }
  function openConversionsDetail() {
    router.push(`/dashboard/${siteId}/settings`);
  }

  return (
    <div className="mb-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FunnelCard
          label="Visitors"
          value={data.visitors.count}
          delta={data.visitors.deltaPct}
          deltaLabel={`${data.visitors.delta >= 0 ? '+' : ''}${data.visitors.delta} vs prior`}
          onClick={openVisitorsDetail}
        />

        <FunnelCard
          label={data.goalName ?? 'Goal Page'}
          value={data.goalPage.count}
          subValue={data.goalConfigured ? `${data.goalPage.reachRate.toFixed(1)}% reach` : 'no goal set'}
          delta={data.goalPage.reachRateDelta}
          deltaLabel={
            data.goalConfigured
              ? `${data.goalPage.reachRateDelta >= 0 ? '+' : ''}${data.goalPage.reachRateDelta} pts`
              : ''
          }
          isPts
          onClick={openGoalPageDetail}
          dimmed={!data.goalConfigured}
        />

        <FunnelCard
          label="Converted"
          value={data.conversions.count}
          subValue={data.goalPage.count > 0 ? `${data.conversions.convertRate.toFixed(1)}% convert` : undefined}
          delta={data.conversions.delta}
          deltaLabel={`${data.conversions.delta >= 0 ? '+' : ''}${data.conversions.delta} vs prior`}
          isCount
          onClick={openConversionsDetail}
        />
      </div>

      {/* Overall funnel summary line */}
      {data.goalConfigured && (
        <p className="text-center mt-3 text-sm text-slate-500">
          <span className="font-medium text-[#082f49]">{data.overallRate.rate.toFixed(2)}%</span>{' '}
          overall conversion{' '}
          <span className={data.overallRate.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}>
            {data.overallRate.delta >= 0 ? '▲' : '▼'} {Math.abs(data.overallRate.delta).toFixed(2)} pts
          </span>{' '}
          vs prior period
        </p>
      )}
    </div>
  );
}

function FunnelCard({
  label, value, subValue, delta, deltaLabel, onClick, dimmed, isPts, isCount,
}: {
  label: string;
  value: number;
  subValue?: string;
  delta: number;
  deltaLabel: string;
  onClick: () => void;
  dimmed?: boolean;
  isPts?: boolean;
  isCount?: boolean;
}) {
  const isUp = delta > 0;
  const isFlat = delta === 0;

  return (
    <button
      onClick={onClick}
      disabled={dimmed}
      className={`text-left rounded-2xl border bg-white p-6 transition-all ${
        dimmed
          ? 'border-slate-200 opacity-60 cursor-not-allowed'
          : 'border-slate-200 hover:border-sky-400 hover:shadow-md cursor-pointer'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">{label}</p>
      <p className="text-4xl font-bold text-[#082f49] tabular-nums">{value.toLocaleString()}</p>
      {subValue && <p className="text-sm text-slate-500 mt-1">{subValue}</p>}
      {deltaLabel && (
        <p
          className={`text-sm mt-3 font-medium ${
            isFlat ? 'text-slate-400' : isUp ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {isFlat ? '—' : isUp ? '▲' : '▼'} {deltaLabel}
        </p>
      )}
      {/* Suppress unused-var warnings without printing anything */}
      <span className="hidden">{isPts ? '' : ''}{isCount ? '' : ''}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// #1 Fix tile
// ---------------------------------------------------------------------------

function TopFixTile({
  fix, audit, siteId,
}: {
  fix: OverviewData['topFix'];
  audit: OverviewData['auditReport'];
  siteId: string;
}) {
  if (!fix.available) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">
          Once we&apos;ve generated your first audit report you&apos;ll see the highest-impact
          fix here with an estimated dollar impact.
        </p>
        {audit.available && audit.reportId && (
          <Link
            href={`/dashboard/${siteId}/report`}
            className="inline-block mt-3 text-sm text-[#0c4a6e] underline"
          >
            Read your audit report →
          </Link>
        )}
      </div>
    );
  }

  const sourceLabel = fix.source === 'WEBAUDIT' ? '45-day audit finding' : 'WebWatch finding';

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
          🔥 The #1 fix right now
        </p>
        <span className="text-[10px] uppercase tracking-wider text-amber-700/80 bg-white border border-amber-200 px-2 py-0.5 rounded-full">
          {sourceLabel}
        </span>
      </div>

      <h2 className="text-lg font-semibold text-[#082f49] mb-2">{fix.title}</h2>
      <p className="text-sm text-slate-700 leading-relaxed mb-3">{fix.finding}</p>
      <p className="text-sm text-slate-700 leading-relaxed">
        <span className="font-medium">Fix:</span> {fix.fixAction}
      </p>

      {fix.dollarImpactPerMonth != null && fix.dollarImpactPerMonth > 0 && (
        <p className="text-sm text-amber-900 mt-3">
          <span className="font-semibold">Estimated impact:</span> +$
          {fix.dollarImpactPerMonth.toLocaleString()}/mo if fixed
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-5">
        <Link
          href={`/dashboard/${siteId}/report`}
          className="inline-flex items-center gap-1 bg-[#0c4a6e] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#082f49] transition-colors"
        >
          See drop-off detail
          <span aria-hidden>→</span>
        </Link>
        <Link
          href={`/dashboard/${siteId}/report`}
          className="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
        >
          How to fix this
          <span aria-hidden>→</span>
        </Link>
      </div>

      {audit.available && audit.reportId && (
        <div className="mt-5 pt-4 border-t border-amber-200/60">
          <Link
            href={`/dashboard/${siteId}/report`}
            className="text-sm text-[#0c4a6e] underline"
          >
            Read your full 45-day audit →
          </Link>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  siteId, sessionsCollected, minimumSessions,
}: {
  siteId: string;
  sessionsCollected: number;
  minimumSessions: number;
}) {
  const pct = Math.min(100, Math.round((sessionsCollected / minimumSessions) * 100));
  const isNoData = sessionsCollected === 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <div className="max-w-md mx-auto">
        <div className="text-5xl mb-3">{isNoData ? '👋' : '⏳'}</div>
        <h2 className="text-xl font-semibold text-[#082f49] mb-2">
          {isNoData ? "Your funnel will appear here" : 'Collecting data…'}
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          {isNoData
            ? `Once the WebGrade snippet is installed and we've collected about ${minimumSessions} sessions, your three-step funnel will show up automatically.`
            : `We've collected ${sessionsCollected} of ~${minimumSessions} sessions needed for a meaningful funnel. Check back soon.`}
        </p>

        {!isNoData && (
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-6">
            <div
              className="bg-[#0c4a6e] h-2 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href={`/dashboard/${siteId}/snippet`}
            className="inline-flex items-center gap-1 bg-[#0c4a6e] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#082f49] transition-colors"
          >
            {isNoData ? 'Install the snippet' : 'View snippet status'}
            <span aria-hidden>→</span>
          </Link>
          <Link
            href={`/dashboard/${siteId}/settings`}
            className="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Set your conversion goal
            <span aria-hidden>→</span>
          </Link>
        </div>

        {/* Greyed-out sample funnel preview */}
        <div className="mt-10 opacity-30 select-none pointer-events-none">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Visitors', value: '5,432' },
              { label: 'Goal Page', value: '387' },
              { label: 'Converted', value: '61' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">{s.label}</p>
                <p className="text-2xl font-bold text-slate-400 mt-1">{s.value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">sample preview</p>
        </div>
      </div>
    </div>
  );
}
