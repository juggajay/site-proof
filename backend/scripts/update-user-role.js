import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'newadmin@test.com';
  const role = process.argv[3] || 'admin';

  const user = await prisma.user.update({
    where: { email },
    data: { roleInCompany: role }
  });

  console.log(`Updated user ${user.email} role to: ${user.roleInCompany}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
