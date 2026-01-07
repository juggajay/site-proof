import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, roleInCompany: true, companyId: true }
  });
  console.log('Users:');
  console.log(JSON.stringify(users, null, 2));

  const projectUsers = await prisma.projectUser.findMany({
    include: {
      user: { select: { email: true } },
      project: { select: { name: true, companyId: true } }
    }
  });
  console.log('\nProject Users:');
  projectUsers.forEach(pu => {
    console.log(`  ${pu.user.email} -> ${pu.project.name} (role: ${pu.role})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
