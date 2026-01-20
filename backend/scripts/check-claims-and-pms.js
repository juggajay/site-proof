import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find project users with project_manager role
  const pms = await prisma.projectUser.findMany({
    where: { role: 'project_manager' },
    include: {
      user: { select: { email: true, fullName: true } },
      project: { select: { name: true, id: true } }
    }
  });
  console.log('Project Managers:');
  pms.forEach(pm => {
    console.log(`  - ${pm.user.email} on project: ${pm.project.name} (${pm.project.id})`);
  });

  // Find claims
  const claims = await prisma.progressClaim.findMany({
    include: { project: { select: { name: true, id: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('\nRecent Claims:');
  claims.forEach(c => {
    console.log(`  - Claim #${c.claimNumber} Status: ${c.status} Amount: ${c.totalClaimedAmount} Project: ${c.project.name}`);
    console.log(`    ID: ${c.id}, ProjectID: ${c.project.id}`);
  });

  // Also list users with owner/admin role who can certify claims
  const admins = await prisma.projectUser.findMany({
    where: { role: { in: ['owner', 'admin'] } },
    include: {
      user: { select: { email: true, fullName: true } },
      project: { select: { name: true } }
    },
    take: 10
  });
  console.log('\nAdmins/Owners:');
  admins.forEach(a => {
    console.log(`  - ${a.user.email} (${a.role}) on project: ${a.project.name}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
