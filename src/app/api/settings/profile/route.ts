// GET  /api/settings/profile?siteId=...  — Load all site configuration data
// PATCH /api/settings/profile             — Partial update to site + onboarding fields

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';

// ---------------------------------------------------------------------------
// GET — Load site profile, onboarding, integration statuses, snippet status
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) {
    return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  }

  const access = await verifySiteAccess(session.user.email, siteId);
  if (!access) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const [site, sessionCount] = await prisma.$transaction([
    prisma.site.findUnique({
      where: { id: siteId },
      include: {
        onboarding: true,
        siteInstallations: { orderBy: { installedAt: 'desc' }, take: 1 },
      },
    }),
    prisma.visitorSession.count({ where: { siteId }, take: 1 }),
  ]);

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Snippet status
  const snippetInstalled =
    site.siteInstallations?.[0]?.status === 'VERIFIED' || sessionCount > 0;

  // Mask integration credentials
  const maskedPosthogKey = site.posthogApiKey
    ? `${'*'.repeat(Math.max(0, site.posthogApiKey.length - 4))}${site.posthogApiKey.slice(-4)}`
    : null;

  const maskedGa4PropertyId = site.ga4PropertyId
    ? `****${site.ga4PropertyId.slice(-4)}`
    : null;

  const maskedGadsCustomerId = site.gadsCustomerId
    ? `****${site.gadsCustomerId.slice(-4)}`
    : null;

  const maskedGscPropertyUrl = site.gscPropertyUrl
    ? `****${site.gscPropertyUrl.slice(-8)}`
    : null;

  const ob = site.onboarding;

  // Check if this user is OAuth-only (no password)
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { hashedPassword: true },
  });
  const isOAuthUser = !user?.hashedPassword && session.user.email !== 'demo@webgrade.io';

  // Modal-conversion tracking diagnostic — counts CONVERSION events that fired
  // automatically because the snippet matched the configured form selector.
  // Lets the user verify the field is actually doing something without digging
  // into raw session data.
  const last30 = new Date(Date.now() - 30 * 86400000);
  const autoConversions = await prisma.sessionEvent.findMany({
    where: {
      siteId: site.id,
      eventType: 'CONVERSION',
      timestamp: { gte: last30 },
    },
    select: { timestamp: true, metadata: true },
    orderBy: { timestamp: 'desc' },
    take: 200, // cap; we only need the count + most recent for display
  });
  // Filter in JS — JSON-path queries vary across Postgres versions and the
  // dataset is small enough (one site, ≤200 events) that an in-memory filter
  // is simpler and faster to develop than a raw SQL query.
  const autoMatched = autoConversions.filter(e => {
    const m = e.metadata as Record<string, unknown> | null;
    return m && m.source === 'form_submit_auto';
  });
  const modalConversionStats = {
    selectorConfigured: !!ob?.conversionFormSelector,
    selectorValue: ob?.conversionFormSelector ?? '',
    autoConversionsCount30d: autoMatched.length,
    lastAutoConversionAt: autoMatched[0]?.timestamp?.toISOString() ?? null,
  };

  return NextResponse.json({
    // Site info
    siteId: site.id,
    siteName: site.name,
    siteUrl: site.url,
    domain: site.domain,
    snippetId: site.snippetId,
    snippetInstalled,

    // Conversion goals
    conversionGoalUrl: ob?.conversionGoalUrl ?? '',
    conversionGoalName: ob?.conversionGoalName ?? '',
    conversionFormSelector: ob?.conversionFormSelector ?? '',
    modalConversionStats,

    // Business context
    businessDescription: ob?.businessDescription ?? '',
    targetAudience: ob?.targetAudience ?? '',
    primaryValueProp: ob?.primaryValueProp ?? '',
    competitorUrls: ob?.competitorUrls ?? [],

    // Integrations
    ga4Connected: site.ga4Connected,
    ga4PropertyId: maskedGa4PropertyId,
    ga4ConnectedAt: site.ga4ConnectedAt,
    ga4LastSyncAt: site.ga4LastSyncAt,

    gscConnected: site.gscConnected,
    gscPropertyUrl: maskedGscPropertyUrl,
    gscConnectedAt: site.gscConnectedAt,
    gscLastSyncAt: site.gscLastSyncAt,

    gadsConnected: site.gadsConnected,
    gadsCustomerId: maskedGadsCustomerId,
    gadsConnectedAt: site.gadsConnectedAt,
    gadsLastSyncAt: site.gadsLastSyncAt,

    posthogEnabled: site.posthogEnabled,
    posthogApiKey: maskedPosthogKey,
    posthogApiKeySet: !!site.posthogApiKey,

    // Revenue & ad spend
    monthlyAdSpend: ob?.monthlyAdSpend ?? null,
    averageOrderValue: ob?.averageOrderValue ?? null,
    leadToWinRate: ob?.leadToWinRate != null ? Math.round(ob.leadToWinRate * 100) : null,
    conversionRate: ob?.conversionRate != null ? Math.round(ob.conversionRate * 100) : null,

    // Auth info for re-auth gate
    isOAuthUser,
  });
}

