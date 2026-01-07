// Setup lots for existing subcontractor users
// Uses the existing companyId values from the database
// Run with: node scripts/setup-subcontractor-lots.js

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Password hashing - must match auth.ts exactly
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  console.log('Setting up lots for subcontractor isolation test...');
  console.log('');

  // Get existing subcontractor users
  const subA = await prisma.user.findFirst({ where: { email: 'subcontractorA@test.com' } });
  const subB = await prisma.user.findFirst({ where: { email: 'subcontractorB@test.com' } });

  if (!subA || !subB) {
    console.log('❌ Subcontractor users not found. Please seed the database first.');
    return;
  }

  console.log('Found subcontractor users:');
  console.log('  - subcontractorA@test.com, companyId:', subA.companyId);
  console.log('  - subcontractorB@test.com, companyId:', subB.companyId);
  console.log('');

  // Update passwords for subcontractor users
  const passwordHash = hashPassword('password123');
  await prisma.user.update({ where: { id: subA.id }, data: { passwordHash } });
  await prisma.user.update({ where: { id: subB.id }, data: { passwordHash } });
  console.log('✅ Updated passwords for subcontractor users');

  // Get or create project
  let project = await prisma.project.findFirst({ where: { name: 'Subcontractor Test Project' } });

  if (!project) {
    // Get or create head contractor company
    let company = await prisma.company.findFirst({ where: { name: 'Head Contractor Company' } });
    if (!company) {
      company = await prisma.company.create({
        data: { name: 'Head Contractor Company', abn: '99888777666' }
      });
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

  // Add subcontractor users to project
  const existingPUA = await prisma.projectUser.findFirst({ where: { userId: subA.id, projectId: project.id } });
  if (!existingPUA) {
    await prisma.projectUser.create({
      data: { userId: subA.id, projectId: project.id, role: 'subcontractor', status: 'active', acceptedAt: new Date() }
    });
    console.log('✅ Added subcontractorA to project');
  }

  const existingPUB = await prisma.projectUser.findFirst({ where: { userId: subB.id, projectId: project.id } });
  if (!existingPUB) {
    await prisma.projectUser.create({
      data: { userId: subB.id, projectId: project.id, role: 'subcontractor', status: 'active', acceptedAt: new Date() }
    });
    console.log('✅ Added subcontractorB to project');
  }

  // Create lots assigned to Subcontractor A (using their companyId as assignedSubcontractorId)
  const lotsA = [
    { lotNumber: 'SUB-A-001', description: 'Lot for Subcontractor A', activityType: 'Excavation' },
    { lotNumber: 'SUB-A-002', description: 'Another lot for Subcontractor A', activityType: 'Compaction' },
  ];

  for (const lotData of lotsA) {
    const existing = await prisma.lot.findFirst({ where: { lotNumber: lotData.lotNumber, projectId: project.id } });
    if (!existing) {
      await prisma.lot.create({
        data: {
          projectId: project.id,
          lotNumber: lotData.lotNumber,
          lotType: 'earthworks',
          description: lotData.description,
          activityType: lotData.activityType,
          assignedSubcontractorId: subA.companyId, // Use subcontractorA's companyId
          status: 'in_progress',
        }
      });
      console.log('✅ Created lot:', lotData.lotNumber, '-> Subcontractor A');
    } else {
      // Update the assignedSubcontractorId if needed
      if (existing.assignedSubcontractorId !== subA.companyId) {
        await prisma.lot.update({
          where: { id: existing.id },
          data: { assignedSubcontractorId: subA.companyId }
        });
        console.log('✅ Updated lot:', lotData.lotNumber, '-> Subcontractor A');
      } else {
        console.log('✅ Using existing lot:', lotData.lotNumber);
      }
    }
  }

  // Create lots assigned to Subcontractor B
  const lotsB = [
    { lotNumber: 'SUB-B-001', description: 'Lot for Subcontractor B', activityType: 'Concrete Pour' },
  ];

  for (const lotData of lotsB) {
    const existing = await prisma.lot.findFirst({ where: { lotNumber: lotData.lotNumber, projectId: project.id } });
    if (!existing) {
      await prisma.lot.create({
        data: {
          projectId: project.id,
          lotNumber: lotData.lotNumber,
          lotType: 'concrete',
          description: lotData.description,
          activityType: lotData.activityType,
          assignedSubcontractorId: subB.companyId, // Use subcontractorB's companyId
          status: 'in_progress',
        }
      });
      console.log('✅ Created lot:', lotData.lotNumber, '-> Subcontractor B');
    } else {
      if (existing.assignedSubcontractorId !== subB.companyId) {
        await prisma.lot.update({
          where: { id: existing.id },
          data: { assignedSubcontractorId: subB.companyId }
        });
        console.log('✅ Updated lot:', lotData.lotNumber, '-> Subcontractor B');
      } else {
        console.log('✅ Using existing lot:', lotData.lotNumber);
      }
    }
  }

  // Create unassigned lot (head contractor only)
  const unassignedLot = await prisma.lot.findFirst({ where: { lotNumber: 'HC-001', projectId: project.id } });
  if (!unassignedLot) {
    await prisma.lot.create({
      data: {
        projectId: project.id,
        lotNumber: 'HC-001',
        lotType: 'general',
        description: 'Head Contractor Only Lot',
        activityType: 'Survey',
        assignedSubcontractorId: null,
        status: 'not_started',
      }
    });
    console.log('✅ Created lot: HC-001 -> Unassigned (Head Contractor)');
  } else {
    console.log('✅ Using existing lot: HC-001');
  }

  console.log('');
  console.log('========================================');
  console.log('SETUP COMPLETE');
  console.log('========================================');
  console.log('');
  console.log('Project:', project.name, '(', project.id, ')');
  console.log('');
  console.log('Subcontractor A:', subA.email);
  console.log('  - companyId:', subA.companyId);
  console.log('  - Lots: SUB-A-001, SUB-A-002');
  console.log('');
  console.log('Subcontractor B:', subB.email);
  console.log('  - companyId:', subB.companyId);
  console.log('  - Lots: SUB-B-001');
  console.log('');
  console.log('Unassigned: HC-001 (head contractor only)');
  console.log('');
  console.log('Password: password123');
  console.log('');
  console.log('Expected behavior:');
  console.log('  - SubA should see: SUB-A-001, SUB-A-002');
  console.log('  - SubB should see: SUB-B-001');
  console.log('  - Neither should see HC-001 or each other\'s lots');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
