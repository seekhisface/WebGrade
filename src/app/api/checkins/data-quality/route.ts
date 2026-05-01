// GET /api/checkins/data-quality?siteId=xxx&mode=gentle|strict
//
// Runs the rule-based data-quality checks for a site and returns the report.
// mode=gentle (Day 7) is more forgiving; mode=strict (Day 14, default) downgrades
// lingering warns on critical checks to fail.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { verifySiteAccess } from '@/lib/auth/session';
import { runDataQualityChecks } from '@/lib/checkins/data-quality';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteId = req.nextUrl.searchParams.get('siteId');
  const modeParam = req.nextUrl.searchParams.get('mode');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const mode = modeParam === 'gentle' ? 'gentle' : modeParam === 'report' ? 'report' : 'strict';

  const site = await verifySiteAccess(session.user.email, siteId);
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const report = await runDataQualityChecks(siteId, mode);
  return NextResponse.json(report);
}
