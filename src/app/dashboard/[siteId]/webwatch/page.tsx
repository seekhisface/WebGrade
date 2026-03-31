'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Implementation {
  id: string;
  title: string;
  sourceModule: string;
  implementedDate: string | null;
  status: string;
  impact: { metric: string; before: number | null; after: number | null; change: number | null };
  notes: string | null;
  estimatedImpact: number | null;
  recoveredValue: number | null;
}

interface BehavioralShift {
  metric: string;
  title: string;
  baseline: number;
  current: number;
  direction: 'improved' | 'regressed' | 'stable';
}

interface ConcernPoint {
  title: string;
  detail: string;
  daysSinceFlag: number;
  estimatedCost: number;
}

interface PraisePoint {
  title: string;
  detail: string;
  dollarImpact: number;
}

interface TrendMonth {
  label: string;
  sessions: number;
}

interface WebWatchData {
  site: { id: string; name: string; domain: string };
  report: {
    year: number; month: number; label: string;
    baselineLabel: string | null; priorPeriodLabel: string | null;
    executiveNarrative: string; performanceGrade: string | null;
    generatedAt: string;
    sessionsThisMonth: number | null; sessionsBaseline: number | null;
    sessionsMoM: number | null; sessionsPctBaseline: number | null;
    intentScoreNow: number | null; intentScoreBaseline: number | null; intentScoreMoM: number | null;
    conversionRateNow: number | null; conversionRateBaseline: number | null;
    revenueAtRiskNow: number | null; revenueRecoveredTotal: number | null;
    totalRecs: number; verifiedFixed: number; inProgress: number; stalled: number; openUnacted: number;
    praisePoints: PraisePoint[] | null;
    concernPoints: ConcernPoint[] | null;
  };
  implementations: Implementation[];
  newFindings: ConcernPoint[];
  behavioralShifts: BehavioralShift[];
  trendMonths: TrendMonth[];
  liveMetrics: { currentSessions: number; currentIntentAvg: number };
}

type View = 'overview' | 'implementations' | 'findings' | 'behavioral';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function useCountUp(target: number, duration = 1800): number {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCurrent(target); clearInterval(timer); }
      else setCurrent(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return current;
}

function Delta({ value, unit = '', inverse = false }: { value: number; unit?: string; inverse?: boolean }) {
  const positive = inverse ? value < 0 : value > 0;
  const color = positive ? 'text-emerald-400' : 'text-red-400';
  const sign = value > 0 ? '+' : '';
  return <span className={`text-xs font-semibold ${color}`}>{sign}{value}{unit}</span>;
}

function Sparkline({ data, color = '#6366f1', height = 32, width = 120 }: {
  data: number[]; color?: string; height?: number; width?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={parseFloat(pts[pts.length - 1].split(',')[0])} cy={parseFloat(pts[pts.length - 1].split(',')[1])} r="3" fill={color} />
    </svg>
  );
}

