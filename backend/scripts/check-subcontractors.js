import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Get all subcontractor companies with their users and assigned lots
  const subbies = await prisma.subcontractorCompany.findMany({
    include: {
      users: true,
      assignedLots: { select: { id: true, lotNumber: true } },
      project: { select: { id: true, name: true } }
    }
  });

  console.log('=== Subcontractor Companies ===');
  for (const subbie of subbies) {
    console.log(`\nCompany: ${subbie.companyName} (ID: ${subbie.id})`);
    console.log(`  Project: ${subbie.project.name} (ID: ${subbie.project.id})`);
    console.log(`  Status: ${subbie.status}`);
    console.log(`  Users: ${subbie.users.length}`);
    subbie.users.forEach(u => console.log(`    - User ID: ${u.userId}, Role: ${u.role}`));
    console.log(`  Assigned Lots: ${subbie.assignedLots.length}`);
    subbie.assignedLots.forEach(l => console.log(`    - ${l.lotNumber} (${l.id})`));
  }

  // Get subcontractor users with their email
  console.log('\n=== Subcontractor Users ===');
  const subUsers = await prisma.user.findMany({
    where: {
      OR: [
        { roleInCompany: 'subcontractor' },
        { roleInCompany: 'subcontractor_admin' }
      ]
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      roleInCompany: true
    }
  });

  for (const user of subUsers) {
    console.log(`\nUser: ${user.email} (${user.fullName})`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Role: ${user.roleInCompany}`);

    // Find their subcontractor company
    const subUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id },
      include: { subcontractorCompany: { select: { companyName: true, id: true } } }
    });
    if (subUser) {
      console.log(`  Company: ${subUser.subcontractorCompany.companyName} (${subUser.subcontractorCompany.id})`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
