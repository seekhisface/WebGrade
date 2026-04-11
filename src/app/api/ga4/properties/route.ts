export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { listGa4Properties } from '@/lib/ga4/client';

// GET /api/ga4/properties — list GA4 properties accessible by the connected user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const properties = await listGa4Properties(user.id);
    return NextResponse.json({ properties });
  } catch (err) {
    console.error('[ga4/properties] Failed to list properties:', err);
    return NextResponse.json({ error: 'Failed to list GA4 properties' }, { status: 500 });
  }
}
