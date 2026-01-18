const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get admin user
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@test.com' }
  });
  console.log('Admin user:', adminUser?.id, adminUser?.email);

  // Get projects
  const projects = await prisma.project.findMany({
    take: 10,
    select: { id: true, name: true, projectNumber: true }
  });
  console.log('\nProjects:', JSON.stringify(projects, null, 2));

  // Get project users for admin
  if (adminUser) {
    const projectUsers = await prisma.projectUser.findMany({
      where: { userId: adminUser.id },
      include: { project: { select: { name: true, code: true } } }
    });
    console.log('\nAdmin ProjectUsers:', JSON.stringify(projectUsers, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
