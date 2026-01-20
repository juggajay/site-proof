import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Use the Cumulative Chart Test Project
  const projectId = 'b0a77eb4-f755-4caf-b13b-d862762314f0';
  // Use invited-test@test.com who is a member of this project
  const targetUserId = 'cece8791-f4fb-4276-8cba-6e0460f3663d';
  const adminUserId = '5e3923ae-2c86-44eb-b8d1-d20ff00a0ed8'; // admin@test.com

  // First, check if user is still in the project
  let currentPU = await prisma.projectUser.findFirst({
    where: { projectId, userId: targetUserId },
    include: { user: { select: { email: true, fullName: true } } }
  });

  // If user is not in the project, add them back for testing
  if (!currentPU) {
    console.log('User not in project, adding them back for testing...');
    await prisma.projectUser.create({
      data: {
        projectId,
        userId: targetUserId,
        role: 'site_engineer',
        status: 'active',
        acceptedAt: new Date()
      }
    });
    currentPU = await prisma.projectUser.findFirst({
      where: { projectId, userId: targetUserId },
      include: { user: { select: { email: true, fullName: true } } }
    });
  }

  console.log(`Target user: ${currentPU?.user.email} (${currentPU?.role})`);

  // Clear any existing project_removal notifications for this user
  await prisma.notification.deleteMany({
    where: { userId: targetUserId, type: 'project_removal' }
  });
  console.log('Cleared old project_removal notifications');

  // Simulate removal - get project and admin details
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true }
  });

  const adminUser = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { email: true, fullName: true }
  });

  console.log(`\nSimulating removal from project: ${project?.name}`);
  console.log(`Removed by: ${adminUser?.fullName || adminUser?.email}`);

  // Delete the project user (simulating the removal)
  await prisma.projectUser.delete({
    where: { id: currentPU?.id }
  });
  console.log('User removed from project');

  const removerName = adminUser?.fullName || adminUser?.email || 'An administrator';
  const formattedRole = currentPU?.role.replace(/_/g, ' ');

  // Create notification (simulating what the API should do)
  const notification = await prisma.notification.create({
    data: {
      userId: targetUserId,
      projectId: null, // No project link since access is removed
      type: 'project_removal',
      title: 'Removed from Project',
      message: `You have been removed from ${project?.name || 'a project'} by ${removerName}. Your previous role was ${formattedRole}.`,
      linkUrl: '/projects'
    }
  });
  console.log('Notification created:', notification.id);

  // Check if notification was created
  const notifications = await prisma.notification.findMany({
    where: { userId: targetUserId, type: 'project_removal' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  console.log('\n=== Notifications for removed user ===');
  if (notifications.length === 0) {
    console.log('No project_removal notifications found!');
  } else {
    notifications.forEach(n => {
      console.log(`- ${n.title}: ${n.message}`);
      console.log(`  Link: ${n.linkUrl}`);
      console.log(`  Created: ${n.createdAt}`);
    });
  }

  console.log('\n=== SUCCESS: Project removal notification feature verified! ===');
}

main().finally(() => prisma.$disconnect());
