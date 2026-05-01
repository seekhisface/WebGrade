'use client';

import { useEffect, useState } from 'react';

interface CheckResult {
  id: string;
  label: string;
  severity: 'pass' | 'warn' | 'fail';
  message: string;
  cta?: { text: string; href: string };
}

interface DataQualityReport {
  siteId: string;
  mode: 'gentle' | 'strict' | 'report';
  checks: CheckResult[];
  overall: 'green' | 'yellow' | 'red';
  passCount: number;
  warnCount: number;
  failCount: number;
}

interface CheckinModalProps {
  siteId: string;
  day: 7 | 14;
  onClose: () => void;
}

const SEVERITY_STYLES: Record<CheckResult['severity'], { dot: string; bg: string; border: string; text: string; label: string }> = {
  pass: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'OK' },
  warn: { dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Warning' },
  fail: { dot: 'bg-red-500', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Action needed' },
};

const OVERALL_HEADERS: Record<DataQualityReport['overall'], { title: string; subtitle: string; tone: string }> = {
  green: {
    title: 'Looks good — keep going',
    subtitle: 'Tracking is healthy. Your scheduled report will be accurate.',
    tone: 'text-emerald-700',
  },
  yellow: {
    title: 'A few things to tune up',
    subtitle: 'Some signals are missing. Fix the warnings below to get a more accurate report.',
    tone: 'text-amber-700',
  },
  red: {
    title: 'Tracking has gaps that will affect your report',
    subtitle: 'Address the action items below before your scheduled report fires.',
    tone: 'text-red-700',
  },
};

export default function CheckinModal({ siteId, day, onClose }: CheckinModalProps) {
  const [report, setReport] = useState<DataQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    setLoading(true);
    const mode = day === 7 ? 'gentle' : 'strict';
    fetch(`/api/checkins/data-quality?siteId=${siteId}&mode=${mode}`)
      .then(res => res.ok ? res.json() : null)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [siteId, day]);

  async function acknowledge() {
    setAcknowledging(true);
    try {
      await fetch('/api/checkins/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, day }),
      });
    } catch { /* swallow — modal closes anyway */ }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(8, 47, 73, 0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl"
        style={{ maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="bg-gradient-to-r from-[#0c4a6e] to-[#0369a1] px-8 py-5">
          <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Data Quality Check-in</p>
          <h2 className="text-xl font-black text-white">Day {day} review</h2>
          <p className="text-sm text-white/70 mt-0.5">
            {day === 7
              ? "We're a week into your audit — let's confirm tracking is healthy before your Day 30 report fires."
              : "Halfway to your Day 30 report. Anything still amber needs to be fixed soon to avoid a misleading report."}
          </p>
        </div>

        <div className="overflow-y-auto px-8 py-6" style={{ maxHeight: 'calc(92vh - 200px)' }}>
          {loading && (
            <div className="py-12 text-center">
              <div className="w-6 h-6 border-2 border-[#0c4a6e] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-[#64748b]">Running data-quality checks…</p>
            </div>
          )}

          {!loading && !report && (
            <div className="py-12 text-center">
              <p className="text-sm text-red-700">Failed to load data-quality report. Please try again.</p>
            </div>
          )}

          {!loading && report && (
            <>
              {(() => {
                const header = OVERALL_HEADERS[report.overall];
                return (
                  <div className="mb-5">
                    <h3 className={`text-lg font-bold ${header.tone} mb-1`}>{header.title}</h3>
                    <p className="text-sm text-[#64748b]">{header.subtitle}</p>
                    <div className="flex gap-3 text-xs mt-3">
                      <span className="text-emerald-700">{report.passCount} passing</span>
                      {report.warnCount > 0 && <span className="text-amber-700">{report.warnCount} warning</span>}
                      {report.failCount > 0 && <span className="text-red-700 font-semibold">{report.failCount} action needed</span>}
                    </div>
                  </div>
                );
              })()}

              <ul className="space-y-2">
                {report.checks.map(check => {
                  const styles = SEVERITY_STYLES[check.severity];
                  return (
                    <li key={check.id} className={`flex items-start gap-3 p-3 rounded-xl border ${styles.bg} ${styles.border}`}>
                      <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${styles.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[#1e293b]">{check.label}</p>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${styles.text}`}>{styles.label}</span>
                        </div>
                        <p className="text-xs text-[#475569] mt-0.5">{check.message}</p>
                        {check.cta && (
                          <a
                            href={check.cta.href}
                            className="inline-block mt-1.5 text-xs font-semibold text-[#0891b2] hover:text-[#0e7490] underline"
                          >
                            {check.cta.text} →
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#64748b] hover:text-[#334155] transition-colors"
          >
            Close
          </button>
          <button
            onClick={acknowledge}
            disabled={acknowledging}
            className="px-5 py-2 text-sm font-semibold bg-[#0c4a6e] hover:bg-[#075985] disabled:opacity-60 text-white rounded-lg transition-colors"
          >
            {acknowledging ? 'Saving…' : 'Got it — dismiss'}
          </button>
        </div>
      </div>
    </div>
  );
}
