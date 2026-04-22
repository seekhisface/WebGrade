import { prisma } from '@/lib/db/client';

export async function checkSuperAdmin(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { isSuperAdmin: true },
  });
  // testing a change
  return user?.isSuperAdmin === true;
}
