'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import type { ActionItem, GrowthPlay, ReportPayload } from '@/types';
import { formatDate, formatMoney } from '@/lib/utils/format';
import { EFFORT_COLORS } from '@/lib/constants/styles';

export default function ReportPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const [activeView, setActiveView] = useState<'executive' | 'action' | 'growth'>('executive');
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadReport(); }, [siteId]); // eslint-disable-line

  async function loadReport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/report?siteId=${siteId}`);
      const data = await res.json();
      if (data.report?.status === 'COMPLETE') setReport(data.report);
    } catch { /* no report yet */ }
    setLoading(false);
  }

  async function generateReport() {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Generation failed'); return; }
      await loadReport();
    } catch { setError('Something went wrong. Please try again.'); }
    finally { setGenerating(false); }
  }

  if (loading) return (
    <div className="min-h-screen bg-page-bg flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-nav-bg border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  if (!report) return (
    <div className="min-h-screen bg-page-bg flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-sky-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-nav-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Generate Your Interim Report™</h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">WebGrade analyzes your behavioral data, drop-off patterns, and GA4 baseline to generate a prioritized action plan with estimated revenue impact.</p>
          {error && <p className="text-sm text-red-500 mb-4 p-3 bg-red-50 rounded-lg">{error}</p>}
          <button onClick={generateReport} disabled={generating}
            className="w-full bg-nav-bg hover:bg-nav-border disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2">
            {generating ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating… (~30s)</> : <>⚡ Generate Interim Report™</>}
          </button>
          <p className="text-xs text-slate-400 mt-3">AI-powered · Uses your behavioral data · ~30 seconds</p>
        </div>
      </div>
    </div>
  );

  const actionItems = (report.actionItems ?? []) as ActionItem[];
  const growthPlays = (report.growthPlays ?? []) as GrowthPlay[];

  return (
    <div className="min-h-screen bg-page-bg flex flex-col">
      {/* Sub-header */}
      <div className="bg-white border-b border-sky-100 px-6 py-2 flex items-center justify-between sticky top-[52px] z-10">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-slate-900">WebGrade Interim Report™</span>
          <span className="bg-[#f0fdf4] border border-[#bbf7d0] text-[#16a34a] text-xs font-semibold px-2 py-0.5 rounded-full">Complete</span>
          <span className="text-slate-300">·</span>
          <span className="text-xs text-slate-400">{formatDate(report.periodStart)} – {formatDate(report.periodEnd)}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-page-bg border border-page-border rounded-lg p-0.5 gap-0.5">
            {(['executive','action','growth'] as const).map(v => (
              <button key={v} onClick={() => setActiveView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeView===v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                {v==='executive' ? 'Executive View' : v==='action' ? `Action Items (${actionItems.length})` : `Growth Plays (${growthPlays.length})`}
              </button>
            ))}
          </div>
          <button onClick={generateReport} disabled={generating}
            className="text-xs px-3 py-1.5 bg-page-bg border border-page-border rounded-lg text-slate-500 hover:bg-sky-100 transition-colors">
            {generating ? '…' : '↻ Regenerate'}
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">

        {/* EXECUTIVE */}
        {activeView === 'executive' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Revenue at Risk', value: formatMoney(report.totalRevenueAtRisk), sub: 'per month', color: 'border-red-100 bg-red-50', text: 'text-red-600' },
                { label: 'Estimated Recovery', value: report.estimatedImpact?.split('–')[0]?.replace(' recoverable','') ?? '—', sub: 'low estimate/mo', color: 'border-green-100 bg-green-50', text: 'text-green-600' },
                { label: 'Action Items', value: String(actionItems.length), sub: `${actionItems.filter(a=>a.effort==='low').length} quick wins`, color: 'border-blue-100 bg-page-bg', text: 'text-nav-bg' },
              ].map(c => (
                <div key={c.label} className={`rounded-xl border p-5 ${c.color}`}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{c.label}</p>
                  <p className={`text-2xl font-bold ${c.text}`}>{c.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-sky-100 p-6">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Executive Summary</h2>
              {report.executiveSummary
                ? report.executiveSummary.split('\n\n').map((p, i) => <p key={i} className="text-sm text-slate-700 leading-relaxed mb-3">{p}</p>)
                : <p className="text-slate-400 text-sm">No executive summary available.</p>}
            </div>

            {report.criticalPages && report.criticalPages.length > 0 && (
              <div className="bg-white rounded-2xl border border-sky-100 p-6">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Critical Pages</h2>
                <div className="space-y-2">
                  {report.criticalPages.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-page-bg last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.severity==='critical'?'bg-red-500':p.severity==='severe'?'bg-orange-500':'bg-yellow-500'}`} />
                        <span className="text-sm text-slate-900 font-mono truncate">{p.url}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-slate-500 flex-shrink-0">
                        <span>{p.exitRate.toFixed(0)}% exit</span>
                        <span className="text-red-500 font-medium">${p.revenueAtRisk.toLocaleString()}/mo</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ACTIONS */}
        {activeView === 'action' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-slate-900">Action Items</h2>
              <span className="text-xs text-slate-500">Ranked by revenue impact</span>
            </div>
            {actionItems.length === 0
              ? <div className="bg-white rounded-2xl border border-sky-100 p-12 text-center"><p className="text-slate-400 text-sm">No action items yet — generate a report first.</p></div>
              : actionItems.map(item => <ActionCard key={item.rank} item={item} />)}
          </div>
        )}

        {/* GROWTH */}
        {activeView === 'growth' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-slate-900">Growth Plays</h2>
              <span className="text-xs text-slate-500">Strategic opportunities beyond fixing what's broken</span>
            </div>
            {growthPlays.length === 0
              ? <div className="bg-white rounded-2xl border border-sky-100 p-12 text-center"><p className="text-slate-400 text-sm">No growth plays yet — generate a report first.</p></div>
              : growthPlays.map(play => <GrowthPlayCard key={play.rank} play={play} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionCard({ item }: { item: ActionItem }) {
  const icons: Record<string, string> = { conversion: '🎯', engagement: '👁', speed: '⚡', seo: '🔍', ux: '✨', content: '📝' };
  return (
    <div className="bg-white rounded-2xl border border-sky-100 p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-nav-bg text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{item.rank}</div>
          <div>
            <div className="flex items-center gap-2">
              <span>{icons[item.category] ?? '📌'}</span>
              <h3 className="font-semibold text-slate-900 text-sm">{item.title}</h3>
            </div>
            {item.pageUrl && <p className="text-xs text-slate-400 font-mono mt-0.5">{item.pageUrl}</p>}
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${EFFORT_COLORS[item.effort]}`}>{item.effort} effort</span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Problem</p>
          <p className="text-sm text-slate-600 leading-relaxed">{item.problem}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Fix</p>
          <p className="text-sm text-slate-600 leading-relaxed">{item.fix}</p>
        </div>
      </div>
      <div className="pt-3 border-t border-page-bg flex items-center gap-1.5">
        <span className="text-xs text-slate-500">Estimated impact:</span>
        <span className="text-sm font-bold text-green-600">{item.impact}</span>
      </div>
    </div>
  );
}

function GrowthPlayCard({ play }: { play: GrowthPlay }) {
  const [exp, setExp] = useState(false);
  const cats: Record<string, string> = { ab_test: 'bg-purple-50 text-purple-700 border-purple-200', content: 'bg-blue-50 text-blue-700 border-blue-200', audience: 'bg-teal-50 text-teal-700 border-teal-200', retention: 'bg-orange-50 text-orange-700 border-orange-200', channel: 'bg-green-50 text-green-700 border-green-200', product: 'bg-pink-50 text-pink-700 border-pink-200' };
  return (
    <div className="bg-white rounded-2xl border border-sky-100 p-5">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#0891b2] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{play.rank}</div>
          <h3 className="font-semibold text-slate-900 text-sm">{play.title}</h3>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${cats[play.category] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>{play.category.replace('_',' ')}</span>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed mb-3">{play.opportunity}</p>
      <button onClick={() => setExp(e => !e)} className="text-xs text-[#0891b2] font-medium hover:underline">{exp ? '▲ Less' : '▼ Hypothesis + experiment'}</button>
      {exp && (
        <div className="mt-3 pt-3 border-t border-page-bg space-y-3">
          <div><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Hypothesis</p><p className="text-sm text-slate-600 italic">{play.hypothesis}</p></div>
          <div><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Experiment</p><p className="text-sm text-slate-600">{play.experiment}</p></div>
        </div>
      )}
      <div className="mt-3 pt-3 border-t border-page-bg flex items-center gap-4">
        <div className="flex gap-1.5 items-center"><span className="text-xs text-slate-500">Upside:</span><span className="text-sm font-bold text-nav-bg">{play.upside}</span></div>
        <div className="flex gap-1.5 items-center"><span className="text-xs text-slate-500">Time:</span><span className="text-sm text-slate-600">{play.timeToResult}</span></div>
      </div>
    </div>
  );
}
