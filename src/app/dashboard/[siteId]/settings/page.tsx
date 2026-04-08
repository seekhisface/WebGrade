'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IntegrationSettings {
  posthogEnabled: boolean;
  posthogApiKey: string | null;
  posthogApiKeySet: boolean;
  gscConnected: boolean;
  gscPropertyUrl: string | null;
  gscLastSyncAt: string | null;
}

interface GscProperty {
  siteUrl: string;
  permissionLevel: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.siteId as string;

  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // PostHog state
  const [posthogEnabled, setPosthogEnabled] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [editingKey, setEditingKey] = useState(false);

  // GSC state
  const [gscProperties, setGscProperties] = useState<GscProperty[]>([]);
  const [gscLoading, setGscLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [syncing, setSyncing] = useState(false);

  // Auto-load GSC properties after returning from Google OAuth
  useEffect(() => {
    if (searchParams.get('gsc') === 'connected') {
      setSaveMessage('Google account connected — loading your properties...');
      fetch(`/api/gsc/connect?siteId=${siteId}`)
        .then(r => r.json())
        .then(data => {
          if (data.properties?.length) {
            setGscProperties(data.properties);
            setSaveMessage(`Found ${data.properties.length} Search Console propert${data.properties.length === 1 ? 'y' : 'ies'} — select one below`);
          } else {
            setSaveMessage('No Search Console properties found. Make sure your Google account has access to at least one verified site in Search Console.');
          }
          setTimeout(() => setSaveMessage(null), 10000);
        })
        .catch(() => {
          setSaveMessage('Failed to load properties');
          setTimeout(() => setSaveMessage(null), 5000);
        });
    }
  }, [searchParams, siteId]);

  useEffect(() => {
    fetch(`/api/settings/integrations?siteId=${siteId}`)
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        setPosthogEnabled(data.posthogEnabled);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId]);

  async function handleTogglePosthog(enabled: boolean) {
    setPosthogEnabled(enabled);
    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, posthogEnabled: enabled }),
      });

      if (res.ok) {
        setSaveMessage(enabled ? 'PostHog enabled' : 'PostHog disabled');
        setSettings(prev => prev ? { ...prev, posthogEnabled: enabled } : prev);
      } else {
        setPosthogEnabled(!enabled);
        setSaveMessage('Failed to save');
      }
    } catch {
      setPosthogEnabled(!enabled);
      setSaveMessage('Failed to save');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  }

  async function handleSaveApiKey() {
    if (!apiKeyInput.trim()) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, posthogApiKey: apiKeyInput.trim() }),
      });

      if (res.ok) {
        setSaveMessage('API key saved');
        setSettings(prev => prev ? {
          ...prev,
          posthogApiKeySet: true,
          posthogApiKey: `${'*'.repeat(Math.max(0, apiKeyInput.trim().length - 4))}${apiKeyInput.trim().slice(-4)}`,
        } : prev);
        setApiKeyInput('');
        setEditingKey(false);
      } else {
        setSaveMessage('Failed to save API key');
      }
    } catch {
      setSaveMessage('Failed to save API key');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  }

  async function handleRemoveApiKey() {
    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, posthogApiKey: null }),
      });

      if (res.ok) {
        setSaveMessage('API key removed');
        setSettings(prev => prev ? { ...prev, posthogApiKeySet: false, posthogApiKey: null } : prev);
        setEditingKey(false);
      } else {
        setSaveMessage('Failed to remove API key');
      }
    } catch {
      setSaveMessage('Failed to remove API key');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  }

  async function handleLoadGscProperties() {
    setGscLoading(true);
    try {
      const res = await fetch(`/api/gsc/connect?siteId=${siteId}`);
      const data = await res.json();
      if (data.needsGoogleAuth && data.authorizeUrl) {
        // Redirect to Google OAuth consent — works for any login method
        window.location.href = data.authorizeUrl;
        return;
      } else if (data.needsGoogleAuth) {
        setSaveMessage(data.message || 'Unable to connect to Google');
        setTimeout(() => setSaveMessage(null), 5000);
      } else {
        setGscProperties(data.properties);
      }
    } catch {
      setSaveMessage('Failed to load GSC properties');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setGscLoading(false);
    }
  }

  async function handleConnectGsc() {
    if (!selectedProperty) return;
    setSaving(true);
    try {
      const res = await fetch('/api/gsc/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, propertyUrl: selectedProperty }),
      });
      if (res.ok) {
        setSettings(prev => prev ? { ...prev, gscConnected: true, gscPropertyUrl: selectedProperty } : prev);
        setGscProperties([]);
        setSaveMessage('Search Console connected');
      } else {
        setSaveMessage('Failed to connect');
      }
    } catch {
      setSaveMessage('Failed to connect');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  }

  async function handleDisconnectGsc() {
    setSaving(true);
    try {
      const res = await fetch(`/api/gsc/connect?siteId=${siteId}`, { method: 'DELETE' });
      if (res.ok) {
        setSettings(prev => prev ? { ...prev, gscConnected: false, gscPropertyUrl: null, gscLastSyncAt: null } : prev);
        setSaveMessage('Search Console disconnected');
      }
    } catch {
      setSaveMessage('Failed to disconnect');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  }

  async function handleSyncGsc() {
    setSyncing(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/gsc/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMessage(`Synced ${data.daysImported} days, ${data.keywordsImported} keyword records`);
        setSettings(prev => prev ? { ...prev, gscLastSyncAt: new Date().toISOString() } : prev);
      } else {
        setSaveMessage(data.error || 'Sync failed');
      }
    } catch {
      setSaveMessage('Sync failed');
    } finally {
      setSyncing(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-48" />
            <div className="h-48 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage integrations and site configuration</p>
        </div>

        {/* Settings nav */}
        <div className="flex gap-2 border-b border-slate-200 pb-px">
          <Link
            href={`/dashboard/${siteId}/settings`}
            className="px-4 py-2 text-sm font-medium text-sky-600 border-b-2 border-sky-600 -mb-px"
          >
            Integrations
          </Link>
          <Link
            href={`/dashboard/${siteId}/settings/alerts`}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Alerts
          </Link>
          <Link
            href={`/dashboard/${siteId}/settings/distributions`}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Distributions
          </Link>
        </div>

        {/* Save message */}
        {saveMessage && (
          <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
            saveMessage.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
          }`}>
            {saveMessage}
          </div>
        )}

        {/* PostHog integration card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-5 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">PostHog</h3>
                  <p className="text-sm text-slate-500">Forward behavioral events to PostHog for additional analytics</p>
                </div>
              </div>

              {/* Toggle */}
              <button
                onClick={() => handleTogglePosthog(!posthogEnabled)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  posthogEnabled ? 'bg-sky-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    posthogEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* API key section — only show when enabled */}
          {posthogEnabled && (
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Project API Key
                </label>
                <p className="text-xs text-slate-400 mb-3">
                  Find this in your PostHog project settings under &quot;Project API Key&quot;. Events will not be forwarded without a valid key.
                </p>

                {settings?.posthogApiKeySet && !editingKey ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 font-mono">
                      {settings.posthogApiKey}
                    </div>
                    <button
                      onClick={() => setEditingKey(true)}
                      className="px-3 py-2 text-sm font-medium text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
                    >
                      Change
                    </button>
                    <button
                      onClick={handleRemoveApiKey}
                      disabled={saving}
                      className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      placeholder="phc_..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    />
                    <button
                      onClick={handleSaveApiKey}
                      disabled={saving || !apiKeyInput.trim()}
                      className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Save
                    </button>
                    {editingKey && (
                      <button
                        onClick={() => { setEditingKey(false); setApiKeyInput(''); }}
                        className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>

              {posthogEnabled && !settings?.posthogApiKeySet && !apiKeyInput && (
                <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-xs text-amber-700">
                    PostHog is enabled but no API key is set. Events will not be forwarded until you add a key.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Google Search Console integration card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-5 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Google Search Console</h3>
                  <p className="text-sm text-slate-500">Import keyword rankings, clicks, and impressions from GSC</p>
                </div>
              </div>

              {settings?.gscConnected && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                  Connected
                </span>
              )}
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            {settings?.gscConnected ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-700 font-medium font-mono">{settings.gscPropertyUrl}</p>
                    {settings.gscLastSyncAt && (
                      <p className="text-xs text-slate-400 mt-1">
                        Last synced: {new Date(settings.gscLastSyncAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSyncGsc}
                      disabled={syncing}
                      className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      {syncing ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Syncing...
                        </>
                      ) : 'Sync Now'}
                    </button>
                    <button
                      onClick={handleDisconnectGsc}
                      disabled={saving}
                      className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {gscProperties.length > 0 ? (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">
                      Select a property
                    </label>
                    <div className="flex items-center gap-3">
                      <select
                        value={selectedProperty}
                        onChange={e => setSelectedProperty(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="">Choose a property...</option>
                        {gscProperties.map(p => (
                          <option key={p.siteUrl} value={p.siteUrl}>{p.siteUrl}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleConnectGsc}
                        disabled={saving || !selectedProperty}
                        className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Connect
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleLoadGscProperties}
                    disabled={gscLoading}
                    className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors"
                  >
                    {gscLoading ? 'Loading...' : 'Connect Search Console'}
                  </button>
                )}
                <p className="text-xs text-slate-400">
                  Requires a Google account with Search Console access. Your account must be verified as a site owner or have read access.
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── Ad Spend ── */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <h2 className="text-sm font-bold text-white mb-1">Ad Spend by Channel</h2>
          <p className="text-xs text-slate-400 mb-4">Enter your monthly ad spend per channel so WebGrade can calculate wasted spend and ROI.</p>
          <AdSpendEditor siteId={siteId} />
        </div>
      </div>
    </div>
  );
}

// ── Ad Spend Editor Component ──────────────────────────────────────────

const DEFAULT_CHANNELS = [
  { source: 'google', medium: 'cpc', label: 'Google Ads' },
  { source: 'facebook', medium: 'social', label: 'Meta / Facebook Ads' },
  { source: 'linkedin', medium: 'social', label: 'LinkedIn Ads' },
  { source: 'bing', medium: 'cpc', label: 'Bing Ads' },
];

function AdSpendEditor({ siteId }: { siteId: string }) {
  const [channels, setChannels] = useState<{ source: string; medium: string; label: string; spend: string; clicks: string }[]>(
    DEFAULT_CHANNELS.map(c => ({ ...c, spend: '', clicks: '' }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/ad-spend?siteId=${siteId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.sources?.length > 0) {
          setChannels(prev => prev.map(ch => {
            const match = data.sources.find((s: { source: string; medium: string }) => s.source === ch.source && s.medium === ch.medium);
            return match ? { ...ch, spend: match.platformSpend ? String(match.platformSpend) : '', clicks: match.platformClicks ? String(match.platformClicks) : '' } : ch;
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const payload = channels
      .filter(ch => ch.spend && parseFloat(ch.spend) > 0)
      .map(ch => ({
        source: ch.source,
        medium: ch.medium,
        platformSpend: parseFloat(ch.spend),
        platformClicks: ch.clicks ? parseInt(ch.clicks) : undefined,
      }));

    if (payload.length > 0) {
      const res = await fetch('/api/ad-spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, channels: payload }),
      });
      if (res.ok) setSaved(true);
    }
    setSaving(false);
  }

  if (loading) return <p className="text-xs text-slate-500">Loading...</p>;

  return (
    <div className="space-y-3">
      {channels.map((ch, i) => (
        <div key={ch.source + ch.medium} className="flex items-center gap-3">
          <span className="text-xs text-slate-300 w-32 flex-shrink-0">{ch.label}</span>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
            <input type="number" placeholder="0" value={ch.spend}
              onChange={e => setChannels(prev => prev.map((c, j) => j === i ? { ...c, spend: e.target.value } : c))}
              className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500" />
          </div>
          <div className="relative w-28 flex-shrink-0">
            <input type="number" placeholder="Clicks" value={ch.clicks}
              onChange={e => setChannels(prev => prev.map((c, j) => j === i ? { ...c, clicks: e.target.value } : c))}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500" />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Save ad spend'}
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved!</span>}
      </div>
      <p className="text-xs text-slate-500">Enter monthly spend and optional click counts. WebGrade uses this to calculate cost-per-conversion and identify wasted spend.</p>
    </div>
  );
}
