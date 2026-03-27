'use client';

import Link from 'next/link';

interface Props {
  siteId: string;
  tabName: string;
}

export function DataBanner({ siteId, tabName }: Props) {
  return (
    <div className="mx-6 mt-4 px-5 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
        <p className="text-sm text-amber-800">
          <span className="font-semibold">This is sample {tabName} data.</span>{' '}
          Connect your site to see your real insights.
        </p>
      </div>
      <Link
        href={`/dashboard/${siteId}/setup`}
        className="flex-shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
      >
        Connect your data →
      </Link>
    </div>
  );
}
