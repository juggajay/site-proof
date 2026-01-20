import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectId = 'b0a77eb4-f755-4caf-b13b-d862762314f0';

  // Check all project users for this project
  const projectUsers = await prisma.projectUser.findMany({
    where: { projectId },
    include: {
      user: { select: { email: true, fullName: true } }
    }
  });

  console.log('All users on Cumulative Chart Test Project:');
  projectUsers.forEach(pu => {
    console.log(`  - ${pu.user.email} | Role: ${pu.role} | Status: ${pu.status}`);
  });

  // Also check project_manager users without status filter
  const pms = await prisma.projectUser.findMany({
    where: {
      projectId,
      role: 'project_manager'
    },
    include: {
      user: { select: { email: true } }
    }
  });
  console.log('\nProject Managers (no status filter):');
  pms.forEach(pm => {
    console.log(`  - ${pm.user.email} | Status: ${pm.status}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
