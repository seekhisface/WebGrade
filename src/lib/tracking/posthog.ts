/**
 * PostHog event forwarding
 * Sends behavioral events to PostHog for pipeline processing.
 * WebGrade then reads from PostHog for behavioral analysis.
 */

interface EnqueueEventsParams {
  siteId: string;
  sessionId: string;
  events: Array<{ t: string; ts: number; u: string; [key: string]: unknown }>;
  consentGiven: boolean;
}

export async function enqueueEvents(params: EnqueueEventsParams): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com';

  if (!apiKey) {
    console.warn('[PostHog] No API key configured, skipping event forwarding');
    return;
  }

  // Don't forward events without consent in anonymous mode
  if (!params.consentGiven) return;

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

  await fetch(`${host}/batch/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, batch }),
  });
}
