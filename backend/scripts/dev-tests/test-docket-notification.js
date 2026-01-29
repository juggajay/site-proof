import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://localhost:4006';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  console.log('=== Testing Feature #926: Docket Pending Notification to Foreman ===\n');

  // Step 1: Find an existing test project (use first available active project)
  let project = await prisma.project.findFirst({
    where: { status: 'active' },
    include: { company: true }
  });

  if (!project) {
    console.error('No active projects found. Please create a project first.');
    return;
  }
  console.log('Using project:', project.name, '(ID:', project.id, ')');

  // Step 2: Create/update foreman user
  const hashedPassword = hashPassword('password123');
  const foremanUser = await prisma.user.upsert({
    where: { email: 'docket-foreman@test.com' },
    update: { passwordHash: hashedPassword },
    create: {
      email: 'docket-foreman@test.com',
      passwordHash: hashedPassword,
      fullName: 'Docket Test Foreman',
      roleInCompany: 'foreman',
      companyId: project.companyId,
    },
  });

  // Add foreman to project
  await prisma.projectUser.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: foremanUser.id,
      }
    },
    update: { role: 'foreman' },
    create: {
      projectId: project.id,
      userId: foremanUser.id,
      role: 'foreman',
      status: 'active',
    },
  });
  console.log('Foreman user ready:', foremanUser.email);

  // Step 3: Create/update subcontractor company and user
  let subcontractorCompany = await prisma.subcontractorCompany.findFirst({
    where: { projectId: project.id }
  });

  if (!subcontractorCompany) {
    subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        companyName: 'Docket Test Subcontractor',
        abn: '55666777888',
        primaryContactName: 'Sub Contact',
        primaryContactEmail: 'sub@test.com',
        projectId: project.id,
      }
    });
  }
  console.log('Subcontractor company ready:', subcontractorCompany.companyName);

  // Create subcontractor user
  const subUser = await prisma.user.upsert({
    where: { email: 'docket-sub@test.com' },
    update: { passwordHash: hashedPassword },
    create: {
      email: 'docket-sub@test.com',
      passwordHash: hashedPassword,
      fullName: 'Docket Test Subbie',
      roleInCompany: 'subcontractor',
      companyId: project.companyId,
    },
  });

  // Link subcontractor user to subcontractor company
  const existingSubUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId: subUser.id,
      subcontractorCompanyId: subcontractorCompany.id,
    }
  });

  if (!existingSubUser) {
    await prisma.subcontractorUser.create({
      data: {
        userId: subUser.id,
        subcontractorCompanyId: subcontractorCompany.id,
        role: 'worker',
      },
    });
  }
  console.log('Subcontractor user ready:', subUser.email);

  // Step 4: Create a draft docket
  const docket = await prisma.dailyDocket.create({
    data: {
      projectId: project.id,
      subcontractorCompanyId: subcontractorCompany.id,
      date: new Date(),
      status: 'draft',
      notes: 'Test docket for notification feature #926',
      totalLabourSubmitted: 8,
      totalPlantSubmitted: 4,
    }
  });
  console.log('Created draft docket:', docket.id);

  // Step 5: Login as subcontractor and submit the docket
  console.log('\n--- Logging in as subcontractor to submit docket ---');
  const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'docket-sub@test.com', password: 'password123' })
  });
  const loginData = await loginResponse.json();

  if (!loginData.token) {
    console.error('Login failed:', loginData);
    return;
  }
  console.log('Logged in successfully');

  // Submit the docket
  console.log('\n--- Submitting docket for approval ---');
  const submitResponse = await fetch(`${API_URL}/api/dockets/${docket.id}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginData.token}`
    }
  });
  const submitData = await submitResponse.json();
  console.log('Submit response:', JSON.stringify(submitData, null, 2));

  // Step 6: Check if notification was created for foreman
  console.log('\n--- Checking for foreman notifications ---');
  const notifications = await prisma.notification.findMany({
    where: {
      userId: foremanUser.id,
      type: 'docket_pending',
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (notifications.length > 0) {
    console.log(`\n SUCCESS: Found ${notifications.length} docket pending notification(s) for foreman!`);
    notifications.forEach((n, i) => {
      console.log(`\nNotification ${i + 1}:`);
      console.log(`  Title: ${n.title}`);
      console.log(`  Message: ${n.message}`);
      console.log(`  Link: ${n.linkUrl}`);
      console.log(`  Created: ${n.createdAt}`);
    });
  } else {
    console.log('\n FAILED: No docket pending notifications found for foreman');
  }

  // Cleanup the test docket
  console.log('\n--- Cleaning up test data ---');
  await prisma.notification.deleteMany({
    where: { type: 'docket_pending', projectId: project.id }
  });
  await prisma.dailyDocket.delete({ where: { id: docket.id } });
  console.log('Test docket cleaned up');

  console.log('\n=== Test Summary ===');
  console.log('Test Users:');
  console.log('  Foreman: docket-foreman@test.com (password123)');
  console.log('  Subcontractor: docket-sub@test.com (password123)');
  console.log('Project:', project.name);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
