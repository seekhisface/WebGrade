'use client';

import { useSetupState } from '@/hooks/useSetupState';
import { SetupChecklist } from '@/components/dashboard/SetupChecklist';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SetupPage({ params }: { params: { siteId: string } }) {
  const setup = useSetupState(params.siteId);
  const router = useRouter();

  // If setup is complete, redirect to dashboard
  useEffect(() => {
    if (!setup.loading && setup.mode !== 'setup') {
      router.replace(`/dashboard/${params.siteId}`);
    }
  }, [setup.loading, setup.mode, params.siteId, router]);

  if (setup.loading) {
    return (
      <div className="min-h-screen bg-[#f0f9ff] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0891b2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f9ff]">
      <SetupChecklist siteId={params.siteId} setup={setup} />
    </div>
  );
}
