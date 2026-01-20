import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'admin@test.com' }
  });
  console.log('Admin user ID:', user?.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
