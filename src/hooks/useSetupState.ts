import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export type SetupMode = 'demo' | 'setup' | 'live';

export interface SetupState {
  mode: SetupMode;
  isDemo: boolean;
  snippetInstalled: boolean;
  ga4Connected: boolean;
  gscConnected: boolean;
  businessContextComplete: boolean;
  percentComplete: number;
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
    percentComplete: 0,
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
        percentComplete: 100,
        loading: false,
      });
      return;
    }

    // Fetch real setup state from DB
    fetch(`/api/setup-state?siteId=${siteId}`)
      .then(r => r.json())
      .then(data => {
        const steps = [
          true, // account always complete
          data.snippetInstalled,
          data.ga4Connected,
          data.gscConnected,
          data.businessContextComplete,
        ];
        const complete = steps.filter(Boolean).length;
        const percentComplete = Math.round((complete / steps.length) * 100);
        const mode: SetupMode = data.snippetInstalled ? 'live' : 'setup';

        setState({
          mode,
          isDemo: false,
          snippetInstalled: data.snippetInstalled,
          ga4Connected: data.ga4Connected,
          gscConnected: data.gscConnected,
          businessContextComplete: data.businessContextComplete,
          percentComplete,
          loading: false,
        });
      })
      .catch(() => setState(s => ({ ...s, loading: false })));
  }, [session, siteId]);

  return state;
}
