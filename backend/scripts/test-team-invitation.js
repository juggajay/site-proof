import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectId = 'b0a77eb4-f755-4caf-b13b-d862762314f0'; // Cumulative Chart Test Project

  console.log('=== Testing Team Invitation Notification (Feature #939) ===\n');

  // Get project details
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, projectNumber: true }
  });
  console.log(`Project: ${project.name} (${project.projectNumber})\n`);

  // Get current admin user (inviter)
  const inviter = await prisma.user.findUnique({
    where: { email: 'admin@test.com' },
    select: { id: true, email: true, fullName: true }
  });
  console.log(`Inviter: ${inviter.fullName || inviter.email}\n`);

  // Create or find a test user to invite
  console.log('1. Finding/creating test user to invite...');
  let invitedUser = await prisma.user.findUnique({
    where: { email: 'invited-test@test.com' }
  });

  if (!invitedUser) {
    const crypto = await import('crypto');
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    const passwordHash = crypto.createHash('sha256').update('password123' + JWT_SECRET).digest('hex');

    invitedUser = await prisma.user.create({
      data: {
        email: 'invited-test@test.com',
        fullName: 'Invited Test User',
        passwordHash,
        roleInCompany: 'employee'
      }
    });
    console.log(`   Created user: ${invitedUser.email}\n`);
  } else {
    console.log(`   Found user: ${invitedUser.email}\n`);
  }

  // Remove user from project if already a member
  await prisma.projectUser.deleteMany({
    where: {
      projectId,
      userId: invitedUser.id
    }
  });

  // Clear existing team_invitation notifications for this user
  console.log('2. Clearing old team_invitation notifications...');
  await prisma.notification.deleteMany({
    where: {
      userId: invitedUser.id,
      type: 'team_invitation'
    }
  });
  console.log('   Done.\n');

  // Simulate the invitation notification (what the API does)
  console.log('3. Creating team invitation notification...');

  const inviterName = inviter.fullName || inviter.email || 'A team member';
  const role = 'site_engineer';

  await prisma.notification.create({
    data: {
      userId: invitedUser.id,
      projectId,
      type: 'team_invitation',
      title: 'Team Invitation',
      message: `${inviterName} has invited you to join ${project.name} as ${role.replace('_', ' ')}.`,
      linkUrl: `/projects/${projectId}`
    }
  });
  console.log('   Created notification!\n');

  // Also create the project user (simulating the full invite flow)
  console.log('4. Adding user to project...');
  await prisma.projectUser.create({
    data: {
      projectId,
      userId: invitedUser.id,
      role,
      status: 'active',
      acceptedAt: new Date()
    }
  });
  console.log('   User added to project.\n');

  // Verify notifications
  console.log('=== Created Notifications ===');
  const notifications = await prisma.notification.findMany({
    where: {
      userId: invitedUser.id,
      type: 'team_invitation'
    },
    orderBy: { createdAt: 'desc' }
  });
  notifications.forEach(n => {
    console.log(`  Title: ${n.title}`);
    console.log(`  Message: ${n.message}`);
    console.log(`  Link: ${n.linkUrl}`);
    console.log('');
  });

  console.log('=== To Verify: Log in as ===');
  console.log(`  Email: ${invitedUser.email}`);
  console.log(`  Password: password123`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
