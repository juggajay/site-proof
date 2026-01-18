const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  const newPasswordHash = hashPassword('password123');

  const user = await prisma.user.update({
    where: { email: 'admin@test.com' },
    data: { passwordHash: newPasswordHash },
    select: { email: true }
  });

  console.log('Password updated for:', user.email);
  console.log('New password: password123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
