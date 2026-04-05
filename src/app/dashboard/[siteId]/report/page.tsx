'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// =============================================================================
// Types
// =============================================================================

interface ArchivedReport {
  id: string;
  type: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  kpiSnapshot: Record<string, number>;
  findings: unknown[];
  actionItems: unknown[];
  createdAt: string;
}

// =============================================================================
// Main Reports Page — Archive-focused
// =============================================================================

export default function ReportsPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const [archives, setArchives] = useState<ArchivedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArchive, setSelectedArchive] = useState<ArchivedReport | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [hasCurrentReport, setHasCurrentReport] = useState(false);

  useEffect(() => {
    loadArchives();
    checkCurrentReport();
  }, [siteId]); // eslint-disable-line

  async function loadArchives() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/archive?siteId=${siteId}`);
      if (res.ok) {
        const data = await res.json();
        setArchives(data.archives ?? []);
      }
    } catch { /* no archives */ }
    setLoading(false);
  }

  async function checkCurrentReport() {
    try {
      const res = await fetch(`/api/ai/report?siteId=${siteId}`);
      const data = await res.json();
      setHasCurrentReport(data.report?.status === 'COMPLETE');
    } catch { /* no report */ }
  }

  async function archiveCurrentReport() {
    setArchiving(true);
    try {
      const res = await fetch('/api/reports/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });
      if (res.ok) await loadArchives();
    } catch { /* ignore */ }
    setArchiving(false);
  }

  function handleSavePDF() {
    window.print();
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtMoney = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`;

  // ── VIEWING A SPECIFIC ARCHIVED REPORT ─────────────────────────────
  if (selectedArchive) {
    return (
      <div className="min-h-screen bg-[#f0f9ff] flex flex-col print:bg-white">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0c4a6e] to-[#0369a1] px-8 py-5 print:bg-[#0c4a6e]">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <button onClick={() => setSelectedArchive(null)} className="text-xs text-white/60 hover:text-white/90 font-medium mb-2 inline-block print:hidden">← Back to Reports</button>
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Archived Report</p>
              <h2 className="text-xl font-black text-white">{selectedArchive.title}</h2>
              <p className="text-sm text-white/70 mt-0.5">{fmt(selectedArchive.periodStart)} – {fmt(selectedArchive.periodEnd)}</p>
            </div>
            <button onClick={handleSavePDF}
              className="text-xs font-semibold px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors print:hidden flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Save as PDF
            </button>
          </div>
        </div>

        {/* Archive content */}
        <div className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
          <div className="bg-[#fffbeb] border border-[#fde68a] rounded-xl px-5 py-3 flex items-center gap-3 mb-6 print:hidden">
            <svg className="w-4 h-4 text-[#92400e] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-sm text-[#92400e]">Viewing archived snapshot from <strong>{fmt(selectedArchive.createdAt)}</strong>. Data is frozen at the time of archival.</p>
          </div>

          {/* Frozen KPIs */}
          {selectedArchive.kpiSnapshot && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Sessions', value: String(selectedArchive.kpiSnapshot.sessions ?? '—') },
                { label: 'Intent Score', value: String(selectedArchive.kpiSnapshot.intentScore ?? '—') },
                { label: 'Bounce Rate', value: `${(selectedArchive.kpiSnapshot.bounceRate ?? 0).toFixed(1)}%` },
                { label: 'Revenue at Risk', value: fmtMoney(selectedArchive.kpiSnapshot.revenueAtRisk ?? 0) },
              ].map(c => (
                <div key={c.label} className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4">
                  <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">{c.label}</p>
                  <p className="text-xl font-black text-[#0c4a6e]">{c.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-5 mb-6">
            {selectedArchive.summary
              ? selectedArchive.summary.split('\n\n').map((p, i) => <p key={i} className="text-sm text-[#334155] leading-relaxed mb-3 last:mb-0">{p}</p>)
              : <p className="text-[#94a3b8] text-sm">No summary available.</p>}
          </div>

          {/* Bottom PDF button */}
          <div className="text-center pt-4 border-t border-[#e2e8f0] print:hidden">
            <button onClick={handleSavePDF}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0c4a6e] text-white text-sm font-semibold rounded-xl hover:bg-[#075985] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Save as PDF
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN ARCHIVE LIST VIEW ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f0f9ff] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0c4a6e] to-[#0369a1] px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">WebGrade</p>
          <h2 className="text-2xl font-black text-white">Report Archive</h2>
          <p className="text-sm text-white/70 mt-1">Saved monthly reports and historical snapshots. Use the Dashboard to view your current live report.</p>
        </div>
      </div>

      <div className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">

        {/* Save current report CTA */}
        {hasCurrentReport && (
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-5 py-4 flex items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-sm font-semibold text-[#166534]">You have a current report ready to archive</p>
              <p className="text-xs text-[#15803d]">Save a snapshot of your latest report to preserve it as a PDF-ready record.</p>
            </div>
            <button onClick={archiveCurrentReport} disabled={archiving}
              className="text-xs font-semibold px-4 py-2 bg-[#16a34a] text-white rounded-lg hover:bg-[#15803d] disabled:opacity-60 transition-colors whitespace-nowrap">
              {archiving ? 'Saving…' : '+ Archive Current Report'}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-2 border-[#0c4a6e] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* Empty state */}
        {!loading && archives.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#e0f2fe] p-12 text-center">
            <svg className="w-12 h-12 text-[#bae6fd] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
            <p className="text-lg font-bold text-[#1e293b] mb-2">No archived reports yet</p>
            <p className="text-sm text-[#64748b] mb-4">Reports are archived monthly or when you save a snapshot from the dashboard. Each archived report is stored as a frozen record — no additional AI calls needed.</p>
            <Link href={`/dashboard/${siteId}`} className="text-sm text-[#0891b2] font-semibold hover:underline">
              Go to Dashboard →
            </Link>
          </div>
        )}

        {/* Archive list */}
        {!loading && archives.length > 0 && (
          <div className="space-y-3">
            {archives.map(a => {
              const isBaseline = a.title.toLowerCase().includes('baseline');
              return (
                <button key={a.id} onClick={() => setSelectedArchive(a)}
                  className="w-full text-left bg-white border border-[#e0f2fe] rounded-xl p-5 hover:bg-[#f0f9ff] hover:border-[#bae6fd] transition-all shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {isBaseline && <span className="text-xs bg-[#fef3c7] text-[#92400e] px-2 py-0.5 rounded-full font-semibold flex-shrink-0">Baseline</span>}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1e293b] truncate">{a.title}</p>
                        <p className="text-xs text-[#64748b] mt-0.5">{fmt(a.periodStart)} – {fmt(a.periodEnd)} · Archived {fmt(a.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {a.kpiSnapshot?.sessions != null && (
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-[#94a3b8]">Sessions</p>
                          <p className="text-sm font-bold text-[#0c4a6e]">{a.kpiSnapshot.sessions.toLocaleString()}</p>
                        </div>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.type === 'webaudit' ? 'bg-sky-50 text-sky-700' : a.type === 'webwatch' ? 'bg-teal-50 text-teal-700' : 'bg-purple-50 text-purple-700'}`}>
                        {a.type === 'webaudit' ? 'WebAudit' : a.type === 'webwatch' ? 'WebWatch' : 'WebOpp'}
                      </span>
                      <svg className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Explanation */}
        <div className="mt-8 text-center">
          <p className="text-xs text-[#94a3b8]">Archived reports are frozen snapshots — viewing them uses no AI calls or database queries beyond retrieval.</p>
        </div>
      </div>
    </div>
  );
}
