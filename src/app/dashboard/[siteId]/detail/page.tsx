// The Detail page — one canvas, five sections organized by customer
// question (not product line):
//
//   Traffic · Engagement · Conversion · SEO · Market
//
// A sticky section nav at the top jumps between them. Each section is
// intentionally lean — top-N lists, a few headline metrics. Anything
// that needs a full deep-dive view links out to its existing dedicated
// page (Sessions admin, full SEO crawl, WebOpp analysis).

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types (mirror the API)
// ---------------------------------------------------------------------------

interface DetailData {
  site: { id: string; name: string };
  range: { days: number; start: string; end: string };
  traffic: {
    totalSessions: number;
    sources: { source: string; count: number; pct: number }[];
    topEntryPages: { page: string; count: number }[];
    countries: { country: string; count: number }[];
    devices: { device: string; count: number }[];
    campaigns: { campaign: string; sessions: number; stale: boolean }[];
    staleCampaignCount: number;
  };
  engagement: {
    bounceRate: number;
    avgDurationSec: number;
    medianDurationSec: number;
    avgIntentScore: number;
    intentDistribution: { HIGH: number; MEDIUM: number; LOW: number; NONE: number };
    topRageClickPages: { page: string; count: number }[];
  };
  conversion: {
    goalConfigured: boolean;
    goalName: string | null;
    funnel: { visitors: number; ctaClicks: number; reachedGoalPage: number; converted: number };
    conversionsBySource: { source: string; label: string; count: number }[];
    totalConversionEvents: number;
  };
  seo: {
    connected: boolean;
    lastSyncAt: string | null;
    health: {
      overall: string; snippet: string; conversionGoal: string; utm: string;
      duplicate: string; consent: string; bot: string; pageSpeed: string;
      lighthouseLcp: number | null; lighthouseCls: number | null;
      lighthouseFid: number | null; lighthouseScore: number | null;
      estimatedBotPercent: number | null;
      checkedAt: string | null;
    } | null;
  };
  market: {
    hasAnalysis: boolean;
    lastAnalysisAt: string | null;
    totalMissedRevenuePerMonth: number | null;
    totalOpportunitiesFound: number | null;
    topClusterName: string | null;
    gaps: {
      cluster: string; keyword: string;
      searchVolume: number | null;
      currentRank: number | null;
      competitorRank: number | null;
      competitorUrl: string | null;
      missedClicks: number | null;
      missedRevenue: number | null;
      decision: string | null;
    }[];
  };
}

type Range = 7 | 30 | 90;

