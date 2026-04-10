export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/**
 * GET /api/rt/list?siteId=xxx
 * Returns all sent win-back reports for a site (authenticated)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { verifySiteAccess } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  // Verify org membership
  const site = await verifySiteAccess(session.user.email, siteId);
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
