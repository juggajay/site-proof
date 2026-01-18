// Script to create an overdue HP for testing
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find a released hold point
  const hp = await prisma.holdPoint.findFirst({
    where: { status: 'released' },
    include: { lot: true }
  });

  if (!hp) {
    console.log('No released hold points found');
    return;
  }

  console.log('Found HP:', hp.id, 'Lot:', hp.lot.lotNumber);

  // Set scheduled date 5 days in the past (overdue)
  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() - 5);

  // Set notification sent 10 days ago
  const notifiedAt = new Date();
  notifiedAt.setDate(notifiedAt.getDate() - 10);

  // Reset to notified status with overdue scheduled date
  const updated = await prisma.holdPoint.update({
    where: { id: hp.id },
    data: {
      status: 'notified',
      scheduledDate: scheduledDate,
      notificationSentAt: notifiedAt,
      releasedAt: null,
      releasedByName: null,
      releasedByOrg: null,
      releaseMethod: null,
      releaseNotes: null
    }
  });

  console.log('Created overdue HP:', updated.id);
  console.log('Status:', updated.status);
  console.log('Scheduled Date:', updated.scheduledDate, '(5 days ago - OVERDUE)');
  console.log('Notified At:', updated.notificationSentAt);
  console.log('\nProject ID:', hp.lot.projectId);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
