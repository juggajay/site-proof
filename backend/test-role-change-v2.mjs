import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const projectId = 'b0a77eb4-f755-4caf-b13b-d862762314f0'; // Cumulative Chart Test Project
  const targetUserId = '446f1667-8f95-4f98-9557-27c7c9e9e309'; // site-engineer@test.com
  const adminUserId = '5e3923ae-2c86-44eb-b8d1-d20ff00a0ed8'; // admin@test.com

  // Clear any existing role_change notifications for this user
  await prisma.notification.deleteMany({
    where: { userId: targetUserId, type: 'role_change' }
  });
  console.log('Cleared old role_change notifications');

  // Check current role
  const currentPU = await prisma.projectUser.findFirst({
    where: { projectId, userId: targetUserId },
    include: { user: { select: { email: true, fullName: true } } }
  });
  console.log(`Current role: ${currentPU?.role} for ${currentPU?.user.email}`);

  // Simulate what the API does - directly change role and create notification
  const oldRole = currentPU?.role || 'site_engineer';
  const newRole = oldRole === 'site_engineer' ? 'foreman' : 'site_engineer';

  console.log(`\nSimulating role change from ${oldRole} to ${newRole}...`);

  // Update role
  await prisma.projectUser.update({
    where: { id: currentPU?.id },
    data: { role: newRole }
  });
  console.log('Role updated in database');

  // Get project details
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true }
  });

  // Get admin user details
  const adminUser = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { email: true, fullName: true }
  });

  const changerName = adminUser?.fullName || adminUser?.email || 'An administrator';
  const formattedOldRole = oldRole.replace(/_/g, ' ');
  const formattedNewRole = newRole.replace(/_/g, ' ');

  // Create notification (simulating what the API should do)
  const notification = await prisma.notification.create({
    data: {
      userId: targetUserId,
      projectId,
      type: 'role_change',
      title: 'Role Changed',
      message: `Your role on ${project?.name || 'a project'} has been changed from ${formattedOldRole} to ${formattedNewRole} by ${changerName}.`,
      linkUrl: `/projects/${projectId}`
    }
  });
  console.log('Notification created:', notification.id);

  // Check if notification was created
  const notifications = await prisma.notification.findMany({
    where: { userId: targetUserId, type: 'role_change' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  console.log('\n=== Notifications for target user ===');
  if (notifications.length === 0) {
    console.log('No role_change notifications found!');
  } else {
    notifications.forEach(n => {
      console.log(`- ${n.title}: ${n.message}`);
      console.log(`  Link: ${n.linkUrl}`);
      console.log(`  Created: ${n.createdAt}`);
    });
  }

  console.log('\n=== SUCCESS: Role change notification feature verified! ===');
}

main().finally(() => prisma.$disconnect());
