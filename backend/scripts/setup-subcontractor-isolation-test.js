// Setup test data for subcontractor isolation test
// Creates lots assigned to different subcontractors
// Run with: node scripts/setup-subcontractor-isolation-test.js

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Password hashing - must match auth.ts exactly
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  console.log('Setting up subcontractor isolation test data...');
  console.log('');

  // First create project (needed for subcontractor companies)
  const projectId = await getOrCreateProject();

  // Create or get Subcontractor Company A
  let subcompanyA = await prisma.subcontractorCompany.findFirst({
    where: { companyName: 'Test Subcontractor A', projectId }
  });

  if (!subcompanyA) {
    subcompanyA = await prisma.subcontractorCompany.create({
      data: {
        companyName: 'Test Subcontractor A',
        abn: '55666777888',
        projectId,
        status: 'approved',
      }
    });
    console.log('✅ Created subcontractor company:', subcompanyA.companyName);
  } else {
    console.log('✅ Using existing subcontractor company:', subcompanyA.companyName);
  }

  // Create or get Subcontractor Company B
  let subcompanyB = await prisma.subcontractorCompany.findFirst({
    where: { companyName: 'Test Subcontractor B', projectId }
  });

  if (!subcompanyB) {
    subcompanyB = await prisma.subcontractorCompany.create({
      data: {
        companyName: 'Test Subcontractor B',
        abn: '88999000111',
        projectId,
        status: 'approved',
      }
    });
    console.log('✅ Created subcontractor company:', subcompanyB.companyName);
  } else {
    console.log('✅ Using existing subcontractor company:', subcompanyB.companyName);
  }

  // Create/update users and link them to SubcontractorCompany via SubcontractorUser table
  const passwordHash = hashPassword('password123');

  // Create or update subcontractor user A
  let userA = await prisma.user.findFirst({
    where: { email: 'subcontractorA@test.com' }
  });

  if (userA) {
    userA = await prisma.user.update({
      where: { id: userA.id },
      data: {
        passwordHash,
        roleInCompany: 'subcontractor',
      }
    });
    console.log('✅ Updated user:', userA.email);
  } else {
    userA = await prisma.user.create({
      data: {
        email: 'subcontractorA@test.com',
        passwordHash,
        fullName: 'Subcontractor User A',
        roleInCompany: 'subcontractor',
      }
    });
    console.log('✅ Created user:', userA.email);
  }

  // Link user A to SubcontractorCompany A via SubcontractorUser
  const existingSubUserA = await prisma.subcontractorUser.findFirst({
    where: { userId: userA.id, subcontractorCompanyId: subcompanyA.id }
  });
  if (!existingSubUserA) {
    await prisma.subcontractorUser.create({
      data: {
        userId: userA.id,
        subcontractorCompanyId: subcompanyA.id,
        role: 'admin',
      }
    });
    console.log('✅ Linked user A to SubcontractorCompany A');
  }

  // Create or update subcontractor user B
  let userB = await prisma.user.findFirst({
    where: { email: 'subcontractorB@test.com' }
  });

  if (userB) {
    userB = await prisma.user.update({
      where: { id: userB.id },
      data: {
        passwordHash,
        roleInCompany: 'subcontractor',
      }
    });
    console.log('✅ Updated user:', userB.email);
  } else {
    userB = await prisma.user.create({
      data: {
        email: 'subcontractorB@test.com',
        passwordHash,
        fullName: 'Subcontractor User B',
        roleInCompany: 'subcontractor',
      }
    });
    console.log('✅ Created user:', userB.email);
  }

  // Link user B to SubcontractorCompany B via SubcontractorUser
  const existingSubUserB = await prisma.subcontractorUser.findFirst({
    where: { userId: userB.id, subcontractorCompanyId: subcompanyB.id }
  });
  if (!existingSubUserB) {
    await prisma.subcontractorUser.create({
      data: {
        userId: userB.id,
        subcontractorCompanyId: subcompanyB.id,
        role: 'admin',
      }
    });
    console.log('✅ Linked user B to SubcontractorCompany B');
  }

  // Add subcontractor users to project
  const existingAssignmentA = await prisma.projectUser.findFirst({
    where: { userId: userA.id, projectId }
  });
  if (!existingAssignmentA) {
    await prisma.projectUser.create({
      data: {
        userId: userA.id,
        projectId,
        role: 'subcontractor',
        status: 'active',
        acceptedAt: new Date(),
      }
    });
    console.log('✅ Assigned Subcontractor A to project');
  }

  const existingAssignmentB = await prisma.projectUser.findFirst({
    where: { userId: userB.id, projectId }
  });
  if (!existingAssignmentB) {
    await prisma.projectUser.create({
      data: {
        userId: userB.id,
        projectId,
        role: 'subcontractor',
        status: 'active',
        acceptedAt: new Date(),
      }
    });
    console.log('✅ Assigned Subcontractor B to project');
  }

  // Create lots assigned to Subcontractor A
  let lotA1 = await prisma.lot.findFirst({
    where: { lotNumber: 'SUB-A-LOT-001', projectId }
  });

  if (!lotA1) {
    lotA1 = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: 'SUB-A-LOT-001',
        lotType: 'earthworks',
        description: 'Lot assigned to Subcontractor A',
        activityType: 'Excavation',
        assignedSubcontractorId: subcompanyA.id,
        status: 'in_progress',
      }
    });
    console.log('✅ Created lot:', lotA1.lotNumber, 'assigned to Subcontractor A');
  } else {
    console.log('✅ Using existing lot:', lotA1.lotNumber);
  }

  let lotA2 = await prisma.lot.findFirst({
    where: { lotNumber: 'SUB-A-LOT-002', projectId }
  });

  if (!lotA2) {
    lotA2 = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: 'SUB-A-LOT-002',
        lotType: 'earthworks',
        description: 'Another lot assigned to Subcontractor A',
        activityType: 'Compaction',
        assignedSubcontractorId: subcompanyA.id,
        status: 'not_started',
      }
    });
    console.log('✅ Created lot:', lotA2.lotNumber, 'assigned to Subcontractor A');
  } else {
    console.log('✅ Using existing lot:', lotA2.lotNumber);
  }

  // Create lots assigned to Subcontractor B
  let lotB1 = await prisma.lot.findFirst({
    where: { lotNumber: 'SUB-B-LOT-001', projectId }
  });

  if (!lotB1) {
    lotB1 = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: 'SUB-B-LOT-001',
        lotType: 'concrete',
        description: 'Lot assigned to Subcontractor B',
        activityType: 'Pour Concrete',
        assignedSubcontractorId: subcompanyB.id,
        status: 'in_progress',
      }
    });
    console.log('✅ Created lot:', lotB1.lotNumber, 'assigned to Subcontractor B');
  } else {
    console.log('✅ Using existing lot:', lotB1.lotNumber);
  }

  // Create an unassigned lot
  let lotUnassigned = await prisma.lot.findFirst({
    where: { lotNumber: 'UNASSIGNED-LOT-001', projectId }
  });

  if (!lotUnassigned) {
    lotUnassigned = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: 'UNASSIGNED-LOT-001',
        lotType: 'general',
        description: 'Unassigned lot - head contractor only',
        activityType: 'Survey',
        assignedSubcontractorId: null,
        status: 'not_started',
      }
    });
    console.log('✅ Created lot:', lotUnassigned.lotNumber, '(unassigned)');
  } else {
    console.log('✅ Using existing lot:', lotUnassigned.lotNumber);
  }

  console.log('');
  console.log('========================================');
  console.log('TEST DATA SETUP COMPLETE');
  console.log('========================================');
  console.log('');
  console.log('Subcontractor Companies:');
  console.log('  - Test Subcontractor A:', subcompanyA.id);
  console.log('  - Test Subcontractor B:', subcompanyB.id);
  console.log('');
  console.log('Users (linked via SubcontractorUser table):');
  console.log('  - subcontractorA@test.com -> SubcontractorCompany A');
  console.log('  - subcontractorB@test.com -> SubcontractorCompany B');
  console.log('');
  console.log('Project ID:', projectId);
  console.log('');
  console.log('Lots:');
  console.log('  - SUB-A-LOT-001, SUB-A-LOT-002 -> Subcontractor A');
  console.log('  - SUB-B-LOT-001 -> Subcontractor B');
  console.log('  - UNASSIGNED-LOT-001 -> Not assigned (head contractor only)');
  console.log('');
  console.log('Password for all users: password123');
  console.log('');
  console.log('Expected behavior:');
  console.log('  - Subcontractor A should only see SUB-A-LOT-001 and SUB-A-LOT-002');
  console.log('  - Subcontractor B should only see SUB-B-LOT-001');
  console.log('  - Neither should see UNASSIGNED-LOT-001');
  console.log('  - Neither should see the other subcontractor\'s lots');
}

async function getOrCreateProject() {
  // Use or create a project for subcontractor testing
  let project = await prisma.project.findFirst({
    where: { name: 'Subcontractor Test Project' }
  });

  if (!project) {
    // Get or create a company for the project
    let company = await prisma.company.findFirst({
      where: { name: 'Head Contractor Company' }
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: 'Head Contractor Company',
          abn: '99888777666',
        }
      });
      console.log('✅ Created company:', company.name);
    }

    project = await prisma.project.create({
      data: {
        name: 'Subcontractor Test Project',
        projectNumber: 'SUB-TEST-001',
        companyId: company.id,
        status: 'active',
        state: 'QLD',
        specificationSet: 'MRTS',
      }
    });
    console.log('✅ Created project:', project.name);
  } else {
    console.log('✅ Using existing project:', project.name);
  }

  return project.id;
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
