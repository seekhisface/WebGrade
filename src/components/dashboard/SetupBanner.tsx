'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { MissingItem } from '@/hooks/useSetupState';

// ── Impact warnings shown when user tries to skip an item ──

const SKIP_WARNINGS: Record<string, { title: string; consequences: string[]; recommendation: string }> = {
  snippet: {
    title: 'Skip Snippet Installation?',
    consequences: [
      'No behavioral tracking data will be collected',
      'Intent scoring, drop-off analysis, and all session data will be empty',
      'AI recommendations will have no data to work with',
    ],
    recommendation: 'The snippet is the foundation of everything WebGrade does. We strongly recommend installing it.',
  },
  conversion: {
    title: 'Skip Conversion Goal Setup?',
    consequences: [
      'Revenue at Risk cannot be calculated',
      'Conversion rate tracking will show 0%',
      'AI recommendations won\'t be able to estimate dollar impact',
    ],
    recommendation: 'Even a simple goal like "visited /contact" gives us enough to calculate value.',
  },
  revenue: {
    title: 'Skip Revenue Data?',
    consequences: [
      'Revenue at Risk will show as "Disengaged Leads" count instead of dollar amounts',
      'AI action items won\'t include estimated ROI',
      'Growth plays can\'t be ranked by revenue potential',
    ],
    recommendation: 'Even rough estimates (average deal size, win rate) dramatically improve our insights.',
  },
  gsc: {
    title: 'Skip Google Search Console?',
    consequences: [
      'No keyword ranking data — we can\'t show what terms you rank for',
      'Organic traffic, clicks, and impressions won\'t be tracked',
      'SEO Intelligence section will be limited to crawl data only',
    ],
    recommendation: 'GSC is free and takes 30 seconds to connect. It unlocks the entire SEO dashboard.',
  },
  context: {
    title: 'Skip Business Context?',
    consequences: [
      'AI explanations and recommendations will be generic, not specific to your business',
      'Reports won\'t reference your target audience or value proposition',
    ],
    recommendation: 'Two sentences about your business makes every insight 10x more relevant.',
  },
  adspend: {
    title: 'Skip Ad Spend Data?',
    consequences: [
      'Wasted Spend Identification will be unavailable',
      'Campaign ROI analysis can\'t compare spend vs. conversions',
      'Ad Spend Efficiency section will be empty',
    ],
    recommendation: 'If you run any paid campaigns, entering your monthly spend unlocks powerful waste detection.',
  },
};

// ── Component ──