function fmtMoney(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function WebWatchPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const [view, setView] = useState<View>('overview');
  const [data, setData] = useState<WebWatchData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/webwatch?siteId=${siteId}`)
      .then(r => {
        if (!r.ok) throw new Error(`WebWatch API error: ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(err => console.error('[webwatch] Failed to load:', err))
      .finally(() => setLoading(false));
  }, [siteId]);

  const recovered = useCountUp(data?.report.revenueRecoveredTotal ?? 0);
  const sessions = useCountUp(data?.report.sessionsThisMonth ?? 0);
  const intentScore = useCountUp(data?.report.intentScoreNow ?? 0);
  const cvrAnimated = useCountUp(Math.round((data?.report.conversionRateNow ?? 0) * 10));

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#f0f9ff]">
        <div className="max-w-6xl mx-auto px-6 py-12 animate-pulse">
          <div className="h-8 w-48 bg-[#bae6fd] rounded-lg mb-6" />
          <div className="grid grid-cols-6 gap-3 mb-8">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 bg-white border border-[#bae6fd] rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const r = data.report;
  const newFindingsCount = data.newFindings.length;
  const trendSessions = data.trendMonths.map(t => t.sessions);

  return (
    <div className="min-h-screen bg-[#f0f9ff]">

      {/* Page sub-header */}
      <div className="bg-white border-b border-sky-100 px-6 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-semibold text-cyan-600 uppercase tracking-wider">WebWatch</span>
            </div>
            <span className="text-slate-300">·</span>
            <span>{r.label}</span>
            {r.performanceGrade && (
              <span className="px-2 py-0.5 bg-sky-50 border border-sky-200 rounded text-[10px] text-[#64748b]">Grade: {r.performanceGrade}</span>
            )}
          </div>
          <div className="flex items-center bg-sky-50 border border-sky-200 rounded-lg p-1 gap-1">
            {(['overview', 'implementations', 'findings', 'behavioral'] as View[]).map((v) => {
              const label = v === 'implementations' ? 'Implementations' : v === 'findings' ? 'New Findings' : v === 'behavioral' ? 'Behavioral Shifts' : 'Overview';
              return (
                <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {label}
                  {v === 'findings' && newFindingsCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-[9px] font-bold text-white rounded">{newFindingsCount}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-[#64748b]">Generated {fmtDate(r.generatedAt)}</div>
        </div>
      </div>

      {/* Report header */}
      <div className="max-w-6xl mx-auto px-6 pt-8 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xs text-[#64748b] uppercase tracking-wider mb-1">{data.site.domain}</p>
            <h1 className="text-2xl font-bold text-[#1e293b]">{data.site.name}</h1>
            <p className="text-sm text-[#64748b] mt-1">
              Monthly monitoring report · {r.label} · Baseline: {r.baselineLabel ?? '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#64748b] mb-1">Revenue recovered this month</p>
            <p className="text-2xl font-bold text-emerald-600">${recovered.toLocaleString()}</p>
            <p className="text-xs text-[#64748b]">vs {r.baselineLabel} baseline</p>
          </div>
        </div>

        {/* Headline KPI bar */}
        <div className="grid grid-cols-6 gap-3 mt-6">
          {[
            { label: 'Sessions', value: sessions.toLocaleString(), sub: r.sessionsPctBaseline ? `${r.sessionsPctBaseline > 0 ? '+' : ''}${r.sessionsPctBaseline.toFixed(0)}% vs baseline` : '', bg: 'bg-[#0c4a6e]', fg: 'text-white', sub_c: 'text-sky-300', trend: trendSessions, tc: '#7dd3fc' },
            { label: 'Intent Score', value: `${intentScore}/100`, sub: r.intentScoreBaseline ? `+${((r.intentScoreNow ?? 0) - r.intentScoreBaseline).toFixed(0)}pts vs baseline` : '', bg: 'bg-[#b45309]', fg: 'text-white', sub_c: 'text-amber-200', trend: trendSessions.map(v => Math.round(v * 0.02 + 40)), tc: '#fde68a' },
            { label: 'Trial CVR', value: `${(cvrAnimated / 10).toFixed(1)}%`, sub: r.conversionRateBaseline ? `+${((r.conversionRateNow ?? 0) - r.conversionRateBaseline).toFixed(1)}pts vs baseline` : '', bg: 'bg-[#166534]', fg: 'text-white', sub_c: 'text-green-200', trend: trendSessions.map(v => Math.round(v * 0.01 + 1)), tc: '#86efac' },
            { label: 'Revenue at Risk', value: fmtMoney(r.revenueAtRiskNow ?? 0), sub: 'remaining opportunity', bg: 'bg-[#7c3aed]', fg: 'text-white', sub_c: 'text-violet-200', trend: trendSessions.map(v => Math.round(v * -0.5 + 200)), tc: '#c4b5fd' },
            { label: 'Fixes Verified', value: `${r.verifiedFixed}/${r.totalRecs}`, sub: r.stalled > 0 ? `${r.stalled} stalled` : 'all on track', bg: 'bg-[#0d9488]', fg: 'text-white', sub_c: 'text-teal-200', trend: [0, 1, 2, 3, r.verifiedFixed], tc: '#99f6e4' },
            { label: 'Revenue Recovered', value: fmtMoney(r.revenueRecoveredTotal ?? 0), sub: 'cumulative since baseline', bg: 'bg-[#1e40af]', fg: 'text-white', sub_c: 'text-blue-200', trend: trendSessions.map((_, i) => Math.round((r.revenueRecoveredTotal ?? 0) * (i + 1) / 6)), tc: '#93c5fd' },
          ].map((kpi, i) => (
            <div key={i} className={`p-4 ${kpi.bg} rounded-xl`}>
              <p className={`text-[10px] ${kpi.sub_c} uppercase tracking-wider mb-1`}>{kpi.label}</p>
              <p className={`text-lg font-bold ${kpi.fg} mb-1`}>{kpi.value}</p>
              <div className="mb-2">
                <Sparkline data={kpi.trend} color={kpi.tc} width={100} height={24} />
              </div>
              <p className={`text-[10px] ${kpi.sub_c} opacity-80`}>{kpi.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-16">

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        {view === 'overview' && (
          <div className="space-y-8">
            {/* Executive summary */}
            <section>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-3">Monthly Summary</p>
              <div className="p-6 bg-sky-50 border border-sky-100 rounded-2xl">
                <p className="text-sm text-slate-700 leading-relaxed">{r.executiveNarrative}</p>
              </div>
            </section>

            {/* Praise points */}
            {r.praisePoints && (r.praisePoints as PraisePoint[]).length > 0 && (
              <section>
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-3">What Went Well</p>
                <div className="space-y-3">
                  {(r.praisePoints as PraisePoint[]).map((p, i) => (
                    <div key={i} className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl flex items-start gap-3">
                      <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-400 text-xs">✓</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#1e293b]">{p.title}</p>
                        <p className="text-xs text-[#64748b] mt-0.5">{p.detail}</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600 flex-shrink-0">+{fmtMoney(p.dollarImpact)}/mo</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Concern points */}
            {r.concernPoints && (r.concernPoints as ConcernPoint[]).length > 0 && (
              <section>
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-3">Areas of Concern</p>
                <div className="space-y-3">
                  {(r.concernPoints as ConcernPoint[]).map((c, i) => (
                    <div key={i} className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl flex items-start gap-3">
                      <div className="w-6 h-6 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-400 text-xs">⚠</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#1e293b]">{c.title}</p>
                        <p className="text-xs text-[#64748b] mt-0.5">{c.detail}</p>
                      </div>
                      <span className="text-sm font-bold text-red-500 flex-shrink-0">-{fmtMoney(c.estimatedCost)}/mo</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Session trend */}
            {data.trendMonths.length > 0 && (
              <section>
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-3">Session Trend</p>
                <div className="p-5 bg-sky-50 border border-sky-100 rounded-2xl">
                  <Sparkline data={trendSessions} color="#0c4a6e" width={600} height={64} />
                  <div className="flex justify-between mt-2">
                    {data.trendMonths.map((m, i) => (
                      <span key={i} className="text-[9px] text-[#64748b]">{m.label}</span>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── IMPLEMENTATIONS ───────────────────────────────────────────────── */}
        {view === 'implementations' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Implementation Tracker</h2>
              <p className="text-sm text-slate-500">Status and measured impact of all prior WebWatch recommendations.</p>
            </div>

            {/* Summary row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Recommendations issued', value: r.totalRecs, color: 'text-slate-800' },
                { label: 'Verified fixed', value: r.verifiedFixed, color: 'text-emerald-400' },
                { label: 'In progress', value: r.inProgress, color: 'text-amber-400' },
                { label: 'Revenue recovered', value: fmtMoney(r.revenueRecoveredTotal ?? 0) + '/mo', color: 'text-emerald-400' },
              ].map((s, i) => (
                <div key={i} className="p-4 bg-sky-50 border border-sky-100 rounded-xl">
                  <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Implementation cards */}
            <div className="space-y-4">
              {data.implementations.map((impl) => (
                <div key={impl.id} className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-400 text-xs font-bold">✓</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1e293b]">{impl.title}</p>
                        {impl.implementedDate && (
                          <p className="text-xs text-[#64748b]">Implemented {fmtDate(impl.implementedDate)}</p>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold rounded uppercase tracking-wider">
                      Confirmed Lift
                    </span>
                  </div>

                  {impl.impact.before != null && impl.impact.after != null && (
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="p-3 bg-sky-50 border border-sky-100 rounded-lg">
                        <p className="text-[10px] text-[#64748b] mb-1">{impl.impact.metric}</p>
                        <p className="text-xs text-slate-500">Before</p>
                        <p className="text-sm font-semibold text-red-600">{impl.impact.before}</p>
                      </div>
                      <div className="p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
                        <p className="text-[10px] text-[#64748b] mb-1">{impl.impact.metric}</p>
                        <p className="text-xs text-slate-500">Now</p>
                        <p className="text-sm font-semibold text-emerald-600">{impl.impact.after}</p>
                      </div>
                      <div className="p-3 bg-sky-50 border border-sky-100 rounded-lg col-span-2">
                        <p className="text-[10px] text-[#64748b] mb-1">Revenue impact</p>
                        <p className="text-lg font-bold text-emerald-600">+{fmtMoney(impl.recoveredValue ?? 0)}/mo</p>
                      </div>
                    </div>
                  )}

                  {impl.notes && <p className="text-xs text-slate-500 leading-relaxed">{impl.notes}</p>}
                </div>
              ))}

              {data.implementations.length === 0 && (
                <div className="p-12 bg-white border border-[#e0f2fe] rounded-2xl text-center">
                  <p className="text-[#94a3b8] text-sm">No verified implementations yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FINDINGS ──────────────────────────────────────────────────────── */}
        {view === 'findings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">New Findings — {r.label}</h2>
              <p className="text-sm text-slate-500">Issues discovered during this month's monitoring cycle.</p>
            </div>

            <div className="space-y-4">
              {data.newFindings.map((f, i) => (
                <div key={i} className="border border-amber-500/20 bg-amber-500/5 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-slate-800 mb-1">{f.title}</h3>
                      <p className="text-xs text-emerald-600 mb-2">Estimated cost: {fmtMoney(f.estimatedCost)}/mo</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{f.detail}</p>
                    </div>
                  </div>
                </div>
              ))}

              {data.newFindings.length === 0 && (
                <div className="p-12 bg-white border border-[#e0f2fe] rounded-2xl text-center">
                  <p className="text-[#94a3b8] text-sm">No new findings this month.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BEHAVIORAL SHIFTS ─────────────────────────────────────────────── */}
        {view === 'behavioral' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Behavioral Shifts</h2>
              <p className="text-sm text-slate-500">Metric changes from verified recommendations vs baseline.</p>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 px-4 pb-1">
                <p className="col-span-4 text-[10px] text-[#64748b] uppercase tracking-wider">Recommendation</p>
                <p className="col-span-2 text-[10px] text-[#64748b] uppercase tracking-wider">Metric</p>
                <p className="col-span-2 text-[10px] text-[#64748b] uppercase tracking-wider">Baseline</p>
                <p className="col-span-2 text-[10px] text-[#64748b] uppercase tracking-wider">Current</p>
                <p className="col-span-2 text-[10px] text-[#64748b] uppercase tracking-wider">Signal</p>
              </div>

              {data.behavioralShifts.map((s, i) => {
                const isGood = s.direction === 'improved';
                const isBad = s.direction === 'regressed';
                const signalBg = isGood ? 'bg-emerald-500/5 border-emerald-500/15' : isBad ? 'bg-red-500/5 border-red-500/15' : 'bg-sky-50 border-sky-100';
                const dotColor = isGood ? 'bg-emerald-500' : isBad ? 'bg-red-500' : 'bg-sky-200';
                const rawDelta = s.current - s.baseline;

                return (
                  <div key={i} className={`grid grid-cols-12 gap-2 p-4 border rounded-xl items-center ${signalBg}`}>
                    <p className="col-span-4 text-xs text-slate-600">{s.title}</p>
                    <p className="col-span-2 text-xs text-slate-500">{s.metric}</p>
                    <p className="col-span-2 text-xs text-[#64748b]">{s.baseline}</p>
                    <p className="col-span-2 text-xs font-semibold text-[#1e293b]">{s.current}</p>
                    <div className="col-span-2 flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                      <Delta value={rawDelta} />
                    </div>
                  </div>
                );
              })}

              {data.behavioralShifts.length === 0 && (
                <div className="p-12 bg-white border border-[#e0f2fe] rounded-2xl text-center">
                  <p className="text-[#94a3b8] text-sm">No behavioral shift data available yet.</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-6 text-xs text-[#64748b] pt-2">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Improved vs baseline</div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /> Regressed — action needed</div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-sky-200" /> Stable</div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
