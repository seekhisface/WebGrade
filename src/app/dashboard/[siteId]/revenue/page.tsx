'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RevenueQuestionnairePage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.siteId as string;
  const [form, setForm] = useState({ averageOrderValue: '', leadToWinRate: '', conversionRate: '', monthlyAdSpend: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load existing values
    fetch(`/api/onboarding/revenue?siteId=${siteId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setForm({
            averageOrderValue: data.averageOrderValue ? String(data.averageOrderValue) : '',
            leadToWinRate: data.leadToWinRate ? String(Math.round(data.leadToWinRate * 100)) : '',
            conversionRate: data.conversionRate ? String(Math.round(data.conversionRate * 100 * 10) / 10) : '',
            monthlyAdSpend: data.monthlyAdSpend ? String(data.monthlyAdSpend) : '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/onboarding/revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          averageOrderValue: form.averageOrderValue ? parseFloat(form.averageOrderValue) : null,
          leadToWinRate: form.leadToWinRate ? parseFloat(form.leadToWinRate) / 100 : null,
          conversionRate: form.conversionRate ? parseFloat(form.conversionRate) / 100 : null,
          monthlyAdSpend: form.monthlyAdSpend ? parseFloat(form.monthlyAdSpend) : null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => router.push(`/dashboard/${siteId}`), 1500);
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  const inputClass = "w-full px-4 py-2.5 bg-[#f8fafc] border border-[#bae6fd] rounded-xl text-sm text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0891b2] focus:border-transparent";

  if (loading) return (
    <div className="min-h-screen bg-[#f0f9ff] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#0c4a6e] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f0f9ff]">
      <div className="bg-gradient-to-r from-[#0c4a6e] to-[#0369a1] px-8 py-6">
        <div className="max-w-xl mx-auto">
          <Link href={`/dashboard/${siteId}`} className="text-xs text-white/60 hover:text-white/90 font-medium mb-2 inline-block">← Back to Dashboard</Link>
          <h1 className="text-2xl font-black text-white mb-1">Revenue Questionnaire</h1>
          <p className="text-sm text-sky-300">Help us translate your behavioral data into dollar impact. This takes about 30 seconds.</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8">
        {saved ? (
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-8 text-center">
            <svg className="w-12 h-12 text-[#16a34a] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <h2 className="text-lg font-bold text-[#166534] mb-1">Revenue data saved!</h2>
            <p className="text-sm text-[#15803d]">Your dashboard will now show Revenue at Risk instead of Disengaged Leads. Redirecting...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="bg-white border border-[#bae6fd] rounded-2xl p-8 shadow-sm space-y-6">
            <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-4 mb-2">
              <p className="text-xs text-[#334155] leading-relaxed">
                By providing these numbers, WebGrade can calculate <strong>Revenue at Risk</strong> — showing exactly how much money you lose from visitor drop-offs, rather than just counting disengaged visitors.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0c4a6e] mb-1.5">Average order or deal value (USD)</label>
              <p className="text-[10px] text-[#64748b] mb-2">What&apos;s the average revenue from a single customer transaction or closed deal?</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">$</span>
                <input type="number" placeholder="500" value={form.averageOrderValue}
                  onChange={e => setForm(f => ({ ...f, averageOrderValue: e.target.value }))}
                  className={`${inputClass} pl-8`} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0c4a6e] mb-1.5">Lead-to-win rate (%)</label>
              <p className="text-[10px] text-[#64748b] mb-2">Of the leads your website generates, what percentage become paying customers?</p>
              <div className="relative">
                <input type="number" placeholder="20" min="0" max="100" value={form.leadToWinRate}
                  onChange={e => setForm(f => ({ ...f, leadToWinRate: e.target.value }))}
                  className={`${inputClass} pr-8`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0c4a6e] mb-1.5">Website conversion rate (%)</label>
              <p className="text-[10px] text-[#64748b] mb-2">What percentage of website visitors take your desired action (sign up, request demo, purchase)?</p>
              <div className="relative">
                <input type="number" placeholder="2.5" min="0" max="100" step="0.1" value={form.conversionRate}
                  onChange={e => setForm(f => ({ ...f, conversionRate: e.target.value }))}
                  className={`${inputClass} pr-8`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0c4a6e] mb-1.5">Monthly ad spend (USD)</label>
              <p className="text-[10px] text-[#64748b] mb-2">Leave blank if you don&apos;t run paid ads. This helps us calculate ad waste.</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">$</span>
                <input type="number" placeholder="5000" value={form.monthlyAdSpend}
                  onChange={e => setForm(f => ({ ...f, monthlyAdSpend: e.target.value }))}
                  className={`${inputClass} pl-8`} />
              </div>
            </div>

            <button type="submit" disabled={saving || (!form.averageOrderValue && !form.leadToWinRate)}
              className="w-full bg-[#0c4a6e] hover:bg-[#075985] disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm">
              {saving ? 'Saving...' : 'Save & unlock Revenue at Risk'}
            </button>

            <p className="text-xs text-[#94a3b8] text-center">You can update these numbers anytime from Settings.</p>
          </form>
        )}
      </div>
    </div>
  );
}
