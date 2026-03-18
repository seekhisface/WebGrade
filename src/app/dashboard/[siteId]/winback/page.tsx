'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AppNav } from '@/components/nav/AppNav';

interface SentReport {
  id: string;
  shareToken: string;
  shareRecipient: string | null;
  shareExpiresAt: string | null;
  shareUnlockedAt: string | null;
  createdAt: string;
  behavioralSummary: string | null;
}

const TARGET_TYPES = [
  { value: 'PROSPECT', label: 'Prospect', desc: 'Someone who hasn\'t bought yet', icon: '🎯' },
  { value: 'LAPSED', label: 'Lapsed Customer', desc: 'Stopped visiting, could come back', icon: '🔄' },
  { value: 'CHURNED', label: 'Churned Customer', desc: 'Was a customer, no longer active', icon: '💔' },
];

export default function WinbackPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  // Form state
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [targetType, setTargetType] = useState('PROSPECT');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ reportUrl: string; expiresAt: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Sent reports history
  const [sentReports, setSentReports] = useState<SentReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => { loadHistory(); }, [siteId]); // eslint-disable-line

  async function loadHistory() {
    try {
      const res = await fetch(`/api/rt/list?siteId=${siteId}`);
      if (res.ok) setSentReports(await res.json());
    } catch { /**/ }
    setLoadingHistory(false);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/rt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, recipientName: recipientName || undefined, recipientEmail: recipientEmail || undefined, targetType }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');

      setResult({ reportUrl: data.reportUrl, expiresAt: data.expiresAt });
      loadHistory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
    setGenerating(false);
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleUnlock(token: string) {
    await fetch('/api/rt/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    loadHistory();
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return (
    <div className="min-h-screen bg-[#f0f9ff]">
      <AppNav currentSiteId={siteId} sites={[]} activePage="winback" />

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[#0891b2] uppercase tracking-wider">RT-01</span>
            <span className="text-xs text-[#94a3b8]">Win-Back Reports</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Send a Win-Back Report</h1>
          <p className="text-sm text-[#64748b] mt-1">
            Generate a personalized teaser report with a shareable link. The prospect sees the top finding — the rest is blurred until they purchase.
          </p>
        </div>

        {/* Compose form */}
        <div className="bg-white rounded-2xl border border-[#bae6fd] p-6 mb-6">
          <h2 className="text-sm font-semibold text-[#1e293b] mb-5 flex items-center gap-2">
            <span className="w-6 h-6 bg-[#0c4a6e] rounded-lg flex items-center justify-center text-white text-xs">1</span>
            Compose Report
          </h2>

          <form onSubmit={handleGenerate} className="space-y-5">

            {/* Target type */}
            <div>
              <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2">Who is this for?</label>
              <div className="grid grid-cols-3 gap-2">
                {TARGET_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTargetType(t.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      targetType === t.value
                        ? 'border-[#0c4a6e] bg-[#f0f9ff] ring-1 ring-[#0c4a6e]'
                        : 'border-[#e2e8f0] hover:border-[#bae6fd]'
                    }`}
                  >
                    <div className="text-lg mb-1">{t.icon}</div>
                    <div className="text-xs font-semibold text-[#1e293b]">{t.label}</div>
                    <div className="text-[10px] text-[#94a3b8] leading-tight mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Name + email */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1.5">
                  Recipient Name <span className="text-[#94a3b8] font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="e.g. Sarah Chen"
                  className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:border-[#0c4a6e] focus:ring-1 focus:ring-[#0c4a6e]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1.5">
                  Their Email <span className="text-[#94a3b8] font-normal normal-case">(optional, for records)</span>
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  placeholder="sarah@company.com"
                  className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-sm text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:border-[#0c4a6e] focus:ring-1 focus:ring-[#0c4a6e]"
                />
              </div>
            </div>

            {/* What it uses */}
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 flex items-start gap-2.5">
              <span className="text-sm mt-0.5">⚡</span>
              <div>
                <p className="text-xs font-semibold text-[#1e293b] mb-0.5">AI generates this from your latest Interim Report</p>
                <p className="text-xs text-[#64748b]">Top findings, revenue at risk, and your site data are used to write a personalized teaser. ~30 seconds.</p>
              </div>
            </div>

            {error && (
              <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl px-4 py-3 text-sm text-[#dc2626]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={generating}
              className="w-full bg-[#0c4a6e] hover:bg-[#075985] disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {generating ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating report…</>
              ) : (
                <>⚡ Generate Win-Back Report</>
              )}
            </button>
          </form>
        </div>

        {/* Result — share link */}
        {result && (
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-green-700">Report generated — share this link</span>
            </div>

            <div className="bg-white border border-[#bbf7d0] rounded-xl p-3 flex items-center gap-3 mb-3">
              <p className="text-sm text-[#1e293b] flex-1 font-mono truncate">{result.reportUrl}</p>
              <button
                onClick={() => copyUrl(result.reportUrl)}
                className="flex-shrink-0 bg-[#0c4a6e] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#075985] transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            <p className="text-xs text-[#64748b]">
              Valid for 30 days · expires {fmt(result.expiresAt)} · The prospect will see the teaser — locked items are blurred until unlocked.
            </p>
          </div>
        )}

        {/* Sent reports history */}
        <div className="bg-white rounded-2xl border border-[#bae6fd] p-6">
          <h2 className="text-sm font-semibold text-[#1e293b] mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-[#0c4a6e] rounded-lg flex items-center justify-center text-white text-xs">2</span>
            Sent Reports
          </h2>

          {loadingHistory ? (
            <div className="py-8 flex justify-center">
              <div className="w-5 h-5 border-2 border-[#bae6fd] border-t-[#0c4a6e] rounded-full animate-spin" />
            </div>
          ) : sentReports.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[#94a3b8]">No win-back reports sent yet.</p>
              <p className="text-xs text-[#94a3b8] mt-1">Generate your first one above — it takes ~30 seconds.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sentReports.map(r => {
                const meta = (() => { try { return JSON.parse(r.behavioralSummary ?? '{}'); } catch { return {}; } })();
                const reportUrl = `${base}/report/${r.shareToken}`;
                const isUnlocked = !!r.shareUnlockedAt;
                const isExpired = r.shareExpiresAt ? new Date(r.shareExpiresAt) < new Date() : false;

                return (
                  <div key={r.id} className="border border-[#e2e8f0] rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isUnlocked ? 'bg-green-100 text-green-700' :
                            isExpired ? 'bg-[#fee2e2] text-[#dc2626]' :
                            'bg-[#f0f9ff] text-[#0891b2]'
                          }`}>
                            {isUnlocked ? '✓ Unlocked' : isExpired ? 'Expired' : 'Active'}
                          </span>
                          <span className="text-[10px] text-[#94a3b8]">{meta.targetType ?? 'PROSPECT'}</span>
                        </div>
                        <p className="text-sm font-semibold text-[#1e293b] truncate">
                          {r.shareRecipient ?? meta.recipientName ?? 'Anonymous recipient'}
                        </p>
                        <p className="text-xs text-[#94a3b8]">
                          Sent {fmt(r.createdAt)}{r.shareExpiresAt ? ` · expires ${fmt(r.shareExpiresAt)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => copyUrl(reportUrl)}
                          className="text-xs font-medium text-[#0891b2] hover:text-[#0c4a6e] transition-colors"
                        >
                          Copy link
                        </button>
                        {!isUnlocked && !isExpired && (
                          <button
                            onClick={() => handleUnlock(r.shareToken)}
                            className="text-xs font-medium bg-[#0c4a6e] text-white px-2.5 py-1 rounded-lg hover:bg-[#075985] transition-colors"
                          >
                            Unlock
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
