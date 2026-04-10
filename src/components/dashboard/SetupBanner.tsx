'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { MissingItem } from '@/hooks/useSetupState';

// Icons for each missing item type
const ICONS: Record<string, string> = {
  snippet: '\u{1F4E1}',    // satellite
  conversion: '\u{1F3AF}', // target
  revenue: '\u{1F4B0}',    // money bag
  gsc: '\u{1F50D}',        // magnifying glass
  context: '\u{1F4DD}',    // memo
  adspend: '\u{1F4B8}',    // money with wings
};

export default function SetupBanner({
  missingItems,
  percentComplete,
}: {
  missingItems: MissingItem[];
  percentComplete: number;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (dismissed || missingItems.length === 0) return null;

  const item = missingItems[currentIndex % missingItems.length];
  const icon = ICONS[item.key] || '\u{26A0}';

  return (
    <div className="sticky top-0 z-40 bg-gradient-to-r from-[#0c4a6e] to-[#075985] text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center gap-4">

        {/* Progress indicator */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-20 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#38bdf8] rounded-full transition-all duration-500"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
          <span className="text-[11px] text-sky-200 font-medium whitespace-nowrap">
            {percentComplete}% setup
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-white/20 shrink-0" />

        {/* Current missing item */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm">{icon}</span>
          <span className="text-sm font-semibold truncate">{item.label}</span>
          <span className="text-xs text-sky-200 truncate hidden sm:inline">
            — {item.description}
          </span>
        </div>

        {/* Action button */}
        <Link
          href={item.link}
          className="px-3 py-1 text-xs font-semibold bg-white text-[#0c4a6e] rounded-md hover:bg-sky-100 transition-colors shrink-0"
        >
          Fix Now
        </Link>

        {/* Navigation arrows (when multiple items) */}
        {missingItems.length > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setCurrentIndex(i => (i - 1 + missingItems.length) % missingItems.length)}
              className="p-1 text-sky-200 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-[10px] text-sky-300 tabular-nums">
              {currentIndex + 1}/{missingItems.length}
            </span>
            <button
              onClick={() => setCurrentIndex(i => (i + 1) % missingItems.length)}
              className="p-1 text-sky-200 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        )}

        {/* Dismiss (hide for this page load) */}
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-sky-300 hover:text-white transition-colors shrink-0"
          title="Dismiss for now"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}
