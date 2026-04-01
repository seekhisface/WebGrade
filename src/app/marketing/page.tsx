'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Cal, { getCalApi } from '@calcom/embed-react';
import SampleReportModal from '@/components/marketing/SampleReportModal';

// -- Hero Slides ----------------------------------------------------------
const HERO_SLIDES = [
  {
    tag: 'WebAudit™',
    headline: <>Your website is losing<br /><span className="text-[#4a9ebe]">$41,000/mo</span> you don&apos;t know about.</>,
    subhead: 'WebGrade finds the behavioral signals, drop-off patterns, and market gaps costing you revenue — and gives you the exact fixes, ranked by impact.',
  },
  {
    tag: 'Live SEO + Behavioral Intelligence',
    headline: <>Your website looks fine.<br />That&apos;s exactly the problem.</>,
    subhead: 'The leaks that hurt most aren\'t visible — they\'re buried in behavioral patterns and missed signals your analytics never surface. WebGrade tracks how real visitors move through your site and shows you exactly where you\'re losing them, filterable by any date range you choose.',
  },
  {
    tag: 'WebOpp™ Market Intelligence',
    headline: <>Your competitors are ranking for keywords<br />your site doesn&apos;t even know exist.</>,
    subhead: 'WebOpp maps the gaps between you and the sites beating you — showing you the untapped keywords, missed traffic, and growth opportunities where your next marketing dollars will have the most impact.',
  },
  {
    tag: 'WebWatch™ Monthly Monitor',
    headline: <>Your site changes. Your performance shifts.<br />Most owners find out too late.</>,
    subhead: 'WebWatch monitors your site every month — automatically flagging drops in performance, emerging competitive threats, and new opportunities before they cost you revenue.',
  },
  {
    tag: 'Get Started',
    headline: <>Sign up in 5 minutes.<br />Add the snippet in 5 more.<br />Start getting real answers.</>,
    subhead: 'WebGrade starts tracking the moment the snippet is live. Within weeks you\'ll have real behavioral data, competitive gaps, and a ranked fix list — all in one dashboard built for owners, not analysts.',
  },
];

// -- Deliverables List (ranked by impact, bold = high value) --------------
const DELIVERABLES = [
  { text: 'Revenue at Risk Modeling', bold: true, desc: 'Dollar-impact estimates on every finding.' },
  { text: 'AI-Powered Fix Recommendations', bold: true, desc: 'Prioritized action plans with estimated ROI.' },
  { text: 'Drop-Off Analysis', bold: true, desc: 'Which pages lose visitors and why.' },
  { text: 'Behavioral Intent Scoring', bold: true, desc: 'Separate buyers from browsers automatically.' },
  { text: 'Ad Spend Efficiency Analysis', bold: true, desc: 'Where your dollars convert vs. get wasted.' },
  { text: 'Competitor Gap Analysis', bold: true, desc: 'Keywords and traffic your competitors capture.' },
  { text: 'Auto-Alert Detection', bold: false, desc: 'Instant notifications on performance drops.' },
  { text: 'Monthly Trend Tracking', bold: false, desc: 'What improved, regressed, or emerged.' },
  { text: 'Live SEO Intelligence', bold: false, desc: 'Rankings, keywords, and organic traffic.' },
  { text: 'Keyword Gap & Opportunity Mapping', bold: false, desc: 'Untapped demand ranked by revenue.' },
  { text: 'Web Crawling Health Scores', bold: false, desc: 'Indexability, crawl errors, and fixes.' },
  { text: 'Broken Link Detection', bold: false, desc: 'Every dead link costing you visitors.' },
  { text: 'Wasted Spend Identification', bold: false, desc: 'Campaigns driving traffic but not converting.' },
  { text: 'Bot Detection & Traffic Filtering', bold: false, desc: 'Real visitors only — bots filtered out.' },
  { text: 'Slack + Email Alert Delivery', bold: false, desc: 'Alerts where your team already works.' },
  { text: 'Win-Back Reports', bold: false, desc: 'Re-engage lost prospects with data.' },
];

