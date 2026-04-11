export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/db/client';

// GET /api/gads/callback — Google OAuth redirect after consent for Google Ads
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const stateParam = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');
  const appUrl = process.env.NEXTAUTH_URL || 'https://www.webgrade.io';

  if (error) {
    console.error('[gads/callback] OAuth error:', error);
    return NextResponse.redirect(`${appUrl}/dashboard?gads_error=denied`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${appUrl}/dashboard?gads_error=missing_params`);
  }

  let state: { siteId: string; email: string };
  try {
    state = JSON.parse(stateParam);
  } catch {
    return NextResponse.redirect(`${appUrl}/dashboard?gads_error=invalid_state`);
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl}/api/gads/callback`,
  );

  try {
    const { tokens } = await oauth2.getToken(code);

    const user = await prisma.user.findUnique({
      where: { email: state.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.redirect(`${appUrl}/dashboard?gads_error=user_not_found`);
    }

    // Store tokens — reuse existing Google account or create new one
    // We store Google Ads tokens alongside GSC tokens since they share the same Google account
    const existingAccount = await prisma.account.findFirst({
      where: { userId: user.id, provider: 'google' },
    });

    if (existingAccount) {
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? existingAccount.refresh_token,
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
          // Merge scopes — keep GSC scope if it was already there
          scope: mergeScopes(existingAccount.scope, tokens.scope),
        },
      });
    } else {
      await prisma.account.create({
        data: {
          userId: user.id,
          type: 'oauth',
          provider: 'google',
          providerAccountId: `gads-${user.id}`,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
          token_type: tokens.token_type ?? 'Bearer',
          scope: tokens.scope,
        },
      });
    }

    // Mark site as Google Ads connected (customer ID selected in next step)
    await prisma.site.update({
      where: { id: state.siteId },
      data: {
        gadsConnected: true,
        gadsConnectedAt: new Date(),
        gadsConnectedByUserId: user.id,
      },
    });

    // Redirect to account selection step
    return NextResponse.redirect(`${appUrl}/dashboard/${state.siteId}/settings?gads=connected`);
  } catch (err) {
    console.error('[gads/callback] Token exchange failed:', err);
    return NextResponse.redirect(`${appUrl}/dashboard/${state.siteId}/settings?gads_error=token_failed`);
  }
}

function mergeScopes(existing: string | null | undefined, incoming: string | null | undefined): string {
  const scopes = new Set<string>();
  if (existing) existing.split(' ').forEach(s => scopes.add(s));
  if (incoming) incoming.split(' ').forEach(s => scopes.add(s));
  return [...scopes].join(' ');
}
