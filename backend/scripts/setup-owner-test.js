import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const JWT_SECRET = 'development-jwt-secret-change-in-production';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  console.log('Setting up owner role test data...\n');

  // Clean up existing test data
  await prisma.projectUser.deleteMany({
    where: { user: { email: 'owner-test@test.com' } }
  });
  await prisma.lot.deleteMany({
    where: { projectId: 'owner-test-project-id' }
  });
  await prisma.project.deleteMany({
    where: { name: 'Owner Test Project' }
  });
  await prisma.user.deleteMany({
    where: { email: 'owner-test@test.com' }
  });
  await prisma.company.deleteMany({
    where: { name: 'Owner Test Company' }
  });

  // Create company
  const company = await prisma.company.create({
    data: {
      id: 'owner-test-company-id',
      name: 'Owner Test Company',
      abn: '99887766554',
    }
  });
  console.log('✓ Created company:', company.name);

  // Create owner user
  const ownerPassword = hashPassword('password123');
  const owner = await prisma.user.create({
    data: {
      id: 'owner-test-user-id',
      email: 'owner-test@test.com',
      passwordHash: ownerPassword,
      fullName: 'Test Owner',
      roleInCompany: 'owner',
      companyId: company.id,
    }
  });
  console.log('✓ Created owner user:', owner.email);

  // Create a project for the company
  const project = await prisma.project.create({
    data: {
      id: 'owner-test-project-id',
      name: 'Owner Test Project',
      projectNumber: 'OTP-001',
      companyId: company.id,
      status: 'active',
      state: 'QLD',
      specificationSet: 'TMR',
    }
  });
  console.log('✓ Created project:', project.name);

  // Add owner to project
  await prisma.projectUser.create({
    data: {
      projectId: project.id,
      userId: owner.id,
      role: 'owner',
      status: 'active',
    }
  });
  console.log('✓ Added owner to project');

  // Create some lots with budgets
  await prisma.lot.create({
    data: {
      id: 'owner-lot-1-id',
      projectId: project.id,
      lotNumber: 'LOT-OWN-001',
      lotType: 'chainage',
      description: 'Owner Test Lot 1',
      chainageStart: 0,
      chainageEnd: 100,
      status: 'in_progress',
      budgetAmount: 50000.00,
      activityType: 'Earthworks',
      createdById: owner.id,
    }
  });
  console.log('✓ Created lot with budget');

  console.log('\n========================================');
  console.log('OWNER TEST CREDENTIALS');
  console.log('========================================');
  console.log('Email: owner-test@test.com');
  console.log('Password: password123');
  console.log('Role: owner');
  console.log('Company: Owner Test Company');
  console.log('========================================\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
