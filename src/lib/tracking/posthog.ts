/**
 * PostHog event forwarding
 * Sends behavioral events to PostHog for pipeline processing.
 * Controlled per-site via the posthogEnabled flag and posthogApiKey in the Site model.
 */

import { prisma } from '@/lib/db/client';

interface EnqueueEventsParams {
  siteId: string;
  sessionId: string;
  events: Array<{ t: string; ts: number; u: string; [key: string]: unknown }>;
  consentGiven: boolean;
}

export async function enqueueEvents(params: EnqueueEventsParams): Promise<void> {
  // Don't forward events without consent
  if (!params.consentGiven) return;

  // Check site-level PostHog config
  const site = await prisma.site.findUnique({
    where: { id: params.siteId },
    select: { posthogEnabled: true, posthogApiKey: true },
  });

  if (!site?.posthogEnabled || !site.posthogApiKey) return;

  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com';

  const batch = params.events.map(event => ({
    event: `webgrade_${event.t}`,
    distinct_id: params.sessionId,
    timestamp: new Date(event.ts).toISOString(),
    properties: {
      ...event,
      $current_url: event.u,
      webgrade_site_id: params.siteId,
    },
  }));

  try {
    const res = await fetch(`${host}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: site.posthogApiKey, batch }),
    });
    if (!res.ok) {
      console.error(`[PostHog] Forwarding failed: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error('[PostHog] Failed to forward events:', err);
  }
}
