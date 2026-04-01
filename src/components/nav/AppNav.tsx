'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Site {
  id: string;
  name: string;
  domain: string;
  hasWebWatch: boolean;
  hasWebOpp: boolean;
  hasInterimReport: boolean;
}

// ---------------------------------------------------------------------------
// Derive activePage from URL path
// ---------------------------------------------------------------------------

function getActivePageFromPath(pathname: string) {
  if (pathname.includes('/seo')) return 'seo';
  if (pathname.includes('/webwatch')) return 'webwatch';
  if (pathname.includes('/webopp')) return 'webopp';
  if (pathname.includes('/report')) return 'report';
  if (pathname.includes('/winback')) return 'winback';
  if (pathname.includes('/snippet')) return 'snippet';
  if (pathname.includes('/settings')) return 'settings';
  if (pathname.includes('/alerts')) return 'settings';
  return 'behavioral';
}

// ---------------------------------------------------------------------------
// Read sites injected by dashboard/layout.tsx via <script> tag
// ---------------------------------------------------------------------------

function useSitesFromLayout(): Site[] {
  const [sites, setSites] = useState<Site[]>([]);

  useEffect(() => {
    const el = document.getElementById('__webgrade_sites__');
    if (el?.textContent) {
      try {
        setSites(JSON.parse(el.textContent));
      } catch {
        // Ignore malformed JSON
      }
    }
  }, []);

  return sites;
}

// ---------------------------------------------------------------------------
// AppNav — self-sufficient, zero-prop component
//
// Reads sites from the layout's <script id="__webgrade_sites__"> tag,
// derives currentSiteId from useParams(), and activePage from usePathname().
// Rendered once in dashboard/layout.tsx.
// ---------------------------------------------------------------------------

export function AppNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { data: session } = useSession();

  const currentSiteId = params.siteId as string | undefined;
  const activePage = getActivePageFromPath(pathname);
  const sites = useSitesFromLayout();

  const [siteSwitcherOpen, setSiteSwitcherOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const siteSwitcherRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const currentSite = sites.find(s => s.id === currentSiteId) ?? sites[0];

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (siteSwitcherRef.current && !siteSwitcherRef.current.contains(e.target as Node)) {
        setSiteSwitcherOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isAdmin = session?.user?.email === 'demo@webgrade.io';

  const navTabs = [
    { id: 'behavioral', label: 'Dashboard',      href: `/dashboard/${currentSiteId}`,           show: !!currentSiteId },
    { id: 'seo',        label: 'Live SEO',        href: `/dashboard/${currentSiteId}/seo`,       show: !!currentSiteId },
    { id: 'report',     label: 'WebAudit™',       href: `/dashboard/${currentSiteId}/report`,    show: !!currentSiteId && (currentSite?.hasInterimReport ?? true) },
    { id: 'webwatch',   label: 'WebWatch™',       href: `/dashboard/${currentSiteId}/webwatch`,  show: !!currentSiteId && (currentSite?.hasWebWatch ?? true) },
    { id: 'webopp',     label: 'WebOpp™',         href: `/dashboard/${currentSiteId}/webopp`,    show: !!currentSiteId && (currentSite?.hasWebOpp ?? true), badge: 'New' },
    { id: 'snippet',    label: 'Installation',     href: `/dashboard/${currentSiteId}/snippet`,   show: !!currentSiteId },
    { id: 'winback',    label: 'Win-Back',         href: `/dashboard/${currentSiteId}/winback`,   show: !!currentSiteId && isAdmin },
  ].filter(tab => tab.show);

  return (
    <nav className="bg-[#0c4a6e] border-b border-[#075985] px-3 md:px-6 py-0 flex items-center justify-between h-14 sticky top-0 z-50 min-w-0">
      {/* Left: logo + site switcher + tabs */}
      <div className="flex items-center gap-2 md:gap-6 min-w-0 flex-1">
        {/* Logo */}
        <Link href="/dashboard" className="flex-shrink-0">
          <img src="/logos/webgrade_logo_dark.svg" alt="WebGrade" className="h-10 w-auto" />
        </Link>

        {/* Site switcher */}
        {currentSiteId && (
          <div className="relative" ref={siteSwitcherRef}>
            <button
              onClick={() => setSiteSwitcherOpen((o: boolean) => !o)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-teal-400" />
              <span className="text-sm text-white font-medium">
                {currentSite?.name ?? 'Select site'}
              </span>
              <svg className={`w-3.5 h-3.5 text-white/40 transition-transform ${siteSwitcherOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {siteSwitcherOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-sky-200 rounded-xl shadow-xl overflow-hidden z-50">
                <div className="px-3 py-2 border-b border-sky-100">
                  <p className="text-xs text-sky-500 uppercase tracking-wider">Your sites</p>
                </div>
                <div className="py-1">
                  {sites.map(site => (
                    <button
                      key={site.id}
                      onClick={() => {
                        setSiteSwitcherOpen(false);
                        router.push(`/dashboard/${site.id}`);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left ${
                        site.id === currentSiteId ? 'bg-sky-50' : ''
                      }`}
                    >
                      <div className="w-7 h-7 bg-sky-100 rounded-md flex items-center justify-center flex-shrink-0">
                        <span className="text-sky-600 text-xs font-bold">
                          {site.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800 font-medium truncate">{site.name}</p>
                        <p className="text-xs text-slate-400 truncate">{site.domain}</p>
                      </div>
                      {site.id === currentSiteId && (
                        <svg className="w-4 h-4 text-emerald-400 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-sky-100 py-1">
                  <Link
                    href="/onboarding"
                    onClick={() => setSiteSwitcherOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 hover:bg-sky-50 transition-colors"
                  >
                    <div className="w-7 h-7 bg-sky-100 rounded-md flex items-center justify-center">
                      <span className="text-sky-500 text-lg leading-none">+</span>
                    </div>
                    <span className="text-sm text-sky-500">Add site</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nav tabs */}
        <div className="hidden md:flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
          {navTabs.map(tab => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex items-center gap-1.5 px-2 lg:px-3 py-1.5 rounded-md text-xs lg:text-sm whitespace-nowrap transition-colors ${
                activePage === tab.id
                  ? 'bg-white/20 text-white font-semibold'
                  : 'text-sky-200 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
              {tab.badge && (
                <span className="px-1.5 py-0.5 bg-sky-400/30 text-sky-200 text-[10px] font-medium rounded">
                  {tab.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Right: alerts + user menu */}
      <div className="flex items-center gap-3">
        {/* Alert bell */}
        {currentSiteId && (
          <Link href={`/dashboard/${currentSiteId}/alerts`} className="relative p-2 text-sky-300 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </Link>
        )}

        {/* User menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((o: boolean) => !o)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#0284c7] flex items-center justify-center">
              <span className="text-white text-xs font-semibold">
                {session?.user?.name?.charAt(0) ?? session?.user?.email?.charAt(0) ?? '?'}
              </span>
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-sky-200 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-sky-100">
                <p className="text-sm text-slate-800 font-medium truncate">
                  {session?.user?.name ?? 'Your account'}
                </p>
                <p className="text-xs text-slate-400 truncate">{session?.user?.email}</p>
              </div>
              <div className="py-1">
                <Link
                  href={currentSiteId ? `/dashboard/${currentSiteId}/settings` : '/dashboard'}
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-sky-50 hover:text-slate-900 transition-colors"
                >
                  Settings
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-sky-50 hover:text-slate-900 transition-colors text-left"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
