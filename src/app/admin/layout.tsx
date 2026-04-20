import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { checkSuperAdmin } from '@/lib/auth/super-admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/login');

  const ok = await checkSuperAdmin(session.user.email);
  if (!ok) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#0c4a6e] text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logos/webgrade_logo.svg" alt="WebGrade" className="h-7 w-auto brightness-0 invert" />
          <span className="text-xs font-bold uppercase tracking-widest text-sky-300 border-l border-sky-600 pl-3">
            Platform Admin
          </span>
        </div>
        <a href="/dashboard" className="text-xs text-sky-300 hover:text-white transition-colors">
          ← Back to Dashboard
        </a>
      </header>
      {children}
    </div>
  );
}
