import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export type SetupMode = 'demo' | 'setup' | 'live';

export interface MissingItem {
  key: string;
  label: string;
  description: string;
  link: string;
}

export interface SetupState {
  mode: SetupMode;
  isDemo: boolean;
  snippetInstalled: boolean;
  ga4Connected: boolean;
  gscConnected: boolean;
  businessContextComplete: boolean;
  hasConversionGoal: boolean;
  hasRevenueData: boolean;
  hasAdSpend: boolean;
  percentComplete: number;
  missingItems: MissingItem[];
  setupComplete: boolean;
  loading: boolean;
}

export function useSetupState(siteId: string): SetupState {
  const { data: session } = useSession();
  const [state, setState] = useState<SetupState>({
    mode: 'setup',
    isDemo: false,
    snippetInstalled: false,
    ga4Connected: false,
    gscConnected: false,
    businessContextComplete: false,
    hasConversionGoal: false,
    hasRevenueData: false,
    hasAdSpend: false,
    percentComplete: 0,
    missingItems: [],
    setupComplete: false,
    loading: true,
  });

  useEffect(() => {
    if (!session?.user?.email) return;

    const isDemo = session.user.email === 'demo@webgrade.io';
    if (isDemo) {
      setState({
        mode: 'demo',
        isDemo: true,
        snippetInstalled: true,
        ga4Connected: true,
        gscConnected: true,
        businessContextComplete: true,
        hasConversionGoal: true,
        hasRevenueData: true,
        hasAdSpend: true,
        percentComplete: 100,
        missingItems: [],
        setupComplete: true,
        loading: false,
      });
      return;
    }

    // Fetch real setup state from DB
    fetch(`/api/setup-state?siteId=${siteId}`)
      .then(r => r.json())
      .then(data => {
        const totalItems = 6; // snippet, conversion, revenue, gsc, context, adspend
        const completeCount = totalItems - (data.missingItems?.length ?? 0);
        const percentComplete = Math.round((completeCount / totalItems) * 100);
        const mode: SetupMode = data.snippetInstalled ? 'live' : 'setup';

        setState({
          mode,
          isDemo: false,
          snippetInstalled: data.snippetInstalled,
          ga4Connected: data.ga4Connected,
          gscConnected: data.gscConnected,
          businessContextComplete: data.businessContextComplete,
          hasConversionGoal: data.hasConversionGoal ?? false,
          hasRevenueData: data.hasRevenueData ?? false,
          hasAdSpend: data.hasAdSpend ?? false,
          percentComplete,
          missingItems: data.missingItems ?? [],
          setupComplete: data.setupComplete ?? false,
          loading: false,
        });
      })
      .catch(() => setState(s => ({ ...s, loading: false })));
  }, [session, siteId]);

  return state;
}