const SECTIONS = [
  { id: 'traffic',    label: 'Traffic' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'conversion', label: 'Conversion' },
  { id: 'seo',        label: 'SEO' },
  { id: 'market',     label: 'Market' },
] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DetailPage() {
  const params = useParams();
  const siteId = params?.siteId as string;

  const [days, setDays] = useState<Range>(30);
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    fetch(`/api/dashboard/detail?siteId=${siteId}&days=${days}`)
      .then(r => r.ok ? r.json() : r.json().then(b => Promise.reject(b)))
      .then(setData)
      .catch(e => setError(typeof e?.error === 'string' ? e.error : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [siteId, days]);

  if (loading && !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-slate-200 rounded" />
          <div className="h-12 bg-slate-100 rounded" />
          <div className="h-72 bg-slate-100 rounded-2xl" />
          <div className="h-72 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <p className="text-red-600">Couldn&apos;t load detail: {error ?? 'unknown error'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#4a9ebe] mb-1">Detail</p>
          <h1 className="text-3xl font-bold text-[#082f49]">{data.site.name}</h1>
        </div>
        <RangePicker value={days} onChange={setDays} />
      </div>

      {/* Sticky section nav */}
      <nav className="sticky top-14 z-30 bg-[#f0f9ff] py-3 -mx-4 px-4 mb-8 border-b border-slate-200">
        <div className="flex flex-wrap gap-2 text-sm">
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-700 hover:border-sky-400 hover:text-[#0c4a6e] transition-colors"
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      {/* Sections */}
      <div className="space-y-16">
        <TrafficSection data={data.traffic} siteId={siteId} />
        <EngagementSection data={data.engagement} siteId={siteId} />
        <ConversionSection data={data.conversion} siteId={siteId} />
        <SeoSection data={data.seo} siteId={siteId} />
        <MarketSection data={data.market} siteId={siteId} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

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
            value === o.value ? 'bg-[#0c4a6e] text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SectionHeader({ id, label, subtitle, action }: {
  id: string; label: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div id={id} className="flex items-end justify-between mb-4 scroll-mt-32">
      <div>
        <h2 className="text-2xl font-semibold text-[#082f49]">{label}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function HBar({ rows, valueFmt }: {
  rows: { label: string; value: number; sub?: string; flag?: string }[];
  valueFmt?: (v: number) => string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-400 py-4">No data.</p>;
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="flex items-center justify-between text-xs text-slate-700 mb-1">
            <span className="truncate pr-2 flex items-center gap-2" title={r.label}>
              {r.label}
              {r.flag && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">{r.flag}</span>}
            </span>
            <span className="font-medium tabular-nums">
              {valueFmt ? valueFmt(r.value) : r.value.toLocaleString()}
              {r.sub && <span className="text-slate-400 ml-1">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-2 bg-[#0c4a6e] rounded-full" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCards({ stats }: { stats: { label: string; value: string; sub?: string }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">{s.label}</p>
          <p className="text-xl font-bold text-[#082f49] mt-1 tabular-nums">{s.value}</p>
          {s.sub && <p className="text-xs text-slate-400 mt-1">{s.sub}</p>}
        </div>
      ))}
    </div>
  );
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      {children}
    </div>
  );
}

function HealthBadge({ status }: { status: string }) {
  const color =
    status === 'GREEN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : status === 'YELLOW' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : status === 'RED' ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-slate-50 text-slate-500 border-slate-200';
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${color}`}>
      {status}
    </span>
  );
}

function fmtDuration(sec: number) {
  if (sec <= 0) return '0s';
  const m = Math.floor(sec / 60); const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ---------------------------------------------------------------------------
// 1) Traffic
// ---------------------------------------------------------------------------

function TrafficSection({ data, siteId }: { data: DetailData['traffic']; siteId: string }) {
  return (
    <section>
      <SectionHeader
        id="traffic"
        label="Traffic"
        subtitle="Where your visitors come from and how they enter the site."
        action={
          <Link href={`/dashboard/${siteId}/admin/sessions`} className="text-sm text-[#0c4a6e] underline">
            Full session log →
          </Link>
        }
      />
      <StatCards
        stats={[
          { label: 'Sessions', value: data.totalSessions.toLocaleString() },
          { label: 'Top source', value: data.sources[0]?.source ?? '—', sub: data.sources[0] ? `${data.sources[0].pct}%` : undefined },
          { label: 'Top entry page', value: data.topEntryPages[0]?.page ?? '—' },
          { label: 'Stale UTM tags', value: data.staleCampaignCount.toString() },
        ]}
      />
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <Panel>
          <h3 className="text-sm font-semibold text-[#082f49] mb-3">Sources</h3>
          <HBar rows={data.sources.map(s => ({
            label: s.source.charAt(0).toUpperCase() + s.source.slice(1),
            value: s.count, sub: `(${s.pct}%)`,
          }))} />
        </Panel>
        <Panel>
          <h3 className="text-sm font-semibold text-[#082f49] mb-3">Top entry pages</h3>
          <HBar rows={data.topEntryPages.map(p => ({ label: p.page, value: p.count }))} />
        </Panel>
        <Panel>
          <h3 className="text-sm font-semibold text-[#082f49] mb-3">Top countries</h3>
          <HBar rows={data.countries.map(c => ({ label: c.country, value: c.count }))} />
        </Panel>
        <Panel>
          <h3 className="text-sm font-semibold text-[#082f49] mb-3">Devices</h3>
          <HBar rows={data.devices.map(d => ({
            label: d.device.charAt(0).toUpperCase() + d.device.slice(1), value: d.count,
          }))} />
        </Panel>
        {data.campaigns.length > 0 && (
          <Panel className="md:col-span-2">
            <h3 className="text-sm font-semibold text-[#082f49] mb-3">UTM campaigns</h3>
            <HBar rows={data.campaigns.map(c => ({
              label: c.campaign, value: c.sessions, flag: c.stale ? 'STALE' : undefined,
            }))} />
          </Panel>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2) Engagement
// ---------------------------------------------------------------------------

function EngagementSection({ data, siteId }: { data: DetailData['engagement']; siteId: string }) {
  return (
    <section>
      <SectionHeader
        id="engagement"
        label="Engagement"
        subtitle="What visitors actually do once they arrive."
        action={
          <Link href={`/dashboard/${siteId}`} className="text-sm text-[#0c4a6e] underline">
            See behavioral detail →
          </Link>
        }
      />
      <StatCards
        stats={[
          { label: 'Bounce rate', value: `${data.bounceRate.toFixed(1)}%` },
          { label: 'Avg session', value: fmtDuration(data.avgDurationSec) },
          { label: 'Median session', value: fmtDuration(data.medianDurationSec) },
          { label: 'Avg intent score', value: data.avgIntentScore.toFixed(1) },
        ]}
      />
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <Panel>
          <h3 className="text-sm font-semibold text-[#082f49] mb-3">Intent distribution</h3>
          <HBar rows={[
            { label: 'High intent',   value: data.intentDistribution.HIGH },
            { label: 'Medium intent', value: data.intentDistribution.MEDIUM },
            { label: 'Low intent',    value: data.intentDistribution.LOW },
            { label: 'Not scored',    value: data.intentDistribution.NONE },
          ]} />
        </Panel>
        <Panel>
          <h3 className="text-sm font-semibold text-[#082f49] mb-3">Top rage-click pages</h3>
          <HBar rows={data.topRageClickPages.map(p => ({ label: p.page, value: p.count }))} />
        </Panel>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3) Conversion
// ---------------------------------------------------------------------------

function ConversionSection({ data, siteId }: { data: DetailData['conversion']; siteId: string }) {
  const f = data.funnel;
  const ctaRate = f.visitors > 0 ? +((f.ctaClicks / f.visitors) * 100).toFixed(1) : 0;
  const reachRate = f.visitors > 0 ? +((f.reachedGoalPage / f.visitors) * 100).toFixed(1) : 0;
  const convertRate = f.reachedGoalPage > 0 ? +((f.converted / f.reachedGoalPage) * 100).toFixed(1) : 0;

  return (
    <section>
      <SectionHeader
        id="conversion"
        label="Conversion"
        subtitle={data.goalConfigured ? `Goal: ${data.goalName ?? 'set in Settings'}` : 'No goal page configured yet.'}
        action={
          <Link href={`/dashboard/${siteId}/settings`} className="text-sm text-[#0c4a6e] underline">
            Conversion setup →
          </Link>
        }
      />

      {/* Funnel exploded */}
      <Panel className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FunnelStep label="Visitors" value={f.visitors.toLocaleString()} pct={null} />
          <FunnelStep label="CTA clicks" value={f.ctaClicks.toLocaleString()} pct={`${ctaRate}% of visitors`} />
          <FunnelStep label="Reached goal page" value={f.reachedGoalPage.toLocaleString()} pct={`${reachRate}% of visitors`} />
          <FunnelStep label="Converted" value={f.converted.toLocaleString()} pct={`${convertRate}% of reachers`} />
        </div>
      </Panel>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel>
          <h3 className="text-sm font-semibold text-[#082f49] mb-3">Conversions by source</h3>
          <HBar rows={data.conversionsBySource.map(s => ({ label: s.label, value: s.count }))} />
        </Panel>
        <Panel>
          <h3 className="text-sm font-semibold text-[#082f49] mb-3">Why this matters</h3>
          <p className="text-sm text-slate-600">
            Each source shows where conversions are actually landing — form auto-detection,
            Calendly bookings, HubSpot submits, or manual API calls. If one source is zero
            and you expect it to fire, your tracking setup probably needs attention.
          </p>
          <Link href={`/dashboard/${siteId}/settings`} className="inline-block text-sm text-[#0c4a6e] underline mt-3">
            Check tracking setup →
          </Link>
        </Panel>
      </div>
    </section>
  );
}

function FunnelStep({ label, value, pct }: { label: string; value: string; pct: string | null }) {
  return (
    <div className="text-center">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-[#082f49] mt-1 tabular-nums">{value}</p>
      {pct && <p className="text-xs text-slate-400 mt-1">{pct}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4) SEO
// ---------------------------------------------------------------------------

function SeoSection({ data, siteId }: { data: DetailData['seo']; siteId: string }) {
  return (
    <section>
      <SectionHeader
        id="seo"
        label="SEO"
        subtitle="Site health and search-readiness."
        action={
          <Link href={`/dashboard/${siteId}/seo`} className="text-sm text-[#0c4a6e] underline">
            Full SEO dashboard →
          </Link>
        }
      />
      {!data.health ? (
        <Panel>
          <p className="text-sm text-slate-500">
            No health check has run yet. Once your audit completes, signals appear here.
          </p>
        </Panel>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#082f49]">Health checks</h3>
              <HealthBadge status={data.health.overall} />
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Snippet', data.health.snippet],
                ['Conversion goal', data.health.conversionGoal],
                ['UTM preservation', data.health.utm],
                ['Duplicate scripts', data.health.duplicate],
                ['Consent banner', data.health.consent],
                ['Bot traffic', data.health.bot],
                ['Page speed', data.health.pageSpeed],
              ].map(([label, status]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-slate-600">{label}</span>
                  <HealthBadge status={status as string} />
                </div>
              ))}
            </div>
          </Panel>
          <Panel>
            <h3 className="text-sm font-semibold text-[#082f49] mb-3">Core Web Vitals</h3>
            <div className="space-y-3 text-sm">
              <CwvRow label="LCP" value={data.health.lighthouseLcp != null ? `${data.health.lighthouseLcp.toFixed(2)}s` : '—'} good="< 2.5s" />
              <CwvRow label="FID" value={data.health.lighthouseFid != null ? `${data.health.lighthouseFid.toFixed(0)}ms` : '—'} good="< 100ms" />
              <CwvRow label="CLS" value={data.health.lighthouseCls != null ? data.health.lighthouseCls.toFixed(3) : '—'} good="< 0.1" />
              <CwvRow label="Lighthouse" value={data.health.lighthouseScore != null ? `${data.health.lighthouseScore}/100` : '—'} good="≥ 90" />
            </div>
          </Panel>
        </div>
      )}
    </section>
  );
}

function CwvRow({ label, value, good }: { label: string; value: string; good: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums">
        <span className="font-medium text-[#082f49]">{value}</span>
        <span className="text-slate-400 ml-2 text-xs">good: {good}</span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5) Market
// ---------------------------------------------------------------------------

function MarketSection({ data, siteId }: { data: DetailData['market']; siteId: string }) {
  return (
    <section>
      <SectionHeader
        id="market"
        label="Market"
        subtitle="Where competitors are beating you in search."
        action={
          <Link href={`/dashboard/${siteId}/webopp`} className="text-sm text-[#0c4a6e] underline">
            Full WebOpp analysis →
          </Link>
        }
      />
      {!data.hasAnalysis ? (
        <Panel>
          <p className="text-sm text-slate-500">
            No WebOpp analysis has run yet. Once we&apos;ve compared your site against
            competitors for keyword opportunities, results appear here.
          </p>
          <Link href={`/dashboard/${siteId}/webopp`} className="inline-block text-sm text-[#0c4a6e] underline mt-3">
            Run an analysis →
          </Link>
        </Panel>
      ) : (
        <>
          <StatCards
            stats={[
              { label: 'Opportunities found', value: (data.totalOpportunitiesFound ?? 0).toLocaleString() },
              { label: 'Missed revenue / mo', value: data.totalMissedRevenuePerMonth != null ? `$${Math.round(data.totalMissedRevenuePerMonth).toLocaleString()}` : '—' },
              { label: 'Top cluster', value: data.topClusterName ?? '—' },
              { label: 'Last analyzed', value: data.lastAnalysisAt ? new Date(data.lastAnalysisAt).toLocaleDateString() : '—' },
            ]}
          />
          <Panel className="mt-4">
            <h3 className="text-sm font-semibold text-[#082f49] mb-3">Top keyword gaps</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-3 font-medium text-slate-500">Keyword</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">Volume</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">You</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500">Competitor</th>
                    <th className="text-right py-2 pl-3 font-medium text-slate-500">$ missed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gaps.map((g, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 text-slate-700">{g.keyword}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-700">{g.searchVolume?.toLocaleString() ?? '—'}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-700">{g.currentRank ?? '—'}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-700">{g.competitorRank ?? '—'}</td>
                      <td className="py-2 pl-3 text-right tabular-nums text-slate-700">
                        {g.missedRevenue != null ? `$${Math.round(g.missedRevenue).toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </section>
  );
}
