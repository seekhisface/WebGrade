export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { z } from 'zod';

// GET /api/profile — fetch current user profile with orgs, sites, members
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      createdAt: true,
      orgMemberships: {
        select: {
          role: true,
          org: {
            select: {
              id: true,
              name: true,
              slug: true,
              sites: {
                select: {
                  id: true,
                  name: true,
                  domain: true,
                  url: true,
                  industry: true,
                  description: true,
                  isActive: true,
                  createdAt: true,
                },
                orderBy: { createdAt: 'asc' },
              },
              members: {
                select: {
                  id: true,
                  role: true,
                  joinedAt: true,
                  user: {
                    select: { id: true, email: true, name: true, image: true },
                  },
                },
                orderBy: { joinedAt: 'asc' },
              },
              invitations: {
                where: { expiresAt: { gt: new Date() } },
                select: {
                  id: true,
                  email: true,
                  role: true,
                  createdAt: true,
                  expiresAt: true,
                },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json(user);
}

// PUT /api/profile — update user name
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const user = await prisma.user.update({
    where: { email: session.user.email },
    data: { name: parsed.data.name },
    select: { id: true, email: true, name: true },
  });

  return NextResponse.json(user);
}
