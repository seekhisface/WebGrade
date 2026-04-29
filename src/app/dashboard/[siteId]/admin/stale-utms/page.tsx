'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface StaleUtmRow {
  id: string;
  utmCampaign: string;
  sessionsAffected: number;
  firstDetectedAt: string;
  lastSeenAt: string;
  topLandingPage: string | null;
}

interface StaleUtmResponse {
  items: StaleUtmRow[];
  totalStaleSessions: number;
  distinctTags: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function relativeFromNow(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function StaleUtmsPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const [data, setData] = useState<StaleUtmResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/stale-utms?siteId=${siteId}`)
      .then(res => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((d: StaleUtmResponse) => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [siteId]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stale Campaign Tags</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">utm_campaign</code> values
            arriving in your sessions that don&apos;t match any active or recent (180-day) Google Ads campaign.
            Likely a renamed-but-still-circulating link in an email signature, social post, or partner site.
            Refreshed daily at 9am UTC.
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error === '403' ? 'You need OWNER or ADMIN access to view this page.' : `Failed to load (${error})`}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && data && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500">Distinct stale tags</p>
                <p className="text-3xl font-semibold text-slate-900 mt-1">{data.distinctTags}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500">Sessions affected (last 90d)</p>
                <p className="text-3xl font-semibold text-slate-900 mt-1">{data.totalStaleSessions}</p>
              </div>
            </div>

            {data.items.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <p className="text-slate-500">No stale UTM campaign tags detected.</p>
                <p className="text-xs text-slate-400 mt-2">
                  Every <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">utm_campaign</code> value
                  in your recent sessions matches a known Google Ads campaign.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-3 font-medium text-slate-500">utm_campaign</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-500">Sessions</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500">First detected</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500">Last seen</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500">Top landing page</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map(row => (
                      <tr key={row.id} className="border-b border-slate-50">
                        <td className="px-4 py-3">
                          <span className="font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                            {row.utmCampaign}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 font-semibold">
                          {row.sessionsAffected}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs" title={formatDate(row.firstDetectedAt)}>
                          {relativeFromNow(row.firstDetectedAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs" title={formatDate(row.lastSeenAt)}>
                          {relativeFromNow(row.lastSeenAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-xs" title={row.topLandingPage ?? ''}>
                          {row.topLandingPage
                            ? (row.topLandingPage.length > 50
                                ? row.topLandingPage.slice(0, 50) + '...'
                                : row.topLandingPage)
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-xs text-slate-400 max-w-3xl">
              <p>
                <strong className="text-slate-500">How to action:</strong> for each stale tag, find where the link
                is still circulating (search your CMS, email templates, retargeting platforms, partner sites)
                and either retire it or update it to the current campaign name. The flag will clear automatically
                on the next daily run once the tag stops appearing.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
