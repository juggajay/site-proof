import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectId = 'b0a77eb4-f755-4caf-b13b-d862762314f0'; // Cumulative Chart Test Project

  console.log('=== Testing Missing Diary Alert Notification (Feature #937) ===\n');

  // Get yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const yesterdayString = yesterday.toISOString().split('T')[0];

  console.log(`Checking for diaries missing from: ${yesterdayString}\n`);

  // Check for PMs and admins in the project
  console.log('1. Looking for project managers and admins...');
  const projectUsers = await prisma.projectUser.findMany({
    where: {
      projectId,
      role: { in: ['project_manager', 'admin', 'owner'] },
      status: { in: ['active', 'accepted'] }
    },
    include: {
      user: {
        select: { id: true, email: true, fullName: true }
      }
    }
  });
  console.log(`   Found ${projectUsers.length} eligible user(s)`);
  projectUsers.forEach(pu => {
    console.log(`   - ${pu.user.email} (${pu.role})`);
  });
  console.log('');

  // Check if diary exists for yesterday
  console.log('2. Checking if diary exists for yesterday...');
  const existingDiary = await prisma.dailyDiary.findFirst({
    where: {
      projectId,
      date: {
        gte: yesterday,
        lt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000)
      }
    }
  });

  if (existingDiary) {
    console.log(`   Diary exists for yesterday (ID: ${existingDiary.id})`);
    console.log('   Deleting diary to simulate missing diary 24+ hours...');
    await prisma.dailyDiary.delete({ where: { id: existingDiary.id } });
    console.log('   Deleted.\n');
  } else {
    console.log('   No diary exists for yesterday - simulating 24+ hours overdue.\n');
  }

  // Clear existing missing diary alerts
  console.log('3. Clearing old diary_missing_alert notifications...');
  await prisma.notification.deleteMany({
    where: { type: 'diary_missing_alert' }
  });
  console.log('   Done.\n');

  // Get project info
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true }
  });

  // Create alert notifications (simulating what the API does)
  console.log('4. Creating missing diary alert notifications...');

  const userIds = projectUsers.map(pu => pu.userId);
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, fullName: true }
      })
    : [];

  const alertsToCreate = users.map(user => ({
    userId: user.id,
    projectId: project.id,
    type: 'diary_missing_alert',
    title: 'Missing Diary Alert',
    message: `ALERT: No daily diary entry was completed for ${project.name} on ${yesterdayString}. This is more than 24 hours overdue.`,
    linkUrl: `/projects/${project.id}/diary`
  }));

  if (alertsToCreate.length > 0) {
    await prisma.notification.createMany({
      data: alertsToCreate
    });
    console.log(`   Created ${alertsToCreate.length} alert notification(s)!\n`);
  } else {
    console.log('   No users to alert.\n');
  }

  // Verify notifications
  console.log('=== Created Alert Notifications ===');
  const notifications = await prisma.notification.findMany({
    where: { type: 'diary_missing_alert' },
    orderBy: { createdAt: 'desc' }
  });
  notifications.forEach(n => {
    console.log(`  Title: ${n.title}`);
    console.log(`  Message: ${n.message}`);
    console.log(`  User ID: ${n.userId}`);
    console.log('');
  });

  // Get user info for testing
  if (users.length > 0) {
    console.log('=== To Verify: Log in as ===');
    users.forEach(user => {
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: password123`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
