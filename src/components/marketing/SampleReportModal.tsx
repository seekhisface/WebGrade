'use client';

import { useEffect } from 'react';

// -- Shared modal shell ---------------------------------------------------
function ReportShell({ onClose, title, subtitle, color, children }: {
  onClose: () => void;
  title: string;
  subtitle: string;
  color: string;
  children: React.ReactNode;
}) {
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

        <div className={`bg-gradient-to-r ${color} px-8 py-6`}>
          <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Sample Report — NovaPulse HR</p>
          <h2 className="text-2xl font-black text-white">{title}</h2>
          <p className="text-sm text-white/70 mt-1">{subtitle}</p>
        </div>

        <div className="overflow-y-auto px-8 py-6" style={{ maxHeight: 'calc(92vh - 110px)' }}>
          <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-lg px-4 py-2 mb-5 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-[#0891b2] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-[10px] text-[#64748b]">Sample report with illustrative data from NovaPulse HR (60 days of behavioral + SEO + ad spend analysis). Your report will reflect your actual site data.</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// -- Helpers --------------------------------------------------------------
function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 mt-8 first:mt-0">
      <svg className="w-5 h-5 text-[#0891b2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
      </svg>
      <h3 className="text-lg font-black text-[#0c4a6e]">{title}</h3>
    </div>
  );
}

