'use client';

/**
 * Dashboard health banner — polls /api/healthz every 60s and surfaces a red
 * banner if anything is broken. Designed to catch schema-drift outages and
 * other silent ingest failures within a minute, instead of taking days to
 * notice (the failure mode that broke things last week).
 *
 * Renders nothing when healthy, so it has zero footprint in the normal case.
 */

import { useEffect, useState } from 'react';

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded';
  checks: CheckResult[];
}

const POLL_INTERVAL_MS = 60_000;

export default function HealthBanner() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/healthz', { cache: 'no-store' });
        const data: HealthResponse = await res.json();
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) setHealth({ status: 'degraded', checks: [{ name: 'fetch', ok: false, detail: 'Could not reach healthz endpoint' }] });
      }
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!health || health.status === 'ok' || dismissed) return null;

  const failingChecks = health.checks.filter(c => !c.ok);

  return (
    <div className="bg-red-600 text-white px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-start gap-3">
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.485 3.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 3.495zM10 6a1 1 0 011 1v3a1 1 0 11-2 0V7a1 1 0 011-1zm0 7a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">System health degraded — ingest may be failing silently.</p>
          <ul className="text-xs mt-1 space-y-0.5 opacity-95">
            {failingChecks.map(c => (
              <li key={c.name}>
                <strong>{c.name}:</strong> {c.detail ?? 'failed'}
              </li>
            ))}
          </ul>
          <p className="text-xs mt-2 opacity-80">
            Most common cause: a schema change was deployed without running migrations.
            Check Vercel build logs for <code className="bg-red-700 px-1 rounded">prisma migrate deploy</code> output.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/80 hover:text-white text-sm flex-shrink-0"
          aria-label="Dismiss"
          title="Dismiss for this session"
        >
          ×
        </button>
      </div>
    </div>
  );
}
