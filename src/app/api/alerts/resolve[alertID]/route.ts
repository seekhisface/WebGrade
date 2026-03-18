/**
 * PATCH /api/alerts/resolve/[alertId]
 *
 * Manually resolves a specific alert.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiSession, unauthorizedResponse } from '@/lib/auth/api';
import { prisma } from '@/lib/db/client';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { alertId: string } }
) {
  const auth = await requireApiSession();
  if (!auth) return unauthorizedResponse();
  const { userId, email } = auth;

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
