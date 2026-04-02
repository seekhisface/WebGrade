export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { z } from 'zod';
import { listGscProperties } from '@/lib/gsc/client';

// GET /api/gsc/connect?siteId=xxx — list available GSC properties or return auth URL
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, accounts: { where: { provider: 'google' }, select: { id: true } } },
  });

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // No Google account — return the standalone OAuth URL
  if (!user.accounts.length) {
    const appUrl = process.env.NEXTAUTH_URL || 'https://www.webgrade.io';
    return NextResponse.json({
      needsGoogleAuth: true,
      authorizeUrl: `${appUrl}/api/gsc/authorize?siteId=${siteId}`,
      properties: [],
    });
  }

  try {
    const properties = await listGscProperties(user.id);
    return NextResponse.json({ properties, needsGoogleAuth: false });
  } catch (err) {
    console.error('[gsc/connect] Failed to list properties:', err);
    const appUrl = process.env.NEXTAUTH_URL || 'https://www.webgrade.io';
    return NextResponse.json({
      needsGoogleAuth: true,
      authorizeUrl: `${appUrl}/api/gsc/authorize?siteId=${siteId}`,
      properties: [],
      message: 'Google access expired. Please reconnect.',
    });
  }
}

// POST /api/gsc/connect — link a GSC property to a site
const connectSchema = z.object({
  siteId: z.string(),
  propertyUrl: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await prisma.site.update({
    where: { id: parsed.data.siteId },
    data: {
      gscConnected: true,
      gscPropertyUrl: parsed.data.propertyUrl,
      gscConnectedAt: new Date(),
      gscConnectedByUserId: user.id,
    },
  });

  return NextResponse.json({ success: true });
}

// DELETE /api/gsc/connect?siteId=xxx — disconnect GSC
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  await prisma.site.update({
    where: { id: siteId },
    data: {
      gscConnected: false,
      gscPropertyUrl: null,
      gscConnectedAt: null,
      gscConnectedByUserId: null,
      gscLastSyncAt: null,
    },
  });

  return NextResponse.json({ success: true });
}
