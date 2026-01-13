import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true
    }
  });
  console.log('Users:', JSON.stringify(users, null, 2));

  await prisma.$disconnect();
}

checkUsers();
