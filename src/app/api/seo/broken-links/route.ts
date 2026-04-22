// src/app/api/seo/broken-links/route.ts
// GET /api/seo/broken-links?siteId=xxx — returns broken link detection results.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { detectBrokenLinks } from '@/lib/seo/broken-links';
import { verifySiteAccess } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = req.nextUrl.searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'siteId required' }, { status: 400 });
    }

    // Verify org membership
    const site = await verifySiteAccess(session.user.email, siteId);
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const report = await detectBrokenLinks(siteId);
    return NextResponse.json(report);
  } catch (err) {
    console.error('Broken links error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
