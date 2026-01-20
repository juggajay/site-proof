import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // List projects
  console.log('=== Projects ===');
  const projects = await prisma.project.findMany({ take: 10, select: { id: true, name: true } });
  console.log(projects);

  // List users
  console.log('\n=== Users ===');
  const users = await prisma.user.findMany({ take: 10, select: { id: true, email: true, fullName: true } });
  console.log(users);

  // List project users
  console.log('\n=== Project Users ===');
  const projectUsers = await prisma.projectUser.findMany({
    take: 20,
    include: {
      project: { select: { name: true } },
      user: { select: { email: true } }
    }
  });
  console.log(projectUsers.map(pu => ({
    id: pu.id,
    projectName: pu.project.name,
    userEmail: pu.user.email,
    role: pu.role
  })));
}

main().finally(() => prisma.$disconnect());
