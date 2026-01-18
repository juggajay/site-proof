import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const JWT_SECRET = 'dev-secret-change-in-production';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'owner@test.com' },
    select: { passwordHash: true }
  });

  console.log('Stored hash:', user?.passwordHash);

  const expected = crypto.createHash('sha256').update('password123' + JWT_SECRET).digest('hex');
  console.log('Expected hash:', expected);
  console.log('Match:', user?.passwordHash === expected);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
