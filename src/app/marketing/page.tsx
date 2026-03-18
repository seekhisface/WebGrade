'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ── Animated count-up ──────────────────────────────────────────────────────
function useCountUp(target: number, duration = 2000, trigger = true): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let v = 0;
    const step = target / (duration / 16);
    const t = setInterval(() => {
      v += step;
      if (v >= target) { setVal(target); clearInterval(t); }
      else setVal(Math.floor(v));
    }, 16);
    return () => clearInterval(t);
  }, [target, duration, trigger]);
  return val;
}

// ── Marquee ────────────────────────────────────────────────────────────────
const MARQUEE_ITEMS = [
  { icon: '📊', text: 'Behavioral Intent Scoring' },
  { icon: '🔍', text: 'Live SEO Intelligence' },
  { icon: '📋', text: 'Interim Report™' },
  { icon: '📉', text: 'Drop-off Analysis' },
  { icon: '👁', text: 'WebWatch™ Monthly Monitor' },
  { icon: '🎯', text: 'WebOpp™ Market Intelligence' },
  { icon: '💰', text: 'Ad Spend Efficiency' },
  { icon: '⚡', text: 'Auto-Alert Detection' },
  { icon: '📈', text: 'Revenue at Risk Modeling' },
  { icon: '🏆', text: 'Competitor Gap Analysis' },
];

function Marquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="overflow-hidden py-4 border-y border-[#bae6fd]">
      <div className="flex animate-marquee whitespace-nowrap">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 mx-8 text-sm font-medium text-[#0c4a6e]">
            <span>{item.icon}</span>
            <span>{item.text}</span>
            <span className="text-[#bae6fd] ml-6">◆</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { animation: marquee 32s linear infinite; }
        .animate-marquee:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
}

// ── Products ───────────────────────────────────────────────────────────────
const PRODUCTS = [
  {
    id: 'interim',
    badge: 'ONE-TIME',
    name: 'WebGrade Interim Report™',
    tagline: 'The 45-day forensic audit that pays for itself.',
    description: 'WebGrade analyzes your behavioral data, ad spend, and drop-off patterns to generate a prioritized action plan with estimated dollar impact on every finding.',
    metrics: [
      { label: 'Avg. Revenue at Risk Found', value: '$41k', suffix: '/mo' },
      { label: 'Action Items Generated', value: '12', suffix: 'avg' },
      { label: 'Time to First Insight', value: '30', suffix: 'sec' },
    ],
    features: ['Executive summary + action items', 'Ad spend efficiency analysis', 'Drop-off forensics by page', 'Growth plays with ROI ranking', 'PDF export for your team'],
    color: 'from-[#0c4a6e] to-[#0369a1]',
    accent: '#38bdf8',
  },
  {
    id: 'webwatch',
    badge: 'MONTHLY',
    name: 'WebWatch™',
    tagline: 'Monthly intelligence. Continuous improvement.',
    description: 'Every month WebWatch runs the same forensic analysis — tracking what improved, what regressed, and what new issues emerged. Your site gets smarter every cycle.',
    metrics: [
      { label: 'Metrics Tracked Monthly', value: '28', suffix: '+' },
      { label: 'Avg. Monthly Revenue Recovered', value: '$38k', suffix: '' },
      { label: 'Alert Detection Time', value: '<2', suffix: 'hrs' },
    ],
    features: ['Monthly behavioral report', 'Trend vs. prior month', 'New findings detection', 'Auto-alert on regressions', 'Slack + email delivery'],
    color: 'from-[#0d9488] to-[#0f766e]',
    accent: '#5eead4',
  },
  {
    id: 'webopp',
    badge: 'MONTHLY ADD-ON',
    name: 'WebOpp™',
    tagline: 'See the revenue your competitors are capturing instead of you.',
    description: 'WebOpp maps your entire keyword market — what you own, what your competitors own, and the uncontested demand no one is serving yet.',
    metrics: [
      { label: 'Keywords Analyzed', value: '94k', suffix: 'avg' },
      { label: 'Avg. Opportunity Found', value: '$39k', suffix: '/mo' },
      { label: 'Competitor Gaps Mapped', value: '6', suffix: 'avg' },
    ],
    features: ['Total addressable search market', 'Keyword gap analysis', 'Competitor capture mapping', 'Channel ROI by source', 'Content gap identification'],
    color: 'from-[#7c3aed] to-[#6d28d9]',
    accent: '#c4b5fd',
  },
];