function MetricCard({ label, value, change, status }: { label: string; value: string; change?: string; status?: 'green' | 'red' | 'yellow' }) {
  const statusColors = { green: 'text-emerald-600 bg-emerald-50', red: 'text-red-600 bg-red-50', yellow: 'text-amber-600 bg-amber-50' };
  return (
    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4">
      <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-black text-[#0c4a6e]">{value}</p>
      {change && status && (
        <p className={`text-xs font-semibold mt-1 inline-block px-2 py-0.5 rounded-full ${statusColors[status]}`}>{change}</p>
      )}
    </div>
  );
}

function FindingRow({ severity, title, desc }: { severity: 'HIGH' | 'MEDIUM' | 'LOW'; title: string; desc: string }) {
  const colors = { HIGH: 'bg-red-100 text-red-700', MEDIUM: 'bg-amber-100 text-amber-700', LOW: 'bg-blue-100 text-blue-700' };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#f1f5f9] last:border-0">
      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${colors[severity]}`}>{severity}</span>
      <div className="flex-1">
        <p className="text-sm font-bold text-[#1e293b]">{title}</p>
        <p className="text-xs text-[#64748b] mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function exitRateColor(rate: number): string {
  if (rate >= 70) return 'text-red-700 bg-red-50 font-black';
  if (rate >= 60) return 'text-red-500 bg-red-50 font-bold';
  if (rate >= 50) return 'text-amber-600 bg-amber-50 font-bold';
  if (rate >= 40) return 'text-amber-500 bg-amber-50 font-semibold';
  return 'text-emerald-600 bg-emerald-50 font-semibold';
}

const recColors = [
  { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-600', text: 'text-red-700' },
  { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-600', text: 'text-red-700' },
  { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-600', text: 'text-amber-700' },
  { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-600', text: 'text-amber-700' },
  { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-600', text: 'text-blue-700' },
  { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-600', text: 'text-blue-700' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-600', text: 'text-emerald-700' },
];

// -- WebAudit Report ------------------------------------------------------
function WebAuditReport({ onClose }: { onClose: () => void }) {
  return (
    <ReportShell
      onClose={onClose}
      title="WebAudit™ Report"
      subtitle="60-Day Forensic Audit · NovaPulse HR · Jan 15 – Mar 15, 2026"
      color="from-[#0c4a6e] to-[#0369a1]"
    >
      <SectionHeader title="Executive Summary" icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-5 mb-6">
        <p className="text-sm text-[#334155] leading-relaxed">
          Over the past 60 days, WebGrade analyzed <strong>14,832 visitor sessions</strong> across NovaPulse HR&apos;s website.
          We identified <strong>$41,200/mo in recoverable revenue</strong> across 12 high-priority findings.
          The top three issues — pricing page drop-off, mobile checkout friction, and broken demo CTA — account for
          <strong> 68% of total revenue at risk</strong>. Immediate action on these three items alone could recover an estimated $28,000/mo.
        </p>
      </div>

      <SectionHeader title="Baseline Metrics" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total Sessions" value="14,832" />
        <MetricCard label="Bounce Rate" value="64.2%" status="red" change="Above industry avg" />
        <MetricCard label="Avg. Session Duration" value="1m 42s" status="yellow" change="Below benchmark" />
        <MetricCard label="Conversion Rate" value="1.8%" status="red" change="Industry avg: 3.2%" />
        <MetricCard label="High-Intent Visitors" value="2,891" />
        <MetricCard label="Revenue at Risk" value="$41.2k/mo" status="red" change="Recoverable" />
        <MetricCard label="Pages Analyzed" value="47" />
        <MetricCard label="Bot Traffic Filtered" value="8.3%" status="green" change="Removed from data" />
      </div>

      <SectionHeader title="Behavioral Intent Breakdown" icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-emerald-700">2,891</p>
          <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1">High Intent</p>
          <p className="text-[10px] text-emerald-600/70">Ready to buy / demo</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-amber-700">4,612</p>
          <p className="text-[10px] text-amber-600 font-bold uppercase mt-1">Medium Intent</p>
          <p className="text-[10px] text-amber-600/70">Comparing / researching</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-blue-700">5,104</p>
          <p className="text-[10px] text-blue-600 font-bold uppercase mt-1">Low Intent</p>
          <p className="text-[10px] text-blue-600/70">Browsing / informational</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-gray-700">2,225</p>
          <p className="text-[10px] text-gray-600 font-bold uppercase mt-1">Bounce / Bot</p>
          <p className="text-[10px] text-gray-600/70">Filtered from analysis</p>
        </div>
      </div>

      <SectionHeader title="Top Drop-Off Pages" icon="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      <div className="mb-6">
        <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] overflow-hidden">
          <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-[#f1f5f9] text-[9px] font-bold text-[#64748b] uppercase tracking-wider">
            <span>Page</span><span>Visitors</span><span>Exit Rate</span>
          </div>
          {[
            { page: '/pricing', visitors: '3,241', exit: '78%', exitNum: 78 },
            { page: '/checkout', visitors: '891', exit: '72%', exitNum: 72 },
            { page: '/demo-request', visitors: '1,892', exit: '61%', exitNum: 61 },
            { page: '/features', visitors: '2,567', exit: '54%', exitNum: 54 },
            { page: '/case-studies', visitors: '1,456', exit: '48%', exitNum: 48 },
            { page: '/blog', visitors: '2,103', exit: '41%', exitNum: 41 },
          ].map((row, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 px-4 py-2.5 text-sm border-t border-[#f1f5f9]">
              <span className="font-mono text-xs text-[#0891b2]">{row.page}</span>
              <span className="text-[#334155]">{row.visitors}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full inline-block w-fit ${exitRateColor(row.exitNum)}`}>{row.exit}</span>
            </div>
          ))}
        </div>
      </div>

      <SectionHeader title="Ad Spend Efficiency" icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] overflow-hidden mb-6">
        <div className="grid grid-cols-5 gap-2 px-4 py-2 bg-[#f1f5f9] text-[9px] font-bold text-[#64748b] uppercase tracking-wider">
          <span>Channel</span><span>Spend</span><span>Traffic</span><span>Conversions</span><span>Cost/Conv.</span>
        </div>
        {[
          { channel: 'Google Ads', spend: '$4,200/mo', traffic: '3,200', conversions: '13', cpa: '$323', bad: true },
          { channel: 'LinkedIn Ads', spend: '$2,800/mo', traffic: '1,800', conversions: '32', cpa: '$87', bad: false },
          { channel: 'Meta Ads', spend: '$1,600/mo', traffic: '980', conversions: '8', cpa: '$200', bad: true },
          { channel: 'Organic Search', spend: '$0', traffic: '8,400', conversions: '268', cpa: '$0', bad: false },
        ].map((row, i) => (
          <div key={i} className={`grid grid-cols-5 gap-2 px-4 py-2.5 text-sm border-t border-[#f1f5f9] ${row.bad ? 'bg-red-50/50' : ''}`}>
            <span className="font-semibold text-[#1e293b]">{row.channel}</span>
            <span className="text-[#334155]">{row.spend}</span>
            <span className="text-[#334155]">{row.traffic}</span>
            <span className={row.bad ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}>{row.conversions}</span>
            <span className={row.bad ? 'text-red-600 font-bold' : 'text-[#64748b]'}>{row.cpa}</span>
          </div>
        ))}
      </div>

      <SectionHeader title="SEO Baseline Snapshot" icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Indexed Pages" value="47" />
        <MetricCard label="Ranking Keywords" value="1,240" />
        <MetricCard label="Organic Traffic" value="8,400/mo" status="green" change="Best channel" />
        <MetricCard label="Broken Links Found" value="14" status="red" change="Needs attention" />
      </div>

      <SectionHeader title="Priority Findings" icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      <div className="mb-6">
        <FindingRow severity="HIGH" title="Pricing page hemorrhaging high-intent visitors" desc="78% exit rate on /pricing — visitors comparing plans but leaving before selecting. No social proof, no FAQ, no comparison table." />
        <FindingRow severity="HIGH" title="Mobile checkout flow broken on iOS Safari" desc="Demo request form not rendering below the fold on iOS 17+. 61% of mobile visitors never see the CTA." />
        <FindingRow severity="HIGH" title="Demo CTA button below fold on 1080p displays" desc="Primary conversion button requires scrolling on the most common screen resolution. 43% of visitors never scroll past hero." />
        <FindingRow severity="MEDIUM" title="Google Ads spend not converting" desc="$4,200/mo driving 3,200 visitors to /features at a $323 cost-per-conversion. Landing page doesn't match ad intent." />
        <FindingRow severity="MEDIUM" title="Case studies page lacks clear next action" desc="High engagement (4.2 min avg) but no inline CTA. Visitors read and leave — no path to demo or pricing." />
        <FindingRow severity="MEDIUM" title="Meta Ads landing page mismatch" desc="$1,600/mo spend driving to homepage instead of dedicated landing page. Only 8 conversions at $200 each." />
        <FindingRow severity="LOW" title="14 broken links detected across site" desc="Broken links on /resources and /blog creating dead ends. 340 visitors/mo hitting 404 pages." />
        <FindingRow severity="LOW" title="Blog content has no internal linking" desc="12 blog posts with zero links to product or pricing pages. High traffic volume leaking out without conversion path." />
      </div>

      <SectionHeader title="AI Recommendations" icon="M13 10V3L4 14h7v7l9-11h-7z" />
      <div className="space-y-3 mb-4">
        {[
          { rank: 1, fix: 'Add comparison table + testimonials to /pricing', effort: 'Low', urgency: 'Critical' },
          { rank: 2, fix: 'Fix iOS Safari form rendering on /demo-request', effort: 'Medium', urgency: 'Critical' },
          { rank: 3, fix: 'Move primary CTA above the fold on all breakpoints', effort: 'Low', urgency: 'Critical' },
          { rank: 4, fix: 'Create dedicated Google Ads landing page (stop wasting $4.2k/mo)', effort: 'Medium', urgency: 'High' },
          { rank: 5, fix: 'Add inline CTAs after each case study', effort: 'Low', urgency: 'High' },
          { rank: 6, fix: 'Pause Meta Ads until landing page is built', effort: 'Low', urgency: 'High' },
          { rank: 7, fix: 'Fix 14 broken links across /resources and /blog', effort: 'Low', urgency: 'Moderate' },
          { rank: 8, fix: 'Add internal links from blog posts to product pages', effort: 'Low', urgency: 'Moderate' },
        ].map((r, i) => {
          const c = recColors[i] || recColors[recColors.length - 1];
          return (
            <div key={r.rank} className={`flex items-center gap-3 ${c.bg} border ${c.border} rounded-xl px-4 py-3`}>
              <span className={`w-7 h-7 ${c.badge} text-white rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0`}>{r.rank}</span>
              <p className="text-sm text-[#1e293b] flex-1">{r.fix}</p>
              <span className={`text-[10px] font-black ${c.text} flex-shrink-0`}>{r.urgency}</span>
              <span className="text-[10px] font-semibold text-[#64748b] bg-white px-2 py-0.5 rounded-full flex-shrink-0">{r.effort} effort</span>
            </div>
          );
        })}
      </div>
    </ReportShell>
  );
}

