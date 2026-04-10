import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';

// GET /api/settings/integrations?siteId=...
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

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      posthogEnabled: true,
      posthogApiKey: true,
      gscConnected: true,
      gscPropertyUrl: true,
      gscLastSyncAt: true,
    },
  });

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const maskedKey = site.posthogApiKey
    ? `${'*'.repeat(Math.max(0, site.posthogApiKey.length - 4))}${site.posthogApiKey.slice(-4)}`
    : null;

  return NextResponse.json({
    posthogEnabled: site.posthogEnabled,
    posthogApiKey: maskedKey,
    posthogApiKeySet: !!site.posthogApiKey,
    gscConnected: site.gscConnected,
    gscPropertyUrl: site.gscPropertyUrl,
    gscLastSyncAt: site.gscLastSyncAt,
  });
}

// PATCH /api/settings/integrations
const PatchSchema = z.object({
  siteId: z.string().min(1),
  posthogEnabled: z.boolean().optional(),
  posthogApiKey: z.string().nullable().optional(),
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

  const { siteId, posthogEnabled, posthogApiKey } = parsed.data;

  const patchAccess = await verifySiteAccess(session.user.email, siteId);
  if (!patchAccess) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (posthogEnabled !== undefined) data.posthogEnabled = posthogEnabled;
  if (posthogApiKey !== undefined) data.posthogApiKey = posthogApiKey;

  await prisma.site.update({
    where: { id: siteId },
    data,
  });

  return NextResponse.json({ ok: true });
}
