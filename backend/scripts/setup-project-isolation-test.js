// Setup test data for project isolation test
// Creates two projects in the same company, assigns a user to only one
// Run with: node scripts/setup-project-isolation-test.js

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Password hashing - must match auth.ts exactly
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  console.log('Setting up project isolation test data...');
  console.log('');

  // Create or get a test company
  let company = await prisma.company.findFirst({
    where: { name: 'Isolation Test Company' }
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Isolation Test Company',
        abn: '11222333444',
      }
    });
    console.log('✅ Created company:', company.name);
  } else {
    console.log('✅ Using existing company:', company.name);
  }

  // Create two users in this company
  const passwordHash = hashPassword('password123');

  // User A - will be assigned to Project A only
  let userA = await prisma.user.findFirst({
    where: { email: 'isolation-user-a@test.com' }
  });

  if (!userA) {
    userA = await prisma.user.create({
      data: {
        email: 'isolation-user-a@test.com',
        passwordHash,
        fullName: 'User A (Project A only)',
        roleInCompany: 'member',
        companyId: company.id,
      }
    });
    console.log('✅ Created user:', userA.email);
  } else {
    // Update password hash to ensure it's correct
    userA = await prisma.user.update({
      where: { id: userA.id },
      data: { passwordHash }
    });
    console.log('✅ Updated existing user:', userA.email);
  }

  // User B - will be assigned to both projects (for comparison)
  let userB = await prisma.user.findFirst({
    where: { email: 'isolation-user-b@test.com' }
  });

  if (!userB) {
    userB = await prisma.user.create({
      data: {
        email: 'isolation-user-b@test.com',
        passwordHash,
        fullName: 'User B (Both projects)',
        roleInCompany: 'admin', // Admin can see all company projects
        companyId: company.id,
      }
    });
    console.log('✅ Created user:', userB.email);
  } else {
    // Update password hash to ensure it's correct
    userB = await prisma.user.update({
      where: { id: userB.id },
      data: { passwordHash }
    });
    console.log('✅ Updated existing user:', userB.email);
  }

  // Create Project A
  let projectA = await prisma.project.findFirst({
    where: { name: 'Isolation Test Project A', companyId: company.id }
  });

  if (!projectA) {
    projectA = await prisma.project.create({
      data: {
        name: 'Isolation Test Project A',
        projectNumber: 'ISO-A-001',
        companyId: company.id,
        status: 'active',
        state: 'QLD',
        specificationSet: 'MRTS',
      }
    });
    console.log('✅ Created project:', projectA.name);
  } else {
    console.log('✅ Using existing project:', projectA.name);
  }

  // Create Project B
  let projectB = await prisma.project.findFirst({
    where: { name: 'Isolation Test Project B', companyId: company.id }
  });

  if (!projectB) {
    projectB = await prisma.project.create({
      data: {
        name: 'Isolation Test Project B',
        projectNumber: 'ISO-B-001',
        companyId: company.id,
        status: 'active',
        state: 'QLD',
        specificationSet: 'MRTS',
      }
    });
    console.log('✅ Created project:', projectB.name);
  } else {
    console.log('✅ Using existing project:', projectB.name);
  }

  // Assign User A to ONLY Project A
  const existingAssignmentA = await prisma.projectUser.findFirst({
    where: { userId: userA.id, projectId: projectA.id }
  });

  if (!existingAssignmentA) {
    await prisma.projectUser.create({
      data: {
        userId: userA.id,
        projectId: projectA.id,
        role: 'member',
        status: 'active',
        acceptedAt: new Date(),
      }
    });
    console.log('✅ Assigned User A to Project A');
  }

  // Make sure User A is NOT on Project B (delete if exists)
  await prisma.projectUser.deleteMany({
    where: { userId: userA.id, projectId: projectB.id }
  });
  console.log('✅ Ensured User A is NOT on Project B');

  // Assign User B to BOTH projects
  const existingAssignmentBA = await prisma.projectUser.findFirst({
    where: { userId: userB.id, projectId: projectA.id }
  });

  if (!existingAssignmentBA) {
    await prisma.projectUser.create({
      data: {
        userId: userB.id,
        projectId: projectA.id,
        role: 'admin',
        status: 'active',
        acceptedAt: new Date(),
      }
    });
    console.log('✅ Assigned User B to Project A');
  }

  const existingAssignmentBB = await prisma.projectUser.findFirst({
    where: { userId: userB.id, projectId: projectB.id }
  });

  if (!existingAssignmentBB) {
    await prisma.projectUser.create({
      data: {
        userId: userB.id,
        projectId: projectB.id,
        role: 'admin',
        status: 'active',
        acceptedAt: new Date(),
      }
    });
    console.log('✅ Assigned User B to Project B');
  }

  console.log('');
  console.log('========================================');
  console.log('TEST DATA SETUP COMPLETE');
  console.log('========================================');
  console.log('');
  console.log('Company:', company.name, '(', company.id, ')');
  console.log('');
  console.log('User A: isolation-user-a@test.com');
  console.log('  - Role: member');
  console.log('  - Assigned to: Project A ONLY');
  console.log('');
  console.log('User B: isolation-user-b@test.com');
  console.log('  - Role: admin');
  console.log('  - Assigned to: BOTH Project A and Project B');
  console.log('');
  console.log('Projects:');
  console.log('  - Project A:', projectA.id);
  console.log('  - Project B:', projectB.id);
  console.log('');
  console.log('Password for both users: password123');
  console.log('');
  console.log('Expected behavior:');
  console.log('  - User A should only see Project A');
  console.log('  - User A should get 403 when accessing Project B directly');
  console.log('  - User B (admin) should see BOTH projects');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
