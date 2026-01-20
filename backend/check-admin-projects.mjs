import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find projects where admin@test.com is a member
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@test.com' } });
  console.log('Admin user:', adminUser?.id);

  if (!adminUser) {
    console.log('Admin user not found');
    return;
  }

  // Get projects admin is part of
  const adminProjects = await prisma.projectUser.findMany({
    where: { userId: adminUser.id },
    include: { project: { select: { id: true, name: true } } }
  });

  console.log('\n=== Projects admin@test.com is in ===');
  for (const pu of adminProjects) {
    console.log(`- ${pu.project.name} (${pu.project.id}) as ${pu.role}`);

    // Get other users in this project
    const otherUsers = await prisma.projectUser.findMany({
      where: { projectId: pu.project.id, userId: { not: adminUser.id } },
      include: { user: { select: { id: true, email: true } } }
    });

    if (otherUsers.length > 0) {
      console.log('  Other users:');
      otherUsers.forEach(ou => console.log(`    - ${ou.user.email} (${ou.user.id}) as ${ou.role}`));
    }
  }
}

main().finally(() => prisma.$disconnect());