// -- Stats (sourced, defensible) ------------------------------------------
const STATS = [
  { value: 70, suffix: '%', label: 'of visitors leave a site without converting — most never return', source: 'Baymard Institute' },
  { value: 91, suffix: '%', label: 'of web content is invisible to Google search', source: 'Ahrefs' },
  { value: 3, suffix: ' sec', label: 'is all a mobile visitor waits before abandoning your site', source: 'Google Web Vitals' },
  { value: 25, suffix: '%', label: 'average conversion lift when UX issues are identified and fixed', source: 'Forrester Research' },
];

// -- Animated count-up ----------------------------------------------------
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

// -- Products -------------------------------------------------------------
const PRODUCTS = [
  {
    id: 'webaudit',
    badge: 'YOUR FIRST 60 DAYS',
    name: 'WebAudit™',
    tagline: 'The 60-day deep dive that every WebGrade customer starts with.',
    description: 'WebAudit is your onboarding into WebGrade. Over 60 days, we analyze your behavioral data, ad spend, and drop-off patterns to build your baseline — then you graduate to continuous WebWatch monitoring.',
    cards: [
      { title: 'Executive Summary', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', lines: ['AI-generated overview', 'Key findings & risks', 'Priority action items'] },
      { title: 'Drop-Off Analysis', icon: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6', lines: ['Page-by-page funnel', 'Exit point mapping', 'Revenue impact per page'] },
      { title: 'Growth Plays', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', lines: ['ROI-ranked fixes', 'Ad spend efficiency', 'Quick wins highlighted'] },
    ],
    features: ['AI-generated executive summary', 'Revenue at risk per issue', 'Drop-off forensics by page', 'Ad spend waste identified', 'Converts to WebWatch after 60 days'],
    color: 'from-[#0c4a6e] to-[#0369a1]',
    accent: '#38bdf8',
  },
  {
    id: 'webwatch',
    badge: 'MONTHLY',
    name: 'WebWatch™',
    tagline: 'Monthly intelligence. Continuous improvement.',
    description: 'Every month WebWatch runs the same forensic analysis — tracking what improved, what regressed, and what new issues emerged. Your site gets smarter every cycle.',
    cards: [
      { title: 'Monthly Report', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', lines: ['What improved this month', 'What regressed & why', 'New issues detected'] },
      { title: 'Auto-Alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', lines: ['Performance drop alerts', 'Traffic anomaly detection', 'Slack + email delivery'] },
      { title: 'Trend Tracking', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', lines: ['Month-over-month data', 'Improvement tracking', 'Regression flagging'] },
    ],
    features: ['Month-over-month comparison', 'New issue detection', 'Performance regression alerts', 'Slack + email delivery', 'Continuous behavioral tracking'],
    color: 'from-[#0d9488] to-[#0f766e]',
    accent: '#5eead4',
  },
  {
    id: 'webopp',
    badge: 'MONTHLY ADD-ON',
    name: 'WebOpp™',
    tagline: 'See the revenue your competitors are capturing instead of you.',
    description: 'WebOpp maps your entire keyword market — what you own, what your competitors own, and the uncontested demand no one is serving yet.',
    cards: [
      { title: 'Keyword Gap Map', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', lines: ['Your keywords vs. theirs', 'Uncontested opportunities', 'Search volume data'] },
      { title: 'Competitor Intel', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0', lines: ['Who ranks where you don\'t', 'Traffic capture analysis', 'Domain-level mapping'] },
      { title: 'Growth Roadmap', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7', lines: ['Revenue-ranked priorities', 'Content gap opportunities', 'Channel ROI by source'] },
    ],
    features: ['Total addressable search market', 'Competitor keyword capture map', 'Uncontested demand identification', 'Channel ROI by source', 'Content gap opportunities'],
    color: 'from-[#7c3aed] to-[#6d28d9]',
    accent: '#c4b5fd',
  },
];

// -- Cal.com embed --------------------------------------------------------
function CalBooking() {
  useEffect(() => {
    (async () => {
      const cal = await getCalApi({ namespace: 'webgrade-demo' });
      cal('ui', {
        styles: { branding: { brandColor: '#0c4a6e' } },
        hideEventTypeDetails: false,
        layout: 'month_view',
      });
    })();
  }, []);

  return (
    <Cal
      namespace="webgrade-demo"
      calLink="mike-stephens-ffp3wx/webgrade-demo"
      style={{ width: '100%', height: '100%', minHeight: '420px' }}
      config={{ layout: 'month_view' }}
    />
  );
}

// -- Demo Modal -----------------------------------------------------------
function DemoModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();

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
        className="relative w-full max-w-5xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
        style={{ maxHeight: '95vh' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-[#f0f9ff] hover:bg-[#e0f2fe] flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4 text-[#0c4a6e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex-[1.2] bg-[#0c4a6e] p-8 md:p-10 flex flex-col justify-between min-w-[320px]">
          <div>
            <div className="mb-8">
              <Image src="/logos/webgrade_logo_dark.svg" alt="WebGrade" width={260} height={48} className="h-12 w-auto" />
            </div>

            <h2 className="text-3xl font-black text-white mb-4 leading-tight">
              See what your site is losing.
            </h2>
            <p className="text-sky-300 text-base leading-relaxed mb-8">
              Start with a 60-day WebAudit — a full forensic deep dive into your behavioral data, drop-off patterns, and ad spend efficiency.
            </p>

            <ul className="space-y-4 mb-10">
              {[
                { item: 'Full behavioral analysis', desc: 'Visitor intent, drop-offs, and conversion funnels' },
                { item: 'Revenue at risk identified', desc: 'Dollar impact on every finding' },
                { item: 'AI-powered action plan', desc: 'Prioritized fixes ranked by ROI' },
                { item: 'Converts to WebWatch', desc: 'Monthly monitoring after your audit completes' },
              ].map(({ item, desc }) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#0d9488] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{item}</p>
                    <p className="text-xs text-sky-300/80">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push('/login')}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-sky-50 text-[#0c4a6e] font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl text-sm"
            >
              Get started
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

        <div className="flex-1 flex flex-col min-w-[300px]">
          <div className="p-4 pb-2 border-b border-[#e0f2fe]">
            <p className="text-[10px] font-bold text-[#0891b2] uppercase tracking-wider mb-1">Optional — Book a walkthrough</p>
            <h3 className="text-sm font-black text-[#0c4a6e]">See WebGrade live with your data</h3>
            <p className="text-[10px] text-[#64748b] mt-1">30-minute demo · Available up to 3 weeks out</p>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ minHeight: '460px', transform: 'scale(0.9)', transformOrigin: 'top center' }}>
            <CalBooking />
          </div>
          <div className="flex items-center justify-center gap-1.5 py-3 border-t border-[#e0f2fe] text-[#0891b2]">
            <span className="text-xs font-medium">Scroll down for available times</span>
            <svg className="w-3.5 h-3.5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Demo Button ----------------------------------------------------------
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

// -- Hero Slider ----------------------------------------------------------
function HeroSlider({
  currentSlide,
  onSlideChange,
  onPause,
  onResume,
  openModal,
  onOpenDeliverables,
}: {
  currentSlide: number;
  onSlideChange: (i: number) => void;
  onPause: () => void;
  onResume: () => void;
  openModal: () => void;
  onOpenDeliverables: () => void;
}) {
  return (
    <section
      className="max-w-5xl mx-auto px-4 pb-16 text-center"
      onMouseEnter={onPause}
      onMouseLeave={onResume}
    >
      {/* SLIDE AREA: fixed height, content aligned to bottom so it grows up into padding */}
      <div className="relative h-[400px] flex flex-col justify-end">
        {HERO_SLIDES.map((slide, i) => (
          <div
            key={i}
            className={`absolute bottom-0 left-0 right-0 transition-opacity duration-700 ease-in-out flex flex-col items-center ${
              i === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <div className="inline-flex items-center gap-2 bg-[#0c4a6e]/10 border border-[#bae6fd] rounded-full px-4 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 bg-[#0d9488] rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-[#0c4a6e] uppercase tracking-wider">{slide.tag}</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#0c4a6e] leading-tight mb-6 tracking-tight">
              {slide.headline}
            </h1>

            <p className="text-lg md:text-xl text-[#334155] max-w-2xl mx-auto leading-relaxed">
              {slide.subhead}
            </p>
          </div>
        ))}
      </div>

      {/* STATIC: CTAs, pills, dots — these never move */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
        <DemoButton size="lg" onClick={openModal} />
        <button
          onClick={onOpenDeliverables}
          className="inline-flex items-center gap-2 text-[#0c4a6e] font-bold text-sm hover:text-[#0891b2] transition-colors bg-[#e0f2fe] hover:bg-[#bae6fd] px-5 py-2.5 rounded-xl border border-[#bae6fd] shadow-sm animate-subtle-pulse"
        >
          <svg className="w-4 h-4 text-[#0891b2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Everything WebGrade tracks for you
        </button>
        <style>{`
          @keyframes subtle-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(8, 145, 178, 0.3); } 50% { box-shadow: 0 0 0 8px rgba(8, 145, 178, 0); } }
          .animate-subtle-pulse { animation: subtle-pulse 2.5s ease-in-out infinite; }
        `}</style>
      </div>

      <div className="flex flex-wrap justify-center gap-3 mt-8">
        {HERO_SLIDES.slice(0, 4).map((slide, i) => (
          <button
            key={slide.tag}
            onClick={() => onSlideChange(i)}
            className={`px-4 py-1.5 border rounded-full text-xs font-semibold shadow-sm transition-all cursor-pointer ${
              i === currentSlide
                ? 'bg-[#0c4a6e] text-white border-[#0c4a6e]'
                : 'bg-white text-[#0c4a6e] border-[#bae6fd] hover:bg-[#f0f9ff]'
            }`}
          >
            {slide.tag}
          </button>
        ))}
        <button
          onClick={() => onSlideChange(4)}
          className={`px-4 py-1.5 border rounded-full text-xs font-bold shadow-sm transition-all cursor-pointer ${
            currentSlide === 4
              ? 'bg-[#0d9488] text-white border-[#0d9488]'
              : 'bg-[#f0fdf4] text-[#0d9488] border-[#0d9488] hover:bg-[#0d9488] hover:text-white'
          }`}
        >
          {HERO_SLIDES[4].tag}
        </button>
      </div>

      <div className="flex justify-center gap-2 mt-5">
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => onSlideChange(i)}
            className={`w-2 h-2 rounded-full transition-all ${
              i === currentSlide ? 'bg-[#0c4a6e] w-6' : 'bg-[#bae6fd] hover:bg-[#7dd3fc]'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

// -- Deliverables Modal ---------------------------------------------------
function DeliverablesModal({ onClose }: { onClose: () => void }) {
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
        className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl"
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

        {/* Header */}
        <div className="bg-[#0c4a6e] px-6 py-5 text-center">
          <h2 className="text-xl font-black text-white mb-1">Everything WebGrade tracks for you</h2>
          <p className="text-xs text-sky-300">One platform. Every signal that matters to your bottom line.</p>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-2">
            {DELIVERABLES.map((d, i) => (
              <div key={i} className="flex items-start gap-2 py-0.5">
                <svg className="w-4 h-4 text-[#0d9488] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className={`text-sm leading-tight ${d.bold ? 'font-bold text-[#0c4a6e]' : 'font-semibold text-[#1e293b]'}`}>
                    {d.text}
                  </p>
                  <p className="text-[11px] text-[#64748b] leading-snug">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Page -----------------------------------------------------------------
export default function MarketingPage() {
  const [statsVisible, setStatsVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeliverables, setShowDeliverables] = useState(false);
  const [sampleReport, setSampleReport] = useState<'webaudit' | 'webwatch' | 'webopp' | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [sliderPaused, setSliderPaused] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  // Auto-advance slider — always runs, 3 seconds per slide
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.85 && rect.bottom > 0) {
        setStatsVisible(true);
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const s0 = useCountUp(STATS[0].value, 1600, statsVisible);
  const s1 = useCountUp(STATS[1].value, 1600, statsVisible);
  const s2 = useCountUp(STATS[2].value, 800, statsVisible);
  const s3 = useCountUp(STATS[3].value, 1400, statsVisible);
  const animatedStats = [s0, s1, s2, s3];

  const openModal = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  return (
    <div className="min-h-screen bg-[#f0f9ff]" style={{ fontFamily: "'Space Grotesk', 'Inter', -apple-system, sans-serif" }}>

      {showModal && <DemoModal onClose={closeModal} />}
      {showDeliverables && <DeliverablesModal onClose={() => setShowDeliverables(false)} />}
      {sampleReport && <SampleReportModal type={sampleReport} onClose={() => setSampleReport(null)} />}

      {/* NAV */}
      <nav className="bg-[#0c4a6e] px-6 py-0 h-[72px] relative flex items-center justify-between sticky top-0 z-50 shadow-lg">
        {/* Left: Logo */}
        <Image src="/logos/webgrade_logo_dark.svg" alt="WebGrade" width={300} height={56} className="h-14 w-auto" />

        {/* Center: Nav links (absolute for true center) */}
        <div className="hidden md:flex items-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <a href="#products" className="text-sky-300 hover:text-white text-sm font-medium transition-colors">Products</a>
          <a href="#pricing" className="text-sky-300 hover:text-white text-sm font-medium transition-colors">Pricing</a>
        </div>

        {/* Right: Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={openModal}
            className="px-5 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white font-bold text-sm rounded-xl transition-all shadow-lg hover:shadow-xl"
          >
            Demo
          </button>
          <Link
            href="/login"
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-xl border border-white/30 transition-all"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* HERO SLIDER */}
      <HeroSlider
        currentSlide={currentSlide}
        onSlideChange={setCurrentSlide}
        onPause={() => setSliderPaused(true)}
        onResume={() => setSliderPaused(false)}
        openModal={openModal}
        onOpenDeliverables={() => setShowDeliverables(true)}
      />

      {/* STATS */}
      <section ref={statsRef} className="bg-[#0c4a6e] py-16 mt-8">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-4xl font-black text-white mb-2">
                  {animatedStats[i]}{s.suffix}
                </p>
                <p className="text-xs text-sky-300 leading-relaxed">{s.label}</p>
                <p className="text-[10px] text-sky-500/60 mt-1">{s.source}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="bg-[#f0fdf4] border-y border-[#bbf7d0] py-6">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div className="flex flex-col items-center gap-1.5 text-sm text-[#166534]">
              <svg className="w-5 h-5 text-[#0d9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span><strong>Privacy-first tracking</strong></span>
              <span className="text-xs text-[#166534]/70">GDPR-compliant, no raw IPs stored</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-sm text-[#166534]">
              <svg className="w-5 h-5 text-[#0d9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span><strong>Exportable PDF reports</strong></span>
              <span className="text-xs text-[#166534]/70">Share with your team or board</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-sm text-[#166534]">
              <svg className="w-5 h-5 text-[#0d9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span><strong>24/7 monitoring</strong></span>
              <span className="text-xs text-[#166534]/70">Hourly and daily performance tracking</span>
            </div>
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
                    <div className="hidden md:grid grid-cols-3 gap-3 flex-shrink-0">
                      {p.cards.map((card, ci) => (
                        <div key={ci} className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 min-w-[130px] border border-white/10">
                          <svg className="w-6 h-6 mb-2" style={{ color: p.accent }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
                          </svg>
                          <p className="text-xs font-bold text-white mb-2">{card.title}</p>
                          {card.lines.map((line, li) => (
                            <div key={li} className="flex items-center gap-1.5 mb-1">
                              <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: p.accent }} />
                              <span className="text-[10px] text-white/70">{line}</span>
                            </div>
                          ))}
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
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <DemoButton size="sm" className="flex-shrink-0" onClick={openModal} />
                    <button
                      onClick={() => setSampleReport(p.id as 'webaudit' | 'webwatch' | 'webopp')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0891b2] hover:bg-[#0c4a6e] rounded-xl transition-colors shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Sample report
                    </button>
                  </div>
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
            <h2 className="text-3xl font-black text-[#0c4a6e] mb-4">From sign-up to first insight in minutes</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { n: '1', title: 'Sign up & add your site', desc: 'Create your account and add the WebGrade snippet — takes about 10 minutes.' },
              { n: '2', title: 'WebAudit runs for 60 days', desc: 'WebGrade collects behavioral data and builds your full forensic baseline.' },
              { n: '3', title: 'Get your audit report', desc: 'AI analyzes everything and delivers a prioritized action plan with dollar impact.' },
              { n: '4', title: 'Graduate to WebWatch', desc: 'After 60 days, WebWatch takes over — tracking improvements and catching new issues every month.' },
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
            <p className="text-xs font-bold text-[#0891b2] uppercase tracking-wider mb-3">Simple Pricing</p>
            <h2 className="text-4xl font-black text-[#0c4a6e] mb-4">Start with your audit. Stay for the intelligence.</h2>
            <p className="text-lg text-[#334155] max-w-xl mx-auto">Every customer starts with a 60-day WebAudit. After that, WebWatch keeps your site improving month over month.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-[#0c4a6e] rounded-3xl p-7 flex flex-col relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-[#0891b2] text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">Start Here</div>
              <div className="mb-6">
                <span className="text-[10px] font-black text-sky-300 uppercase tracking-wider">First 60 Days</span>
                <h3 className="text-xl font-black text-white mt-1 mb-1">WebAudit™</h3>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-4xl font-black text-white">$1,000</span>
                  <span className="text-sm text-sky-300">for 60 days</span>
                </div>
                <p className="text-xs text-sky-300 mt-2">Your deep-dive onboarding into WebGrade. Full forensic audit of behavioral data, ad spend, and conversion funnels.</p>
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {['Full 60-day behavioral audit', 'AI-generated executive summary', 'Drop-off analysis by page', 'Revenue at risk identified', 'Ad spend efficiency review', 'Converts to WebWatch automatically'].map(f => (
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
                Get started →
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-[#bae6fd] p-7 flex flex-col">
              <div className="mb-6">
                <span className="text-[10px] font-black text-[#0891b2] tracking-wider">After WebAudit</span>
                <h3 className="text-xl font-black text-[#1e293b] mt-1 mb-1">WebWatch™</h3>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-4xl font-black text-[#0c4a6e]">$299</span>
                  <span className="text-sm text-[#64748b]">/month</span>
                </div>
                <p className="text-xs text-[#64748b] mt-2">Continuous monthly monitoring. Track improvements, catch regressions, get new AI recommendations every cycle.</p>
              </div>
              <ul className="space-y-2.5 mb-8 flex-1">
                {['Monthly fresh analysis', 'Trend vs. prior month', 'Auto-alert on regressions', 'New issue detection', 'Slack + email delivery', 'Cancel anytime'].map(f => (
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

            <div className="bg-white rounded-3xl border border-[#bae6fd] p-7 flex flex-col">
              <div className="mb-6">
                <span className="text-[10px] font-black text-[#7c3aed] uppercase tracking-wider">Add-On</span>
                <h3 className="text-xl font-black text-[#1e293b] mt-1 mb-1">WebOpp™</h3>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-4xl font-black text-[#0c4a6e]">$199</span>
                  <span className="text-sm text-[#64748b]">/month</span>
                </div>
                <p className="text-xs text-[#64748b] mt-2">Add to WebWatch for an outside-in view. Competitor intelligence, keyword gaps, and market opportunities.</p>
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
              <strong>Annual commitment:</strong> Sign up for WebWatch™ + WebOpp™ for 12 months and pay just <strong>$398/mo</strong> — save over $1,200/year.{' '}
              <button onClick={openModal} className="underline hover:no-underline text-[#166534]">Get started →</button>
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-[#0c4a6e] py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-black text-white mb-4">Find out what your site is losing today.</h2>
          <p className="text-lg text-sky-300 mb-8 leading-relaxed">
            Most sites have significant recoverable revenue sitting in their behavioral data. WebGrade finds it and tells you exactly how to fix it.
          </p>
          <DemoButton size="lg" className="mx-auto" onClick={openModal} />
          <p className="text-xs text-sky-400 mt-4">Setup in minutes · Cancel anytime · Results in weeks</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#082f49] py-10">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <Image src="/logos/webgrade_logo_dark.svg" alt="WebGrade" width={180} height={32} className="h-7 w-auto" />
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
