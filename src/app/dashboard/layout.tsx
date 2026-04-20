import { requireSession, getUserSites } from '@/lib/auth/session';
import { AppNav } from '@/components/nav/AppNav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const sites = await getUserSites(session.user.id, session.user.email ?? undefined);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Sites data injected for client components (AppNav reads this) */}
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
      <AppNav />
      {children}
    </div>
  );
}