// ---------------------------------------------------------------------------
// PATCH — Partial update to site name, onboarding fields, integrations
// ---------------------------------------------------------------------------

const PatchSchema = z.object({
  siteId: z.string().min(1),

  // Site info
  siteName: z.string().min(1).optional(),

  // Conversion goals
  conversionGoalUrl: z.string().optional(),
  conversionGoalName: z.string().optional(),
  conversionFormSelector: z.string().optional(),

  // Business context
  businessDescription: z.string().optional(),
  targetAudience: z.string().optional(),
  primaryValueProp: z.string().optional(),
  competitorUrls: z.array(z.string()).optional(),

  // Revenue
  monthlyAdSpend: z.number().nullable().optional(),
  averageOrderValue: z.number().nullable().optional(),
  leadToWinRate: z.number().nullable().optional(),
  conversionRate: z.number().nullable().optional(),

  // Integrations
  posthogEnabled: z.boolean().optional(),
  posthogApiKey: z.string().nullable().optional(),

  // Disconnect flags
  disconnectGa4: z.boolean().optional(),
  disconnectGads: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const { siteId, siteName, posthogEnabled, posthogApiKey, disconnectGa4, disconnectGads, ...onboardingFields } = parsed.data;

  const access = await verifySiteAccess(session.user.email, siteId);
  if (!access) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  // Update site-level fields
  const siteData: Record<string, unknown> = {};
  if (siteName !== undefined) siteData.name = siteName;
  if (posthogEnabled !== undefined) siteData.posthogEnabled = posthogEnabled;
  if (posthogApiKey !== undefined) siteData.posthogApiKey = posthogApiKey;
  if (disconnectGa4) {
    siteData.ga4Connected = false;
    siteData.ga4PropertyId = null;
    siteData.ga4ConnectedAt = null;
    siteData.ga4LastSyncAt = null;
    siteData.ga4ConnectedByUserId = null;
  }
  if (disconnectGads) {
    siteData.gadsConnected = false;
    siteData.gadsCustomerId = null;
    siteData.gadsConnectedAt = null;
    siteData.gadsLastSyncAt = null;
    siteData.gadsConnectedByUserId = null;
  }

  if (Object.keys(siteData).length > 0) {
    await prisma.site.update({ where: { id: siteId }, data: siteData });
  }

  // Update onboarding fields
  const obData: Record<string, unknown> = {};
  if (onboardingFields.conversionGoalUrl !== undefined) obData.conversionGoalUrl = onboardingFields.conversionGoalUrl;
  if (onboardingFields.conversionGoalName !== undefined) obData.conversionGoalName = onboardingFields.conversionGoalName;
  if (onboardingFields.conversionFormSelector !== undefined) obData.conversionFormSelector = onboardingFields.conversionFormSelector || null;
  if (onboardingFields.businessDescription !== undefined) obData.businessDescription = onboardingFields.businessDescription;
  if (onboardingFields.targetAudience !== undefined) obData.targetAudience = onboardingFields.targetAudience;
  if (onboardingFields.primaryValueProp !== undefined) obData.primaryValueProp = onboardingFields.primaryValueProp;
  if (onboardingFields.competitorUrls !== undefined) obData.competitorUrls = onboardingFields.competitorUrls.filter(Boolean);
  if (onboardingFields.monthlyAdSpend !== undefined) obData.monthlyAdSpend = onboardingFields.monthlyAdSpend;
  if (onboardingFields.averageOrderValue !== undefined) obData.averageOrderValue = onboardingFields.averageOrderValue;
  if (onboardingFields.leadToWinRate !== undefined) {
    obData.leadToWinRate = onboardingFields.leadToWinRate != null ? onboardingFields.leadToWinRate / 100 : null;
  }
  if (onboardingFields.conversionRate !== undefined) {
    obData.conversionRate = onboardingFields.conversionRate != null ? onboardingFields.conversionRate / 100 : null;
  }

  if (Object.keys(obData).length > 0) {
    await prisma.siteOnboarding.upsert({
      where: { siteId },
      update: obData,
      create: { siteId, ...obData },
    });
  }

  return NextResponse.json({ ok: true });
}
