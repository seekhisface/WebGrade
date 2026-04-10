import { getServerSession } from 'next-auth';
import { authOptions } from './options';
import { prisma } from '@/lib/db/client';
import { redirect } from 'next/navigation';

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login');
  }
  return session;
}

export async function getUserOrgs(userId: string) {
  return prisma.orgMember.findMany({
    where: { userId },
    include: {
      org: {
        include: {
          sites: {
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });
}

export async function getUserSites(userId: string) {
  const memberships = await getUserOrgs(userId);
  return memberships.flatMap(m => m.org.sites);
}

export async function requireSiteAccess(userId: string, siteId: string) {
  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      org: {
        members: {
          some: { userId },
        },
      },
    },
    include: {
      org: true,
      onboarding: true,
    },
  });

  if (!site) {
    redirect('/dashboard');
  }

  return site;
}

/**
 * API-route version of requireSiteAccess.
 * Returns the site if the user (by email) belongs to its org, or null.
 * Use this in route.ts handlers instead of requireSiteAccess (which redirects).
 */
export async function verifySiteAccess(email: string, siteId: string) {
  return prisma.site.findFirst({
    where: {
      id: siteId,
      org: {
        members: {
          some: { user: { email } },
        },
      },
    },
  });
}