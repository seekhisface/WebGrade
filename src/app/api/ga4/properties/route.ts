export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { verifySiteAccess } from '@/lib/auth/session';
import { listGa4Properties } from '@/lib/ga4/client';

// GET /api/ga4/properties?siteId=xxx — list GA4 properties for the connected site
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const access = await verifySiteAccess(session.user.email, siteId);
  if (!access) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  try {
    const properties = await listGa4Properties(siteId);
    return NextResponse.json({ properties });
  } catch (err) {
    console.error('[ga4/properties] Failed to list properties:', err);
    return NextResponse.json({ error: 'Failed to list GA4 properties' }, { status: 500 });
  }
}