const STATS = [
  { value: 94, suffix: '%', label: 'of sites have recoverable revenue found in first audit' },
  { value: 41, prefix: '$', suffix: 'k/mo', label: 'average revenue at risk identified' },
  { value: 30, suffix: 'sec', label: 'to generate your first AI-powered insight' },
  { value: 45, suffix: ' days', label: 'forensic analysis window for the Interim Report™' },
];

// ── Demo Modal ─────────────────────────────────────────────────────────────
// 👉 REPLACE THIS URL with your actual Cal.com booking link
const CAL_URL = 'https://cal.com/mike-stephens-ffp3wx/30min/webgrade-demo';

function DemoModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll while modal open
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
        className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-[#f0f9ff] hover:bg-[#e0f2fe] flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4 text-[#0c4a6e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* LEFT — Sign up panel */}
        <div className="flex-1 bg-[#0c4a6e] p-8 md:p-10 flex flex-col justify-between min-w-[280px]">
          <div>
            <div className="flex items-center gap-2 mb-8">
              <div className="w-7 h-7 bg-white/15 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-sm">W</span>
              </div>
              <span className="text-white font-bold text-base tracking-tight">WebGrade</span>
            </div>

            <h2 className="text-2xl font-black text-white mb-3 leading-tight">
              See what your site is losing.
            </h2>
            <p className="text-sky-300 text-sm leading-relaxed mb-8">
              Create your free account and connect your GA4 data in 5 minutes. No credit card required.
            </p>

            <ul className="space-y-3 mb-10">
              {[
                '45-day behavioral audit',
                'Revenue at risk identified',
                'Prioritized action plan',
                'Free to start',
              ].map(item => (
                <li key={item} className="flex items-center gap-3 text-sm text-sky-100">
                  <span className="w-5 h-5 rounded-full bg-[#0d9488] flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push('/login')}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-sky-50 text-[#0c4a6e] font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl text-sm"
            >
              Create free account
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <p className="text-center text-xs text-sky-400">
              Already have an account?{' '}
              <button onClick={() => router.push('/login')} className="text-white underline hover:no-underline">
                Sign in
              </button>
            </p>
          </div>
        </div>

        {/* RIGHT — Cal.com embed */}
        <div className="flex-1 flex flex-col min-w-[280px]">
          <div className="p-6 pb-3 border-b border-[#e0f2fe]">
            <p className="text-xs font-bold text-[#0891b2] uppercase tracking-wider mb-1">Optional — Book a walkthrough</p>
            <h3 className="text-base font-black text-[#0c4a6e]">See WebGrade live with your data</h3>
            <p className="text-xs text-[#64748b] mt-1">30-minute demo · Available up to 3 weeks out</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <iframe
              src={`${CAL_URL}?embed=true&layout=month_view`}
              className="w-full h-full border-0"
              style={{ minHeight: '420px' }}
              title="Book a WebGrade demo"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Demo Button ────────────────────────────────────────────────────────────
function DemoButton({
  size = 'md',
  className = '',
  onClick,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}) {
  const sizes = { sm: 'px-4 py-2 text-sm', md: 'px-6 py-3 text-sm', lg: 'px-8 py-4 text-base' };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 bg-[#0c4a6e] hover:bg-[#075985] text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl ${sizes[size]} ${className}`}
    >
      Sign up for a demo
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
      </svg>
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function MarketingPage() {
  const [statsVisible, setStatsVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const s0 = useCountUp(STATS[0].value, 1600, statsVisible);
  const s1 = useCountUp(STATS[1].value, 1600, statsVisible);
  const s2 = useCountUp(STATS[2].value, 1200, statsVisible);
  const s3 = useCountUp(STATS[3].value, 1800, statsVisible);
  const animatedStats = [s0, s1, s2, s3];

  const openModal = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  return (
    <div className="min-h-screen bg-[#f0f9ff]" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* Modal */}
      {showModal && <DemoModal onClose={closeModal} />}

      {/* NAV */}
      <nav className="bg-[#0c4a6e] px-6 py-0 h-14 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/15 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-sm">W</span>
          </div>
          <span className="text-white font-bold text-base tracking-tight">WebGrade</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <a href="#products" className="text-sky-300 hover:text-white text-sm transition-colors">Products</a>
          <a href="#pricing" className="text-sky-300 hover:text-white text-sm transition-colors">Pricing</a>
          <Link href="/login" className="text-sky-300 hover:text-white text-sm transition-colors">Sign in</Link>
        </div>
        <DemoButton size="sm" onClick={openModal} />
      </nav>

      {/* HERO */}
      <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-[#0c4a6e]/10 border border-[#bae6fd] rounded-full px-4 py-1.5 mb-6">
          <span className="w-1.5 h-1.5 bg-[#0d9488] rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-[#0c4a6e] uppercase tracking-wider">Website intelligence for founders</span>
        </div>

        <h1 className="text-5xl md:text-6xl font-black text-[#0c4a6e] leading-tight mb-6 tracking-tight">
          Your website is losing<br />
          <span className="text-[#0891b2]">$41,000/mo</span> you don&apos;t know about.
        </h1>

        <p className="text-xl text-[#334155] max-w-2xl mx-auto mb-8 leading-relaxed">
          WebGrade finds the behavioral signals, drop-off patterns, and market gaps that are costing you revenue — and gives you the exact fixes, ranked by impact.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <DemoButton size="lg" onClick={openModal} />
          <a href="#products" className="inline-flex items-center gap-2 text-[#0c4a6e] font-semibold text-sm hover:text-[#0891b2] transition-colors">
            See how it works
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-10">
          {['Behavioral Intelligence', 'Live SEO', 'Interim Report™', 'WebWatch™', 'WebOpp™', 'Auto-Alerts'].map(p => (
            <span key={p} className="px-3 py-1.5 bg-white border border-[#bae6fd] rounded-full text-xs font-semibold text-[#0c4a6e] shadow-sm">
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* MARQUEE */}
      <div className="bg-white">
        <Marquee />
      </div>

      {/* STATS */}
      <section ref={statsRef} className="bg-[#0c4a6e] py-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-4xl font-black text-white mb-2">
                  {s.prefix ?? ''}{animatedStats[i]}{s.suffix}
                </p>
                <p className="text-xs text-sky-300 leading-relaxed">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section id="products" className="py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-[#0891b2] uppercase tracking-wider mb-3">Three Products. One Platform.</p>
            <h2 className="text-4xl font-black text-[#0c4a6e] mb-4">Intelligence at every stage</h2>
            <p className="text-lg text-[#334155] max-w-xl mx-auto">Start with a one-time audit. Scale to continuous intelligence. Add market analysis when you&apos;re ready to grow.</p>
          </div>

          <div className="space-y-8">
            {PRODUCTS.map((p) => (
              <div key={p.id} className="bg-white rounded-3xl border border-[#bae6fd] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className={`bg-gradient-to-r ${p.color} p-8`}>
                  <div className="flex items-start justify-between gap-6 flex-wrap">
                    <div className="flex-1 min-w-[280px]">
                      <span className="inline-block text-[10px] font-black tracking-widest px-2.5 py-1 rounded-full mb-3"
                        style={{ backgroundColor: `${p.accent}30`, color: p.accent }}>
                        {p.badge}
                      </span>
                      <h3 className="text-2xl font-black text-white mb-2">{p.name}</h3>
                      <p className="text-base font-semibold mb-3" style={{ color: p.accent }}>{p.tagline}</p>
                      <p className="text-sm text-white/75 leading-relaxed max-w-xl">{p.description}</p>
                    </div>
                    <div className="hidden md:grid grid-cols-3 gap-4 flex-shrink-0">
                      {p.metrics.map((m, mi) => (
                        <div key={mi} className="text-center bg-white/10 rounded-2xl p-4 min-w-[90px]">
                          <p className="text-2xl font-black text-white">{m.value}<span className="text-sm font-normal" style={{ color: p.accent }}>{m.suffix}</span></p>
                          <p className="text-[10px] text-white/60 mt-1 leading-tight">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="p-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-3">
                    {p.features.map((f, fi) => (
                      <span key={fi} className="flex items-center gap-1.5 text-xs text-[#334155]">
                        <svg className="w-3.5 h-3.5 text-[#0d9488] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </span>
                    ))}
                  </div>
                  <DemoButton size="sm" className="flex-shrink-0" onClick={openModal} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-white py-20 border-y border-[#bae6fd]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-[#0891b2] uppercase tracking-wider mb-3">Simple Setup</p>
            <h2 className="text-3xl font-black text-[#0c4a6e] mb-4">From sign-up to first insight in 5 minutes</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { n: '1', title: 'Connect GA4', desc: 'One-click Google Analytics connection brings in 90 days of baseline data.' },
              { n: '2', title: 'Add the snippet', desc: 'One line of JavaScript on your site starts capturing behavioral signals immediately.' },
              { n: '3', title: 'Generate your report', desc: 'Click Generate — AI analyzes all your data and surfaces the highest-impact findings.' },
              { n: '4', title: 'Fix and track', desc: 'Work through the action items. WebWatch tracks your improvements month over month.' },
            ].map(s => (
              <div key={s.n} className="text-center">
                <div className="w-10 h-10 bg-[#0c4a6e] text-white rounded-xl flex items-center justify-center font-black text-lg mx-auto mb-3">{s.n}</div>
                <h4 className="text-sm font-bold text-[#1e293b] mb-2">{s.title}</h4>
                <p className="text-xs text-[#64748b] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-[#0891b2] uppercase tracking-wider mb-3">Transparent Pricing</p>
            <h2 className="text-4xl font-black text-[#0c4a6e] mb-4">Start with an audit. Scale with intelligence.</h2>
            <p className="text-lg text-[#334155] max-w-xl mx-auto">No long contracts. Start with a one-time report, upgrade to continuous monitoring when you&apos;re ready.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl border border-[#bae6fd] p-7 flex flex-col">
              <div className="mb-6">
                <span className="text-[10px] font-black text-[#0891b2] uppercase tracking-wider">One-Time</span>
                <h3 className="text-xl font-black text-[#1e293b] mt-1 mb-1">Interim Report™</h3>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-4xl font-black text-[#0c4a6e]">$497</span>
                  <span className="text-sm text-[#64748b]">one time</span>
                </div>
                <p className="text-xs text-[#64748b] mt-2">45-day forensic audit of your site&apos;s behavioral data, ad spend, and conversion funnel.</p>
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {['Full behavioral audit', 'Drop-off analysis', 'Ad spend efficiency', 'Prioritized action plan', 'PDF export', 'One-time delivery'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#334155]">
                    <svg className="w-4 h-4 text-[#0d9488] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <DemoButton size="md" className="w-full justify-center" onClick={openModal} />
            </div>

            <div className="bg-[#0c4a6e] rounded-3xl p-7 flex flex-col relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-[#0891b2] text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">Popular</div>
              <div className="mb-6">
                <span className="text-[10px] font-black text-sky-300 uppercase tracking-wider">Monthly</span>
                <h3 className="text-xl font-black text-white mt-1 mb-1">WebWatch™</h3>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-4xl font-black text-white">$297</span>
                  <span className="text-sm text-sky-300">/month</span>
                </div>
                <p className="text-xs text-sky-300 mt-2">Continuous monitoring. New findings every month. Track what improved and what regressed.</p>
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {['Everything in Interim Report™', 'Monthly fresh analysis', 'Trend vs. prior month', 'Auto-alert on regressions', 'Slack + email delivery', 'Cancel anytime'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-sky-100">
                    <svg className="w-4 h-4 text-[#0d9488] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={openModal}
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-sky-50 text-[#0c4a6e] font-bold py-3 px-6 rounded-xl transition-colors text-sm"
              >
                Sign up for a demo →
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-[#bae6fd] p-7 flex flex-col">
              <div className="mb-6">
                <span className="text-[10px] font-black text-[#7c3aed] uppercase tracking-wider">Monthly Add-On</span>
                <h3 className="text-xl font-black text-[#1e293b] mt-1 mb-1">WebOpp™</h3>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-4xl font-black text-[#0c4a6e]">$197</span>
                  <span className="text-sm text-[#64748b]">/month</span>
                </div>
                <p className="text-xs text-[#64748b] mt-2">Add-on to WebWatch. Market intelligence, competitor gaps, and keyword opportunities updated monthly.</p>
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {['Full keyword market map', 'Competitor gap analysis', 'Uncontested demand', 'Channel ROI by source', 'Content gap identification', 'Cancel anytime'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#334155]">
                    <svg className="w-4 h-4 text-[#0d9488] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <DemoButton size="md" className="w-full justify-center" onClick={openModal} />
            </div>
          </div>

          <div className="mt-6 p-5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl text-center">
            <p className="text-sm text-[#166534]">
              <strong>Bundle discount:</strong> Get WebWatch™ + WebOpp™ together for <strong>$397/mo</strong> — save $97/month.{' '}
              <button onClick={openModal} className="underline hover:no-underline text-[#166534]">Sign up for a demo →</button>
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-[#0c4a6e] py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-black text-white mb-4">Find out what your site is losing today.</h2>
          <p className="text-lg text-sky-300 mb-8 leading-relaxed">
            Most sites have $30k–$60k/mo in recoverable revenue sitting in their behavioral data. WebGrade finds it in 30 seconds.
          </p>
          <DemoButton size="lg" className="mx-auto" onClick={openModal} />
          <p className="text-xs text-sky-400 mt-4">No credit card required · Setup in 5 minutes · Cancel anytime</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#082f49] py-10">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white/15 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xs">W</span>
            </div>
            <span className="text-white font-bold text-sm">WebGrade</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-sky-400">
            <a href="#products" className="hover:text-white transition-colors">Products</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
          <p className="text-xs text-sky-600">© 2026 WebGrade. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
