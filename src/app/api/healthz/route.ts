/**
 * Health probe — verifies app + database + ingest path are working.
 *
 * GET /api/healthz       → 200 ok / 503 if anything broken
 * GET /api/healthz?deep=1 → also runs ingest-critical column probes
 *
 * The dashboard banner polls this every 60s. If schema drift breaks ingest
 * (the failure mode that broke things last week — no visits for 3 days),
 * this endpoint catches it within a minute instead of taking days to notice.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

export async function GET(req: NextRequest) {
  const deep = req.nextUrl.searchParams.get('deep') === '1';
  const checks: CheckResult[] = [];
  const start = Date.now();

  // 1. DB connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: 'db-connection', ok: true });
  } catch (err) {
    checks.push({ name: 'db-connection', ok: false, detail: (err as Error).message.slice(0, 200) });
  }

  // 2. Ingest-critical tables — count(1) to verify columns exist.
  // This is the canary that would have caught the recent schema-drift outage.
  try {
    await prisma.visitorSession.count({ take: 1 });
    checks.push({ name: 'visitor-session-table', ok: true });
  } catch (err) {
    checks.push({ name: 'visitor-session-table', ok: false, detail: (err as Error).message.slice(0, 200) });
  }

  try {
    await prisma.sessionEvent.count({ take: 1 });
    checks.push({ name: 'session-event-table', ok: true });
  } catch (err) {
    checks.push({ name: 'session-event-table', ok: false, detail: (err as Error).message.slice(0, 200) });
  }

  try {
    await prisma.pageView.count({ take: 1 });
    checks.push({ name: 'page-view-table', ok: true });
  } catch (err) {
    checks.push({ name: 'page-view-table', ok: false, detail: (err as Error).message.slice(0, 200) });
  }

  // 3. Recent ingest activity — has any session arrived in the last 24h?
  // Useful for spotting "snippet stopped firing" silently.
  if (deep) {
    try {
      const recent = await prisma.visitorSession.count({
        where: { startedAt: { gte: new Date(Date.now() - 24 * 3600000) } },
      });
      checks.push({
        name: 'recent-ingest-24h',
        ok: recent > 0,
        detail: `${recent} sessions in last 24h`,
      });
    } catch (err) {
      checks.push({ name: 'recent-ingest-24h', ok: false, detail: (err as Error).message.slice(0, 200) });
    }
  }

  const allOk = checks.every(c => c.ok);
  const status = allOk ? 'ok' : 'degraded';
  const httpStatus = allOk ? 200 : 503;

  return NextResponse.json({
    status,
    checks,
    elapsedMs: Date.now() - start,
    timestamp: new Date().toISOString(),
  }, { status: httpStatus });
}
