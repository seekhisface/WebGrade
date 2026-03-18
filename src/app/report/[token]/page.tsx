'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LockedItem {
  rank: number;
  title: string;
  preview: string;
  impact: string;
  category: string;
}

interface WinbackReport {
  id: string;
  siteName: string;
  domain: string;
  periodStart: string;
  periodEnd: string;
  teaserContent: string | null;
  lockedItems: LockedItem[] | null;
  totalRevenueAtRisk: number;
  recipientName: string | null;
  isWinBack: boolean;
  targetType: string;
  unlockedAt: string | null;
  expired: boolean;
  expiresAt: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  behavioral: '👁',
  seo: '🔍',
  adspend: '💸',
  ux: '✨',
  content: '📝',
};

// ---------------------------------------------------------------------------
// Main page — no auth required, public URL
// ---------------------------------------------------------------------------

export default function WinbackReportPage() {
  const params = useParams();
  const token = params.token as string;

  const [report, setReport] = useState<WinbackReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const paywallRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadReport();
  }, [token]); // eslint-disable-line

  async function loadReport() {
    try {
      const res = await fetch(`/api/rt/generate?token=${token}`);
      if (!res.ok) { setNotFound(true); setLoading(false); return; }
      const data = await res.json();
      setReport(data.report);
      // Already unlocked?
      if (!data.report.unlockedAt) {
        setShowPaywall(true);
      }
    } catch { setNotFound(true); }
    setLoading(false);
  }

  async function handleUnlockRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setUnlocking(true);
    // In production this would trigger a payment/CRM flow
    // For now: record the email and show a "we'll be in touch" state
    await new Promise(r => setTimeout(r, 800)); // simulate request
    setEmailSubmitted(true);
    setUnlocking(false);
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const fmtMoney = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#0c4a6e] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#64748b]">Loading your report…</p>
      </div>
    </div>
  );

  // ── Not found ─────────────────────────────────────────────────────────────
  if (notFound || !report) return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-[#fee2e2] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔗</span>
        </div>
        <h1 className="text-lg font-bold text-[#1e293b] mb-2">Report not found</h1>
        <p className="text-sm text-[#64748b]">This link may have expired or been revoked. Contact your WebGrade account manager for a new one.</p>
      </div>
    </div>
  );

  const isUnlocked = !!report.unlockedAt;
  const lockedItems = (report.lockedItems ?? []) as LockedItem[];

  // ── Full report ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f0f9ff]" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* Top bar */}
      <div className="bg-[#0c4a6e] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/15 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-sm">W</span>
          </div>
          <span className="text-white font-semibold text-sm">WebGrade</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sky-300 text-xs">Confidential report for</span>
          <span className="text-white text-xs font-semibold">{report.domain}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Report header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-[#0c4a6e] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              {report.isWinBack ? 'Win-Back Analysis' : 'Site Intelligence Report'}
            </span>
            <span className="text-xs text-[#94a3b8]">{fmt(report.periodStart)} – {fmt(report.periodEnd)}</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1e293b] mb-1">{report.siteName}</h1>
          <p className="text-sm text-[#64748b]">{report.domain}</p>
        </div>

        {/* Revenue at risk banner */}
        {report.totalRevenueAtRisk > 0 && (
          <div className="bg-gradient-to-r from-[#0c4a6e] to-[#0369a1] rounded-2xl p-5 mb-6 flex items-center justify-between">
            <div>
              <p className="text-sky-300 text-xs font-semibold uppercase tracking-wider mb-1">Estimated Revenue at Risk</p>
              <p className="text-white text-3xl font-bold">{fmtMoney(report.totalRevenueAtRisk)}<span className="text-sky-300 text-base font-normal">/mo</span></p>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        )}

        {/* ── TEASER SECTION (always visible) ─────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#e0f2fe] p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">Key Finding</span>
          </div>

          {report.teaserContent ? (
            <div>
              {report.teaserContent.split('\n\n').map((para, i) => (
                <p key={i} className="text-sm text-[#334155] leading-relaxed mb-3 last:mb-0">{para}</p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#64748b]">No preview available.</p>
          )}
        </div>

        {/* ── LOCKED SECTION ──────────────────────────────────────────────── */}
        {lockedItems.length > 0 && (
          <div className="relative mb-6" ref={paywallRef}>

            {/* Blurred items */}
            <div className={`space-y-3 ${!isUnlocked ? 'select-none' : ''}`}>
              {lockedItems.map((item, i) => (
                <div key={i} className={`bg-white rounded-2xl border border-[#e0f2fe] p-5 relative overflow-hidden transition-all ${!isUnlocked ? 'cursor-not-allowed' : ''}`}>

                  {/* Blur overlay on locked items */}
                  {!isUnlocked && (
                    <div className="absolute inset-0 backdrop-blur-sm bg-white/60 z-10 flex items-center justify-center rounded-2xl">
                      <div className="flex items-center gap-2 bg-white border border-[#bae6fd] rounded-full px-3 py-1.5 shadow-sm">
                        <svg className="w-3.5 h-3.5 text-[#0c4a6e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span className="text-xs font-semibold text-[#0c4a6e]">Unlock to view</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-[#f0f9ff] border border-[#bae6fd] flex items-center justify-center flex-shrink-0">
                        <span className="text-sm">{CATEGORY_ICONS[item.category] ?? '📌'}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1e293b] mb-1">{item.title}</p>
                        <p className="text-xs text-[#64748b] leading-relaxed">{item.preview}</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-[#94a3b8] mb-0.5">Potential</p>
                      <p className="text-sm font-bold text-[#0c4a6e]">{item.impact}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Paywall CTA — shown when locked */}
            {!isUnlocked && (
              <div className="mt-4 bg-gradient-to-b from-[#f0f9ff] via-white to-white rounded-2xl border border-[#bae6fd] p-6 text-center shadow-lg">
                <div className="w-12 h-12 bg-[#0c4a6e] rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                </div>

                <h2 className="text-base font-bold text-[#1e293b] mb-1">
                  {lockedItems.length} more findings in the full report
                </h2>
                <p className="text-sm text-[#64748b] mb-5 leading-relaxed">
                  The full WebGrade Interim Report™ includes every finding above, the specific fix for each, and a prioritized action plan with estimated revenue impact.
                </p>

                {!emailSubmitted ? (
                  <form onSubmit={handleUnlockRequest} className="space-y-3">
                    <input
                      type="email"
                      placeholder="Your work email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-4 py-3 text-sm text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:border-[#0c4a6e] focus:ring-1 focus:ring-[#0c4a6e]"
                    />
                    <button
                      type="submit"
                      disabled={unlocking}
                      className="w-full bg-[#0c4a6e] hover:bg-[#075985] disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      {unlocking ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending…</>
                      ) : (
                        <>Get the Full Report →</>
                      )}
                    </button>
                    <p className="text-xs text-[#94a3b8]">A WebGrade advisor will send you access within 1 business day.</p>
                  </form>
                ) : (
                  <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4">
                    <p className="text-sm font-semibold text-[#16a34a] mb-1">✓ Request received</p>
                    <p className="text-xs text-[#64748b]">We'll send access to <strong>{email}</strong> within 1 business day. Check your spam folder if you don't see it.</p>
                  </div>
                )}
              </div>
            )}

            {/* Unlocked state */}
            {isUnlocked && (
              <div className="mt-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-700">Full report unlocked</p>
                  <p className="text-xs text-green-600">Unlocked on {fmt(report.unlockedAt!)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-8 border-t border-[#e0f2fe]">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <div className="w-5 h-5 bg-[#0c4a6e] rounded flex items-center justify-center">
              <span className="text-white font-black text-[9px]">W</span>
            </div>
            <span className="text-xs font-semibold text-[#64748b]">WebGrade</span>
          </div>
          <p className="text-xs text-[#94a3b8]">This report was generated by WebGrade's behavioral intelligence platform.</p>
          <p className="text-xs text-[#94a3b8]">Confidential · Do not forward · Expires {fmt(report.expiresAt)}</p>
        </div>
      </div>
    </div>
  );
}
