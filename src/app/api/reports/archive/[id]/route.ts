// src/app/api/reports/archive/[id]/route.ts
// Fetch a single archived report by ID.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const archive = await prisma.archivedReport.findUnique({
      where: { id: params.id },
      include: {
        site: {
          select: {
            id: true,
            org: {
              select: {
                members: {
                  where: { user: { email: session.user.email } },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    if (!archive) {
      return NextResponse.json({ error: 'Archive not found' }, { status: 404 });
    }

    // Verify org membership
    if (!archive.site.org.members.length) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Strip internal relation data
    const { site: _, ...archiveData } = archive;
    return NextResponse.json({ archive: archiveData });
  } catch (err) {
    console.error('Archive fetch error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
