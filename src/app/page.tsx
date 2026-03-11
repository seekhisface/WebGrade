import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/client';

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/login');
  }

  // Find the user's first site
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      orgMemberships: {
        include: {
          org: {
            include: {
              sites: { take: 1, orderBy: { createdAt: 'asc' } }
            }
          }
        },
        take: 1,
      }
    }
  });

  const firstSite = user?.orgMemberships[0]?.org?.sites[0];

  if (!firstSite) {
    redirect('/onboarding');
  }

  redirect(`/dashboard/${firstSite.id}`);
}
