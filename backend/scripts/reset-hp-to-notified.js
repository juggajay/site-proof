// Script to reset a hold point to notified status for testing
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

  // Reset to notified status
  const updated = await prisma.holdPoint.update({
    where: { id: hp.id },
    data: {
      status: 'notified',
      releasedAt: null,
      releasedByName: null,
      releasedByOrg: null,
      releaseMethod: null,
      releaseNotes: null
    }
  });

  console.log('Reset HP to notified:', updated.id, updated.status);
  console.log('\nProject ID:', hp.lot.projectId);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
