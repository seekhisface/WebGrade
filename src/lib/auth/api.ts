import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './options';

/**
 * Validates the current API request has an authenticated session.
 * Returns the session + convenience fields, or null if unauthenticated.
 */
export async function requireApiSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return null;
  }
  return { session, userId: session.user.id!, email: session.user.email };
}

/**
 * Returns a 401 JSON response — use when requireApiSession() returns null.
 */
export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
