import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectId = 'b0a77eb4-f755-4caf-b13b-d862762314f0'; // Cumulative Chart Test Project

  console.log('=== Testing Daily Diary Reminder Notification ===\n');

  // Get today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateString = today.toISOString().split('T')[0];

  console.log(`Target date: ${dateString}\n`);

  // Check for site engineers/foremen in the project
  console.log('1. Looking for eligible users (site_engineer, foreman, project_manager)...');
  const projectUsers = await prisma.projectUser.findMany({
    where: {
      projectId,
      role: { in: ['site_engineer', 'foreman', 'project_manager'] },
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

  // Check if a diary exists for today
  console.log('2. Checking if diary exists for today...');
  const existingDiary = await prisma.dailyDiary.findFirst({
    where: {
      projectId,
      date: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    }
  });

  if (existingDiary) {
    console.log(`   Diary exists for today (ID: ${existingDiary.id})`);
    console.log('   Deleting diary to simulate missing diary...');
    await prisma.dailyDiary.delete({ where: { id: existingDiary.id } });
    console.log('   Deleted.\n');
  } else {
    console.log('   No diary exists for today.\n');
  }

  // Clear existing diary reminders
  console.log('3. Clearing old diary_reminder notifications...');
  await prisma.notification.deleteMany({
    where: { type: 'diary_reminder' }
  });
  console.log('   Done.\n');

  // Get project info
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true }
  });

  // Manually create the reminder notifications (simulating what the API does)
  console.log('4. Creating diary reminder notifications...');

  const userIds = projectUsers.map(pu => pu.userId);
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, fullName: true }
      })
    : [];

  const notificationsToCreate = users.map(user => ({
    userId: user.id,
    projectId: project.id,
    type: 'diary_reminder',
    title: 'Daily Diary Reminder',
    message: `No daily diary entry found for ${project.name} on ${dateString}. Please complete your site diary.`,
    linkUrl: `/projects/${project.id}/diary`
  }));

  if (notificationsToCreate.length > 0) {
    await prisma.notification.createMany({
      data: notificationsToCreate
    });
    console.log(`   Created ${notificationsToCreate.length} notification(s)!\n`);
  } else {
    console.log('   No users to notify.\n');
  }

  // Verify notifications
  console.log('=== Created Notifications ===');
  const notifications = await prisma.notification.findMany({
    where: { type: 'diary_reminder' },
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
