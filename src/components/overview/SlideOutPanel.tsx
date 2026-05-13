// Right-side slide-out drawer used by the Overview funnel cards.
//
// The Overview promise was "click any funnel number → see the one
// breakdown that answers the obvious next question." Each step has its
// own panel component below that calls /api/dashboard/overview/detail
// with the right step= param and renders the result.
//
// On mobile the panel goes full-screen via the same component — Tailwind
// breakpoints handle that.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Drawer chrome — shared by all three step panels
// ---------------------------------------------------------------------------

export function SlideOutPanel({
  open, onClose, title, subtitle, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute right-0 top-0 h-full w-full md:w-[480px] bg-white shadow-2xl overflow-y-auto"
      >
        <header className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#082f49]">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors -mr-1 -mt-1 p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="px-5 py-5">{children}</div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared: small bar chart
// ---------------------------------------------------------------------------

function HBar({ rows, valueFmt }: {
  rows: { label: string; value: number; sub?: string }[];
  valueFmt?: (v: number) => string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 py-4">No data in this range.</p>;
  }
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="flex items-center justify-between text-xs text-slate-700 mb-1">
            <span className="truncate pr-2" title={r.label}>{r.label}</span>
            <span className="font-medium tabular-nums">
              {valueFmt ? valueFmt(r.value) : r.value.toLocaleString()}
              {r.sub && <span className="text-slate-400 ml-1">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-2 bg-[#0c4a6e] rounded-full transition-all"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <div className="py-10 flex justify-center">
      <div className="w-6 h-6 border-2 border-slate-200 border-t-[#0c4a6e] rounded-full animate-spin" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1) Visitors panel — traffic source breakdown + top entry pages
// ---------------------------------------------------------------------------

interface VisitorsData {
  step: 'visitors';
  totalVisitors: number;
  sources: { source: string; count: number; pct: number }[];
  topEntryPages: { page: string; count: number }[];
}

export function VisitorsPanel({
  open, onClose, siteId, days,
}: {
  open: boolean;
  onClose: () => void;
  siteId: string;
  days: number;
}) {
  const [data, setData] = useState<VisitorsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setData(null);
    fetch(`/api/dashboard/overview/detail?siteId=${siteId}&days=${days}&step=visitors`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [open, siteId, days]);

  return (
    <SlideOutPanel
      open={open}
      onClose={onClose}
      title="Where your visitors came from"
      subtitle={data ? `${data.totalVisitors.toLocaleString()} sessions in the last ${days} days` : undefined}
    >
      {loading || !data ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-[#082f49] mb-3">Traffic sources</h3>
            <HBar
              rows={data.sources.map(s => ({
                label: s.source.charAt(0).toUpperCase() + s.source.slice(1),
                value: s.count,
                sub: `(${s.pct}%)`,
              }))}
            />
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[#082f49] mb-3">Top entry pages</h3>
            <HBar rows={data.topEntryPages.map(p => ({ label: p.page, value: p.count }))} />
          </section>

          <div className="pt-3 border-t border-slate-100">
            <Link
              href={`/dashboard/${siteId}/admin/sessions`}
              className="text-sm text-[#0c4a6e] underline"
            >
              See full session detail →
            </Link>
          </div>
        </div>
      )}
    </SlideOutPanel>
  );
}

// ---------------------------------------------------------------------------
// 2) Goal Page panel — top FROM-pages + reach-vs-bounce
// ---------------------------------------------------------------------------

interface GoalData {
  step: 'goal';
  goalConfigured: boolean;
  goalName: string | null;
  goalPath: string | null;
  reachedSessions: number;
  convertedAfterReach: number;
  bouncedAfterReach: number;
  bounceRate: number;
  topFromPages: { page: string; count: number }[];
}

export function GoalPagePanel({
  open, onClose, siteId, days,
}: {
  open: boolean;
  onClose: () => void;
  siteId: string;
  days: number;
}) {
  const [data, setData] = useState<GoalData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setData(null);
    fetch(`/api/dashboard/overview/detail?siteId=${siteId}&days=${days}&step=goal`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [open, siteId, days]);

  return (
    <SlideOutPanel
      open={open}
      onClose={onClose}
      title="Goal page reach"
      subtitle={data?.goalPath ?? undefined}
    >
      {loading || !data ? (
        <Spinner />
      ) : !data.goalConfigured ? (
        <div className="text-sm text-slate-600">
          <p className="mb-3">No conversion goal page configured yet.</p>
          <Link
            href={`/dashboard/${siteId}/settings`}
            className="text-[#0c4a6e] underline"
          >
            Set your conversion goal →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs uppercase tracking-wider text-emerald-700">Converted</p>
              <p className="text-2xl font-bold text-emerald-900 mt-1 tabular-nums">
                {data.convertedAfterReach.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs uppercase tracking-wider text-red-700">Bounced</p>
              <p className="text-2xl font-bold text-red-900 mt-1 tabular-nums">
                {data.bouncedAfterReach.toLocaleString()}
              </p>
              <p className="text-xs text-red-700 mt-1">{data.bounceRate.toFixed(1)}% of reachers</p>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[#082f49] mb-3">
              Top pages visitors came FROM
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              The last page each visitor was on before they reached your goal page.
            </p>
            <HBar rows={data.topFromPages.map(p => ({ label: p.page, value: p.count }))} />
          </section>

          <div className="pt-3 border-t border-slate-100">
            <Link
              href={`/dashboard/${siteId}`}
              className="text-sm text-[#0c4a6e] underline"
            >
              See drop-off detail →
            </Link>
          </div>
        </div>
      )}
    </SlideOutPanel>
  );
}

// ---------------------------------------------------------------------------
// 3) Conversions panel — breakdown by source + top converting channel
// ---------------------------------------------------------------------------

interface ConvData {
  step: 'conversions';
  totalConversions: number;
  uniqueConvertedSessions: number;
  sources: { source: string; label: string; count: number }[];
  topChannels: { channel: string; count: number }[];
  recent: { at: string; source: string; channel: string }[];
}

export function ConversionsPanel({
  open, onClose, siteId, days,
}: {
  open: boolean;
  onClose: () => void;
  siteId: string;
  days: number;
}) {
  const [data, setData] = useState<ConvData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setData(null);
    fetch(`/api/dashboard/overview/detail?siteId=${siteId}&days=${days}&step=conversions`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [open, siteId, days]);

  return (
    <SlideOutPanel
      open={open}
      onClose={onClose}
      title="Conversions"
      subtitle={data ? `${data.uniqueConvertedSessions.toLocaleString()} converted sessions · ${data.totalConversions.toLocaleString()} conversion events` : undefined}
    >
      {loading || !data ? (
        <Spinner />
      ) : data.totalConversions === 0 ? (
        <div className="text-sm text-slate-600">
          <p className="mb-3">
            No conversions in the last {days} days. Conversions are tracked when:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>A form matching your conversion selector is submitted</li>
            <li>Someone books through an embedded Calendly widget</li>
            <li>Someone submits an embedded HubSpot form</li>
            <li>Your site calls <code className="bg-slate-100 px-1 rounded">window.wg(&apos;conversion&apos;)</code></li>
          </ul>
          <Link
            href={`/dashboard/${siteId}/settings`}
            className="block mt-4 text-[#0c4a6e] underline"
          >
            Check your conversion tracking setup →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-[#082f49] mb-3">By source</h3>
            <HBar rows={data.sources.map(s => ({ label: s.label, value: s.count }))} />
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[#082f49] mb-3">Top converting channels</h3>
            <HBar
              rows={data.topChannels.map(c => ({
                label: c.channel.charAt(0).toUpperCase() + c.channel.slice(1),
                value: c.count,
              }))}
            />
          </section>

          {data.recent.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-[#082f49] mb-3">Recent conversions</h3>
              <div className="space-y-1.5">
                {data.recent.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 tabular-nums">
                      {new Date(r.at).toLocaleString()}
                    </span>
                    <span className="text-slate-700">
                      <span className="font-medium">{r.source.replace(/_/g, ' ')}</span>
                      <span className="text-slate-400 mx-1">·</span>
                      {r.channel}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="pt-3 border-t border-slate-100">
            <Link
              href={`/dashboard/${siteId}/settings`}
              className="text-sm text-[#0c4a6e] underline"
            >
              Check tracking setup →
            </Link>
          </div>
        </div>
      )}
    </SlideOutPanel>
  );
}
