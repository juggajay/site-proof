const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// This matches the backend's hashPassword function
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  const newPasswordHash = hashPassword('password123');
  console.log('New hash:', newPasswordHash);

  const user = await prisma.user.update({
    where: { email: 'admin@test.com' },
    data: { passwordHash: newPasswordHash },
    select: { email: true }
  });

  console.log('Password updated for:', user.email);
  console.log('New password: password123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
