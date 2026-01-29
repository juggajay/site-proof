const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  const projectId = '457af21a-16bf-49e7-a23b-c467af933e7e'; // highway upgrade
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true, name: true }
  });
  console.log('Using project:', project.name);

  const hashedPassword = hashPassword('password123');

  const foremanUser = await prisma.user.upsert({
    where: { email: 'foreman@test.com' },
    update: {
      roleInCompany: 'foreman',
      companyId: project.companyId,
      passwordHash: hashedPassword,
    },
    create: {
      email: 'foreman@test.com',
      passwordHash: hashedPassword,
      fullName: 'Test Foreman',
      roleInCompany: 'foreman',
      companyId: project.companyId,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log('Foreman user created/updated:', foremanUser.email, foremanUser.id);

  await prisma.projectUser.deleteMany({
    where: { userId: foremanUser.id, projectId }
  });
  await prisma.projectUser.create({
    data: {
      userId: foremanUser.id,
      projectId,
      role: 'foreman',
      status: 'active',
    },
  });
  console.log('Added foreman to project:', project.name);
  console.log('\nLogin: foreman@test.com / password123');
}
main().catch(console.error).finally(() => prisma.$disconnect());
