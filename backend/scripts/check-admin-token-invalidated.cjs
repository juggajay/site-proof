const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Use raw query since the model may not expose token_invalidated_at
  const users = await prisma.$queryRaw`
    SELECT id, email, token_invalidated_at FROM users WHERE email = 'admin@test.com'
  `;
  console.log('Admin user token info:', JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
