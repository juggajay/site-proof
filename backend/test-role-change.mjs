import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const projectId = 'b0a77eb4-f755-4caf-b13b-d862762314f0'; // Cumulative Chart Test Project
  const targetUserId = '446f1667-8f95-4f98-9557-27c7c9e9e309'; // site-engineer@test.com

  // Clear any existing role_change notifications for this user
  await prisma.notification.deleteMany({
    where: { userId: targetUserId, type: 'role_change' }
  });
  console.log('Cleared old role_change notifications');

  // Check current role
  const currentPU = await prisma.projectUser.findFirst({
    where: { projectId, userId: targetUserId },
    include: { user: { select: { email: true } } }
  });
  console.log(`Current role: ${currentPU?.role} for ${currentPU?.user.email}`);

  // Now let's call the API to change the role
  // First, login to get a token
  const loginRes = await fetch('http://localhost:4006/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'password123' })
  });
  const loginData = await loginRes.json();
  console.log('Login response:', loginData.user?.email ? 'Success' : 'Failed', loginData.error || '');

  if (!loginData.token) {
    console.log('Failed to get token');
    return;
  }

  const token = loginData.token;

  // Change role from site_engineer to foreman
  const newRole = currentPU?.role === 'site_engineer' ? 'foreman' : 'site_engineer';
  console.log(`\nChanging role to: ${newRole}`);

  const changeRes = await fetch(`http://localhost:4006/api/projects/${projectId}/users/${targetUserId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ role: newRole })
  });

  const changeData = await changeRes.json();
  console.log('Change response:', changeRes.status, changeData);

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
}

main().finally(() => prisma.$disconnect());
