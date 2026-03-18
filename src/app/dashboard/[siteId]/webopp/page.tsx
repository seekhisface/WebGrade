'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
interface KeywordCluster {
  clusterName: string;
  primaryKeyword: string;
  keywords: string[];
  monthlySearchVolume: number | null;
  avgCpc: number | null;
  missedRevenue: number | null;
  currentRankPosition: number | null;
}

interface BudgetChannel {
  channel: string;
  currentMonthlySpend: number | null;
  recommendedMonthlySpend: number | null;
  expectedLeads: number | null;
  expectedRevenue: number | null;
  roiTimeline: number | null;
  rationale: string;
}

interface Analysis {
  id: string;
  status: string;
  completedAt: string | null;
  totalMissedRevenuePerMonth: number | null;
  topOpportunityCluster: string | null;
  totalOpportunitiesFound: number | null;
  keywordClusters: KeywordCluster[];
  budgetModels: BudgetChannel[];
}

export default function WebOppPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const [activeView, setActiveView] = useState<'overview' | 'keywords' | 'channels' | 'gaps'>('overview');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [overview, setOverview] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadAnalysis(); }, [siteId]); // eslint-disable-line

  async function loadAnalysis() {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/webopp?siteId=${siteId}`);
      const data = await res.json();
      if (data.analysis) setAnalysis(data.analysis);
    } catch { /* no analysis yet */ }
    setLoading(false);
  }

  async function generateAnalysis() {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/ai/webopp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Generation failed'); return; }
      setOverview(data.overview ?? '');
      await loadAnalysis();
    } catch { setError('Something went wrong.'); }
    finally { setGenerating(false); }
  }

  const fmtMoney = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(0)}k` : `$${n}`;
  const CHANNEL_LABELS: Record<string, string> = { google_ads: 'Google Ads', meta_ads: 'Meta Ads', seo_organic: 'SEO / Organic', content_marketing: 'Content Marketing', linkedin_ads: 'LinkedIn Ads' };

  if (loading) return (
    <div className="min-h-screen bg-[#f0f9ff] flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0c4a6e] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  if (!analysis) return (
    <div className="min-h-screen bg-[#f0f9ff] flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#e0f2fe] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🔍</span>
          </div>
          <h1 className="text-xl font-bold text-[#1e293b] mb-2">Run WebOpp™ Market Intelligence</h1>
          <p className="text-sm text-[#64748b] mb-6 leading-relaxed">WebOpp scans your keyword market, identifies gaps vs competitors, and maps the revenue opportunity in your search category.</p>
          {error && <p className="text-sm text-red-500 mb-4 p-3 bg-red-50 rounded-lg">{error}</p>}
          <button onClick={generateAnalysis} disabled={generating}
            className="w-full bg-[#0c4a6e] hover:bg-[#075985] disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2">
            {generating ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Analyzing market… (~30s)</> : <>🔍 Run WebOpp™ Analysis</>}
          </button>
          <p className="text-xs text-[#94a3b8] mt-3">Scans keyword demand · Competitor gaps · Channel ROI · ~30 seconds</p>
        </div>
      </div>
    </div>
  );

  const clusters = analysis.keywordClusters ?? [];
  const channels = analysis.budgetModels ?? [];

  return (
    <div className="min-h-screen bg-[#f0f9ff] flex flex-col">
      {/* Sub-header */}
      <div className="bg-white border-b border-[#e0f2fe] px-6 py-2 flex items-center justify-between sticky top-[52px] z-10">
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#22d3ee] animate-pulse" />
            <span className="text-[#0891b2] text-xs font-bold uppercase tracking-wider">WebOpp™</span>
          </div>
          <span className="text-[#cbd5e1]">·</span>
          <span className="font-semibold text-[#1e293b]">Market Intelligence</span>
          {analysis.totalOpportunitiesFound && (
            <span className="bg-[#f0fdf4] border border-[#bbf7d0] text-[#16a34a] text-xs font-semibold px-2 py-0.5 rounded-full">{analysis.totalOpportunitiesFound} opportunities</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#f0f9ff] border border-[#bae6fd] rounded-lg p-0.5 gap-0.5">
            {(['overview','keywords','channels','gaps'] as const).map(v => (
              <button key={v} onClick={() => setActiveView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${activeView===v?'bg-white text-[#1e293b] shadow-sm':'text-[#64748b]'}`}>
                {v === 'keywords' ? 'Keyword Gaps' : v === 'channels' ? 'Channel ROI' : v === 'gaps' ? 'Competitor Map' : 'Overview'}
              </button>
            ))}
          </div>
          <button onClick={generateAnalysis} disabled={generating}
            className="text-xs px-3 py-1.5 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-[#64748b] hover:bg-[#e0f2fe] transition-colors">
            {generating ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">

        {/* OVERVIEW */}
        {activeView === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Missed Revenue/Mo', value: analysis.totalMissedRevenuePerMonth ? fmtMoney(analysis.totalMissedRevenuePerMonth) : '—', sub: 'estimated opportunity', color: 'border-red-100 bg-red-50', text: 'text-red-600' },
                { label: 'Keyword Clusters', value: String(clusters.length), sub: 'opportunity clusters found', color: 'border-blue-100 bg-[#f0f9ff]', text: 'text-[#0c4a6e]' },
                { label: 'Top Opportunity', value: analysis.topOpportunityCluster ?? '—', sub: 'highest-ROI cluster', color: 'border-green-100 bg-green-50', text: 'text-green-700 text-sm' },
              ].map(c => (
                <div key={c.label} className={`rounded-xl border p-5 ${c.color}`}>
                  <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">{c.label}</p>
                  <p className={`text-2xl font-bold ${c.text}`}>{c.value}</p>
                  <p className="text-xs text-[#94a3b8] mt-0.5">{c.sub}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-[#e0f2fe] p-6">
              <h2 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-4">Market Intelligence Summary</h2>
              {overview
                ? overview.split('\n\n').map((p, i) => <p key={i} className="text-sm text-[#334155] leading-relaxed mb-3">{p}</p>)
                : <p className="text-sm text-[#94a3b8]">Run the analysis to generate market intelligence.</p>}
            </div>
          </div>
        )}

        {/* KEYWORD GAPS */}
        {activeView === 'keywords' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-[#1e293b]">Keyword Opportunity Clusters</h2>
              <span className="text-xs text-[#64748b]">Ranked by missed revenue</span>
            </div>
            {clusters.length === 0
              ? <div className="bg-white rounded-2xl border border-[#e0f2fe] p-12 text-center"><p className="text-[#94a3b8] text-sm">No keyword clusters yet — run the analysis first.</p></div>
              : clusters.sort((a, b) => (b.missedRevenue ?? 0) - (a.missedRevenue ?? 0)).map((c, i) => (
                <div key={i} className="bg-white rounded-2xl border border-[#e0f2fe] p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#0891b2] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</div>
                      <div>
                        <h3 className="font-semibold text-[#1e293b] text-sm">{c.clusterName}</h3>
                        <p className="text-xs text-[#94a3b8] font-mono mt-0.5">Primary: {c.primaryKeyword}</p>
                      </div>
                    </div>
                    {c.missedRevenue && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-red-500">{fmtMoney(c.missedRevenue)}/mo</p>
                        <p className="text-xs text-[#94a3b8]">missed revenue</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {c.keywords.map((kw, ki) => (
                      <span key={ki} className="text-xs bg-[#f0f9ff] border border-[#bae6fd] text-[#0369a1] px-2 py-0.5 rounded-full">{kw}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-3 border-t border-[#f0f9ff]">
                    <div><p className="text-xs text-[#94a3b8]">Monthly Volume</p><p className="text-sm font-semibold text-[#1e293b]">{c.monthlySearchVolume?.toLocaleString() ?? '—'}</p></div>
                    <div><p className="text-xs text-[#94a3b8]">Avg CPC</p><p className="text-sm font-semibold text-[#1e293b]">${c.avgCpc?.toFixed(2) ?? '—'}</p></div>
                    <div><p className="text-xs text-[#94a3b8]">Current Rank</p><p className="text-sm font-semibold text-[#1e293b]">{c.currentRankPosition ? `#${c.currentRankPosition}` : 'Not ranking'}</p></div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* CHANNELS */}
        {activeView === 'channels' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-[#1e293b]">Channel ROI Recommendations</h2>
              <span className="text-xs text-[#64748b]">Ranked by expected revenue</span>
            </div>
            {channels.length === 0
              ? <div className="bg-white rounded-2xl border border-[#e0f2fe] p-12 text-center"><p className="text-[#94a3b8] text-sm">No channel recommendations yet — run the analysis first.</p></div>
              : channels.sort((a, b) => (b.expectedRevenue ?? 0) - (a.expectedRevenue ?? 0)).map((ch, i) => (
                <div key={i} className="bg-white rounded-2xl border border-[#e0f2fe] p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#0c4a6e] text-white text-xs font-bold flex items-center justify-center">{i+1}</div>
                      <h3 className="font-semibold text-[#1e293b] text-sm">{CHANNEL_LABELS[ch.channel] ?? ch.channel}</h3>
                    </div>
                    {ch.expectedRevenue && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-green-600">{fmtMoney(ch.expectedRevenue)}/mo</p>
                        <p className="text-xs text-[#94a3b8]">expected revenue</p>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-[#475569] mb-3 leading-relaxed">{ch.rationale}</p>
                  <div className="grid grid-cols-4 gap-3 pt-3 border-t border-[#f0f9ff]">
                    <div><p className="text-xs text-[#94a3b8]">Current Spend</p><p className="text-sm font-semibold">{ch.currentMonthlySpend ? fmtMoney(ch.currentMonthlySpend) : '—'}/mo</p></div>
                    <div><p className="text-xs text-[#94a3b8]">Recommended</p><p className="text-sm font-semibold text-[#0c4a6e]">{ch.recommendedMonthlySpend ? fmtMoney(ch.recommendedMonthlySpend) : '—'}/mo</p></div>
                    <div><p className="text-xs text-[#94a3b8]">Expected Leads</p><p className="text-sm font-semibold">{ch.expectedLeads ?? '—'}/mo</p></div>
                    <div><p className="text-xs text-[#94a3b8]">ROI Timeline</p><p className="text-sm font-semibold">{ch.roiTimeline ? `${ch.roiTimeline} months` : '—'}</p></div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* COMPETITOR MAP */}
        {activeView === 'gaps' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[#1e293b] mb-2">Competitor Keyword Map</h2>
            <div className="bg-white rounded-2xl border border-[#e0f2fe] p-8 text-center">
              <p className="text-3xl mb-3">🗺️</p>
              <p className="font-semibold text-[#1e293b] mb-1">Competitor map coming soon</p>
              <p className="text-xs text-[#94a3b8]">Add competitors in your onboarding settings to see keyword coverage maps.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