export default function SetupBanner({
  missingItems,
  percentComplete,
  siteId,
}: {
  missingItems: MissingItem[];
  percentComplete: number;
  siteId: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [skipConfirm, setSkipConfirm] = useState<MissingItem | null>(null);
  const [skipping, setSkipping] = useState(false);
  const [localSkipped, setLocalSkipped] = useState<string[]>([]);

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`wg_banner_collapsed_${siteId}`);
    if (stored === 'true') setCollapsed(true);
  }, [siteId]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(`wg_banner_collapsed_${siteId}`, String(next));
  };

  // Filter out locally skipped items (before server catches up)
  const activeItems = missingItems.filter(i => !localSkipped.includes(i.key));

  if (activeItems.length === 0) return null;

  const item = activeItems[currentIndex % activeItems.length];

  // Handle permanent opt-out
  const confirmSkip = async () => {
    if (!skipConfirm) return;
    setSkipping(true);
    try {
      await fetch('/api/setup-state/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, itemKey: skipConfirm.key }),
      });
      setLocalSkipped(prev => [...prev, skipConfirm.key]);
      setSkipConfirm(null);
      // Reset index if we removed the current item
      setCurrentIndex(0);
    } catch { /* non-fatal */ }
    setSkipping(false);
  };

  // ── Collapsed state: just a glowing pill button ──
  if (collapsed) {
    return (
      <div className="sticky top-0 z-40">
        <div className="flex justify-end px-4 py-1.5 pointer-events-none">
          <button
            onClick={toggleCollapse}
            className="pointer-events-auto relative flex items-center gap-2 px-3 py-1.5 bg-[#0c4a6e] text-white text-xs font-semibold rounded-full shadow-lg hover:bg-[#075985] transition-colors"
          >
            {/* Glowing pulse ring */}
            <span className="absolute inset-0 rounded-full animate-ping bg-sky-400 opacity-30" />
            <span className="relative flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L13.09 8.26L18 6L14.74 10.91L21 12L14.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L9.26 13.09L3 12L9.26 10.91L6 6L10.91 8.26L12 2Z" />
              </svg>
              {activeItems.length} setup item{activeItems.length !== 1 ? 's' : ''} remaining
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ── Expanded state: full banner ──
  return (
    <>
      <div className="sticky top-0 z-40 bg-gradient-to-r from-[#0c4a6e] to-[#075985] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center gap-4">

          {/* Progress */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-20 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-[#38bdf8] rounded-full transition-all duration-500" style={{ width: `${percentComplete}%` }} />
            </div>
            <span className="text-[11px] text-sky-200 font-medium whitespace-nowrap">{percentComplete}%</span>
          </div>

          <div className="w-px h-5 bg-white/20 shrink-0" />

          {/* Current item */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-sm font-semibold truncate">{item.label}</span>
            <span className="text-xs text-sky-200 truncate hidden sm:inline">— {item.description}</span>
          </div>

          {/* Fix Now */}
          <Link
            href={item.link}
            className="px-3 py-1 text-xs font-semibold bg-white text-[#0c4a6e] rounded-md hover:bg-sky-100 transition-colors shrink-0"
          >
            Fix Now
          </Link>

          {/* Not Applicable / Skip */}
          <button
            onClick={() => setSkipConfirm(item)}
            className="px-2 py-1 text-[10px] text-sky-300 hover:text-white border border-sky-400/30 rounded hover:border-sky-300 transition-colors shrink-0"
          >
            Not Applicable
          </button>

          {/* Navigation */}
          {activeItems.length > 1 && (
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setCurrentIndex(i => (i - 1 + activeItems.length) % activeItems.length)} className="p-1 text-sky-200 hover:text-white">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-[10px] text-sky-300 tabular-nums">{(currentIndex % activeItems.length) + 1}/{activeItems.length}</span>
              <button onClick={() => setCurrentIndex(i => (i + 1) % activeItems.length)} className="p-1 text-sky-200 hover:text-white">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          )}

          {/* Collapse */}
          <button onClick={toggleCollapse} className="p-1 text-sky-300 hover:text-white transition-colors shrink-0" title="Minimize">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
        </div>
      </div>

      {/* ── Skip Confirmation Modal ── */}
      {skipConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h3 className="text-lg font-bold text-slate-900">
                  {SKIP_WARNINGS[skipConfirm.key]?.title ?? `Skip ${skipConfirm.label}?`}
                </h3>
              </div>
            </div>

            {/* Consequences */}
            <div className="px-6 py-4">
              <p className="text-sm font-medium text-slate-700 mb-3">By skipping this, you will lose:</p>
              <ul className="space-y-2 mb-4">
                {(SKIP_WARNINGS[skipConfirm.key]?.consequences ?? ['This feature will not be available.']).map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {c}
                  </li>
                ))}
              </ul>

              {/* Recommendation */}
              <div className="bg-sky-50 border border-sky-100 rounded-lg px-4 py-3 text-sm text-sky-800">
                <span className="font-semibold">Our recommendation: </span>
                {SKIP_WARNINGS[skipConfirm.key]?.recommendation ?? 'We recommend completing this step.'}
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setSkipConfirm(null)}
                className="px-4 py-2 text-sm font-semibold text-[#0c4a6e] bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={confirmSkip}
                disabled={skipping}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {skipping ? 'Skipping...' : 'Skip Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
