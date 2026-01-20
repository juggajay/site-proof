const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'regression65@siteproof.test' }
  });

  if (user) {
    await prisma.user.update({
      where: { email: 'regression65@siteproof.test' },
      data: { emailVerified: true }
    });
    console.log('Email verified for regression65@siteproof.test');
  } else {
    console.log('User not found');
  }

  await prisma.$disconnect();
}

main();
