'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const ROLE_LABELS: Record<string, string> = { OWNER: 'Owner', ADMIN: 'Editor', VIEWER: 'Viewer' };
const ROLE_COLORS: Record<string, string> = {
  OWNER:  'bg-[#0c4a6e] text-white',
  ADMIN:  'bg-sky-100 text-sky-700',
  VIEWER: 'bg-slate-100 text-slate-600',
};

interface Member {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'VIEWER';
  joinedAt: string;
  user: { id: string; email: string; name: string | null; image: string | null };
}

interface Site {
  id: string;
  name: string;
  domain: string;
  url: string;
  isActive: boolean;
  createdAt: string;
}

interface Org {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  sites: Site[];
  members: Member[];
}

export default function AdminAccountsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async (q = '') => {
    setLoading(true);
    const res = await fetch(`/api/admin/accounts?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      setOrgs(data.orgs);
      setTotal(data.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  async function changeRole(memberId: string, role: string) {
    const res = await fetch('/api/admin/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, role }),
    });
    if (res.ok) { flash('Role updated'); load(search); }
  }

  async function removeMember(memberId: string) {
    if (!confirm('Remove this member from the org?')) return;
    const res = await fetch(`/api/admin/accounts?memberId=${memberId}`, { method: 'DELETE' });
    if (res.ok) { flash('Member removed'); load(search); }
  }

  const filtered = search
    ? orgs.filter(o =>
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        o.members.some(m => m.user.email.toLowerCase().includes(search.toLowerCase())) ||
        o.sites.some(s => s.domain.toLowerCase().includes(search.toLowerCase()))
      )
    : orgs;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">All Accounts</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} organizations in the platform</p>
        </div>
        {message && (
          <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
            {message}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by org name, email, or domain..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 placeholder-slate-400"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-16">No accounts found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(org => {
            const owner = org.members.find(m => m.role === 'OWNER');
            const isExpanded = expandedOrg === org.id;
            return (
              <div key={org.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {/* Org row */}
                <button
                  onClick={() => setExpandedOrg(isExpanded ? null : org.id)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#0c4a6e] flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                    {org.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{org.name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      Owner: {owner?.user.email ?? 'None'} · {org.sites.length} site{org.sites.length !== 1 ? 's' : ''} · {org.members.length} member{org.members.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-400">
                      {new Date(org.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {/* Sites */}
                    {org.sites.length > 0 && (
                      <div className="px-6 py-4 border-b border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Sites</p>
                        <div className="space-y-2">
                          {org.sites.map(site => (
                            <div key={site.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{site.name}</p>
                                <p className="text-xs text-slate-400">{site.domain}</p>
                              </div>
                              <Link
                                href={`/dashboard/${site.id}`}
                                className="text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors"
                              >
                                Open dashboard →
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Members */}
                    <div className="px-6 py-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Team Members</p>
                      <div className="space-y-2">
                        {org.members.map(member => (
                          <div key={member.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 text-xs font-bold flex-shrink-0">
                                {(member.user.name || member.user.email)[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{member.user.name || member.user.email}</p>
                                {member.user.name && <p className="text-xs text-slate-400">{member.user.email}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={member.role}
                                onChange={e => changeRole(member.id, e.target.value)}
                                className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-400 ${ROLE_COLORS[member.role]}`}
                              >
                                <option value="OWNER">Owner</option>
                                <option value="ADMIN">Editor</option>
                                <option value="VIEWER">Viewer</option>
                              </select>
                              <button
                                onClick={() => removeMember(member.id)}
                                className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
