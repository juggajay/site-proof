import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get the site engineer user
  const user = await prisma.user.findUnique({
    where: { email: 'site-engineer@test.com' }
  });

  console.log('User:', user?.id, user?.email);

  if (user) {
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log('\nNotifications for this user:');
    notifications.forEach(n => {
      console.log(`  Type: ${n.type}`);
      console.log(`  Title: ${n.title}`);
      console.log(`  Read: ${n.read}`);
      console.log(`  Created: ${n.createdAt}`);
      console.log('');
    });
  }

  // Also check all diary_reminder notifications
  console.log('\nAll diary_reminder notifications:');
  const diaryNotifications = await prisma.notification.findMany({
    where: { type: 'diary_reminder' }
  });
  diaryNotifications.forEach(n => {
    console.log(`  User ID: ${n.userId}`);
    console.log(`  Message: ${n.message}`);
    console.log('');
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
