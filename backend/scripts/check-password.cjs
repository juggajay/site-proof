const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === testHash;
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'admin@test.com' },
    select: { email: true, passwordHash: true }
  });

  if (user) {
    console.log('User found:', user.email);
    console.log('Has password hash:', !!user.passwordHash);
    if (user.passwordHash) {
      const result = verifyPassword('password123', user.passwordHash);
      console.log('Password "password123" matches:', result);
    }
  } else {
    console.log('User not found');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
