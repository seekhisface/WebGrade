/**
 * Liveness probe for load balancers and container health checks.
 * Returns 200 OK without auth or DB access.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
