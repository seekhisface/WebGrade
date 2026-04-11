'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertSetting {
  id: string;
  alertType: string;
  isEnabled: boolean;
  severity: string;
  emailEnabled: boolean;
  slackEnabled: boolean;
  slackWebhookUrl: string | null;
  slackChannel: string | null;
  smsEnabled: boolean;
  emailRecipients: string[];
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

const ALERT_TYPE_LABELS: Record<string, { label: string; description: string; icon: string }> = {
  CONVERSION_DROP: { label: 'Conversion Drop', description: 'Conversion rate drops more than 20% vs baseline', icon: '📉' },
  BOUNCE_RATE_SPIKE: { label: 'Bounce Rate Spike', description: 'Bounce rate spikes more than 25% vs baseline', icon: '🔄' },
  WASTED_SPEND_DETECTED: { label: 'Wasted Ad Spend', description: 'A campaign CPA exceeds 3× your target CPA', icon: '💸' },
  SNIPPET_FIRING_STOPPED: { label: 'Snippet Stopped', description: 'Behavioral tracking has stopped receiving events', icon: '⚡' },
  SEO_REGRESSION: { label: 'SEO Regression', description: 'Core Web Vitals or ranking signals decline significantly', icon: '🔍' },
  NEW_HIGH_VALUE_OPPORTUNITY: { label: 'New Opportunity', description: 'A high-value keyword or content gap is detected', icon: '🎯' },
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
  MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AlertSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [settings, setSettings] = useState<AlertSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [slackWebhook, setSlackWebhook] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState('');

  useEffect(() => { loadSettings(); }, [siteId]); // eslint-disable-line

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch(`/api/alerts/settings?siteId=${siteId}`);
      const data = await res.json();
      setSettings(data.settings ?? []);
      // Pre-populate Slack webhook from first configured setting
      const withSlack = data.settings?.find((s: AlertSetting) => s.slackWebhookUrl);
      if (withSlack) setSlackWebhook(withSlack.slackWebhookUrl ?? '');
    } catch { /* no settings yet */ }
    setLoading(false);
  }

  async function toggleSetting(alertType: string, field: keyof AlertSetting, value: boolean) {
    setSaving(alertType);
    try {
      await fetch('/api/alerts/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, alertType, [field]: value }),
      });
      setSettings(prev => prev.map(s => s.alertType === alertType ? { ...s, [field]: value } : s));
    } finally { setSaving(null); }
  }

  async function saveSlackWebhook() {
    setSaving('slack');
    try {
      await fetch('/api/alerts/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, alertType: '__all__', slackWebhookUrl: slackWebhook }),
      });
      setSettings(prev => prev.map(s => ({ ...s, slackWebhookUrl: slackWebhook })));
    } finally { setSaving(null); }
  }

  async function sendTestAlert() {
    setTestingEmail(true);
    setTestResult('');
    try {
      const res = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });
      const data = await res.json();
      setTestResult(data.ok ? '✓ Test alert sent successfully' : `Error: ${data.error}`);
    } catch { setTestResult('Error sending test alert'); }
    setTestingEmail(false);
  }

  return (
    <div className="space-y-6">
      {/* Sub-header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#64748b]">Configure when and how you're notified</p>
        <button onClick={sendTestAlert} disabled={testingEmail}
          className="text-xs px-3 py-1.5 bg-white border border-[#bae6fd] rounded-lg text-[#0c4a6e] font-medium hover:bg-[#f0f9ff] transition-colors disabled:opacity-50">
          {testingEmail ? 'Sending…' : '📧 Send Test Alert'}
        </button>
      </div>

      {testResult && (
        <div className={`p-3 rounded-lg text-sm ${testResult.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {testResult}
        </div>
      )}

      <div className="space-y-6">

        {/* Delivery channels */}
        <div className="bg-white rounded-2xl border border-[#e0f2fe] p-6">
          <h2 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-4">Delivery Channels</h2>

          <div className="space-y-4">
            {/* Email */}
            <div className="flex items-center justify-between py-3 border-b border-[#f0f9ff]">
              <div className="flex items-center gap-3">
                <span className="text-lg">📧</span>
                <div>
                  <p className="text-sm font-medium text-[#1e293b]">Email</p>
                  <p className="text-xs text-[#94a3b8]">Sent to your account email</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-green-600 font-medium">Active</span>
              </div>
            </div>

            {/* Slack */}
            <div className="py-3 border-b border-[#f0f9ff]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">💬</span>
                  <div>
                    <p className="text-sm font-medium text-[#1e293b]">Slack</p>
                    <p className="text-xs text-[#94a3b8]">Post to a channel via webhook</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${slackWebhook ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={`text-xs font-medium ${slackWebhook ? 'text-green-600' : 'text-[#94a3b8]'}`}>{slackWebhook ? 'Connected' : 'Not configured'}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhook}
                  onChange={e => setSlackWebhook(e.target.value)}
                  className="flex-1 text-xs bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-3 py-2 text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:border-[#0891b2]"
                />
                <button onClick={saveSlackWebhook} disabled={saving === 'slack'}
                  className="px-4 py-2 bg-[#0c4a6e] text-white text-xs font-medium rounded-lg hover:bg-[#075985] transition-colors disabled:opacity-50">
                  {saving === 'slack' ? '…' : 'Save'}
                </button>
              </div>
              <p className="text-xs text-[#94a3b8] mt-1.5">
                <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer" className="text-[#0891b2] hover:underline">How to create a Slack webhook →</a>
              </p>
            </div>
          </div>
        </div>

        {/* Alert types */}
        <div className="bg-white rounded-2xl border border-[#e0f2fe] p-6">
          <h2 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-4">Alert Types</h2>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#0c4a6e] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-1">
              {Object.entries(ALERT_TYPE_LABELS).map(([type, meta]) => {
                const setting = settings.find(s => s.alertType === type);
                const isEnabled = setting?.isEnabled ?? true;

                return (
                  <div key={type} className={`flex items-center justify-between p-4 rounded-xl transition-colors ${isEnabled ? 'bg-white' : 'bg-[#f8fafc] opacity-60'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{meta.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[#1e293b]">{meta.label}</p>
                          {setting && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[setting.severity] ?? ''}`}>
                              {setting.severity}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#94a3b8] mt-0.5">{meta.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Email toggle */}
                      <button
                        onClick={() => toggleSetting(type, 'emailEnabled', !(setting?.emailEnabled ?? true))}
                        title="Email"
                        className={`text-base ${setting?.emailEnabled !== false ? 'opacity-100' : 'opacity-30'}`}>
                        📧
                      </button>

                      {/* Slack toggle */}
                      {slackWebhook && (
                        <button
                          onClick={() => toggleSetting(type, 'slackEnabled', !(setting?.slackEnabled ?? false))}
                          title="Slack"
                          className={`text-base ${setting?.slackEnabled ? 'opacity-100' : 'opacity-30'}`}>
                          💬
                        </button>
                      )}

                      {/* Enabled toggle */}
                      <button
                        onClick={() => toggleSetting(type, 'isEnabled', !isEnabled)}
                        disabled={saving === type}
                        className={`w-10 h-5 rounded-full transition-colors relative ${isEnabled ? 'bg-[#0c4a6e]' : 'bg-[#cbd5e1]'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${isEnabled ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quiet hours */}
        <div className="bg-white rounded-2xl border border-[#e0f2fe] p-6">
          <h2 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">Quiet Hours</h2>
          <p className="text-xs text-[#94a3b8] mb-4">No alerts will be delivered during these hours. Critical alerts are always delivered immediately.</p>
          <div className="flex items-center gap-3">
            <select className="text-sm bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-3 py-2 text-[#1e293b] focus:outline-none focus:border-[#0891b2]">
              {Array.from({length:24},(_,i) => <option key={i} value={i}>{i===0?'12 AM':`${i > 12 ? i-12 : i} ${i >= 12 ? 'PM' : 'AM'}`}</option>)}
            </select>
            <span className="text-xs text-[#94a3b8]">to</span>
            <select className="text-sm bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-3 py-2 text-[#1e293b] focus:outline-none focus:border-[#0891b2]">
              {Array.from({length:24},(_,i) => <option key={i} value={i}>{i===0?'12 AM':`${i > 12 ? i-12 : i} ${i >= 12 ? 'PM' : 'AM'}`}</option>)}
            </select>
            <button className="px-4 py-2 bg-[#0c4a6e] text-white text-xs font-medium rounded-lg hover:bg-[#075985] transition-colors">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
