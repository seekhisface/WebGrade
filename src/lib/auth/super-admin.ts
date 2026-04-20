import { prisma } from '@/lib/db/client';

export function isSuperAdminEmail(email: string): boolean {
  const list = (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

// Ensure the DB flag matches the env list — call on sign-in
export async function syncSuperAdminFlag(email: string): Promise<void> {
  const shouldBe = isSuperAdminEmail(email);
  await prisma.user.updateMany({
    where: { email },
    data: { isSuperAdmin: shouldBe },
  });
}

// Fast check from the DB (use in server components / API routes)
export async function checkSuperAdmin(email: string): Promise<boolean> {
  if (isSuperAdminEmail(email)) return true;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { isSuperAdmin: true },
  });
  return user?.isSuperAdmin ?? false;
}
