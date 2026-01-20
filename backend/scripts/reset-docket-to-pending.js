import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const docketId = '25759103-f303-42a8-a908-d994930982c8';

  // Reset the docket to pending_approval status
  const updatedDocket = await prisma.dailyDocket.update({
    where: { id: docketId },
    data: {
      status: 'pending_approval',
      approvedById: null,
      approvedAt: null,
      foremanNotes: null,
      adjustmentReason: null,
      totalLabourApproved: null,
      totalPlantApproved: null,
    }
  });

  console.log('Docket reset to pending_approval:');
  console.log(`  ID: ${updatedDocket.id}`);
  console.log(`  Status: ${updatedDocket.status}`);

  // Delete any existing notifications for this docket to start fresh
  const deletedNotifs = await prisma.notification.deleteMany({
    where: {
      OR: [
        { type: 'docket_approved' },
        { type: 'docket_rejected' }
      ]
    }
  });
  console.log(`\nDeleted ${deletedNotifs.count} docket notifications`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
