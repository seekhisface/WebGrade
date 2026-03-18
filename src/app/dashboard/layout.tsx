import { requireSession, getUserSites } from '@/lib/auth/session';
import { AppNav } from '@/components/nav/AppNav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const sites = await getUserSites(session.user.id);

  const siteList = sites.map(s => ({
    id: s.id,
    name: s.name,
    domain: s.domain,
    hasWebWatch: s.hasWebWatch,
    hasWebOpp: s.hasWebOpp,
    hasInterimReport: s.hasInterimReport,
  }));

  return (
    <div className="min-h-screen bg-page-bg">
      <AppNav sites={siteList} />
      {children}
    </div>
  );
}
