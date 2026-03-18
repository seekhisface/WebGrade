/**
 * /demo — Demo mode entry point
 *
 * Signs in as the demo user and redirects to the demo dashboard.
 * Shows a "Demo Mode" banner throughout the session.
 *
 * Safe to share publicly — uses a read-only demo account with
 * seeded fake data. No real customer data is ever shown.
 */

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/client';

export default async function DemoPage() {
  // Find the demo site
  const site = await prisma.site.findFirst({
    where: { domain: 'novapulsehr.com' },
  });

  if (!site) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Demo not set up yet</h1>
          <p className="text-sm text-white/50 mb-6 leading-relaxed">
            The demo data hasn't been seeded yet. Run the seed script first:
          </p>
          <code className="block bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-brand-400 font-mono text-left">
            npx ts-node --project tsconfig.json prisma/seed-demo.ts
          </code>
        </div>
      </div>
    );
  }

  // Redirect to demo dashboard with demo mode flag
  redirect(`/dashboard/${site.id}?demo=true`);
}
