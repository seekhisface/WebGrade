export const dynamic = 'force-dynamic'
/**
 * PATCH /api/recommendations/status
 *
 * Customer updates the implementation status of a recommendation.
 * Validates access, saves status + note, triggers verification if marked done.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { recId, status, note } = await req.json();
  if (!recId || !status) {
    return NextResponse.json({ error: 'recId and status required' }, { status: 400 });
  }

  const validStatuses = ['OPEN', 'IN_PROGRESS', 'IMPLEMENTED', 'ABANDONED'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // Verify the user has access to this recommendation's site
  const rec = await prisma.recommendation.findFirst({
    where: { id: recId },
    include: {
      site: {
        include: {
          org: {
            include: { members: { include: { user: true } } },
          },
        },
      },
    },
  });

  if (!rec) {
    return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
  }

  const isMember = rec.site.org.members.some(m => m.user.email === session.user!.email);
  // Fallback: also allow if user's org owns the site
  if (!isMember) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { orgMemberships: { select: { orgId: true } } },
    });
    const orgIds = user?.orgMemberships.map(m => m.orgId) ?? [];
    if (!orgIds.includes(rec.site.orgId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  // Save the update
  const updated = await prisma.recommendation.update({
    where: { id: recId },
    data: {
      implementationStatus: status,
      customerNote: note || null,
      customerUpdatedAt: new Date(),
      // If marking done, clear contradiction flag until next AI verification
      ...(status === 'IMPLEMENTED' ? {
        contradictionFlag: false,
        contradictionNote: null,
      } : {}),
      // If reopening, reset verification
      ...(status === 'IN_PROGRESS' || status === 'OPEN' ? {
        verificationStatus: 'UNVERIFIED',
      } : {}),
    },
  });

  // Log the status change in metric history
  const existingHistory = (updated.metricHistory as Array<{ month: string; value: number; note: string; customerAction?: string }>) ?? [];
  const nowLabel = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const updatedHistory = [
    ...existingHistory.filter(h => !(h.month === nowLabel && h.customerAction)),
    {
      month: nowLabel,
      value: updated.lastVerifiedValue ?? 0,
      note: note || `Status changed to ${status}`,
      customerAction: status,
    },
  ].slice(-24);

  await prisma.recommendation.update({
    where: { id: recId },
    data: { metricHistory: updatedHistory as never },
  });

  return NextResponse.json({
    success: true,
    id: updated.id,
    implementationStatus: updated.implementationStatus,
    message: getStatusMessage(status),
  });
}

function getStatusMessage(status: string): string {
  switch (status) {
    case 'IN_PROGRESS': return "Got it — we'll track this and verify improvement next month.";
    case 'IMPLEMENTED': return "Marked as done. We'll verify the metric improved in our next analysis.";
    case 'ABANDONED': return "Marked as won't fix. We'll remove this from your priority list.";
    case 'OPEN': return "Reopened — back in your action queue.";
    default: return 'Status updated.';
  }
}
