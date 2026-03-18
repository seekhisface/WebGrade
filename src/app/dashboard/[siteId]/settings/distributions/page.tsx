'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DistributionRole = 'OWNER' | 'STAKEHOLDER' | 'EXEC' | 'CUSTOM';
type DigestFrequency  = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'ON_PUBLISH';
type DeliveryChannel  = 'EMAIL' | 'SLACK' | 'BOTH';

interface Recipient {
  id: string;
  recipientEmail: string;
  recipientName: string;
  role: DistributionRole;
  receiveInterimReport: boolean;
  receiveWebWatch: boolean;
  receiveWebOpp: boolean;
  receiveWeeklyDigest: boolean;
  receiveAlerts: boolean;
  webWatchFrequency: DigestFrequency;
  digestHour: number;
  customMessage: string;
  deliveryChannel: DeliveryChannel;
  slackWebhookUrl: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Demo seed data
// ---------------------------------------------------------------------------
const DEMO_RECIPIENTS: Recipient[] = [
  {
    id: '1',
    recipientEmail: 'mike@novapulsehr.com',
    recipientName: 'Mike (You)',
    role: 'OWNER',
    receiveInterimReport: true,
    receiveWebWatch: true,
    receiveWebOpp: true,
    receiveWeeklyDigest: true,
    receiveAlerts: true,
    webWatchFrequency: 'MONTHLY',
    digestHour: 8,
    customMessage: '',
    deliveryChannel: 'EMAIL',
    slackWebhookUrl: '',
    isActive: true,
  },
  {
    id: '2',
    recipientEmail: 'cmo@novapulsehr.com',
    recipientName: 'Sarah (CMO)',
    role: 'EXEC',
    receiveInterimReport: true,
    receiveWebWatch: false,
    receiveWebOpp: false,
    receiveWeeklyDigest: true,
    receiveAlerts: false,
    webWatchFrequency: 'MONTHLY',
    digestHour: 8,
    customMessage: 'Hi Sarah — here\'s your monthly WebGrade intelligence digest.',
    deliveryChannel: 'EMAIL',
    slackWebhookUrl: '',
    isActive: true,
  },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ROLE_CONFIG: Record<DistributionRole, { label: string; description: string; color: string }> = {
  OWNER:       { label: 'Owner',       description: 'Receives all reports + alerts',     color: 'bg-[#0c4a6e] text-white' },
  STAKEHOLDER: { label: 'Stakeholder', description: 'Receives full reports',             color: 'bg-sky-100 text-sky-700' },
  EXEC:        { label: 'Exec',        description: 'Executive summary + digest only',   color: 'bg-violet-100 text-violet-700' },
  CUSTOM:      { label: 'Custom',      description: 'Manually configured',               color: 'bg-slate-100 text-slate-600' },
};

const FREQUENCY_LABELS: Record<DigestFrequency, string> = {
  WEEKLY:     'Weekly',
  BIWEEKLY:   'Every 2 weeks',
  MONTHLY:    'Monthly',
  ON_PUBLISH: 'Immediately on publish',
};

const REPORT_LABELS = [
  { key: 'receiveInterimReport', label: 'Interim Report™', description: '45-day forensic audit' },
  { key: 'receiveWebWatch',      label: 'WebWatch™',       description: 'Monthly monitoring reports' },
  { key: 'receiveWebOpp',        label: 'WebOpp™',         description: 'Market intelligence reports' },
  { key: 'receiveWeeklyDigest',  label: 'Weekly Digest',   description: 'Summary of key metrics' },
  { key: 'receiveAlerts',        label: 'Alerts',          description: 'Real-time issue notifications' },
] as const;

// ---------------------------------------------------------------------------
// Add/Edit Recipient Drawer
// ---------------------------------------------------------------------------
function RecipientDrawer({
  recipient,
  onSave,
  onClose,
}: {
  recipient: Partial<Recipient> | null;
  onSave: (r: Recipient) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Recipient>({
    id: recipient?.id ?? String(Date.now()),
    recipientEmail: recipient?.recipientEmail ?? '',
    recipientName: recipient?.recipientName ?? '',
    role: recipient?.role ?? 'STAKEHOLDER',
    receiveInterimReport: recipient?.receiveInterimReport ?? true,
    receiveWebWatch: recipient?.receiveWebWatch ?? true,
    receiveWebOpp: recipient?.receiveWebOpp ?? false,
    receiveWeeklyDigest: recipient?.receiveWeeklyDigest ?? true,
    receiveAlerts: recipient?.receiveAlerts ?? false,
    webWatchFrequency: recipient?.webWatchFrequency ?? 'MONTHLY',
    digestHour: recipient?.digestHour ?? 8,
    customMessage: recipient?.customMessage ?? '',
    deliveryChannel: recipient?.deliveryChannel ?? 'EMAIL',
    slackWebhookUrl: recipient?.slackWebhookUrl ?? '',
    isActive: recipient?.isActive ?? true,
  });

  const [tab, setTab] = useState<'basics' | 'reports' | 'schedule' | 'message'>('basics');

  function set<K extends keyof Recipient>(key: K, value: Recipient[K]) {
    setForm((f: Recipient) => ({ ...f, [key]: value }));
  }

  const isEdit = !!recipient?.id;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[420px] bg-white border-l border-sky-100 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-sky-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">{isEdit ? 'Edit Recipient' : 'Add Recipient'}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Configure report delivery for this person</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-sky-50 text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-sky-100 px-5 gap-1">
          {(['basics', 'reports', 'schedule', 'message'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-xs font-semibold capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-[#0284c7] text-[#0284c7]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>{t}</button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {tab === 'basics' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email address *</label>
                <input type="email" value={form.recipientEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('recipientEmail', e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3 py-2.5 bg-sky-50 border border-sky-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0284c7] placeholder-slate-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Display name</label>
                <input type="text" value={form.recipientName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('recipientName', e.target.value)}
                  placeholder="e.g. Sarah (CMO)"
                  className="w-full px-3 py-2.5 bg-sky-50 border border-sky-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0284c7] placeholder-slate-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Role</label>
                <div className="space-y-2">
                  {(Object.entries(ROLE_CONFIG) as [DistributionRole, typeof ROLE_CONFIG[DistributionRole]][]).map(([role, cfg]) => (
                    <button key={role} onClick={() => set('role', role)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        form.role === role ? 'border-[#0284c7] bg-sky-50' : 'border-sky-100 hover:border-sky-200'
                      }`}>
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        form.role === role ? 'border-[#0284c7]' : 'border-slate-300'
                      }`}>
                        {form.role === role && <div className="w-1.5 h-1.5 rounded-full bg-[#0284c7]" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{cfg.label}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <p className="text-xs text-slate-400">{cfg.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Delivery channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['EMAIL', 'SLACK', 'BOTH'] as DeliveryChannel[]).map(ch => (
                    <button key={ch} onClick={() => set('deliveryChannel', ch)}
                      className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                        form.deliveryChannel === ch
                          ? 'border-[#0284c7] bg-sky-50 text-[#0284c7]'
                          : 'border-sky-100 text-slate-500 hover:border-sky-200'
                      }`}>{ch}</button>
                  ))}
                </div>
                {(form.deliveryChannel === 'SLACK' || form.deliveryChannel === 'BOTH') && (
                  <input type="url" value={form.slackWebhookUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('slackWebhookUrl', e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="mt-2 w-full px-3 py-2 bg-sky-50 border border-sky-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#0284c7] placeholder-slate-300" />
                )}
              </div>
            </>
          )}

          {tab === 'reports' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Choose which reports and notifications this person receives.</p>
              {REPORT_LABELS.map(({ key, label, description }) => (
                <div key={key}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    form[key] ? 'border-sky-200 bg-sky-50' : 'border-sky-100 bg-white'
                  }`}
                  onClick={() => set(key as keyof Recipient, !form[key] as Recipient[keyof Recipient])}>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400">{description}</p>
                  </div>
                  <div className={`w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ${form[key] ? 'bg-[#0284c7]' : 'bg-slate-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${form[key] ? 'translate-x-5' : 'translate-x-1'}`} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'schedule' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Control when reports are delivered to this person.</p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">WebWatch delivery frequency</label>
                <div className="space-y-1.5">
                  {(Object.entries(FREQUENCY_LABELS) as [DigestFrequency, string][]).map(([freq, label]) => (
                    <button key={freq} onClick={() => set('webWatchFrequency', freq)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        form.webWatchFrequency === freq ? 'border-[#0284c7] bg-sky-50' : 'border-sky-100 hover:border-sky-200'
                      }`}>
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        form.webWatchFrequency === freq ? 'border-[#0284c7]' : 'border-slate-300'
                      }`}>
                        {form.webWatchFrequency === freq && <div className="w-1.5 h-1.5 rounded-full bg-[#0284c7]" />}
                      </div>
                      <span className="text-sm text-slate-700 font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Delivery time — {form.digestHour < 12 ? `${form.digestHour || 12}am` : form.digestHour === 12 ? '12pm' : `${form.digestHour - 12}pm`}
                </label>
                <input type="range" min={6} max={20} value={form.digestHour}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('digestHour', parseInt(e.target.value, 10))}
                  className="w-full accent-[#0284c7]" />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>6am</span><span>12pm</span><span>8pm</span>
                </div>
              </div>
            </div>
          )}

          {tab === 'message' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                An optional personal note prepended to every delivery for this person. Great for executives who need context.
              </p>
              <textarea
                value={form.customMessage}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('customMessage', e.target.value)}
                rows={5}
                placeholder={`e.g. "Hi Sarah — here's your monthly WebGrade intelligence digest for NovaPulse HR."`}
                className="w-full px-3 py-2.5 bg-sky-50 border border-sky-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#0284c7] placeholder-slate-300 resize-none"
              />
              {form.customMessage && (
                <div className="p-3.5 bg-white border border-sky-200 rounded-xl">
                  <p className="text-[10px] text-sky-500 font-semibold uppercase tracking-wider mb-1.5">Preview</p>
                  <p className="text-xs text-slate-600 italic">"{form.customMessage}"</p>
                  <p className="text-xs text-slate-400 mt-2">— Followed by the full report content</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-sky-100 flex items-center gap-2">
          <button onClick={() => onSave(form)}
            className="flex-1 py-2.5 bg-[#0284c7] hover:bg-[#0369a1] text-white text-sm font-bold rounded-xl transition-colors">
            {isEdit ? 'Save changes' : 'Add recipient'}
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 border border-sky-200 text-slate-500 text-sm font-medium rounded-xl hover:bg-sky-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Recipient card
// ---------------------------------------------------------------------------
function RecipientCard({
  recipient,
  onEdit,
  onToggle,
  onDelete,
}: {
  recipient: Recipient;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const roleCfg = ROLE_CONFIG[recipient.role];
  const activeReports = REPORT_LABELS.filter(r => recipient[r.key]);
  const freq = FREQUENCY_LABELS[recipient.webWatchFrequency];

  return (
    <div className={`bg-white border rounded-2xl p-4 shadow-card transition-all ${recipient.isActive ? 'border-sky-100' : 'border-slate-200 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-[#0284c7] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">
              {(recipient.recipientName || recipient.recipientEmail).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-800 truncate">
                {recipient.recipientName || recipient.recipientEmail}
              </p>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${roleCfg.color}`}>
                {roleCfg.label}
              </span>
              {!recipient.isActive && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Paused</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{recipient.recipientEmail}</p>

            {/* Reports & frequency */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {activeReports.map(r => (
                <span key={r.key} className="text-[10px] font-semibold px-2 py-0.5 bg-sky-50 border border-sky-100 text-sky-600 rounded-full">
                  {r.label}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
              <span>📅 {freq}</span>
              <span>🕐 {recipient.digestHour < 12 ? `${recipient.digestHour || 12}am` : recipient.digestHour === 12 ? '12pm' : `${recipient.digestHour - 12}pm`}</span>
              <span>{recipient.deliveryChannel === 'EMAIL' ? '📧 Email' : recipient.deliveryChannel === 'SLACK' ? '💬 Slack' : '📧💬 Both'}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onEdit}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 transition-colors text-xs">
            ✏️
          </button>
          <button onClick={onToggle}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors text-xs ${
              recipient.isActive ? 'bg-amber-50 hover:bg-amber-100 text-amber-600' : 'bg-teal-50 hover:bg-teal-100 text-teal-600'
            }`}>
            {recipient.isActive ? '⏸' : '▶'}
          </button>
          <button onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors text-xs">
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DistributionsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [recipients, setRecipients] = useState<Recipient[]>(DEMO_RECIPIENTS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [saved, setSaved] = useState(false);

  function openAdd() { setEditingRecipient(null); setDrawerOpen(true); }
  function openEdit(r: Recipient) { setEditingRecipient(r); setDrawerOpen(true); }

  function handleSave(r: Recipient) {
    setRecipients((prev: Recipient[]) => {
      const idx = prev.findIndex((x: Recipient) => x.id === r.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = r; return next; }
      return [...prev, r];
    });
    setDrawerOpen(false);
    showSaved();
  }

  function handleToggle(id: string) {
    setRecipients((prev: Recipient[]) => prev.map((r: Recipient) => r.id === id ? { ...r, isActive: !r.isActive } : r));
    showSaved();
  }

  function handleDelete(id: string) {
    setRecipients((prev: Recipient[]) => prev.filter((r: Recipient) => r.id !== id));
    showSaved();
  }

  function showSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const activeCount = recipients.filter((r: Recipient) => r.isActive).length;

  return (
    <div className="min-h-screen bg-[#f0f9ff] text-slate-900">
      <div className="max-w-3xl mx-auto px-6 py-7">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-6">
          <Link href={`/dashboard/${siteId}`} className="hover:text-sky-600 transition-colors">Dashboard</Link>
          <span>›</span>
          <Link href={`/dashboard/${siteId}/settings`} className="hover:text-sky-600 transition-colors">Settings</Link>
          <span>›</span>
          <span className="text-slate-600 font-medium">Report Distribution</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900 mb-1">Report Distribution</h1>
            <p className="text-sm text-slate-500">
              Control who receives WebGrade reports and when. Reports are only delivered when they contain real data.
            </p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#0284c7] hover:bg-[#0369a1] text-white text-sm font-semibold rounded-xl transition-colors shadow-sm flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add recipient
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Recipients',      value: recipients.length,                                color: 'text-slate-800' },
            { label: 'Active',          value: activeCount,                                      color: 'text-teal-600' },
            { label: 'Reports enabled', value: `${REPORT_LABELS.length} types`,                  color: 'text-slate-800' },
            { label: 'Next delivery',   value: 'Apr 1, 8am',                                     color: 'text-[#0284c7]' },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-sky-100 rounded-2xl p-3.5 shadow-card">
              <p className="text-[10px] text-sky-400 uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Saved toast */}
        {saved && (
          <div className="mb-4 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-xl flex items-center gap-2 text-sm text-teal-700 font-semibold">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Distribution settings saved
          </div>
        )}

        {/* Recipients */}
        {recipients.length === 0 ? (
          <div className="text-center py-16 bg-white border border-sky-100 rounded-2xl shadow-card">
            <div className="w-12 h-12 bg-sky-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">📬</div>
            <p className="text-sm font-semibold text-slate-800 mb-1">No recipients yet</p>
            <p className="text-xs text-slate-400 mb-4">Add people who should receive WebGrade reports automatically.</p>
            <button onClick={openAdd}
              className="px-4 py-2 bg-[#0284c7] text-white text-sm font-semibold rounded-xl hover:bg-[#0369a1] transition-colors">
              Add first recipient
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {recipients.map((r: Recipient) => (
              <div key={r.id}>
              <RecipientCard
                recipient={r}
                onEdit={() => openEdit(r)}
                onToggle={() => handleToggle(r.id)}
                onDelete={() => handleDelete(r.id)}
              />
              </div>
            ))}
          </div>
        )}

        {/* Info box */}
        <div className="mt-6 p-4 bg-white border border-sky-100 rounded-2xl shadow-card">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-sky-100 rounded-xl flex items-center justify-center flex-shrink-0 text-base">💡</div>
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-1">How distribution works</p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• Reports are only sent when they contain real data — no blank reports ever go out</li>
                <li>• <strong>Owner</strong> role receives everything including raw alert notifications</li>
                <li>• <strong>Exec</strong> role receives a one-page summary optimized for non-technical readers</li>
                <li>• Alerts (when enabled) fire immediately regardless of scheduled delivery time</li>
                <li>• All emails include a one-click unsubscribe link — GDPR compliant</li>
              </ul>
            </div>
          </div>
        </div>

      </div>

      {/* Drawer */}
      {drawerOpen && (
        <RecipientDrawer
          recipient={editingRecipient}
          onSave={handleSave}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
