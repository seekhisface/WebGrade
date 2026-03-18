import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const users = await p.user.findMany({ select: { id: true, email: true } });
  console.log(JSON.stringify(users, null, 2));
  const members = await p.orgMember.findMany({ select: { userId: true, orgId: true, role: true } });
  console.log('OrgMembers:', JSON.stringify(members, null, 2));
  await p.$disconnect();
}
main();
