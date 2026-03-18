import { requireSession, getUserSites } from '@/lib/auth/session';
import { AppNav } from '@/components/nav/AppNav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const sites = await getUserSites(session.user.id);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Nav is rendered per-page so it knows activePage + currentSiteId */}
      {/* Sites are passed via a hidden script tag for client components to read */}
      <script
        id="__webgrade_sites__"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(sites.map(s => ({
            id: s.id,
            name: s.name,
            domain: s.domain,
            hasWebWatch: s.hasWebWatch,
            hasWebOpp: s.hasWebOpp,
            hasInterimReport: s.hasInterimReport,
          }))),
        }}
      />
      {children}
    </div>
  );
}
