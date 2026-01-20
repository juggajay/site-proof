import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectId = 'b0a77eb4-f755-4caf-b13b-d862762314f0';

  // Find all users on this project
  const projectUsers = await prisma.projectUser.findMany({
    where: { projectId },
    include: {
      user: { select: { email: true, fullName: true } }
    }
  });

  console.log('Users on Cumulative Chart Test Project:');
  projectUsers.forEach(pu => {
    console.log(`  - ${pu.user.email} (${pu.role}) - ${pu.status}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
