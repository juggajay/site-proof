import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  console.log('Setting up viewer test user...\n');

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

  // Create or update viewer user
  const viewerUser = await prisma.user.upsert({
    where: { email: 'viewer@test.com' },
    update: {
      roleInCompany: 'viewer',
      companyId: project.companyId,
      passwordHash: hashedPassword, // Always update password
    },
    create: {
      email: 'viewer@test.com',
      passwordHash: hashedPassword,
      fullName: 'Test Viewer',
      roleInCompany: 'viewer',
      companyId: project.companyId,
    },
  });

  console.log('✓ Viewer user created:', viewerUser.email);

  // Add to the NCR Test Project
  await prisma.projectUser.deleteMany({
    where: {
      userId: viewerUser.id,
      projectId,
    },
  });

  await prisma.projectUser.create({
    data: {
      userId: viewerUser.id,
      projectId,
      role: 'viewer',
      status: 'active',
    },
  });

  console.log('✓ Added viewer to NCR Test Project');

  console.log('\n=== Viewer Test User ===');
  console.log('Email: viewer@test.com');
  console.log('Password: password123');
  console.log('Role: viewer');
  console.log('Project: NCR Test Project');
  console.log('\nViewer should be able to:');
  console.log('  - View lot register (read-only)');
  console.log('  - View ITPs (read-only)');
  console.log('  - View other data (read-only)');
  console.log('\nViewer should NOT be able to:');
  console.log('  - Create anything');
  console.log('  - Edit anything');
  console.log('  - Delete anything');
  console.log('  - See commercial data');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
