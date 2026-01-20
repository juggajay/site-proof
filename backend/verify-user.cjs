const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'regression66@siteproof.test';

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (user) {
    await prisma.user.update({
      where: { email },
      data: { emailVerified: true }
    });
    console.log(`Email verified for ${email}`);
  } else {
    console.log(`User not found: ${email}`);
  }

  await prisma.$disconnect();
}

main();
