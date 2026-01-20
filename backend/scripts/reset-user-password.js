import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  const email = 'cumulative-test@test.com';
  const newPassword = 'password123';

  // Hash the password using the same method as the app
  const passwordHash = hashPassword(newPassword);

  // Update the user
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash }
  });

  console.log(`Password reset for ${email}`);
  console.log(`User ID: ${user.id}`);
  console.log(`New password: ${newPassword}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
