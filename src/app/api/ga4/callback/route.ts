export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/db/client';

// GET /api/ga4/callback — Google OAuth redirect after GA4 consent
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const stateParam = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');
  const appUrl = process.env.NEXTAUTH_URL || 'https://www.webgrade.io';

  if (error) {
    console.error('[ga4/callback] OAuth error:', error);
    return NextResponse.redirect(`${appUrl}/dashboard?ga4_error=denied`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${appUrl}/dashboard?ga4_error=missing_params`);
  }

  let state: { siteId: string; email: string };
  try {
    state = JSON.parse(stateParam);
  } catch {
    return NextResponse.redirect(`${appUrl}/dashboard?ga4_error=invalid_state`);
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl}/api/ga4/callback`,
  );

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2.getToken(code);

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: state.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.redirect(`${appUrl}/dashboard?ga4_error=user_not_found`);
    }

    // Upsert the Google account record with GA4 tokens
    const existingAccount = await prisma.account.findFirst({
      where: { userId: user.id, provider: 'google' },
    });

    if (existingAccount) {
      // Update existing Google account with new tokens/scope
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? existingAccount.refresh_token,
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
          scope: tokens.scope ?? existingAccount.scope,
        },
      });
    } else {
      // Create a new Google account record for this user
      await prisma.account.create({
        data: {
          userId: user.id,
          type: 'oauth',
          provider: 'google',
          providerAccountId: `ga4-${user.id}`,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
          token_type: tokens.token_type ?? 'Bearer',
          scope: tokens.scope,
        },
      });
    }

    // Mark the site's GA4 connection
    await prisma.site.update({
      where: { id: state.siteId },
      data: {
        ga4Connected: true,
        ga4ConnectedAt: new Date(),
        ga4ConnectedByUserId: user.id,
      },
    });

    // Redirect back to settings
    return NextResponse.redirect(`${appUrl}/dashboard/${state.siteId}/settings?ga4=connected`);
  } catch (err) {
    console.error('[ga4/callback] Token exchange failed:', err);
    return NextResponse.redirect(`${appUrl}/dashboard/${state.siteId}/settings?ga4_error=token_failed`);
  }
}
