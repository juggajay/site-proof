import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  console.log('Setting up foreman test user...\n');

  const projectId = 'e9761f0a-d1f7-43b5-bfe2-6d4a648fcff1'; // NCR Test Project

  // Hash the password
  const hashedPassword = hashPassword('password123');

  // Find or get the company from the project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true }
  });

  if (!project) {
    console.error('Project not found:', projectId);
    return;
  }

  // Create or update foreman user
  const foremanUser = await prisma.user.upsert({
    where: { email: 'foreman@test.com' },
    update: {
      roleInCompany: 'foreman',
      companyId: project.companyId,
    },
    create: {
      email: 'foreman@test.com',
      passwordHash: hashedPassword,
      fullName: 'Test Foreman',
      roleInCompany: 'foreman',
      companyId: project.companyId,
    },
  });

  console.log('✓ Foreman user created:', foremanUser.email);

  // Add to the NCR Test Project
  await prisma.projectUser.deleteMany({
    where: {
      userId: foremanUser.id,
      projectId,
    },
  });

  await prisma.projectUser.create({
    data: {
      userId: foremanUser.id,
      projectId,
      role: 'foreman',
      status: 'active',
    },
  });

  console.log('✓ Added foreman to NCR Test Project');

  console.log('\n=== Foreman Test User ===');
  console.log('Email: foreman@test.com');
  console.log('Password: password123');
  console.log('Role: foreman');
  console.log('Project: NCR Test Project');
  console.log('\nForeman should be able to:');
  console.log('  - View assigned lots');
  console.log('  - Complete assigned ITP items');
  console.log('  - Create daily diary');
  console.log('  - Approve dockets');
  console.log('  - Raise NCRs');
  console.log('\nForeman should NOT be able to:');
  console.log('  - Edit the lot register (delete lots)');
  console.log('  - See commercial data');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
