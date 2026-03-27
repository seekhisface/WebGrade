export const dynamic = 'force-dynamic'
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';
import { redirect } from 'next/navigation';

export default async function DashboardRootPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/login');
  }

  // Look up by email — resilient to NextAuth creating duplicate user records
  // when Credentials provider is used alongside PrismaAdapter. Email is always
  // the stable identifier regardless of which user ID NextAuth assigned.
  const userByEmail = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      orgMemberships: {
        include: {
          org: {
            include: {
              sites: {
                where: { isActive: true },
                orderBy: { createdAt: 'asc' },
                take: 1,
              },
            },
          },
        },
        take: 1,
      },
    },
  });

  const site = userByEmail?.orgMemberships?.[0]?.org?.sites?.[0];

  if (!site) {
    redirect('/onboarding');
  }

  redirect(`/dashboard/${site.id}`);
}
