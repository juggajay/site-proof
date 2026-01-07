import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'admin@test.com' },
    select: { email: true, passwordHash: true }
  });

  console.log('User found:', user?.email);
  console.log('Has password hash:', !!user?.passwordHash);

  if (user?.passwordHash) {
    console.log('Password hash (first 30 chars):', user.passwordHash.substring(0, 30) + '...');
    console.log('Full hash length:', user.passwordHash.length);
  } else {
    console.log('User has no password hash set!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
