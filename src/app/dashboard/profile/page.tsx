'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface Site {
  id: string;
  name: string;
  domain: string;
  url: string;
  industry: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Member {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'VIEWER';
  joinedAt: string;
  user: { id: string; email: string; name: string | null; image: string | null };
}

interface Invitation {
  id: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'VIEWER';
  createdAt: string;
  expiresAt: string;
}

interface Org {
  id: string;
  name: string;
  slug: string;
  sites: Site[];
  members: Member[];
  invitations: Invitation[];
}

interface ProfileData {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: string;
  orgMemberships: { role: string; org: Org }[];
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [editingSite, setEditingSite] = useState<string | null>(null);
  const [siteForm, setSiteForm] = useState<Partial<Site>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'VIEWER'>('VIEWER');
  const [inviteOrgId, setInviteOrgId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { fetchProfile(); }, []);

  async function fetchProfile() {
    setLoading(true);
    const res = await fetch('/api/profile');
    if (res.ok) {
      const data = await res.json();
      setProfile(data);
      setNameValue(data.name || '');
    }
    setLoading(false);
  }

  async function saveName() {
    setSaving(true);
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameValue }),
    });
    if (res.ok) {
      setEditingName(false);
      fetchProfile();
      flash('Name updated');
    }
    setSaving(false);
  }

  async function saveSite() {
    if (!editingSite) return;
    setSaving(true);
    const res = await fetch('/api/profile/sites', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: editingSite, ...siteForm }),
    });
    if (res.ok) {
      setEditingSite(null);
      setSiteForm({});
      fetchProfile();
      flash('Site updated');
    }
    setSaving(false);
  }

  async function sendInvite(orgId: string) {
    if (!inviteEmail) return;
    setSaving(true);
    const res = await fetch('/api/profile/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, email: inviteEmail, role: inviteRole }),
    });
    const data = await res.json();
    if (res.ok) {
      setInviteEmail('');
      setInviteOrgId('');
      fetchProfile();
      flash(`Invitation sent to ${inviteEmail}`);
    } else {
      flash(data.error || 'Failed to send invitation');
    }
    setSaving(false);
  }

  async function revokeInvite(invitationId: string) {
    const res = await fetch('/api/profile/invite', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId }),
    });
    if (res.ok) { fetchProfile(); flash('Invitation revoked'); }
  }

  async function removeMember(memberId: string) {
    if (!confirm('Remove this team member?')) return;
    const res = await fetch('/api/profile/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    });
    if (res.ok) { fetchProfile(); flash('Member removed'); }
  }

  async function updateRole(memberId: string, role: 'ADMIN' | 'VIEWER') {
    const res = await fetch('/api/profile/members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, role }),
    });
    if (res.ok) { fetchProfile(); flash('Role updated'); }
  }

  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  function startEditSite(site: Site) {
    setEditingSite(site.id);
    setSiteForm({ name: site.name, domain: site.domain, url: site.url, industry: site.industry || '', description: site.description || '' });
  }

  if (loading) return (
    <div className="min-h-screen bg-[#f0f9ff] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#0891b2] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-[#f0f9ff] flex items-center justify-center">
      <p className="text-[#64748b]">Unable to load profile</p>
    </div>
  );

  const membership = profile.orgMemberships[0];
  const org = membership?.org;
  const isOwner = membership?.role === 'OWNER';
  const isAdmin = membership?.role === 'OWNER' || membership?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-[#f0f9ff]">
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Flash message */}
        {message && (
          <div className="mb-6 p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl text-sm text-[#166534] font-medium text-center">
            {message}
          </div>
        )}

        {/* PROFILE SECTION */}
        <section className="bg-white border border-[#bae6fd] rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-black text-[#0c4a6e] mb-4">Your Profile</h2>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-[#0c4a6e] flex items-center justify-center text-white text-2xl font-black flex-shrink-0">
              {profile.image ? (
                <img src={profile.image} alt="" className="w-16 h-16 rounded-full" />
              ) : (
                (profile.name || profile.email)[0].toUpperCase()
              )}
            </div>
            <div className="flex-1">
              {editingName ? (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    className="px-3 py-1.5 border border-[#bae6fd] rounded-lg text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#0891b2]"
                    autoFocus
                  />
                  <button onClick={saveName} disabled={saving} className="px-3 py-1.5 bg-[#0c4a6e] text-white text-xs font-bold rounded-lg">Save</button>
                  <button onClick={() => setEditingName(false)} className="px-3 py-1.5 text-xs text-[#64748b]">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-lg font-bold text-[#1e293b]">{profile.name || 'No name set'}</p>
                  <button onClick={() => setEditingName(true)} className="text-xs text-[#0891b2] hover:underline">Edit</button>
                </div>
              )}
              <p className="text-sm text-[#64748b]">{profile.email}</p>
              <p className="text-xs text-[#94a3b8] mt-1">Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
              {org && (
                <p className="text-xs text-[#64748b] mt-1">Organization: <span className="font-semibold text-[#0c4a6e]">{org.name}</span> · Role: <span className="font-semibold">{membership.role}</span></p>
              )}
            </div>
          </div>
        </section>

        {/* SITES SECTION */}
        {org && (
          <section className="bg-white border border-[#bae6fd] rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-black text-[#0c4a6e] mb-4">Your Sites</h2>
            {org.sites.length === 0 ? (
              <p className="text-sm text-[#64748b]">No sites added yet. <Link href="/onboarding" className="text-[#0891b2] hover:underline">Add your first site</Link></p>
            ) : (
              <div className="space-y-4">
                {org.sites.map(site => (
                  <div key={site.id} className="border border-[#e2e8f0] rounded-xl p-4">
                    {editingSite === site.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-[#64748b] uppercase">Site Name</label>
                            <input value={siteForm.name || ''} onChange={e => setSiteForm(f => ({ ...f, name: e.target.value }))}
                              className="w-full px-3 py-2 border border-[#bae6fd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0891b2]" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[#64748b] uppercase">Domain</label>
                            <input value={siteForm.domain || ''} onChange={e => setSiteForm(f => ({ ...f, domain: e.target.value }))}
                              className="w-full px-3 py-2 border border-[#bae6fd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0891b2]" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[#64748b] uppercase">URL</label>
                            <input value={siteForm.url || ''} onChange={e => setSiteForm(f => ({ ...f, url: e.target.value }))}
                              className="w-full px-3 py-2 border border-[#bae6fd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0891b2]" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[#64748b] uppercase">Industry</label>
                            <input value={siteForm.industry || ''} onChange={e => setSiteForm(f => ({ ...f, industry: e.target.value }))}
                              className="w-full px-3 py-2 border border-[#bae6fd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0891b2]" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#64748b] uppercase">Description</label>
                          <textarea value={siteForm.description || ''} onChange={e => setSiteForm(f => ({ ...f, description: e.target.value }))} rows={2}
                            className="w-full px-3 py-2 border border-[#bae6fd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0891b2]" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveSite} disabled={saving} className="px-4 py-2 bg-[#0c4a6e] text-white text-xs font-bold rounded-lg">Save</button>
                          <button onClick={() => { setEditingSite(null); setSiteForm({}); }} className="px-4 py-2 text-xs text-[#64748b]">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${site.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                            <p className="text-sm font-bold text-[#1e293b]">{site.name}</p>
                          </div>
                          <p className="text-xs text-[#0891b2] mt-0.5">{site.domain}</p>
                          {site.industry && <p className="text-xs text-[#94a3b8] mt-0.5">{site.industry}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/${site.id}`} className="px-3 py-1.5 text-xs font-semibold text-[#0891b2] hover:bg-[#f0f9ff] rounded-lg transition-colors">
                            Dashboard →
                          </Link>
                          {isAdmin && (
                            <button onClick={() => startEditSite(site)} className="px-3 py-1.5 text-xs font-semibold text-[#64748b] hover:bg-[#f8fafc] rounded-lg transition-colors">
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TEAM MEMBERS SECTION */}
        {org && (
          <section className="bg-white border border-[#bae6fd] rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-[#0c4a6e]">Team Members</h2>
              {isAdmin && (
                <button
                  onClick={() => setInviteOrgId(inviteOrgId === org.id ? '' : org.id)}
                  className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-bold rounded-lg transition-colors"
                >
                  + Invite Member
                </button>
              )}
            </div>

            {/* Invite form */}
            {inviteOrgId === org.id && (
              <div className="mb-4 p-4 bg-[#f0f9ff] border border-[#bae6fd] rounded-xl">
                <p className="text-xs font-bold text-[#0c4a6e] mb-3">Send an invitation</p>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-[#64748b] uppercase">Email address</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="w-full px-3 py-2 border border-[#bae6fd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0891b2]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#64748b] uppercase">Role</label>
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as 'ADMIN' | 'VIEWER')}
                      className="px-3 py-2 border border-[#bae6fd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0891b2]"
                    >
                      <option value="VIEWER">Viewer</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <button
                    onClick={() => sendInvite(org.id)}
                    disabled={saving || !inviteEmail}
                    className="px-4 py-2 bg-[#0c4a6e] text-white text-xs font-bold rounded-lg disabled:opacity-50"
                  >
                    Send Invite
                  </button>
                </div>
              </div>
            )}

            {/* Members list */}
            <div className="space-y-2">
              {org.members.map(member => (
                <div key={member.id} className="flex items-center justify-between py-3 px-4 border border-[#f1f5f9] rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#e0f2fe] flex items-center justify-center text-[#0c4a6e] text-sm font-bold flex-shrink-0">
                      {member.user.image ? (
                        <img src={member.user.image} alt="" className="w-9 h-9 rounded-full" />
                      ) : (
                        (member.user.name || member.user.email)[0].toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1e293b]">{member.user.name || member.user.email}</p>
                      <p className="text-xs text-[#94a3b8]">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwner && member.role !== 'OWNER' && member.user.id !== profile.id ? (
                      <>
                        <select
                          value={member.role}
                          onChange={e => updateRole(member.id, e.target.value as 'ADMIN' | 'VIEWER')}
                          className="text-xs border border-[#e2e8f0] rounded-lg px-2 py-1 text-[#64748b]"
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                        <button onClick={() => removeMember(member.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                      </>
                    ) : (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        member.role === 'OWNER' ? 'bg-[#0c4a6e] text-white' :
                        member.role === 'ADMIN' ? 'bg-[#e0f2fe] text-[#0891b2]' :
                        'bg-[#f1f5f9] text-[#64748b]'
                      }`}>
                        {member.role}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pending invitations */}
            {org.invitations.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold text-[#64748b] uppercase mb-2">Pending Invitations</p>
                <div className="space-y-2">
                  {org.invitations.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between py-2 px-4 bg-[#fffbeb] border border-[#fde68a] rounded-xl">
                      <div>
                        <p className="text-sm text-[#1e293b]">{inv.email}</p>
                        <p className="text-xs text-[#94a3b8]">Invited as {inv.role} · Expires {new Date(inv.expiresAt).toLocaleDateString()}</p>
                      </div>
                      {isAdmin && (
                        <button onClick={() => revokeInvite(inv.id)} className="text-xs text-red-500 hover:text-red-700">Revoke</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <p className="text-center text-xs text-[#94a3b8] mt-8">
          <Link href="/dashboard" className="hover:text-[#0c4a6e] transition-colors">← Back to Dashboard</Link>
        </p>
      </div>
    </div>
  );
}
