import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/db/client';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  // NOTE: PrismaAdapter removed — it throws OAuthAccountNotLinked before callbacks
  // can handle linking. User/Account management is handled in the signIn callback instead.
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;

        // Demo account — plain-text password check
        if (credentials.email === 'demo@webgrade.io') {
          const demoPass = process.env.DEMO_PASSWORD ?? 'DemoPass2026!';
          if (credentials.password === demoPass) {
            return { id: user.id, email: user.email, name: user.name, image: user.image };
          }
          return null;
        }

        // Password-based login — bcrypt hash comparison
        if (user.hashedPassword) {
          const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
          if (valid) {
            return { id: user.id, email: user.email, name: user.name, image: user.image };
          }
        }

        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // For Google OAuth: find or create user, link account if needed
      if (account?.provider === 'google' && profile?.email) {
        try {
          let dbUser = await prisma.user.findUnique({
            where: { email: profile.email },
          });

          // Create user if they don't exist
          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                email: profile.email,
                name: profile.name ?? user.name,
                image: user.image,
              },
            });
          }

          // Ensure Google account is linked
          const existingAccount = await prisma.account.findFirst({
            where: { provider: 'google', providerAccountId: account.providerAccountId },
          });

          if (!existingAccount) {
            await prisma.account.create({
              data: {
                userId: dbUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            });
          }

          // Attach the DB user id so the jwt callback picks it up
          (user as Record<string, unknown>).id = dbUser.id;
        } catch (err) {
          console.error('[auth] Google signIn callback error:', err);
          return true; // still allow sign-in even if linking fails
        }
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
};