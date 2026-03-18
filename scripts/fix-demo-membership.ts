import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // Find the correct demo user
  const user = await p.user.findUnique({ where: { email: 'demo@webgrade.io' } });
  if (!user) { console.log('❌ demo@webgrade.io not found'); return; }
  console.log(`✅ Found user: ${user.id}`);

  // Find the NovaPulse org
  const org = await p.organization.findUnique({ where: { slug: 'novapulse-hr' } });
  if (!org) { console.log('❌ NovaPulse org not found — run seed first'); return; }
  console.log(`✅ Found org: ${org.id}`);

  // Find the site
  const site = await p.site.findFirst({ where: { orgId: org.id } });
  if (!site) { console.log('❌ No site found for org'); return; }
  console.log(`✅ Found site: ${site.id} (${site.domain})`);

  // Upsert org membership for the correct user
  await p.orgMember.upsert({
    where:  { orgId_userId: { orgId: org.id, userId: user.id } },
    update: { role: 'OWNER' },
    create: { orgId: org.id, userId: user.id, role: 'OWNER' },
  });
  console.log(`✅ OrgMember linked`);

  // Clean up the ghost user (demo@webgrade.com typo)
  const ghost = await p.user.findUnique({ where: { email: 'demo@webgrade.com' } });
  if (ghost) {
    await p.user.delete({ where: { id: ghost.id } });
    console.log(`🧹 Deleted ghost user: demo@webgrade.com`);
  }

  console.log(`\n🎉 Done! Login as demo@webgrade.io → /dashboard/${site.id}`);
  await p.$disconnect();
}

main().catch(e => { console.error('❌', e); process.exit(1); });
