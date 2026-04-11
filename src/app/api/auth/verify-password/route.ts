// POST /api/auth/verify-password
// Re-authenticates a credential-based user by verifying their password.
// Used by the settings page to gate integration credential visibility.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import bcrypt from 'bcryptjs';

const Schema = z.object({
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Password required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { hashedPassword: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Demo account — plain-text password check
  if (user.email === 'demo@webgrade.io') {
    const demoPass = process.env.DEMO_PASSWORD ?? 'DemoPass2026!';
    if (parsed.data.password === demoPass) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
  }

  // OAuth-only users have no password — they skip re-auth
  if (!user.hashedPassword) {
    return NextResponse.json({ ok: true, oauthUser: true });
  }

  const valid = await bcrypt.compare(parsed.data.password, user.hashedPassword);
  if (!valid) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
