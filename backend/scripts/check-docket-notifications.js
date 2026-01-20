import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Docket Notifications ===\n');

  // Check docket_approved notifications
  const approvedNotifs = await prisma.notification.findMany({
    where: { type: 'docket_approved' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('Docket Approved Notifications:', approvedNotifs.length);
  approvedNotifs.forEach(n => {
    console.log(`  - User: ${n.userId}`);
    console.log(`    Title: ${n.title}`);
    console.log(`    Message: ${n.message}`);
    console.log(`    Created: ${n.createdAt}`);
    console.log('');
  });

  // Check docket_pending notifications
  const pendingNotifs = await prisma.notification.findMany({
    where: { type: 'docket_pending' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('\nDocket Pending Notifications:', pendingNotifs.length);
  pendingNotifs.forEach(n => {
    console.log(`  - User: ${n.userId}`);
    console.log(`    Title: ${n.title}`);
    console.log(`    Message: ${n.message}`);
    console.log(`    Created: ${n.createdAt}`);
    console.log('');
  });

  // Get docket-sub@test.com user
  const subUser = await prisma.user.findFirst({
    where: { email: 'docket-sub@test.com' }
  });
  if (subUser) {
    console.log('\nSubcontractor user:', subUser.email, '(ID:', subUser.id, ')');

    // Check if this user has any notifications
    const userNotifs = await prisma.notification.findMany({
      where: { userId: subUser.id },
      orderBy: { createdAt: 'desc' }
    });
    console.log('All notifications for subcontractor:', userNotifs.length);
    userNotifs.forEach(n => {
      console.log(`  - Type: ${n.type}, Title: ${n.title}`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
