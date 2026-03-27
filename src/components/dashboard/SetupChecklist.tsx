'use client';

import Link from 'next/link';
import { SetupState } from '@/hooks/useSetupState';

interface Props {
  siteId: string;
  setup: SetupState;
}

const STEPS = [
  {
    id: 'account',
    title: 'Account created',
    description: 'You\'re in. WebGrade is ready to analyze your site.',
    alwaysDone: true,
  },
  {
    id: 'snippet',
    title: 'Install tracking snippet',
    description: 'A lightweight script that captures behavioral signals — intent, drop-off, scroll depth.',
    action: { label: 'Get snippet code', href: (siteId: string) => `/dashboard/${siteId}/setup/snippet` },
    key: 'snippetInstalled' as keyof SetupState,
  },
  {
    id: 'ga4',
    title: 'Connect Google Analytics 4',
    description: 'Imports your 90-day baseline. Every recommendation benchmarks against this.',
    action: { label: 'Connect GA4', href: (siteId: string) => `/dashboard/${siteId}/setup/ga4` },
    key: 'ga4Connected' as keyof SetupState,
  },
  {
    id: 'gsc',
    title: 'Connect Google Search Console',
    description: 'Unlocks keyword intelligence and WebOpp™ market analysis.',
    action: { label: 'Connect Search Console', href: (siteId: string) => `/dashboard/${siteId}/setup/gsc` },
    key: 'gscConnected' as keyof SetupState,
  },
  {
    id: 'context',
    title: 'Set business context',
    description: 'Competitors, conversion goals, and value proposition. Makes every AI insight specific to you.',
    action: { label: 'Complete setup', href: (siteId: string) => `/onboarding?siteId=${siteId}` },
    key: 'businessContextComplete' as keyof SetupState,
  },
];

export function SetupChecklist({ siteId, setup }: Props) {
  return (
    <div className="min-h-screen bg-[#f0f9ff]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-black text-[#0c4a6e] mb-2">Get WebGrade live on your site</h1>
          <p className="text-sm text-[#64748b]">
            Complete these steps to unlock your behavioral intelligence dashboard.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-10">
          {STEPS.map((step, index) => {
            const done = step.alwaysDone || !!(setup[step.key as keyof SetupState]);
            const isNext = !done && STEPS.slice(0, index).every(s => s.alwaysDone || !!(setup[s.key as keyof SetupState]));

            return (
              <div
                key={step.id}
                className={`p-5 rounded-2xl border transition-all ${
                  done
                    ? 'bg-white border-[#bae6fd]'
                    : isNext
                    ? 'bg-white border-[#0c4a6e] shadow-md'
                    : 'bg-white/60 border-[#e0f2fe]'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Step indicator */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    done ? 'bg-[#0d9488]' : isNext ? 'bg-[#0c4a6e]' : 'bg-[#e0f2fe]'
                  }`}>
                    {done ? (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className={`text-xs font-bold ${isNext ? 'text-white' : 'text-[#94a3b8]'}`}>
                        {index + 1}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <p className={`text-sm font-semibold ${done ? 'text-[#0d9488]' : 'text-[#0c4a6e]'}`}>
                        {step.title}
                        {done && <span className="ml-2 text-[#0d9488]">✓</span>}
                      </p>
                      {!done && step.action && isNext && (
                        <Link
                          href={step.action.href(siteId)}
                          className="flex-shrink-0 px-3 py-1.5 bg-[#0c4a6e] hover:bg-[#075985] text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          {step.action.label}
                        </Link>
                      )}
                    </div>
                    <p className="text-xs text-[#64748b] mt-1 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sample report download */}
        <div className="p-5 bg-white border border-[#bae6fd] rounded-2xl flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#0c4a6e] mb-1">See what your report will look like</p>
            <p className="text-xs text-[#64748b]">Download a sample Interim Report™ generated from real behavioral data.</p>
          </div>
          
            href="/sample-report.pdf"
            download
            className="flex-shrink-0 px-4 py-2 bg-white border border-[#bae6fd] hover:bg-[#f0f9ff] text-[#0c4a6e] text-xs font-semibold rounded-lg transition-colors"
          >
            ↓ Sample Report
          </a>
        </div>

        {/* Progress bar */}
        <div className="mt-8">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-[#64748b]">Setup progress</span>
            <span className="text-xs font-semibold text-[#0c4a6e]">{setup.percentComplete}% complete</span>
          </div>
          <div className="h-2 bg-[#e0f2fe] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0c4a6e] rounded-full transition-all duration-700"
              style={{ width: `${setup.percentComplete}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
