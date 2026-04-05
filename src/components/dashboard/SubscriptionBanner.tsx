'use client';

import { useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import WebWatchUpsellModal from './WebWatchUpsellModal';

interface SubscriptionBannerProps {
  tier: 'WEBAUDIT' | 'WEBAUDIT_EXPIRED' | 'WEBWATCH' | 'WEBWATCH_WEBOPP';
  webauditStartDate?: string | null;
  webauditEndDate?: string | null;
  webwatchStartDate?: string | null;
  hasWebOpp?: boolean;
}

export default function SubscriptionBanner({
  tier,
  webauditStartDate,
  webauditEndDate,
  webwatchStartDate,
}: SubscriptionBannerProps) {
  const now = new Date();
  const [showUpsell, setShowUpsell] = useState(false);

  // ── WEBAUDIT active ──────────────────────────────────────────────────
  if (tier === 'WEBAUDIT') {
    const start = webauditStartDate ? new Date(webauditStartDate) : now;
    const dayElapsed = Math.max(0, differenceInDays(now, start));
    const daysRemaining = Math.max(0, 60 - dayElapsed);
    const progress = Math.min(100, (dayElapsed / 60) * 100);
    const endDate = new Date(start);
    endDate.setDate(endDate.getDate() + 60);

    return (
      <div className="bg-gradient-to-r from-sky-50 to-sky-100 border border-sky-200 rounded-xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <svg className="w-4 h-4 text-sky-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-bold text-slate-800">WebAudit™ Active</span>
            <span className="text-xs text-sky-700 font-medium">— Day {dayElapsed} of 60</span>
            <span className="text-xs text-slate-400 ml-1">({daysRemaining} days remaining · ends {format(endDate, 'MMM d, yyyy')})</span>
          </div>
          <div className="w-full max-w-xs bg-sky-200/50 rounded-full h-1.5 mb-1.5">
            <div className="bg-sky-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-slate-500">Reports generated at Day 30 and Day 60</p>
        </div>
        <button onClick={() => setShowUpsell(true)} className="text-[11px] font-medium px-3 py-1.5 bg-white border border-sky-300 text-sky-700 rounded-lg hover:bg-sky-50 transition-colors whitespace-nowrap flex-shrink-0">
          Keep the reports going →
        </button>
        {showUpsell && (
          <WebWatchUpsellModal onClose={() => setShowUpsell(false)} daysRemaining={daysRemaining} dayElapsed={dayElapsed} />
        )}
      </div>
    );
  }

  // ── WEBAUDIT expired ─────────────────────────────────────────────────
  if (tier === 'WEBAUDIT_EXPIRED') {
    const endDate = webauditEndDate ? format(new Date(webauditEndDate), 'MMM d, yyyy') : 'completed';
    return (
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-bold text-slate-800">WebAudit™ Complete</span>
            <span className="text-xs text-amber-700 font-medium">— Ended {endDate}</span>
          </div>
          <p className="text-xs text-slate-500">Your data is frozen. Upgrade to WebWatch™ for continuous monitoring.</p>
        </div>
        <button onClick={() => setShowUpsell(true)} className="text-xs font-semibold px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors whitespace-nowrap flex-shrink-0">
          Keep the reports going →
        </button>
        {showUpsell && (
          <WebWatchUpsellModal onClose={() => setShowUpsell(false)} daysRemaining={0} dayElapsed={60} />
        )}
      </div>
    );
  }

  // ── WEBWATCH active ──────────────────────────────────────────────────
  if (tier === 'WEBWATCH') {
    const since = webwatchStartDate ? format(new Date(webwatchStartDate), 'MMM yyyy') : 'recently';
    return (
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-teal-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-sm font-bold text-slate-800">WebWatch™ Active</span>
            <span className="text-xs text-teal-700 font-medium">— Monitoring since {since}</span>
          </div>
          <p className="text-xs text-slate-500">Next monthly report generates automatically</p>
        </div>
        <a href="#upgrade" className="text-xs font-medium px-4 py-2 bg-teal-50 border border-teal-300 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap flex-shrink-0">
          Add WebOpp™ →
        </a>
      </div>
    );
  }

  // ── WEBWATCH + WEBOPP ────────────────────────────────────────────────
  if (tier === 'WEBWATCH_WEBOPP') {
    const since = webwatchStartDate ? format(new Date(webwatchStartDate), 'MMM yyyy') : 'recently';
    return (
      <div className="bg-gradient-to-r from-teal-50 to-sky-50 border border-teal-200 rounded-xl px-6 py-4 flex items-center gap-3">
        <svg className="w-4 h-4 text-teal-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        <div>
          <span className="text-sm font-bold text-slate-800">WebWatch™ + WebOpp™</span>
          <span className="text-xs text-teal-700 font-medium ml-2">Full Intelligence Suite — since {since}</span>
        </div>
      </div>
    );
  }

  return null;
}
