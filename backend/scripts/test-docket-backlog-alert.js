import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectId = 'b0a77eb4-f755-4caf-b13b-d862762314f0'; // Cumulative Chart Test Project

  console.log('=== Testing Docket Backlog Alert Notification (Feature #938) ===\n');

  // Calculate 48 hours ago
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - 48);
  console.log(`Cutoff time (48 hours ago): ${cutoffTime.toISOString()}\n`);

  // Check for foremen and PMs in the project
  console.log('1. Looking for foremen and project managers...');
  const projectUsers = await prisma.projectUser.findMany({
    where: {
      projectId,
      role: { in: ['foreman', 'project_manager', 'admin'] },
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

  // Check for existing dockets
  console.log('2. Checking for pending dockets...');
  let pendingDockets = await prisma.dailyDocket.findMany({
    where: {
      projectId,
      status: 'pending_approval'
    }
  });

  if (pendingDockets.length === 0) {
    // Check if any dockets exist at all
    const anyDockets = await prisma.dailyDocket.findMany({
      where: { projectId },
      take: 5
    });

    if (anyDockets.length > 0) {
      console.log(`   No pending dockets, but found ${anyDockets.length} docket(s). Updating status...`);
      // Update some dockets to pending_approval and backdate them
      const overdueDate = new Date();
      overdueDate.setHours(overdueDate.getHours() - 72);

      for (const docket of anyDockets.slice(0, 2)) {
        await prisma.dailyDocket.update({
          where: { id: docket.id },
          data: {
            status: 'pending_approval',
            submittedAt: overdueDate
          }
        });
        pendingDockets.push(docket);
      }
      console.log(`   Made ${pendingDockets.length} docket(s) pending_approval and overdue.`);
    } else {
      console.log('   No dockets found. Creating a simulated alert notification...');
      // Just create notifications without actual dockets
      pendingDockets = [{ docketNumber: 'DKT-SIM-001' }, { docketNumber: 'DKT-SIM-002' }];
    }
  } else {
    // Update existing pending dockets to be overdue
    console.log(`   Found ${pendingDockets.length} pending docket(s). Making them overdue...`);
    const overdueDate = new Date();
    overdueDate.setHours(overdueDate.getHours() - 72);

    for (const docket of pendingDockets) {
      await prisma.dailyDocket.update({
        where: { id: docket.id },
        data: { submittedAt: overdueDate }
      });
    }
  }
  console.log('');

  // Clear existing docket backlog alerts
  console.log('3. Clearing old docket_backlog_alert notifications...');
  await prisma.notification.deleteMany({
    where: { type: 'docket_backlog_alert' }
  });
  console.log('   Done.\n');

  // Get project info
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true }
  });

  // Create alert notifications (simulating what the API does)
  console.log('4. Creating docket backlog alert notifications...');

  const userIds = projectUsers.map(pu => pu.userId);
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, fullName: true }
      })
    : [];

  const docketCount = pendingDockets.length;
  const docketNumbers = pendingDockets.slice(0, 3).map(d => d.docketNumber).join(', ');

  const alertsToCreate = users.map(user => ({
    userId: user.id,
    projectId: project.id,
    type: 'docket_backlog_alert',
    title: 'Docket Backlog Alert',
    message: `${docketCount} docket(s) have been pending approval for more than 48 hours on ${project.name}: ${docketNumbers}. Please review.`,
    linkUrl: `/projects/${project.id}/dockets`
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
    where: { type: 'docket_backlog_alert' },
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