// -- WebWatch Report ------------------------------------------------------
function WebWatchReport({ onClose }: { onClose: () => void }) {
  return (
    <ReportShell
      onClose={onClose}
      title="WebWatch™ Monthly Report"
      subtitle="Month 3 · NovaPulse HR · Mar 16 – Apr 15, 2026"
      color="from-[#0d9488] to-[#0f766e]"
    >
      <SectionHeader title="Monthly Summary" icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-5 mb-6">
        <p className="text-sm text-[#334155] leading-relaxed">
          NovaPulse HR is in <strong>Month 3</strong> of WebGrade monitoring. Since the initial WebAudit, the team has completed
          <strong> 5 of 8 recommended fixes</strong>. Overall revenue at risk has dropped from <strong>$41.2k/mo to $14.8k/mo</strong> — a 64% improvement.
          Two new issues were detected this month that require attention.
        </p>
      </div>

      <SectionHeader title="Trend vs. Baseline" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Conversion Rate" value="3.1%" status="green" change="+72% from baseline" />
        <MetricCard label="Bounce Rate" value="48.7%" status="green" change="-15.5pts from baseline" />
        <MetricCard label="Revenue at Risk" value="$14.8k/mo" status="green" change="-64% from audit" />
        <MetricCard label="Sessions" value="17,420" status="green" change="+17.4% vs. baseline" />
      </div>

      <SectionHeader title="Completed Fixes — Impact Verified" icon="M5 13l4 4L19 7" />
      <div className="space-y-2 mb-6">
        {[
          { fix: 'Added comparison table + testimonials to /pricing', before: '78% exit rate', after: '42% exit rate' },
          { fix: 'Fixed iOS Safari form rendering', before: '0 mobile conversions', after: '124 conversions/mo' },
          { fix: 'Moved primary CTA above the fold', before: '43% never saw CTA', after: '92% CTA visibility' },
          { fix: 'Added inline CTAs to case studies', before: '0% case study conversion', after: '3.8% conversion rate' },
          { fix: 'Paused Meta Ads (saving $1,600/mo)', before: '$200/conversion', after: 'Budget reallocated to LinkedIn' },
        ].map((f, i) => (
          <div key={i} className="flex items-start gap-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-4 py-3">
            <svg className="w-5 h-5 text-[#0d9488] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#1e293b]">{f.fix}</p>
              <p className="text-xs text-[#64748b] mt-0.5">{f.before} → {f.after}</p>
            </div>
          </div>
        ))}
      </div>

      <SectionHeader title="Still Outstanding" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      <div className="space-y-2 mb-6">
        {[
          { fix: 'Create dedicated Google Ads landing page', status: 'In progress', urgency: 'High' },
          { fix: 'Fix 14 broken links across /resources and /blog', status: 'Not started', urgency: 'Moderate' },
          { fix: 'Add internal links from blog posts to product pages', status: 'Not started', urgency: 'Moderate' },
        ].map((f, i) => (
          <div key={i} className="flex items-center gap-3 bg-[#fffbeb] border border-[#fde68a] rounded-xl px-4 py-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#1e293b]">{f.fix}</p>
              <p className="text-xs text-amber-600">{f.status}</p>
            </div>
            <span className="text-[10px] font-black text-amber-700 flex-shrink-0">{f.urgency}</span>
          </div>
        ))}
      </div>

      <SectionHeader title="New Issues Detected This Month" icon="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      <div className="mb-6">
        <FindingRow severity="MEDIUM" title="New blog pages have no internal linking structure" desc="8 new blog posts published this month with zero internal links to product pages. High traffic, no conversion path." />
        <FindingRow severity="LOW" title="Page speed regression on /features" desc="Load time increased from 1.8s to 3.4s after latest deploy. New hero video not optimized. Mobile score dropped to 62." />
      </div>

      <SectionHeader title="Month-Over-Month Scorecard" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] overflow-hidden mb-4">
        <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-[#f1f5f9] text-[9px] font-bold text-[#64748b] uppercase tracking-wider">
          <span>Metric</span><span>Baseline (Audit)</span><span>Last Month</span><span>This Month</span>
        </div>
        {[
          { metric: 'Conversion Rate', baseline: '1.8%', last: '2.4%', current: '3.1%' },
          { metric: 'Bounce Rate', baseline: '64.2%', last: '55.1%', current: '48.7%' },
          { metric: 'Revenue at Risk', baseline: '$41.2k', last: '$24.8k', current: '$14.8k' },
          { metric: 'Avg. Session Duration', baseline: '1m 42s', last: '2m 11s', current: '2m 34s' },
          { metric: 'High-Intent Visitors', baseline: '2,891', last: '3,412', current: '4,180' },
          { metric: 'Ad Spend Waste', baseline: '$5,800/mo', last: '$4,200/mo', current: '$2,100/mo' },
        ].map((row, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 px-4 py-2.5 text-sm border-t border-[#f1f5f9]">
            <span className="font-semibold text-[#1e293b]">{row.metric}</span>
            <span className="text-[#94a3b8]">{row.baseline}</span>
            <span className="text-[#64748b]">{row.last}</span>
            <span className="font-bold text-[#0d9488]">{row.current}</span>
          </div>
        ))}
      </div>
    </ReportShell>
  );
}

// -- WebOpp Report --------------------------------------------------------
function WebOppReport({ onClose }: { onClose: () => void }) {
  return (
    <ReportShell
      onClose={onClose}
      title="WebOpp™ Market Intelligence"
      subtitle="Monthly Scan · NovaPulse HR · Mar 16 – Apr 15, 2026"
      color="from-[#7c3aed] to-[#6d28d9]"
    >
      <SectionHeader title="Market Overview" icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      <div className="bg-[#f5f3ff] border border-[#ddd6fe] rounded-xl p-5 mb-6">
        <p className="text-sm text-[#334155] leading-relaxed">
          WebOpp scanned your competitive landscape using Google Search Console data and keyword intelligence APIs.
          NovaPulse HR currently ranks for <strong>1,240 keywords</strong> — capturing approximately <strong>$18k/mo in organic traffic value</strong>.
          Your top 3 competitors collectively rank for keywords you don&apos;t, representing
          an estimated <strong>$39k/mo in missed opportunity</strong> across <strong>8,400 keyword gaps</strong>.
        </p>
      </div>

      <SectionHeader title="Your Search Market Position" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Your Keywords" value="1,240" />
        <MetricCard label="Competitor Keywords" value="8,400" status="red" change="You're missing these" />
        <MetricCard label="Uncontested Demand" value="2,100" status="green" change="No one ranks here" />
        <MetricCard label="Total Market Size" value="$142k/mo" />
      </div>

      <SectionHeader title="Competitor Keyword Capture" icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
      <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] overflow-hidden mb-6">
        <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-[#f1f5f9] text-[9px] font-bold text-[#64748b] uppercase tracking-wider">
          <span>Competitor</span><span>Keywords</span><span>Traffic Value</span><span>Your Overlap</span>
        </div>
        {[
          { name: 'BambooHR', keywords: '4,200', value: '$62k/mo', overlap: '18%' },
          { name: 'Gusto', keywords: '3,800', value: '$54k/mo', overlap: '12%' },
          { name: 'Rippling', keywords: '2,900', value: '$48k/mo', overlap: '22%' },
          { name: 'Zenefits', keywords: '1,800', value: '$28k/mo', overlap: '31%' },
          { name: 'Namely', keywords: '1,100', value: '$16k/mo', overlap: '44%' },
        ].map((row, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 px-4 py-2.5 text-sm border-t border-[#f1f5f9]">
            <span className="font-semibold text-[#1e293b]">{row.name}</span>
            <span className="text-[#334155]">{row.keywords}</span>
            <span className="font-bold text-[#7c3aed]">{row.value}</span>
            <span className="text-[#64748b]">{row.overlap}</span>
          </div>
        ))}
      </div>

      <SectionHeader title="Top Keyword Gaps — Highest Potential" icon="M13 7l5 5m0 0l-5 5m5-5H6" />
      <div className="space-y-2 mb-6">
        {[
          { keyword: 'hr software for small business', volume: '12,100/mo', difficulty: 'Medium', competitors: 'BambooHR, Gusto' },
          { keyword: 'employee onboarding software', volume: '8,400/mo', difficulty: 'Medium', competitors: 'Rippling, BambooHR' },
          { keyword: 'payroll and benefits platform', volume: '6,800/mo', difficulty: 'High', competitors: 'Gusto, Zenefits' },
          { keyword: 'hr compliance tools', volume: '4,200/mo', difficulty: 'Low', competitors: 'None ranking well' },
          { keyword: 'employee self-service portal', volume: '3,600/mo', difficulty: 'Low', competitors: 'Namely' },
          { keyword: 'workforce analytics dashboard', volume: '2,900/mo', difficulty: 'Low', competitors: 'None ranking well' },
        ].map((kw, i) => {
          const diffColor = kw.difficulty === 'High' ? 'text-red-600' : kw.difficulty === 'Medium' ? 'text-amber-600' : 'text-emerald-600';
          return (
            <div key={i} className="bg-[#f5f3ff] border border-[#ddd6fe] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-[#1e293b]">{kw.keyword}</p>
                <span className="text-xs font-semibold text-[#64748b]">{kw.volume}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#64748b]">
                <span className={`font-semibold ${diffColor}`}>Difficulty: {kw.difficulty}</span>
                <span>Ranking: {kw.competitors}</span>
              </div>
            </div>
          );
        })}
      </div>

      <SectionHeader title="Uncontested Opportunities" icon="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-5 mb-6">
        <p className="text-sm text-[#334155] leading-relaxed mb-3">
          <strong>2,100 keywords</strong> have meaningful search volume but <strong>no competitor is ranking well</strong>. These represent your lowest-effort, highest-return content opportunities.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {['hr automation for startups', 'remote team management tools', 'employee engagement metrics', 'hr tech stack comparison', 'people ops software', 'small business payroll comparison'].map(kw => (
            <div key={kw} className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 bg-[#0d9488] rounded-full flex-shrink-0" />
              <span className="text-[#1e293b] font-medium">{kw}</span>
            </div>
          ))}
        </div>
      </div>

      <SectionHeader title="Channel ROI Analysis" icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] overflow-hidden mb-6">
        <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-[#f1f5f9] text-[9px] font-bold text-[#64748b] uppercase tracking-wider">
          <span>Channel</span><span>Traffic</span><span>Conversion</span><span>Cost/Acquisition</span>
        </div>
        {[
          { channel: 'Organic Search', traffic: '8,400', conversion: '3.2%', cpa: '$0', good: true },
          { channel: 'Direct', traffic: '2,100', conversion: '4.1%', cpa: '$0', good: true },
          { channel: 'Referral', traffic: '741', conversion: '5.2%', cpa: '$0', good: true },
          { channel: 'LinkedIn Ads', traffic: '1,800', conversion: '1.8%', cpa: '$89', good: true },
          { channel: 'Google Ads', traffic: '3,200', conversion: '0.4%', cpa: '$312', good: false },
        ].map((row, i) => (
          <div key={i} className={`grid grid-cols-4 gap-2 px-4 py-2.5 text-sm border-t border-[#f1f5f9] ${!row.good ? 'bg-red-50/50' : ''}`}>
            <span className="font-semibold text-[#1e293b]">{row.channel}</span>
            <span className="text-[#334155]">{row.traffic}</span>
            <span className={`font-semibold ${row.good ? 'text-[#0d9488]' : 'text-red-500'}`}>{row.conversion}</span>
            <span className={row.good ? 'text-[#64748b]' : 'text-red-600 font-bold'}>{row.cpa}</span>
          </div>
        ))}
      </div>

      <SectionHeader title="Recommended Content Strategy" icon="M13 10V3L4 14h7v7l9-11h-7z" />
      <div className="space-y-3 mb-4">
        {[
          { rank: 1, action: 'Create comparison page: "NovaPulse vs BambooHR"', urgency: 'High' },
          { rank: 2, action: 'Publish guide: "HR Software for Small Business (2026)"', urgency: 'High' },
          { rank: 3, action: 'Build landing page for "hr compliance tools"', urgency: 'Medium' },
          { rank: 4, action: 'Create content hub around employee onboarding', urgency: 'Medium' },
          { rank: 5, action: 'Target uncontested "hr automation for startups" cluster', urgency: 'Opportunity' },
        ].map((r, i) => {
          const c = recColors[i] || recColors[recColors.length - 1];
          return (
            <div key={r.rank} className={`flex items-center gap-3 ${c.bg} border ${c.border} rounded-xl px-4 py-3`}>
              <span className={`w-7 h-7 ${c.badge} text-white rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0`}>{r.rank}</span>
              <p className="text-sm text-[#1e293b] flex-1">{r.action}</p>
              <span className={`text-[10px] font-black ${c.text} flex-shrink-0`}>{r.urgency}</span>
            </div>
          );
        })}
      </div>
    </ReportShell>
  );
}

// -- Export ----------------------------------------------------------------
export default function SampleReportModal({ type, onClose }: { type: 'webaudit' | 'webwatch' | 'webopp'; onClose: () => void }) {
  switch (type) {
    case 'webaudit': return <WebAuditReport onClose={onClose} />;
    case 'webwatch': return <WebWatchReport onClose={onClose} />;
    case 'webopp': return <WebOppReport onClose={onClose} />;
  }
}
