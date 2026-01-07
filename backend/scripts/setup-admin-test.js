import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const JWT_SECRET = 'development-jwt-secret-change-in-production';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  console.log('Setting up admin role test data...\n');

  // Clean up existing test data
  await prisma.projectUser.deleteMany({
    where: { user: { email: 'admin-test@test.com' } }
  });
  await prisma.lot.deleteMany({
    where: { projectId: 'admin-test-project-id' }
  });
  await prisma.project.deleteMany({
    where: { name: 'Admin Test Project' }
  });
  await prisma.user.deleteMany({
    where: { email: 'admin-test@test.com' }
  });
  await prisma.company.deleteMany({
    where: { name: 'Admin Test Company' }
  });

  // Create company
  const company = await prisma.company.create({
    data: {
      id: 'admin-test-company-id',
      name: 'Admin Test Company',
      abn: '11223344556',
    }
  });
  console.log('✓ Created company:', company.name);

  // Create admin user
  const adminPassword = hashPassword('password123');
  const admin = await prisma.user.create({
    data: {
      id: 'admin-test-user-id',
      email: 'admin-test@test.com',
      passwordHash: adminPassword,
      fullName: 'Test Admin',
      roleInCompany: 'admin',
      companyId: company.id,
    }
  });
  console.log('✓ Created admin user:', admin.email);

  // Create a project for the company
  const project = await prisma.project.create({
    data: {
      id: 'admin-test-project-id',
      name: 'Admin Test Project',
      projectNumber: 'ATP-001',
      companyId: company.id,
      status: 'active',
      state: 'NSW',
      specificationSet: 'RMS',
    }
  });
  console.log('✓ Created project:', project.name);

  // Add admin to project
  await prisma.projectUser.create({
    data: {
      projectId: project.id,
      userId: admin.id,
      role: 'admin',
      status: 'active',
    }
  });
  console.log('✓ Added admin to project');

  // Create a lot with budget
  await prisma.lot.create({
    data: {
      id: 'admin-lot-1-id',
      projectId: project.id,
      lotNumber: 'LOT-ADM-001',
      lotType: 'chainage',
      description: 'Admin Test Lot 1',
      chainageStart: 500,
      chainageEnd: 600,
      status: 'in_progress',
      budgetAmount: 75000.00,
      activityType: 'Pavement',
      createdById: admin.id,
    }
  });
  console.log('✓ Created lot with budget');

  console.log('\n========================================');
  console.log('ADMIN TEST CREDENTIALS');
  console.log('========================================');
  console.log('Email: admin-test@test.com');
  console.log('Password: password123');
  console.log('Role: admin');
  console.log('Company: Admin Test Company');
  console.log('========================================\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
