import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const JWT_SECRET = 'development-jwt-secret-change-in-production';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  console.log('Setting up commercial isolation test data...\n');

  // Clean up existing test data
  await prisma.lot.deleteMany({
    where: { description: { contains: 'Commercial Isolation Test' } }
  });
  await prisma.projectUser.deleteMany({
    where: { user: { email: { in: ['commercial-engineer@test.com', 'commercial-pm@test.com'] } } }
  });
  await prisma.user.deleteMany({
    where: { email: { in: ['commercial-engineer@test.com', 'commercial-pm@test.com'] } }
  });
  await prisma.project.deleteMany({
    where: { name: 'Commercial Isolation Test Project' }
  });
  await prisma.company.deleteMany({
    where: { name: 'Commercial Test Company' }
  });

  // Create company
  const company = await prisma.company.create({
    data: {
      id: 'commercial-test-company-id',
      name: 'Commercial Test Company',
      abn: '12345678901',
    }
  });
  console.log('✓ Created company:', company.name);

  // Create project
  const project = await prisma.project.create({
    data: {
      id: 'commercial-test-project-id',
      name: 'Commercial Isolation Test Project',
      projectNumber: 'CIT-001',
      companyId: company.id,
      status: 'active',
      state: 'QLD',
      specificationSet: 'TMR',
    }
  });
  console.log('✓ Created project:', project.name);

  // Create site engineer user (should NOT see costs)
  const engineerPassword = hashPassword('password123');
  const engineer = await prisma.user.create({
    data: {
      id: 'commercial-engineer-id',
      email: 'commercial-engineer@test.com',
      passwordHash: engineerPassword,
      fullName: 'Test Site Engineer',
      roleInCompany: 'site_engineer',
      companyId: company.id,
    }
  });
  console.log('✓ Created site engineer:', engineer.email);

  // Add engineer to project
  await prisma.projectUser.create({
    data: {
      projectId: project.id,
      userId: engineer.id,
      role: 'site_engineer',
      status: 'active',
    }
  });
  console.log('✓ Added engineer to project');

  // Create project manager user (CAN see costs)
  const pmPassword = hashPassword('password123');
  const pm = await prisma.user.create({
    data: {
      id: 'commercial-pm-id',
      email: 'commercial-pm@test.com',
      passwordHash: pmPassword,
      fullName: 'Test Project Manager',
      roleInCompany: 'project_manager',
      companyId: company.id,
    }
  });
  console.log('✓ Created project manager:', pm.email);

  // Add PM to project
  await prisma.projectUser.create({
    data: {
      projectId: project.id,
      userId: pm.id,
      role: 'project_manager',
      status: 'active',
    }
  });
  console.log('✓ Added PM to project');

  // Create a lot WITH budget (cost data)
  const lot = await prisma.lot.create({
    data: {
      id: 'commercial-test-lot-id',
      projectId: project.id,
      lotNumber: 'LOT-CIT-001',
      lotType: 'chainage',
      description: 'Commercial Isolation Test Lot',
      chainageStart: 1000,
      chainageEnd: 1100,
      offset: 'full',
      layer: 'Subbase',
      activityType: 'Earthworks',
      status: 'in_progress',
      budgetAmount: 25000.00, // This is the commercial data that should be hidden
      createdById: pm.id,
    }
  });
  console.log('✓ Created lot with budget:', lot.lotNumber, '- Budget: $' + lot.budgetAmount);

  // Create a second lot with different budget
  const lot2 = await prisma.lot.create({
    data: {
      id: 'commercial-test-lot-2-id',
      projectId: project.id,
      lotNumber: 'LOT-CIT-002',
      lotType: 'chainage',
      description: 'Commercial Isolation Test Lot 2',
      chainageStart: 1100,
      chainageEnd: 1200,
      offset: 'left',
      layer: 'Base',
      activityType: 'Pavement',
      status: 'not_started',
      budgetAmount: 45000.00,
      createdById: pm.id,
    }
  });
  console.log('✓ Created lot 2 with budget:', lot2.lotNumber, '- Budget: $' + lot2.budgetAmount);

  console.log('\n========================================');
  console.log('TEST CREDENTIALS');
  console.log('========================================');
  console.log('Site Engineer (NO cost visibility):');
  console.log('  Email: commercial-engineer@test.com');
  console.log('  Password: password123');
  console.log('');
  console.log('Project Manager (HAS cost visibility):');
  console.log('  Email: commercial-pm@test.com');
  console.log('  Password: password123');
  console.log('');
  console.log('Project: Commercial Isolation Test Project');
  console.log('Lots with budgets:');
  console.log('  - LOT-CIT-001: $25,000');
  console.log('  - LOT-CIT-002: $45,000');
  console.log('========================================\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
