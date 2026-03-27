export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/**
 * POST /api/rt/unlock
 * Marks a win-back report as unlocked after purchase / manual approval.
 * Body: { token }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const report = await prisma.report.findFirst({ where: { shareToken: token, type: 'WINBACK' } });
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const unlockedAt = new Date();
  await prisma.report.update({
    where: { id: report.id },
    data: { shareUnlockedAt: unlockedAt },
  });

  return NextResponse.json({ ok: true, unlockedAt: unlockedAt.toISOString() });
}
