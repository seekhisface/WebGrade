/**
 * PATCH /api/alerts/resolve/[alertId]
 *
 * Manually resolves a specific alert.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { alertId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { alertId } = params;
  const { resolvedAt } = await req.json();

  const alert = await prisma.alert.update({
    where: { id: alertId },
    data: {
      resolvedAt: resolvedAt ? new Date(resolvedAt) : new Date(),
      resolvedAutomatically: false,
      resolutionTimeMs: Date.now() - (await prisma.alert.findUnique({ where: { id: alertId } }))!.triggeredAt.getTime(),
    },
  });

  return NextResponse.json({ alert });
}
