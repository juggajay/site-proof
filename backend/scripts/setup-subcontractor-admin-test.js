import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  console.log('Setting up subcontractor admin test user...\n');

  const projectId = 'e9761f0a-d1f7-43b5-bfe2-6d4a648fcff1'; // NCR Test Project

  // Hash the password
  const hashedPassword = hashPassword('password123');

  // Create or get Subcontractor Company A (linked to project)
  let subCompanyA = await prisma.subcontractorCompany.findFirst({
    where: {
      projectId,
      companyName: 'ABC Earthmoving Pty Ltd',
    },
  });

  if (!subCompanyA) {
    subCompanyA = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: 'ABC Earthmoving Pty Ltd',
        abn: '12345678901',
        status: 'active',
      },
    });
    console.log('✓ Created Subcontractor Company:', subCompanyA.companyName);
  } else {
    console.log('✓ Found existing Subcontractor Company:', subCompanyA.companyName);
  }

  // Create the main company for the user
  const mainCompany = await prisma.company.upsert({
    where: { id: 'sub-admin-company-test' },
    update: {},
    create: {
      id: 'sub-admin-company-test',
      name: 'ABC Earthmoving Pty Ltd (Main)',
      abn: '12345678901',
    },
  });

  // Create or update subcontractor_admin user
  const subAdminUser = await prisma.user.upsert({
    where: { email: 'subadmin@test.com' },
    update: {
      roleInCompany: 'subcontractor_admin',
      companyId: mainCompany.id,
      passwordHash: hashedPassword,
    },
    create: {
      email: 'subadmin@test.com',
      passwordHash: hashedPassword,
      fullName: 'Subcontractor Admin',
      roleInCompany: 'subcontractor_admin',
      companyId: mainCompany.id,
    },
  });

  console.log('✓ Subcontractor Admin user created:', subAdminUser.email);

  // Link user to subcontractor company
  await prisma.subcontractorUser.deleteMany({
    where: { userId: subAdminUser.id },
  });

  await prisma.subcontractorUser.create({
    data: {
      userId: subAdminUser.id,
      subcontractorCompanyId: subCompanyA.id,
      role: 'admin',
    },
  });
  console.log('✓ Linked user to Subcontractor Company A as admin');

  // Subcontractor company is already linked to project via projectId field
  console.log('✓ Subcontractor Company is linked to NCR Test Project');

  // Assign some lots to this subcontractor
  await prisma.lot.updateMany({
    where: {
      projectId,
      lotNumber: { in: ['QM-LOT-001', 'QM-LOT-002'] },
    },
    data: {
      assignedSubcontractorId: subCompanyA.id,
    },
  });
  console.log('✓ Assigned QM-LOT-001 and QM-LOT-002 to Subcontractor Company A');

  console.log('\n=== Subcontractor Admin Test User ===');
  console.log('Email: subadmin@test.com');
  console.log('Password: password123');
  console.log('Role: subcontractor_admin');
  console.log('Subcontractor Company: ABC Earthmoving Pty Ltd');
  console.log('Project: NCR Test Project');
  console.log('\nSubcontractor Admin should be able to:');
  console.log('  - Manage employee roster');
  console.log('  - Manage plant register');
  console.log('  - View assigned work (QM-LOT-001, QM-LOT-002)');
  console.log('  - Submit dockets');
  console.log('  - Respond to NCRs');
  console.log('\nSubcontractor Admin should NOT be able to:');
  console.log('  - See other subcontractors\' data');
  console.log('  - See commercial data');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
