import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const targetUserId = '446f1667-8f95-4f98-9557-27c7c9e9e309'; // site-engineer@test.com

  // Get all notifications for this user
  const notifications = await prisma.notification.findMany({
    where: { userId: targetUserId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      project: { select: { name: true } }
    }
  });

  console.log(`=== Notifications for site-engineer@test.com (${targetUserId}) ===`);
  console.log(`Found ${notifications.length} notifications:\n`);

  notifications.forEach((n, i) => {
    console.log(`${i + 1}. Type: ${n.type}`);
    console.log(`   Title: ${n.title}`);
    console.log(`   Message: ${n.message}`);
    console.log(`   Project: ${n.project?.name || 'N/A'}`);
    console.log(`   Link: ${n.linkUrl}`);
    console.log(`   Read: ${n.isRead}`);
    console.log(`   Created: ${n.createdAt}`);
    console.log('');
  });
}

main().finally(() => prisma.$disconnect());
