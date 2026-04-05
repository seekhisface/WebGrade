'use client';

import { useEffect } from 'react';

const BENEFITS = [
  { text: 'Monthly AI-Generated Reports', desc: 'Executive summary, action items, and growth plays delivered every month', bold: true },
  { text: 'Continuous Drop-Off Monitoring', desc: 'Track which pages lose visitors and get alerts when exit rates spike' },
  { text: 'Revenue at Risk Tracking', desc: 'See exactly how much money you leave on the table — and watch it shrink' },
  { text: 'Verified Fix Impact', desc: 'Before/after measurement proves your changes actually worked', bold: true },
  { text: 'Month-over-Month Trend Analysis', desc: 'Sessions, intent scores, conversions, and bounce rate compared monthly' },
  { text: 'Baseline vs. Current Comparison', desc: 'Your initial WebAudit becomes the benchmark — track improvement over time' },
  { text: 'Auto-Alert Detection', desc: 'Instant notifications when key metrics regress or spike unexpectedly' },
  { text: 'Ad Spend Efficiency Updates', desc: 'Monthly scan for wasted spend across all your campaigns' },
  { text: 'SEO Rankings & Traffic', desc: 'Keyword positions, organic traffic, and crawl health tracked weekly', bold: true },
  { text: 'Priority Recommendations', desc: 'AI-ranked action items refreshed every month based on new data' },
  { text: 'Archived Report History', desc: 'Browse any past report — frozen KPIs, findings, and action items' },
  { text: 'Slack + Email Delivery', desc: 'Reports and alerts sent where your team already works' },
];

interface WebWatchUpsellModalProps {
  onClose: () => void;
  daysRemaining: number;
  dayElapsed: number;
}

export default function WebWatchUpsellModal({ onClose, daysRemaining, dayElapsed }: WebWatchUpsellModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(8, 47, 73, 0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white rounded-3xl overflow-hidden shadow-2xl"
        style={{ maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-[#0d9488] to-[#0f766e] px-8 py-6 text-center">
          <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">
            {daysRemaining > 0 ? `${daysRemaining} days left in your WebAudit` : 'Your WebAudit has ended'}
          </p>
          <h2 className="text-2xl font-black text-white mb-1">Keep the reports going with WebWatch™</h2>
          <p className="text-sm text-white/70">
            {daysRemaining > 0
              ? `You're on Day ${dayElapsed} of 60. Don't lose momentum — upgrade before your audit ends.`
              : 'Your data is frozen. Upgrade to continue tracking and improving.'}
          </p>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-8 py-6" style={{ maxHeight: 'calc(92vh - 200px)' }}>

          {/* Value proposition */}
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-5 mb-6">
            <p className="text-sm text-[#166534] leading-relaxed">
              WebWatch picks up where WebAudit left off. Instead of a one-time snapshot, you get <strong>continuous monitoring</strong> with
              monthly AI reports, verified fix tracking, and instant alerts when something goes wrong. Your WebAudit baseline becomes the
              benchmark — every month shows you exactly how much you&apos;ve improved.
            </p>
          </div>

          {/* Benefits grid */}
          <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-3">Everything included in WebWatch™</p>
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-2.5 mb-6">
            {BENEFITS.map((b, i) => (
              <div key={i} className="flex items-start gap-2.5 py-0.5">
                <svg className="w-4 h-4 text-[#0d9488] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className={`text-sm leading-tight ${b.bold ? 'font-bold text-[#0c4a6e]' : 'font-semibold text-[#1e293b]'}`}>
                    {b.text}
                  </p>
                  <p className="text-[11px] text-[#64748b] leading-snug">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center pt-4 border-t border-[#e2e8f0]">
            <a href="#upgrade"
              className="inline-flex items-center gap-2 px-8 py-3 bg-[#0d9488] hover:bg-[#0f766e] text-white font-bold rounded-xl transition-colors shadow-lg text-sm">
              Upgrade to WebWatch™
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
            <p className="text-xs text-[#94a3b8] mt-3">Cancel anytime · Reports start immediately</p>
          </div>
        </div>
      </div>
    </div>
  );
}
