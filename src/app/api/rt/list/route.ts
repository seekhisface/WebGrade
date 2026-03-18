/**
 * GET /api/rt/list?siteId=xxx
 * Returns all sent win-back reports for a site (authenticated)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireApiSession, unauthorizedResponse } from '@/lib/auth/api';
import { prisma } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  const auth = await requireApiSession();
  if (!auth) return unauthorizedResponse();
  const { userId, email } = auth;

  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  // Verify ownership
  const site = await prisma.site.findFirst({
    where: { id: siteId, user: { email } },
  });
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const reports = await prisma.report.findMany({
    where: { siteId, type: 'WINBACK' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      shareToken: true,
      shareRecipient: true,
      shareExpiresAt: true,
      shareUnlockedAt: true,
      behavioralSummary: true,
      createdAt: true,
    },
  });

  return NextResponse.json(reports);
}
