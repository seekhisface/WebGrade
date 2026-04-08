// src/app/api/ad-spend/route.ts
// GET + POST for manual ad spend entry per channel.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { z } from 'zod';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const sources = await prisma.adSource.findMany({
    where: {
      siteId,
      site: { org: { members: { some: { user: { email: session.user.email } } } } },
    },
    select: {
      id: true,
      source: true,
      medium: true,
      campaign: true,
      platformSpend: true,
      platformClicks: true,
      platformImpressions: true,
      platformCpc: true,
      qualityScore: true,
      conversionRate: true,
      estimatedWastedSpend: true,
    },
    orderBy: { source: 'asc' },
  });

  return NextResponse.json({ sources });
}

const adSpendSchema = z.object({
  siteId: z.string().min(1),
  channels: z.array(z.object({
    source: z.string().min(1),
    medium: z.string().min(1),
    campaign: z.string().optional(),
    platformSpend: z.number().min(0),
    platformClicks: z.number().int().min(0).optional(),
    platformImpressions: z.number().int().min(0).optional(),
  })),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = adSpendSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });

  const { siteId, channels } = parsed.data;

  const site = await prisma.site.findFirst({
    where: { id: siteId, org: { members: { some: { user: { email: session.user.email } } } } },
    select: { id: true },
  });
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  // Upsert each channel
  for (const ch of channels) {
    const existing = await prisma.adSource.findFirst({
      where: { siteId, source: ch.source, medium: ch.medium },
    });

    const cpc = ch.platformClicks && ch.platformClicks > 0 ? ch.platformSpend / ch.platformClicks : null;

    if (existing) {
      await prisma.adSource.update({
        where: { id: existing.id },
        data: {
          platformSpend: ch.platformSpend,
          platformClicks: ch.platformClicks ?? null,
          platformImpressions: ch.platformImpressions ?? null,
          platformCpc: cpc,
          campaign: ch.campaign ?? existing.campaign,
        },
      });
    } else {
      await prisma.adSource.create({
        data: {
          siteId,
          source: ch.source,
          medium: ch.medium,
          campaign: ch.campaign ?? null,
          platformSpend: ch.platformSpend,
          platformClicks: ch.platformClicks ?? null,
          platformImpressions: ch.platformImpressions ?? null,
          platformCpc: cpc,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, channelsSaved: channels.length });
}
