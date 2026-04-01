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
    description: "You're in. WebGrade is ready to analyze your site.",
    alwaysDone: true,
    key: null as null,
    action: null as null,
  },
  {
    id: 'snippet',
    title: 'Install tracking snippet',
    description: 'A lightweight script that captures behavioral signals: intent, drop-off, scroll depth.',
    alwaysDone: false,
    action: { label: 'Get snippet code', path: 'setup/snippet' },
    key: 'snippetInstalled' as keyof SetupState,
  },
  {
    id: 'ga4',
    title: 'Connect Google Analytics 4',
    description: 'Imports your 90-day baseline. Every recommendation benchmarks against this.',
    alwaysDone: false,
    action: { label: 'Connect GA4', path: 'setup/ga4' },
    key: 'ga4Connected' as keyof SetupState,
  },
  {
    id: 'gsc',
    title: 'Connect Google Search Console',
    description: 'Unlocks keyword intelligence and WebOpp market analysis.',
    alwaysDone: false,
    action: { label: 'Connect Search Console', path: 'setup/gsc' },
    key: 'gscConnected' as keyof SetupState,
  },
  {
    id: 'context',
    title: 'Set business context',
    description: 'Competitors, conversion goals, and value proposition. Makes every AI insight specific to you.',
    alwaysDone: false,
    action: { label: 'Complete setup', path: 'onboarding' },
    key: 'businessContextComplete' as keyof SetupState,
  },
];

export function SetupChecklist({ siteId, setup }: Props) {
  return (
    <div className="min-h-screen bg-[#f0f9ff]">
      <div className="max-w-2xl mx-auto px-6 py-12">

        <div className="mb-10">
          <h1 className="text-2xl font-black text-[#0c4a6e] mb-2">Get WebGrade live on your site</h1>
          <p className="text-sm text-[#64748b]">
            Complete these steps to unlock your behavioral intelligence dashboard.
          </p>
        </div>

        <div className="space-y-3 mb-10">
          {STEPS.map((step, index) => {
            const done = step.alwaysDone || !!(step.key && setup[step.key]);
            const prevDone = STEPS.slice(0, index).every(s => s.alwaysDone || !!(s.key && setup[s.key]));
            const isNext = !done && prevDone;
            const href = step.action
              ? step.action.path.startsWith('onboarding')
                ? '/onboarding?siteId=' + siteId
                : '/dashboard/' + siteId + '/' + step.action.path
              : '#';

            return (
              <div
                key={step.id}
                className={[
                  'p-5 rounded-2xl border transition-all',
                  done ? 'bg-white border-[#bae6fd]' : isNext ? 'bg-white border-[#0c4a6e] shadow-md' : 'bg-white/60 border-[#e0f2fe]',
                ].join(' ')}
              >
                <div className="flex items-start gap-4">
                  <div className={[
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                    done ? 'bg-[#0d9488]' : isNext ? 'bg-[#0c4a6e]' : 'bg-[#e0f2fe]',
                  ].join(' ')}>
                    {done ? (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className={['text-xs font-bold', isNext ? 'text-white' : 'text-[#94a3b8]'].join(' ')}>
                        {index + 1}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <p className={['text-sm font-semibold', done ? 'text-[#0d9488]' : 'text-[#0c4a6e]'].join(' ')}>
                        {step.title}
                        {done && <span className="ml-2">✓</span>}
                      </p>
                      {!done && step.action && isNext && (
                        <Link
                          href={href}
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

        <div className="p-5 bg-[#f0f9ff] border border-[#bae6fd] rounded-2xl">
          <p className="text-sm font-semibold text-[#0c4a6e] mb-1">Your WebAudit™ is building</p>
          <p className="text-xs text-[#64748b]">Complete the steps above to start your 60-day WebAudit. Once the snippet is live, WebGrade begins collecting behavioral data immediately.</p>
        </div>

        <div className="mt-8">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-[#64748b]">Setup progress</span>
            <span className="text-xs font-semibold text-[#0c4a6e]">{setup.percentComplete}% complete</span>
          </div>
          <div className="h-2 bg-[#e0f2fe] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0c4a6e] rounded-full transition-all duration-700"
              style={{ width: setup.percentComplete + '%' }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
