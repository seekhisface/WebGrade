'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const siteId = params.siteId as string;

  const tabs = [
    { id: 'profile', label: 'Site Profile', href: `/dashboard/${siteId}/settings` },
    { id: 'alerts', label: 'Alerts', href: `/dashboard/${siteId}/settings/alerts` },
    { id: 'distributions', label: 'Distributions', href: `/dashboard/${siteId}/settings/distributions` },
  ];

  // Determine active tab from current pathname
  const activeTab = pathname?.endsWith('/alerts')
    ? 'alerts'
    : pathname?.endsWith('/distributions')
    ? 'distributions'
    : 'profile';

  return (
    <div className="min-h-screen bg-[#f0f9ff]">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-[#0c4a6e]">Settings</h1>
          <p className="text-sm text-[#64748b] mt-1">
            Manage your site configuration, integrations, and business context
          </p>
        </div>

        {/* Persistent nav tabs */}
        <div className="flex gap-2 border-b border-[#bae6fd]">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`px-5 py-2.5 text-sm font-semibold transition-colors -mb-px ${
                  isActive
                    ? 'text-sky-700 border-b-2 border-sky-600'
                    : 'text-[#64748b] hover:text-[#0c4a6e] hover:bg-[#f0f9ff] rounded-t-lg border-b-2 border-transparent'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Page content */}
        <div>{children}</div>
      </div>
    </div>
  );
}
