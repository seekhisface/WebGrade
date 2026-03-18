'use client';

import { useState } from 'react';

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <span className="text-amber-400 text-sm">👁</span>
        <p className="text-xs text-amber-300 font-medium">
          Demo mode — you're viewing NovaPulse HR, a fictional company with realistic data.{' '}
          <span className="text-amber-400/70 font-normal">No real data is shown.</span>
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-amber-400/50 hover:text-amber-400 transition-colors text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
