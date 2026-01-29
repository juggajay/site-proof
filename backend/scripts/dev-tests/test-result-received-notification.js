import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectId = 'b0a77eb4-f755-4caf-b13b-d862762314f0'; // Cumulative Chart Test Project

  console.log('=== Testing Test Result Received Notification ===\n');

  // Check for site engineers in the project
  console.log('1. Looking for site engineers in project...');
  const siteEngineers = await prisma.projectUser.findMany({
    where: {
      projectId,
      role: 'site_engineer',
      status: { in: ['active', 'accepted'] }
    },
    include: {
      user: {
        select: { id: true, email: true, fullName: true }
      }
    }
  });
  console.log(`   Found ${siteEngineers.length} site engineer(s)`);

  if (siteEngineers.length === 0) {
    // Create a site engineer for testing
    console.log('   Creating test site engineer...');

    // First check if user exists
    let siteEngineerUser = await prisma.user.findUnique({
      where: { email: 'site-engineer@test.com' }
    });

    if (!siteEngineerUser) {
      // Create the user with proper password hash
      const crypto = await import('crypto');
      const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
      const passwordHash = crypto.createHash('sha256').update('password123' + JWT_SECRET).digest('hex');

      siteEngineerUser = await prisma.user.create({
        data: {
          email: 'site-engineer@test.com',
          fullName: 'Test Site Engineer',
          passwordHash,
          roleInCompany: 'site_engineer'
        }
      });
      console.log(`   Created user: ${siteEngineerUser.email}`);
    }

    // Create project user
    await prisma.projectUser.create({
      data: {
        projectId,
        userId: siteEngineerUser.id,
        role: 'site_engineer',
        status: 'active'
      }
    });
    console.log(`   Added site engineer to project\n`);
  } else {
    siteEngineers.forEach(se => {
      console.log(`   - ${se.user.email} (${se.user.fullName || 'No name'})`);
    });
    console.log('');
  }

  // Get or create a test result
  console.log('2. Looking for a test result to use...');
  let testResult = await prisma.testResult.findFirst({
    where: { projectId },
    include: {
      lot: { select: { lotNumber: true } }
    }
  });

  if (!testResult) {
    console.log('   Creating a test result...');
    testResult = await prisma.testResult.create({
      data: {
        projectId,
        testType: 'Compaction Test',
        testRequestNumber: 'TR-2026-001',
        laboratoryName: 'ABC Testing Labs',
        status: 'at_lab', // Start at 'at_lab' so we can transition to 'results_received'
        sampleDate: new Date(),
        sampleLocation: 'CH 1500+00'
      },
      include: {
        lot: { select: { lotNumber: true } }
      }
    });
    console.log(`   Created test result: ${testResult.id}`);
  } else {
    console.log(`   Found test result: ${testResult.id}`);
    console.log(`   Current status: ${testResult.status}`);
  }
  console.log('');

  // If status is not 'at_lab', reset it
  if (testResult.status !== 'at_lab') {
    console.log('3. Resetting test result to at_lab status...');
    await prisma.testResult.update({
      where: { id: testResult.id },
      data: { status: 'at_lab' }
    });
    console.log('   Done.\n');
  } else {
    console.log('3. Test result already at at_lab status\n');
  }

  // Delete any existing test_result_received notifications
  console.log('4. Clearing old test_result_received notifications...');
  await prisma.notification.deleteMany({
    where: { type: 'test_result_received' }
  });
  console.log('   Done.\n');

  // Simulate the status transition to results_received
  console.log('5. Transitioning to results_received status...');

  const updatedTest = await prisma.testResult.update({
    where: { id: testResult.id },
    data: {
      status: 'results_received',
      resultValue: 97.5,
      resultUnit: '% MDD',
      resultDate: new Date(),
      laboratoryReportNumber: 'LAB-2026-0042'
    }
  });
  console.log(`   Status: ${updatedTest.status}`);
  console.log(`   Result: ${updatedTest.resultValue} ${updatedTest.resultUnit}\n`);

  // Now manually create the notification (simulating what the API would do)
  console.log('6. Creating notifications for site engineers...');

  // Refresh site engineers list
  const currentEngineers = await prisma.projectUser.findMany({
    where: {
      projectId,
      role: 'site_engineer',
      status: { in: ['active', 'accepted'] }
    }
  });

  const engineerUserIds = currentEngineers.map(se => se.userId);
  const engineerUsers = engineerUserIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: engineerUserIds } },
        select: { id: true, email: true, fullName: true }
      })
    : [];

  const labName = updatedTest.laboratoryName || 'laboratory';
  const requestNum = updatedTest.testRequestNumber || updatedTest.id.substring(0, 8).toUpperCase();

  const notificationsToCreate = engineerUsers.map(eng => ({
    userId: eng.id,
    projectId,
    type: 'test_result_received',
    title: 'Test Result Received',
    message: `Test result for ${updatedTest.testType} (${requestNum}) has been received from ${labName}. Pending verification.`,
    linkUrl: `/projects/${projectId}/test-results`
  }));

  if (notificationsToCreate.length > 0) {
    await prisma.notification.createMany({
      data: notificationsToCreate
    });
    console.log(`   Created ${notificationsToCreate.length} notification(s)!\n`);
  } else {
    console.log('   No engineers to notify.\n');
  }

  // Verify notifications
  console.log('=== Created Notifications ===');
  const notifications = await prisma.notification.findMany({
    where: { type: 'test_result_received' },
    orderBy: { createdAt: 'desc' }
  });
  notifications.forEach(n => {
    console.log(`  Title: ${n.title}`);
    console.log(`  Message: ${n.message}`);
    console.log(`  User ID: ${n.userId}`);
    console.log('');
  });

  // Get engineer info for testing
  if (engineerUsers.length > 0) {
    console.log('=== To Verify: Log in as ===');
    engineerUsers.forEach(eng => {
      console.log(`  Email: ${eng.email}`);
      console.log(`  Password: password123`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
