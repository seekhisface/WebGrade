'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IntegrationSettings {
  posthogEnabled: boolean;
  posthogApiKey: string | null;
  posthogApiKeySet: boolean;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Form state
  const [posthogEnabled, setPosthogEnabled] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [editingKey, setEditingKey] = useState(false);

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
      </div>
    </div>
  );
}
