'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AppNav } from '@/components/nav/AppNav';

interface Alert {
  id: string;
  alertType: string;
  severity: string;
  message: string;
  triggeredAt: string;
  resolvedAt: string | null;
  resolvedAutomatically: boolean;
  acknowledgedAt: string | null;
  emailSentAt: string | null;
  slackSentAt: string | null;
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  CRITICAL: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  HIGH: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  MEDIUM: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
  LOW: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' },
};

const ALERT_ICONS: Record<string, string> = {
  CONVERSION_DROP: '📉',
  BOUNCE_RATE_SPIKE: '🔄',
  WASTED_SPEND_DETECTED: '💸',
  SNIPPET_FIRING_STOPPED: '⚡',
  SEO_REGRESSION: '🔍',
  NEW_HIGH_VALUE_OPPORTUNITY: '🎯',
};

export default function AlertCenterPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [open, setOpen] = useState<Alert[]>([]);
  const [resolved, setResolved] = useState<Alert[]>([]);
  const [stats, setStats] = useState({ openCount: 0, criticalCount: 0, avgResolutionHours: 0 });
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const sites = [{ id: siteId, name: 'WebGrade', domain: 'webgrade.io', hasWebWatch: true, hasWebOpp: true, hasInterimReport: true }];

  useEffect(() => { loadAlerts(); }, [siteId]); // eslint-disable-line

  async function loadAlerts() {
    setLoading(true);
    try {
      const res = await fetch(`/api/alerts/resolve?siteId=${siteId}`);
      const data = await res.json();
      setOpen(data.open ?? []);
      setResolved(data.recentlyResolved ?? []);
      setStats(data.stats ?? { openCount: 0, criticalCount: 0, avgResolutionHours: 0 });
    } catch { /* no alerts */ }
    setLoading(false);
  }

  async function resolveAlert(alertId: string) {
    setResolving(alertId);
    try {
      await fetch(`/api/alerts/resolve/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolvedAt: new Date().toISOString() }),
      });
      await loadAlerts();
    } finally { setResolving(null); }
  }

  async function runAutoResolve() {
    await fetch('/api/alerts/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId }) });
    await loadAlerts();
  }

  const formatTime = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const timeAgo = (d: string) => {
    const ms = Date.now() - new Date(d).getTime();
    const h = Math.floor(ms / 3600000);
    if (h < 1) return `${Math.floor(ms / 60000)}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="min-h-screen bg-[#f0f9ff] flex flex-col">
      <AppNav currentSiteId={siteId} sites={sites} activePage="settings" />

      {/* Sub-header */}
      <div className="bg-white border-b border-[#e0f2fe] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#1e293b]">Alert Center</span>
          {stats.criticalCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{stats.criticalCount} critical</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runAutoResolve} className="text-xs px-3 py-1.5 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-[#64748b] hover:bg-[#e0f2fe] transition-colors">
            ↻ Run Auto-Resolve
          </button>
          <a href={`/dashboard/${siteId}/settings/alerts`} className="text-xs px-3 py-1.5 bg-[#0c4a6e] text-white rounded-lg hover:bg-[#075985] transition-colors">
            ⚙ Alert Settings
          </a>
        </div>
      </div>

      <div className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Open Alerts', value: String(stats.openCount), color: stats.openCount > 0 ? 'text-red-600' : 'text-green-600', bg: stats.openCount > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100' },
            { label: 'Critical', value: String(stats.criticalCount), color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
            { label: 'Avg Resolution', value: stats.avgResolutionHours > 0 ? `${stats.avgResolutionHours}h` : '—', color: 'text-[#0c4a6e]', bg: 'bg-[#f0f9ff] border-[#bae6fd]' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex bg-[#f0f9ff] border border-[#bae6fd] rounded-lg p-0.5 gap-0.5 mb-4 w-fit">
          {(['open', 'resolved'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${tab === t ? 'bg-white text-[#1e293b] shadow-sm' : 'text-[#64748b]'}`}>
              {t} {t === 'open' ? `(${open.length})` : `(${resolved.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#0c4a6e] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {(tab === 'open' ? open : resolved).length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#e0f2fe] p-16 text-center">
                <p className="text-3xl mb-3">{tab === 'open' ? '✅' : '📋'}</p>
                <p className="text-[#1e293b] font-semibold mb-1">{tab === 'open' ? 'No open alerts' : 'No resolved alerts yet'}</p>
                <p className="text-xs text-[#94a3b8]">{tab === 'open' ? 'Everything looks good.' : 'Resolved alerts will appear here.'}</p>
              </div>
            ) : (
              (tab === 'open' ? open : resolved).map(alert => {
                const sev = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.MEDIUM;
                return (
                  <div key={alert.id} className="bg-white rounded-2xl border border-[#e0f2fe] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sev.dot}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span>{ALERT_ICONS[alert.alertType] ?? '🔔'}</span>
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${sev.bg} ${sev.text} ${sev.border}`}>{alert.severity}</span>
                            <span className="text-xs text-[#94a3b8]">{alert.alertType.replace(/_/g, ' ')}</span>
                          </div>
                          <p className="text-sm text-[#334155] leading-relaxed">{alert.message}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-[#94a3b8]">🕐 {timeAgo(alert.triggeredAt)}</span>
                            {alert.emailSentAt && <span className="text-xs text-[#94a3b8]">📧 emailed</span>}
                            {alert.slackSentAt && <span className="text-xs text-[#94a3b8]">💬 slacked</span>}
                            {alert.resolvedAutomatically && <span className="text-xs text-green-600">✓ auto-resolved</span>}
                          </div>
                        </div>
                      </div>

                      {tab === 'open' && (
                        <button onClick={() => resolveAlert(alert.id)} disabled={resolving === alert.id}
                          className="flex-shrink-0 text-xs px-3 py-1.5 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-[#64748b] hover:bg-[#e0f2fe] transition-colors disabled:opacity-50">
                          {resolving === alert.id ? '…' : 'Resolve'}
                        </button>
                      )}

                      {tab === 'resolved' && alert.resolvedAt && (
                        <span className="flex-shrink-0 text-xs text-[#94a3b8]">Resolved {timeAgo(alert.resolvedAt)}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
