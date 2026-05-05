'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConversionGoal {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  createdAt: string;
}

interface ProfileData {
  siteId: string;
  siteName: string;
  siteUrl: string;
  domain: string;
  snippetId: string;
  snippetInstalled: boolean;

  conversionGoalUrl: string;
  conversionGoalName: string;
  conversionFormSelector?: string;
  modalConversionStats?: {
    selectorConfigured: boolean;
    selectorValue: string;
    autoConversionsCount30d: number;
    lastAutoConversionAt: string | null;
    iframeConversions?: {
      calendly: { count: number; lastAt: string | null };
      hubspot: { count: number; lastAt: string | null };
    };
    widgetEngagedCount30d?: number;
    manualConversionsCount30d?: number;
    totalConversionsCount30d?: number;
  };

  businessDescription: string;
  targetAudience: string;
  primaryValueProp: string;
  competitorUrls: string[];

  ga4Connected: boolean;
  ga4PropertyId: string | null;
  ga4ConnectedAt: string | null;
  ga4LastSyncAt: string | null;

  gscConnected: boolean;
  gscPropertyUrl: string | null;
  gscConnectedAt: string | null;
  gscLastSyncAt: string | null;

  gadsConnected: boolean;
  gadsCustomerId: string | null;
  gadsConnectedAt: string | null;
  gadsLastSyncAt: string | null;

  posthogEnabled: boolean;
  posthogApiKey: string | null;
  posthogApiKeySet: boolean;

  monthlyAdSpend: number | null;
  averageOrderValue: number | null;
  leadToWinRate: number | null;
  conversionRate: number | null;

  isOAuthUser: boolean;
}

interface DetectedCta {
  type: string;
  text: string;
  url: string;
  confidence: string;
}

interface GscProperty {
  siteUrl: string;
  permissionLevel: string;
}

// ---------------------------------------------------------------------------
// Tooltip Component
// ---------------------------------------------------------------------------

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex ml-1">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(s => !s)}
        className="w-4 h-4 rounded-full bg-sky-100 text-sky-600 text-[10px] font-bold flex items-center justify-center hover:bg-sky-200 transition-colors"
      >
        ?
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 bg-[#0c4a6e] text-white text-xs rounded-lg shadow-lg z-50 pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0c4a6e] rotate-45 -mt-1" />
        </div>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status Badge Component
// ---------------------------------------------------------------------------

function StatusBadge({ connected, label }: { connected: boolean; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
      connected
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        : 'bg-amber-50 text-amber-700 border border-amber-200'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {label ?? (connected ? 'Connected' : 'Not connected')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Re-auth Modal
// ---------------------------------------------------------------------------

function ReauthModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onSuccess();
      } else {
        setError(data.error || 'Incorrect password');
      }
    } catch {
      setError('Failed to verify password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-[#bae6fd] shadow-xl w-full max-w-sm p-6">
          <h3 className="text-base font-bold text-[#0c4a6e] mb-1">Verify your identity</h3>
          <p className="text-xs text-[#64748b] mb-4">
            Enter your password to view integration credentials.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoFocus
              className="w-full px-3 py-2.5 bg-[#f0f9ff] border border-[#bae6fd] rounded-xl text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder-[#94a3b8]"
            />
            {error && (
              <p className="text-xs text-red-600 font-medium">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !password}
                className="flex-1 py-2.5 bg-[#0c4a6e] text-white text-sm font-semibold rounded-xl hover:bg-[#075985] disabled:opacity-50 transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-[#bae6fd] text-[#64748b] text-sm font-medium rounded-xl hover:bg-[#f0f9ff] transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Ad Spend Editor (restyled for light theme)
// ---------------------------------------------------------------------------

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

  if (loading) return <p className="text-xs text-[#94a3b8]">Loading...</p>;

  return (
    <div className="space-y-3">
      {channels.map((ch, i) => (
        <div key={ch.source + ch.medium} className="flex items-center gap-3">
          <span className="text-xs text-[#64748b] w-36 flex-shrink-0 font-medium">{ch.label}</span>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-xs">$</span>
            <input type="number" placeholder="0" value={ch.spend}
              onChange={e => setChannels(prev => prev.map((c, j) => j === i ? { ...c, spend: e.target.value } : c))}
              className="w-full pl-7 pr-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-sky-400" />
          </div>
          <div className="relative w-28 flex-shrink-0">
            <input type="number" placeholder="Clicks" value={ch.clicks}
              onChange={e => setChannels(prev => prev.map((c, j) => j === i ? { ...c, clicks: e.target.value } : c))}
              className="w-full px-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-sky-400" />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-[#0c4a6e] text-white text-sm font-medium rounded-lg hover:bg-[#075985] disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Save ad spend'}
        </button>
        {saved && <span className="text-xs text-emerald-600 font-medium">Saved!</span>}
      </div>
      <p className="text-xs text-[#94a3b8]">Enter monthly spend and optional click counts. WebGrade uses this to calculate cost-per-conversion and identify wasted spend.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Settings Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.siteId as string;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Editable fields
  const [siteName, setSiteName] = useState('');
  const [bizDescription, setBizDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [primaryValueProp, setPrimaryValueProp] = useState('');
  const [competitors, setCompetitors] = useState(['', '', '']);
  const [monthlyAdSpend, setMonthlyAdSpend] = useState('');
  const [aov, setAov] = useState('');
  const [leadToWinRate, setLeadToWinRate] = useState('');
  const [conversionRate, setConversionRate] = useState('');

  // PostHog
  const [posthogEnabled, setPosthogEnabled] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [editingKey, setEditingKey] = useState(false);

  // GSC
  const [gscProperties, setGscProperties] = useState<GscProperty[]>([]);
  const [gscLoading, setGscLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [syncing, setSyncing] = useState(false);

  // GA4
  const [ga4Properties, setGa4Properties] = useState<{ name: string; displayName: string }[]>([]);
  const [ga4Loading, setGa4Loading] = useState(false);
  const [selectedGa4Property, setSelectedGa4Property] = useState('');
  const [syncingGa4, setSyncingGa4] = useState(false);

  // Google Ads
  const [gadsAccounts, setGadsAccounts] = useState<{ customerId: string; name: string }[]>([]);
  const [gadsLoading, setGadsLoading] = useState(false);
  const [selectedGadsAccount, setSelectedGadsAccount] = useState('');
  const [syncingGads, setSyncingGads] = useState(false);

  // Conversion goals (multi)
  const [conversionGoals, setConversionGoals] = useState<ConversionGoal[]>([]);
  const [newGoalUrl, setNewGoalUrl] = useState('');
  const [newGoalName, setNewGoalName] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  // CTA scan
  const [scanningCtas, setScanningCtas] = useState(false);
  const [detectedCtas, setDetectedCtas] = useState<DetectedCta[]>([]);
  const [showCtaModal, setShowCtaModal] = useState(false);
  const [ctaFilter, setCtaFilter] = useState<'all' | 'high' | 'form' | 'button' | 'link'>('all');
  const [selectedCtaUrls, setSelectedCtaUrls] = useState<Set<string>>(new Set());

  // Re-auth
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthed, setReauthed] = useState(false);
  const reauthTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Snippet copy
  const [snippetCopied, setSnippetCopied] = useState(false);

  // ---------------------------------------------------------------------------
  // Load profile data
  // ---------------------------------------------------------------------------

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/settings/profile?siteId=${siteId}`);
      const data: ProfileData = await res.json();
      setProfile(data);

      setSiteName(data.siteName);
      setBizDescription(data.businessDescription);
      setTargetAudience(data.targetAudience);
      setPrimaryValueProp(data.primaryValueProp);

      const urls = data.competitorUrls ?? [];
      setCompetitors([urls[0] ?? '', urls[1] ?? '', urls[2] ?? '']);

      setMonthlyAdSpend(data.monthlyAdSpend != null ? String(data.monthlyAdSpend) : '');
      setAov(data.averageOrderValue != null ? String(data.averageOrderValue) : '');
      setLeadToWinRate(data.leadToWinRate != null ? String(data.leadToWinRate) : '');
      setConversionRate(data.conversionRate != null ? String(data.conversionRate) : '');
      setPosthogEnabled(data.posthogEnabled);

      // OAuth users skip re-auth automatically
      if (data.isOAuthUser) {
        setReauthed(true);
      }
    } catch {
      flash('Failed to load settings', true);
    } finally {
      setLoading(false);
    }

    // Load conversion goals separately
    try {
      const gr = await fetch(`/api/conversion-goals?siteId=${siteId}`);
      if (gr.ok) {
        const gd = await gr.json();
        setConversionGoals(gd.goals ?? []);
      }
    } catch { /* non-fatal */ }
  }, [siteId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Auto-load GSC properties after OAuth return
  useEffect(() => {
    if (searchParams.get('gsc') === 'connected') {
      flash('Google account connected -- loading your properties...');
      fetch(`/api/gsc/connect?siteId=${siteId}`)
        .then(r => r.json())
        .then(data => {
          if (data.properties?.length) {
            setGscProperties(data.properties);
            flash(`Found ${data.properties.length} Search Console propert${data.properties.length === 1 ? 'y' : 'ies'} -- select one below`);
          } else {
            flash('No Search Console properties found. Make sure your Google account has access to at least one verified site.', true);
          }
        })
        .catch(() => flash('Failed to load properties', true));
    }
  }, [searchParams, siteId]);

  // Auto-load GA4 properties after OAuth return
  useEffect(() => {
    if (searchParams.get('ga4') === 'connected') {
      setGa4Loading(true);
      flash('Google Analytics connected — loading your properties...');
      fetch(`/api/ga4/properties?siteId=${siteId}`)
        .then(r => r.json())
        .then(data => {
          if (data.properties?.length) {
            setGa4Properties(data.properties);
            flash(`Found ${data.properties.length} GA4 propert${data.properties.length === 1 ? 'y' : 'ies'} — select one below`);
          } else {
            flash('No GA4 properties found. Make sure your Google account has Analytics access.', true);
          }
        })
        .catch(() => flash('Failed to load GA4 properties', true))
        .finally(() => setGa4Loading(false));
    }
  }, [searchParams, siteId]);

  // Auto-load Google Ads accounts after OAuth return
  useEffect(() => {
    if (searchParams.get('gads') === 'connected') {
      setGadsLoading(true);
      flash('Google Ads connected — loading your accounts...');
      fetch(`/api/gads/accounts?siteId=${siteId}`)
        .then(r => r.json())
        .then(data => {
          if (data.accounts?.length) {
            setGadsAccounts(data.accounts);
            flash(`Found ${data.accounts.length} Google Ads account${data.accounts.length === 1 ? '' : 's'} — select one below`);
          } else {
            flash('No Google Ads accounts found. Make sure your Google account has Ads access.', true);
          }
        })
        .catch(() => flash('Failed to load Google Ads accounts', true))
        .finally(() => setGadsLoading(false));
    }
  }, [searchParams, siteId]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function flash(msg: string, isError = false) {
    setSaveMessage((isError ? 'FAIL:' : '') + msg);
    setTimeout(() => setSaveMessage(null), 5000);
  }

  function handleReauthSuccess() {
    setReauthed(true);
    setShowReauthModal(false);
    if (reauthTimerRef.current) clearTimeout(reauthTimerRef.current);
    reauthTimerRef.current = setTimeout(() => setReauthed(false), 5 * 60 * 1000); // 5 minutes
  }

  // ---------------------------------------------------------------------------
  // Save handlers
  // ---------------------------------------------------------------------------

  async function patchProfile(data: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, ...data }),
      });
      if (res.ok) {
        flash('Saved');
        loadProfile();
      } else {
        flash('Failed to save', true);
      }
    } catch {
      flash('Failed to save', true);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSiteInfo() {
    await patchProfile({ siteName });
  }


  async function handleSaveBusinessContext() {
    await patchProfile({
      businessDescription: bizDescription,
      targetAudience,
      primaryValueProp,
      competitorUrls: competitors.filter(Boolean),
    });
  }

  async function handleSaveRevenue() {
    await patchProfile({
      monthlyAdSpend: monthlyAdSpend ? parseFloat(monthlyAdSpend) : null,
      averageOrderValue: aov ? parseFloat(aov) : null,
      leadToWinRate: leadToWinRate ? parseFloat(leadToWinRate) : null,
      conversionRate: conversionRate ? parseFloat(conversionRate) : null,
    });
  }

  // ---------------------------------------------------------------------------
  // Conversion goal handlers
  // ---------------------------------------------------------------------------

  async function handleAddGoal(goalsToAdd: { name: string; url: string }[]) {
    if (goalsToAdd.length === 0) return;
    setSavingGoal(true);
    try {
      const res = await fetch('/api/conversion-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, goals: goalsToAdd }),
      });
      const data = await res.json();
      if (res.ok) {
        setConversionGoals(data.goals);
        setNewGoalUrl('');
        setNewGoalName('');
        flash('Conversion goal added');
      } else {
        flash(data.error || 'Failed to add goal', true);
      }
    } catch {
      flash('Failed to add goal', true);
    } finally {
      setSavingGoal(false);
    }
  }

  async function handleDeleteGoal(id: string) {
    try {
      const res = await fetch(`/api/conversion-goals?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConversionGoals(prev => prev.filter(g => g.id !== id));
        flash('Goal removed');
      } else {
        flash('Failed to remove goal', true);
      }
    } catch {
      flash('Failed to remove goal', true);
    }
  }

  async function handleToggleGoal(id: string, isActive: boolean) {
    try {
      const res = await fetch('/api/conversion-goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      });
      if (res.ok) {
        setConversionGoals(prev => prev.map(g => g.id === id ? { ...g, isActive } : g));
      }
    } catch { /* non-fatal */ }
  }

  // ---------------------------------------------------------------------------
  // PostHog handlers
  // ---------------------------------------------------------------------------

  async function handleTogglePosthog(enabled: boolean) {
    setPosthogEnabled(enabled);
    await patchProfile({ posthogEnabled: enabled });
  }

  async function handleSaveApiKey() {
    if (!apiKeyInput.trim()) return;
    await patchProfile({ posthogApiKey: apiKeyInput.trim() });
    setApiKeyInput('');
    setEditingKey(false);
  }

  async function handleRemoveApiKey() {
    await patchProfile({ posthogApiKey: null });
    setEditingKey(false);
  }

  // ---------------------------------------------------------------------------
  // GSC handlers
  // ---------------------------------------------------------------------------

  async function handleLoadGscProperties() {
    setGscLoading(true);
    try {
      const res = await fetch(`/api/gsc/connect?siteId=${siteId}`);
      const data = await res.json();
      if (data.needsGoogleAuth && data.authorizeUrl) {
        window.location.href = data.authorizeUrl;
        return;
      } else if (data.needsGoogleAuth) {
        flash(data.message || 'Unable to connect to Google', true);
      } else {
        setGscProperties(data.properties);
      }
    } catch {
      flash('Failed to load GSC properties', true);
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
        setGscProperties([]);
        flash('Search Console connected');
        loadProfile();
      } else {
        flash('Failed to connect', true);
      }
    } catch {
      flash('Failed to connect', true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnectGsc() {
    setSaving(true);
    try {
      const res = await fetch(`/api/gsc/connect?siteId=${siteId}`, { method: 'DELETE' });
      if (res.ok) {
        flash('Search Console disconnected');
        loadProfile();
      }
    } catch {
      flash('Failed to disconnect', true);
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncGsc() {
    setSyncing(true);
    try {
      const res = await fetch('/api/gsc/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, force: true }),
      });
      const data = await res.json();
      if (res.ok) {
        flash(data.daysImported > 0
          ? `Synced ${data.daysImported} days, ${data.keywordsImported} keyword records`
          : 'Search Console is up to date — no new data from Google (check property URL in console.search.google.com)');
        loadProfile();
      } else {
        flash(data.error || 'Sync failed', true);
      }
    } catch {
      flash('Sync failed', true);
    } finally {
      setSyncing(false);
    }
  }

  async function handleConnectGa4() {
    if (!selectedGa4Property) return;
    setSyncingGa4(true);
    try {
      const res = await fetch('/api/ga4/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, propertyId: selectedGa4Property }),
      });
      const data = await res.json();
      if (res.ok) {
        setGa4Properties([]);
        flash(`GA4 connected — ${data.metricsImported} baseline metrics imported`);
        loadProfile();
      } else {
        flash(data.error || 'Failed to connect GA4', true);
      }
    } catch {
      flash('Failed to connect GA4', true);
    } finally {
      setSyncingGa4(false);
    }
  }

  async function handleConnectGads() {
    if (!selectedGadsAccount) return;
    setSyncingGads(true);
    try {
      const res = await fetch('/api/gads/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, customerId: selectedGadsAccount }),
      });
      if (res.ok) {
        setGadsAccounts([]);
        flash('Google Ads account connected');
        loadProfile();
      } else {
        const data = await res.json();
        flash(data.error || 'Failed to connect Google Ads account', true);
      }
    } catch {
      flash('Failed to connect Google Ads account', true);
    } finally {
      setSyncingGads(false);
    }
  }

  async function handleSyncGa4() {
    if (!profile?.ga4PropertyId) return;
    setSyncingGa4(true);
    try {
      const res = await fetch('/api/ga4/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, propertyId: profile.ga4PropertyId }),
      });
      const data = await res.json();
      if (res.ok) {
        flash(`GA4 synced — ${data.metricsImported} metrics imported`);
        loadProfile();
      } else {
        flash(data.error || 'GA4 sync failed', true);
      }
    } catch {
      flash('GA4 sync failed', true);
    } finally {
      setSyncingGa4(false);
    }
  }

  async function handleDisconnectGa4() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, disconnectGa4: true }),
      });
      if (res.ok) {
        flash('Google Analytics disconnected');
        loadProfile();
      } else {
        flash('Failed to disconnect', true);
      }
    } catch {
      flash('Failed to disconnect', true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnectGads() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, disconnectGads: true }),
      });
      if (res.ok) {
        flash('Google Ads disconnected');
        loadProfile();
      } else {
        flash('Failed to disconnect', true);
      }
    } catch {
      flash('Failed to disconnect', true);
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncGads() {
    setSyncingGads(true);
    try {
      const res = await fetch('/api/gads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, daysBack: 30 }),
      });
      const data = await res.json();
      if (res.ok) {
        flash(`Google Ads synced — ${data.campaignsImported ?? 0} campaigns imported`);
        loadProfile();
      } else {
        flash(data.error || 'Google Ads sync failed', true);
      }
    } catch {
      flash('Google Ads sync failed', true);
    } finally {
      setSyncingGads(false);
    }
  }

  // ---------------------------------------------------------------------------
  // CTA scan
  // ---------------------------------------------------------------------------

  async function handleScanCtas() {
    if (!profile?.siteUrl) return;
    setScanningCtas(true);
    setDetectedCtas([]);
    setSelectedCtaUrls(new Set());
    try {
      const res = await fetch('/api/detect-ctas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: profile.siteUrl }),
      });
      const data = await res.json();
      if (res.ok && data.ctas) {
        setDetectedCtas(data.ctas);
        // Auto-select high confidence
        const highUrls = new Set<string>(
          (data.ctas as DetectedCta[])
            .filter(c => c.confidence === 'high' && c.url)
            .map(c => c.url)
        );
        setSelectedCtaUrls(highUrls);
        if (data.ctas.length === 0) flash('No CTAs detected on this page');
      } else {
        flash(data.error || 'CTA scan failed', true);
      }
    } catch {
      flash('CTA scan failed', true);
    } finally {
      setScanningCtas(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Snippet copy
  // ---------------------------------------------------------------------------

  function handleCopySnippetId() {
    if (!profile?.snippetId) return;
    navigator.clipboard.writeText(profile.snippetId);
    setSnippetCopied(true);
    setTimeout(() => setSnippetCopied(false), 2000);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-48 bg-sky-100 rounded-xl" />
        <div className="h-48 bg-sky-100 rounded-xl" />
      </div>
    );
  }

  const isFail = saveMessage?.startsWith('FAIL:');
  const displayMsg = isFail ? saveMessage?.replace('FAIL:', '') : saveMessage;

  return (
    <div className="space-y-6">
        {/* Save message */}
        {saveMessage && (
          <div className={`px-4 py-2 rounded-xl text-sm font-medium ${
            isFail ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            {displayMsg}
          </div>
        )}

        {/* ================================================================= */}
        {/* 1. SITE INFORMATION */}
        {/* ================================================================= */}
        <div id="site-info" className="bg-white rounded-2xl border border-[#bae6fd] shadow-sm">
          <div className="px-6 py-5 border-b border-[#e0f2fe]">
            <h2 className="text-base font-bold text-[#0c4a6e]">Site Information</h2>
            <p className="text-xs text-[#94a3b8] mt-0.5">Basic details about your tracked website</p>
          </div>
          <div className="px-6 py-5 space-y-4">
            {/* Site URL (read-only) */}
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Site URL</label>
              <div className="px-3 py-2 bg-[#f0f9ff] border border-[#e0f2fe] rounded-lg text-sm text-[#0f172a] font-mono">
                {profile?.siteUrl}
              </div>
            </div>

            {/* Site name (editable) */}
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Site Name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={siteName}
                  onChange={e => setSiteName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <button
                  onClick={handleSaveSiteInfo}
                  disabled={saving || siteName === profile?.siteName}
                  className="px-4 py-2 bg-[#0c4a6e] text-white text-sm font-medium rounded-lg hover:bg-[#075985] disabled:opacity-50 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Domain (read-only) */}
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Domain</label>
              <div className="px-3 py-2 bg-[#f0f9ff] border border-[#e0f2fe] rounded-lg text-sm text-[#0f172a] font-mono">
                {profile?.domain}
              </div>
            </div>

            {/* Snippet ID */}
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Snippet ID</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-[#f0f9ff] border border-[#e0f2fe] rounded-lg text-sm text-[#0f172a] font-mono">
                  {profile?.snippetId}
                </div>
                <button
                  onClick={handleCopySnippetId}
                  className="px-3 py-2 border border-[#bae6fd] text-[#64748b] text-sm font-medium rounded-lg hover:bg-[#f0f9ff] transition-colors"
                >
                  {snippetCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Snippet status */}
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Snippet Status</label>
              <StatusBadge
                connected={!!profile?.snippetInstalled}
                label={profile?.snippetInstalled ? 'Installed' : 'Not detected'}
              />
              {!profile?.snippetInstalled && (
                <p className="text-xs text-amber-600 mt-1.5">
                  Install the tracking snippet in your site&apos;s &lt;head&gt; tag to start collecting behavioral data.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. BUSINESS CONTEXT */}
        {/* ================================================================= */}
        <div id="business-context" className="bg-white rounded-2xl border border-[#bae6fd] shadow-sm">
          <div className="px-6 py-5 border-b border-[#e0f2fe]">
            <h2 className="text-base font-bold text-[#0c4a6e]">Business Context</h2>
            <p className="text-xs text-[#94a3b8] mt-0.5">Helps AI generate relevant, specific recommendations for your business</p>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Business Description</label>
              <textarea
                value={bizDescription}
                onChange={e => setBizDescription(e.target.value)}
                rows={3}
                placeholder="Describe what your business does, who you serve, and your key offerings..."
                className="w-full px-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder-[#94a3b8] resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Target Audience</label>
              <input
                type="text"
                value={targetAudience}
                onChange={e => setTargetAudience(e.target.value)}
                placeholder="e.g. Mid-market HR leaders at companies with 200-5000 employees"
                className="w-full px-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder-[#94a3b8]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Primary Value Proposition</label>
              <input
                type="text"
                value={primaryValueProp}
                onChange={e => setPrimaryValueProp(e.target.value)}
                placeholder="e.g. All-in-one HR platform that reduces admin time by 60%"
                className="w-full px-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder-[#94a3b8]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Competitors (up to 3 URLs)</label>
              <div className="space-y-2">
                {competitors.map((url, i) => (
                  <input
                    key={i}
                    type="url"
                    value={url}
                    onChange={e => setCompetitors(prev => prev.map((c, j) => j === i ? e.target.value : c))}
                    placeholder={`https://competitor${i + 1}.com`}
                    className="w-full px-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder-[#94a3b8]"
                  />
                ))}
              </div>
            </div>
            <button
              onClick={handleSaveBusinessContext}
              disabled={saving}
              className="px-4 py-2 bg-[#0c4a6e] text-white text-sm font-medium rounded-lg hover:bg-[#075985] disabled:opacity-50 transition-colors"
            >
              Save Business Context
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 3. CONVERSION GOALS */}
        {/* ================================================================= */}
        <div id="conversion-goals" className="bg-white rounded-2xl border border-[#bae6fd] shadow-sm">
          <div className="px-6 py-5 border-b border-[#e0f2fe]">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h2 className="text-base font-bold text-[#0c4a6e]">Conversion Goals</h2>
                <Tooltip text="Conversion goals define what counts as a successful action on your site. WebGrade tracks every goal URL and uses them to calculate conversion rates, drop-off points, and revenue impact." />
              </div>
              <button
                onClick={() => { handleScanCtas(); setShowCtaModal(true); }}
                disabled={scanningCtas || !profile?.siteUrl}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#bae6fd] text-[#0c4a6e] text-xs font-medium rounded-lg hover:bg-[#f0f9ff] disabled:opacity-50 transition-colors"
              >
                {scanningCtas ? (
                  <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Scanning...</>
                ) : (
                  <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>Scan for CTAs</>
                )}
              </button>
            </div>
            <p className="text-xs text-[#94a3b8] mt-0.5">Track multiple conversion actions — thank-you pages, signups, purchases</p>
          </div>
          <div className="px-6 py-5 space-y-4">

            {/* Existing goals list */}
            {conversionGoals.length > 0 ? (
              <div className="space-y-2">
                {conversionGoals.map(goal => (
                  <div key={goal.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${goal.isActive ? 'border-[#bae6fd] bg-[#f0f9ff]' : 'border-[#e2e8f0] bg-[#f8fafc]'}`}>
                    <button
                      onClick={() => handleToggleGoal(goal.id, !goal.isActive)}
                      title={goal.isActive ? 'Deactivate' : 'Activate'}
                      className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${goal.isActive ? 'bg-emerald-500 border-emerald-500' : 'border-[#cbd5e1] bg-white'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0f172a] truncate">{goal.name}</p>
                      <p className="text-xs text-[#94a3b8] truncate">{goal.url}</p>
                    </div>
                    {!goal.isActive && (
                      <span className="text-[10px] font-medium text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded-full flex-shrink-0">Inactive</span>
                    )}
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="text-[#cbd5e1] hover:text-red-500 transition-colors flex-shrink-0"
                      title="Remove goal"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#94a3b8] italic">No conversion goals set. Add one below or scan your site.</p>
            )}

            {/* Add manually */}
            <div className="pt-3 border-t border-[#e0f2fe]">
              <p className="text-xs font-semibold text-[#64748b] mb-2">Add manually</p>
              <div className="space-y-2">
                <input
                  type="url"
                  value={newGoalUrl}
                  onChange={e => setNewGoalUrl(e.target.value)}
                  placeholder="https://yoursite.com/thank-you"
                  className="w-full px-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder-[#94a3b8]"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGoalName}
                    onChange={e => setNewGoalName(e.target.value)}
                    placeholder="Goal name (e.g. Free trial signup)"
                    className="flex-1 px-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder-[#94a3b8]"
                  />
                  <button
                    onClick={() => {
                      if (newGoalUrl.trim()) {
                        handleAddGoal([{ url: newGoalUrl.trim(), name: newGoalName.trim() || 'Conversion' }]);
                      }
                    }}
                    disabled={savingGoal || !newGoalUrl.trim()}
                    className="px-4 py-2 bg-[#0c4a6e] text-white text-sm font-medium rounded-lg hover:bg-[#075985] disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    {savingGoal ? 'Adding...' : 'Add Goal'}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal-conversion tracking (form selector) */}
            <div className="pt-3 border-t border-[#e0f2fe]">
              <div className="flex items-center mb-1">
                <p className="text-xs font-semibold text-[#64748b]">Modal-confirmation tracking</p>
                <Tooltip text="If your demo / signup form shows a confirmation modal instead of redirecting to a thank-you page, the snippet can't see a URL change. Enter the form's HTML id OR a fragment of the form action URL — when that form submits, the snippet auto-fires a conversion event." />
              </div>
              <input
                type="text"
                value={profile?.conversionFormSelector ?? ''}
                onChange={e => setProfile(p => p ? { ...p, conversionFormSelector: e.target.value } : p)}
                onBlur={() => patchProfile({ conversionFormSelector: profile?.conversionFormSelector ?? '' })}
                placeholder="demo-form  OR  /api/demo"
                className="w-full px-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder-[#94a3b8]"
              />

              {/* Live diagnostic — proves whether the selector is actually catching submits */}
              {(() => {
                const stats = profile?.modalConversionStats;
                if (!stats) return null;
                if (!stats.selectorConfigured) {
                  return (
                    <p className="text-[11px] text-[#94a3b8] mt-1.5">
                      Leave empty if your conversion fires a page navigation to a thank-you URL (use the goal list above instead).
                    </p>
                  );
                }
                if (stats.autoConversionsCount30d === 0) {
                  return (
                    <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-[11px] font-semibold text-amber-800">
                        ⏳ Configured, no matches yet
                      </p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        The snippet is loaded with this selector, but no form_submit events have matched it in the last 30 days.
                        Check your form&apos;s id or action URL contains <code className="font-mono bg-white px-1 rounded">{stats.selectorValue}</code>.
                        Test it: submit your form and refresh this page after ~10 seconds.
                      </p>
                    </div>
                  );
                }
                const lastFired = stats.lastAutoConversionAt
                  ? (() => {
                      const hrs = Math.floor((Date.now() - new Date(stats.lastAutoConversionAt!).getTime()) / 3600000);
                      if (hrs < 1) return 'just now';
                      if (hrs < 24) return `${hrs}h ago`;
                      return `${Math.floor(hrs / 24)}d ago`;
                    })()
                  : 'unknown';
                return (
                  <div className="mt-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-[11px] font-semibold text-emerald-800">
                      ✓ Active — auto-firing conversions
                    </p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      <strong>{stats.autoConversionsCount30d}</strong> conversion{stats.autoConversionsCount30d !== 1 ? 's' : ''} auto-fired
                      via this form selector in the last 30 days. Most recent: <strong>{lastFired}</strong>.
                    </p>
                  </div>
                );
              })()}

              {/* Iframe widget tracking (Calendly + HubSpot) — always-on, no setup needed */}
              {(() => {
                const stats = profile?.modalConversionStats;
                if (!stats?.iframeConversions) return null;
                const cal = stats.iframeConversions.calendly;
                const hs = stats.iframeConversions.hubspot;
                const totalIframeConversions = cal.count + hs.count;
                const widgetEngaged = stats.widgetEngagedCount30d ?? 0;

                return (
                  <div className="mt-4 pt-3 border-t border-[#e0f2fe]">
                    <div className="flex items-center mb-2">
                      <p className="text-xs font-semibold text-[#64748b]">Iframe widget tracking (Calendly / HubSpot)</p>
                      <Tooltip text="The snippet automatically listens for booking events from Calendly and HubSpot iframes via postMessage. No setup needed — if you embed either widget, conversions are auto-recorded when bookings complete." />
                    </div>
                    {totalIframeConversions === 0 && widgetEngaged === 0 ? (
                      <p className="text-[11px] text-[#94a3b8]">
                        No iframe widget activity detected in the last 30 days. If you embed Calendly or HubSpot booking forms, this counter will populate automatically once a visitor uses them.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3">
                            <p className="text-[9px] text-[#64748b] uppercase tracking-wider mb-1">Calendly bookings</p>
                            <p className="text-lg font-black text-emerald-700">{cal.count}</p>
                            {cal.lastAt && <p className="text-[10px] text-[#94a3b8] mt-0.5">last: {new Date(cal.lastAt).toLocaleDateString()}</p>}
                          </div>
                          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3">
                            <p className="text-[9px] text-[#64748b] uppercase tracking-wider mb-1">HubSpot submits</p>
                            <p className="text-lg font-black text-emerald-700">{hs.count}</p>
                            {hs.lastAt && <p className="text-[10px] text-[#94a3b8] mt-0.5">last: {new Date(hs.lastAt).toLocaleDateString()}</p>}
                          </div>
                          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3">
                            <p className="text-[9px] text-[#64748b] uppercase tracking-wider mb-1">Widget engagements</p>
                            <p className="text-lg font-black text-[#0c4a6e]">{widgetEngaged}</p>
                            <p className="text-[10px] text-[#94a3b8] mt-0.5">opens, slot-picks</p>
                          </div>
                        </div>
                        {widgetEngaged > 0 && (
                          <p className="text-[11px] text-[#94a3b8] mt-2">
                            Funnel signal: {widgetEngaged} visitors interacted with a widget; {totalIframeConversions} actually converted. Gap = drop-off inside the widget.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 4. INTEGRATIONS */}
        {/* ================================================================= */}
        <div id="integrations" className="bg-white rounded-2xl border border-[#bae6fd] shadow-sm">
          <div className="px-6 py-5 border-b border-[#e0f2fe]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#0c4a6e]">Integrations</h2>
                <p className="text-xs text-[#94a3b8] mt-0.5">Connect external services to enrich your data</p>
              </div>
              {!reauthed && !profile?.isOAuthUser && (
                <button
                  onClick={() => setShowReauthModal(true)}
                  className="px-3 py-1.5 text-xs font-medium border border-[#bae6fd] text-[#64748b] rounded-lg hover:bg-[#f0f9ff] transition-colors"
                >
                  Show credentials
                </button>
              )}
              {reauthed && (
                <span className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  Credentials visible
                </span>
              )}
            </div>
          </div>

          <div className="divide-y divide-[#e0f2fe]">

            {/* ── Google Analytics 4 ── */}
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg border border-[#e0f2fe] flex items-center justify-center">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#E37400" d="M12.87 22.68c-1.43.16-2.75-.8-3.04-2.21l-.01-.07c-.01-.06-.02-.13-.02-.2V10.98c-.03-1.53 1.34-2.77 2.87-2.6 1.32.15 2.3 1.23 2.36 2.55v9.18c.05 1.42-1.01 2.64-2.17 2.57zM4.14 22.68c-1.48.19-2.84-.8-3.13-2.28v-.23c0-.04 0-.07-.01-.11v-2.14c-.01-1.57 1.41-2.83 2.97-2.62 1.3.17 2.26 1.25 2.33 2.56v2.23c.06 1.44-1.02 2.66-2.16 2.59zM21.06 12a2.96 2.96 0 01-2.97 2.96A2.96 2.96 0 0115.12 12a2.97 2.97 0 012.97-2.96A2.97 2.97 0 0121.06 12z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#0f172a]">Google Analytics 4</h3>
                    <p className="text-xs text-[#94a3b8]">Import baseline metrics for improvement tracking</p>
                  </div>
                </div>
                <StatusBadge connected={!!profile?.ga4Connected} />
              </div>

              {profile?.ga4Connected && profile?.ga4PropertyId && ga4Properties.length === 0 ? (
                <div className="ml-[52px] space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-[#64748b]">Property ID:</span>
                    <span className="font-mono text-[#0f172a]">{profile.ga4PropertyId}</span>
                  </div>
                  {profile.ga4LastSyncAt && (
                    <p className="text-xs text-[#94a3b8]">
                      Last synced: {new Date(profile.ga4LastSyncAt).toLocaleString()}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleSyncGa4}
                      disabled={syncingGa4}
                      className="px-3 py-1.5 bg-[#0c4a6e] text-white text-xs font-medium rounded-lg hover:bg-[#075985] disabled:opacity-50 transition-colors"
                    >
                      {syncingGa4 ? 'Syncing...' : 'Sync Now'}
                    </button>
                    <button onClick={handleDisconnectGa4} disabled={saving} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : ga4Properties.length > 0 ? (
                <div className="ml-[52px] space-y-2">
                  <label className="block text-xs font-semibold text-[#64748b]">Select a GA4 property</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedGa4Property}
                      onChange={e => setSelectedGa4Property(e.target.value)}
                      className="flex-1 px-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400"
                    >
                      <option value="">Choose a property...</option>
                      {ga4Properties.map(p => (
                        <option key={p.name} value={p.name}>{p.displayName} ({p.name})</option>
                      ))}
                    </select>
                    <button
                      onClick={handleConnectGa4}
                      disabled={syncingGa4 || !selectedGa4Property}
                      className="px-4 py-2 bg-[#0c4a6e] text-white text-sm font-medium rounded-lg hover:bg-[#075985] disabled:opacity-50 transition-colors"
                    >
                      {syncingGa4 ? 'Connecting...' : 'Connect'}
                    </button>
                    <button onClick={handleDisconnectGa4} disabled={saving} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : profile?.ga4Connected && !profile?.ga4PropertyId ? (
                <div className="ml-[52px] space-y-2">
                  <div className="flex items-center gap-2">
                    {ga4Loading ? (
                      <p className="text-xs text-[#94a3b8]">Loading properties...</p>
                    ) : (
                      <button
                        onClick={() => {
                          setGa4Loading(true);
                          fetch(`/api/ga4/properties?siteId=${siteId}`)
                            .then(r => r.json())
                            .then(data => {
                              if (data.properties?.length) {
                                setGa4Properties(data.properties);
                              } else {
                                flash('No GA4 properties found.', true);
                              }
                            })
                            .catch(() => flash('Failed to load GA4 properties', true))
                            .finally(() => setGa4Loading(false));
                        }}
                        className="px-4 py-2 bg-[#0c4a6e] text-white text-sm font-medium rounded-lg hover:bg-[#075985] transition-colors"
                      >
                        Select Property
                      </button>
                    )}
                    <button onClick={handleDisconnectGa4} disabled={saving} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                      Disconnect
                    </button>
                  </div>
                  <p className="text-xs text-[#94a3b8]">Google Analytics connected — select which property to sync.</p>
                </div>
              ) : (
                <div className="ml-[52px]">
                  {ga4Loading ? (
                    <p className="text-xs text-[#94a3b8]">Loading properties...</p>
                  ) : (
                    <a
                      href={`/api/ga4/authorize?siteId=${siteId}`}
                      className="inline-flex px-4 py-2 bg-[#0c4a6e] text-white text-sm font-medium rounded-lg hover:bg-[#075985] transition-colors"
                    >
                      Connect Google Analytics
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* ── Google Search Console ── */}
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg border border-[#e0f2fe] flex items-center justify-center">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#0f172a]">Google Search Console</h3>
                    <p className="text-xs text-[#94a3b8]">Import keyword rankings, clicks, and impressions</p>
                  </div>
                </div>
                <StatusBadge connected={!!profile?.gscConnected} />
              </div>

              <div className="ml-[52px] space-y-3">
                {profile?.gscConnected ? (
                  <>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-[#64748b]">Property:</span>
                      <span className="font-mono text-[#0f172a]">
                        {reauthed ? profile.gscPropertyUrl : (profile.gscPropertyUrl ?? '----')}
                      </span>
                    </div>
                    {profile.gscLastSyncAt && (
                      <p className="text-xs text-[#94a3b8]">
                        Last synced: {new Date(profile.gscLastSyncAt).toLocaleString()}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSyncGsc}
                        disabled={syncing}
                        className="px-3 py-1.5 bg-[#0c4a6e] text-white text-xs font-medium rounded-lg hover:bg-[#075985] disabled:opacity-50 transition-colors flex items-center gap-1.5"
                      >
                        {syncing ? (
                          <>
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Syncing...
                          </>
                        ) : 'Sync Now'}
                      </button>
                      <button
                        onClick={handleDisconnectGsc}
                        disabled={saving}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {gscProperties.length > 0 ? (
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-[#64748b]">Select a property</label>
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedProperty}
                            onChange={e => setSelectedProperty(e.target.value)}
                            className="flex-1 px-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400"
                          >
                            <option value="">Choose a property...</option>
                            {gscProperties.map(p => (
                              <option key={p.siteUrl} value={p.siteUrl}>{p.siteUrl}</option>
                            ))}
                          </select>
                          <button
                            onClick={handleConnectGsc}
                            disabled={saving || !selectedProperty}
                            className="px-4 py-2 bg-[#0c4a6e] text-white text-sm font-medium rounded-lg hover:bg-[#075985] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Connect
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleLoadGscProperties}
                        disabled={gscLoading}
                        className="px-4 py-2 bg-[#0c4a6e] text-white text-sm font-medium rounded-lg hover:bg-[#075985] disabled:opacity-50 transition-colors"
                      >
                        {gscLoading ? 'Loading...' : 'Connect Search Console'}
                      </button>
                    )}
                    <p className="text-xs text-[#94a3b8]">
                      Requires a Google account with Search Console access.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* ── Google Ads ── */}
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg border border-[#e0f2fe] flex items-center justify-center">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#FBBC04" d="M3.2 15.3L8.4 6.5c.7-1.2 2.2-1.6 3.4-.9.7.4 1.2 1.1 1.3 1.9l-5.2 8.8c-.7 1.2-2.2 1.6-3.4.9C3.3 16.8 2.9 16 3.2 15.3z" />
                      <path fill="#4285F4" d="M13.1 6.5l5.2 8.8c.7 1.2.3 2.7-.9 3.4-1.2.7-2.7.3-3.4-.9L8.8 9c-.7-1.2-.3-2.7.9-3.4 1.2-.7 2.7-.3 3.4.9z" />
                      <path fill="#34A853" d="M18.5 18a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#0f172a]">Google Ads</h3>
                    <p className="text-xs text-[#94a3b8]">Automatic campaign spend sync for ROI analysis</p>
                  </div>
                </div>
                <StatusBadge connected={!!profile?.gadsConnected} />
              </div>

              <div className="ml-[52px]">
                {profile?.gadsConnected && profile.gadsCustomerId && gadsAccounts.length === 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-[#64748b]">Customer ID:</span>
                      <span className="font-mono text-[#0f172a]">
                        {reauthed ? profile.gadsCustomerId : profile.gadsCustomerId}
                      </span>
                    </div>
                    {profile.gadsLastSyncAt && (
                      <p className="text-xs text-[#94a3b8]">
                        Last synced: {new Date(profile.gadsLastSyncAt).toLocaleString()}
                      </p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleSyncGads}
                        disabled={syncingGads}
                        className="px-3 py-1.5 bg-[#0c4a6e] text-white text-xs font-medium rounded-lg hover:bg-[#075985] disabled:opacity-50 transition-colors"
                      >
                        {syncingGads ? 'Syncing...' : 'Sync Now'}
                      </button>
                      <button onClick={handleDisconnectGads} disabled={saving} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : gadsAccounts.length > 0 ? (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[#64748b]">Select a Google Ads account</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedGadsAccount}
                        onChange={e => setSelectedGadsAccount(e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400"
                      >
                        <option value="">Choose an account...</option>
                        {gadsAccounts.map(a => (
                          <option key={a.customerId} value={a.customerId}>{a.name} ({a.customerId})</option>
                        ))}
                      </select>
                      <button
                        onClick={handleConnectGads}
                        disabled={syncingGads || !selectedGadsAccount}
                        className="px-4 py-2 bg-[#0c4a6e] text-white text-sm font-medium rounded-lg hover:bg-[#075985] disabled:opacity-50 transition-colors"
                      >
                        {syncingGads ? 'Connecting...' : 'Connect'}
                      </button>
                      <button onClick={handleDisconnectGads} disabled={saving} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : profile?.gadsConnected && !profile.gadsCustomerId ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {gadsLoading ? (
                        <p className="text-xs text-[#94a3b8]">Loading accounts...</p>
                      ) : (
                        <button
                          onClick={() => {
                            setGadsLoading(true);
                            fetch(`/api/gads/accounts?siteId=${siteId}`)
                              .then(r => r.json())
                              .then(data => {
                                if (data.accounts?.length) {
                                  setGadsAccounts(data.accounts);
                                } else {
                                  flash('No Google Ads accounts found.', true);
                                }
                              })
                              .catch(() => flash('Failed to load Google Ads accounts', true))
                              .finally(() => setGadsLoading(false));
                          }}
                          className="px-4 py-2 bg-[#0c4a6e] text-white text-sm font-medium rounded-lg hover:bg-[#075985] transition-colors"
                        >
                          Select Account
                        </button>
                      )}
                      <button onClick={handleDisconnectGads} disabled={saving} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                        Disconnect
                      </button>
                    </div>
                    <p className="text-xs text-[#94a3b8]">Google Ads connected — select which account to sync.</p>
                  </div>
                ) : (
                  <a
                    href={`/api/gads/authorize?siteId=${siteId}`}
                    className="inline-flex px-4 py-2 bg-[#0c4a6e] text-white text-sm font-medium rounded-lg hover:bg-[#075985] transition-colors"
                  >
                    Connect Google Ads
                  </a>
                )}
              </div>
            </div>

            {/* ── PostHog ── */}
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#0f172a] rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#0f172a]">PostHog</h3>
                    <p className="text-xs text-[#94a3b8]">Forward behavioral events to PostHog for additional analytics</p>
                  </div>
                </div>
                <button
                  onClick={() => handleTogglePosthog(!posthogEnabled)}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    posthogEnabled ? 'bg-[#0c4a6e]' : 'bg-[#cbd5e1]'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    posthogEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {posthogEnabled && (
                <div className="ml-[52px] space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#64748b] mb-1">Project API Key</label>
                    <p className="text-xs text-[#94a3b8] mb-2">
                      Find this in your PostHog project settings under &quot;Project API Key&quot;.
                    </p>

                    {profile?.posthogApiKeySet && !editingKey ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 px-3 py-2 bg-[#f0f9ff] border border-[#e0f2fe] rounded-lg text-sm text-[#64748b] font-mono">
                          {reauthed ? profile.posthogApiKey : (profile.posthogApiKey ?? '****')}
                        </div>
                        <button
                          onClick={() => setEditingKey(true)}
                          className="px-3 py-2 text-xs font-medium text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
                        >
                          Change
                        </button>
                        <button
                          onClick={handleRemoveApiKey}
                          disabled={saving}
                          className="px-3 py-2 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={apiKeyInput}
                          onChange={e => setApiKeyInput(e.target.value)}
                          placeholder="phc_..."
                          className="flex-1 px-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder-[#94a3b8]"
                        />
                        <button
                          onClick={handleSaveApiKey}
                          disabled={saving || !apiKeyInput.trim()}
                          className="px-4 py-2 bg-[#0c4a6e] text-white text-xs font-medium rounded-lg hover:bg-[#075985] disabled:opacity-50 transition-colors"
                        >
                          Save
                        </button>
                        {editingKey && (
                          <button
                            onClick={() => { setEditingKey(false); setApiKeyInput(''); }}
                            className="px-3 py-2 text-xs font-medium text-[#64748b] hover:text-[#0f172a] hover:bg-[#f0f9ff] rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {posthogEnabled && !profile?.posthogApiKeySet && !apiKeyInput && (
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

        {/* ================================================================= */}
        {/* 5. REVENUE & AD SPEND */}
        {/* ================================================================= */}
        <div id="revenue" className="bg-white rounded-2xl border border-[#bae6fd] shadow-sm">
          <div className="px-6 py-5 border-b border-[#e0f2fe]">
            <h2 className="text-base font-bold text-[#0c4a6e]">Revenue & Ad Spend</h2>
            <p className="text-xs text-[#94a3b8] mt-0.5">Financial data used for ROI calculations and revenue impact estimates</p>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center mb-1">
                  <label className="text-xs font-semibold text-[#64748b]">Monthly Ad Spend</label>
                  <Tooltip text="Your total monthly advertising budget across all channels. Used to calculate wasted spend and campaign ROI." />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">$</span>
                  <input
                    type="number"
                    value={monthlyAdSpend}
                    onChange={e => setMonthlyAdSpend(e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder-[#94a3b8]"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center mb-1">
                  <label className="text-xs font-semibold text-[#64748b]">Average Order Value</label>
                  <Tooltip text="The average revenue per conversion. Used to calculate Revenue at Risk and dollar impact of drop-offs." />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">$</span>
                  <input
                    type="number"
                    value={aov}
                    onChange={e => setAov(e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder-[#94a3b8]"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center mb-1">
                  <label className="text-xs font-semibold text-[#64748b]">Lead-to-Win Rate</label>
                  <Tooltip text="The percentage of leads that convert to paying customers. Unlocks pipeline revenue estimates." />
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={leadToWinRate}
                    onChange={e => setLeadToWinRate(e.target.value)}
                    placeholder="0"
                    className="w-full pl-3 pr-7 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder-[#94a3b8]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">%</span>
                </div>
              </div>
              <div>
                <div className="flex items-center mb-1">
                  <label className="text-xs font-semibold text-[#64748b]">Conversion Rate</label>
                  <Tooltip text="Your site's current conversion rate. Used as the baseline for measuring improvement." />
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={conversionRate}
                    onChange={e => setConversionRate(e.target.value)}
                    placeholder="0"
                    className="w-full pl-3 pr-7 py-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder-[#94a3b8]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">%</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleSaveRevenue}
              disabled={saving}
              className="px-4 py-2 bg-[#0c4a6e] text-white text-sm font-medium rounded-lg hover:bg-[#075985] disabled:opacity-50 transition-colors"
            >
              Save Revenue Data
            </button>

            {/* Ad Spend by Channel */}
            <div className="pt-4 border-t border-[#e0f2fe]">
              <h3 className="text-sm font-semibold text-[#0c4a6e] mb-1">Ad Spend by Channel</h3>
              <p className="text-xs text-[#94a3b8] mb-4">
                Enter monthly spend per channel so WebGrade can calculate wasted spend and ROI.
              </p>
              <AdSpendEditor siteId={siteId} />
            </div>
          </div>
        </div>

      {/* Re-auth Modal */}
      {showReauthModal && (
        <ReauthModal
          onSuccess={handleReauthSuccess}
          onClose={() => setShowReauthModal(false)}
        />
      )}

      {/* CTA Scan Results Modal */}
      {showCtaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col overflow-hidden border border-[#bae6fd]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#e0f2fe] flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-[#0c4a6e]">Detected Conversion Actions</h3>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  {scanningCtas ? 'Scanning your site...' : `${detectedCtas.length} found · ${selectedCtaUrls.size} selected`}
                </p>
              </div>
              <button onClick={() => setShowCtaModal(false)} className="p-1.5 text-[#94a3b8] hover:text-[#0c4a6e] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Loading state */}
            {scanningCtas && (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm text-[#64748b]">Scanning your site for forms, buttons, and links...</p>
                <p className="text-xs text-[#94a3b8] mt-1">This usually takes 5–10 seconds</p>
              </div>
            )}

            {/* Filter tabs */}
            {!scanningCtas && detectedCtas.length > 0 && (
              <>
                <div className="px-6 py-2 border-b border-[#f0f9ff] flex gap-1 shrink-0 overflow-x-auto">
                  {([
                    { id: 'all' as const, label: 'All', count: detectedCtas.length },
                    { id: 'high' as const, label: 'Recommended', count: detectedCtas.filter(c => c.confidence === 'high').length },
                    { id: 'form' as const, label: 'Forms', count: detectedCtas.filter(c => c.type === 'form').length },
                    { id: 'button' as const, label: 'Buttons', count: detectedCtas.filter(c => c.type === 'button').length },
                    { id: 'link' as const, label: 'Links', count: detectedCtas.filter(c => c.type === 'link').length },
                  ] as const).filter(t => t.count > 0).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setCtaFilter(tab.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                        ctaFilter === tab.id ? 'bg-[#0c4a6e] text-white' : 'text-[#64748b] hover:bg-[#f0f9ff]'
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                {/* Results list — checkboxes */}
                <div className="overflow-y-auto flex-1">
                  <div className="divide-y divide-[#f0f9ff]">
                    {detectedCtas
                      .filter(cta => {
                        if (ctaFilter === 'all') return true;
                        if (ctaFilter === 'high') return cta.confidence === 'high';
                        return cta.type === ctaFilter;
                      })
                      .map((cta, i) => {
                        const url = cta.url || '';
                        const checked = selectedCtaUrls.has(url);
                        return (
                          <label key={i} className={`flex items-start gap-3 px-6 py-3.5 cursor-pointer transition-colors ${checked ? 'bg-[#f0f9ff]' : 'hover:bg-[#f8fafc]'}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedCtaUrls(prev => {
                                  const next = new Set(prev);
                                  if (next.has(url)) next.delete(url); else next.add(url);
                                  return next;
                                });
                              }}
                              className="mt-0.5 accent-[#0c4a6e]"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-medium text-[#0f172a]">{cta.text || 'Unnamed action'}</span>
                                {cta.confidence === 'high' && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700 rounded">Recommended</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
                                <span className="inline-flex px-1.5 py-0.5 bg-[#f1f5f9] rounded text-[10px] font-semibold uppercase text-[#475569]">{cta.type}</span>
                                {url && <span className="truncate">{url}</span>}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </>
            )}

            {/* Empty state */}
            {!scanningCtas && detectedCtas.length === 0 && (
              <div className="py-12 px-6 text-center">
                <p className="text-sm text-[#64748b]">No CTAs detected on your site.</p>
                <p className="text-xs text-[#94a3b8] mt-1">Add your conversion goal manually in the section above.</p>
              </div>
            )}

            {/* Footer — Add Selected */}
            {!scanningCtas && detectedCtas.length > 0 && (
              <div className="px-6 py-3 border-t border-[#e0f2fe] shrink-0 bg-[#f8fafc] flex items-center justify-between gap-3">
                <p className="text-[10px] text-[#94a3b8]">High-confidence items auto-selected. Check any others you want to track.</p>
                <button
                  disabled={selectedCtaUrls.size === 0 || savingGoal}
                  onClick={async () => {
                    const goalsToAdd = detectedCtas
                      .filter(c => c.url && selectedCtaUrls.has(c.url))
                      .map(c => ({ url: c.url, name: c.text || 'Conversion' }));
                    await handleAddGoal(goalsToAdd);
                    setShowCtaModal(false);
                  }}
                  className="px-4 py-2 bg-[#0c4a6e] text-white text-xs font-bold rounded-lg disabled:opacity-40 hover:bg-[#075985] transition-colors flex-shrink-0"
                >
                  {savingGoal ? 'Adding...' : `Add ${selectedCtaUrls.size > 0 ? selectedCtaUrls.size : ''} selected`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
