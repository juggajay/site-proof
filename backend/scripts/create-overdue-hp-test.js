// Script to create an overdue HP for testing
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find a lot with an ITP instance
  const lot = await prisma.lot.findFirst({
    where: {
      itpInstance: { isNot: null }
    },
    include: {
      itpInstance: {
        include: {
          template: {
            include: {
              checklistItems: {
                where: { pointType: 'hold_point' }
              }
            }
          }
        }
      }
    }
  });

  if (!lot || !lot.itpInstance) {
    console.log('No lot with ITP instance found');
    return;
  }

  const hpItem = lot.itpInstance.template.checklistItems[0];
  if (!hpItem) {
    console.log('No hold point item found in template');
    return;
  }

  // Check if HP already exists
  let hp = await prisma.holdPoint.findFirst({
    where: {
      lotId: lot.id,
      itpChecklistItemId: hpItem.id
    }
  });

  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() - 5); // 5 days in the past

  if (hp) {
    // Update existing HP to be overdue
    hp = await prisma.holdPoint.update({
      where: { id: hp.id },
      data: {
        status: 'notified',
        notificationSentAt: tenDaysAgo,
        scheduledDate: scheduledDate,
        releasedAt: null,
        releasedByName: null,
        releasedByOrg: null,
        releaseMethod: null,
        releaseNotes: null
      }
    });
    console.log('Updated HP to overdue status:', hp.id);
  } else {
    // Create new HP
    hp = await prisma.holdPoint.create({
      data: {
        lotId: lot.id,
        itpChecklistItemId: hpItem.id,
        status: 'notified',
        notificationSentAt: tenDaysAgo,
        scheduledDate: scheduledDate
      }
    });
    console.log('Created overdue HP:', hp.id);
  }

  console.log('---');
  console.log('Lot:', lot.lotNumber);
  console.log('HP Status:', hp.status);
  console.log('Notified At:', hp.notificationSentAt);
  console.log('Scheduled Date:', hp.scheduledDate);
  console.log('Is Overdue: Yes (scheduled date is in the past)');
  console.log('\nProject ID:', lot.projectId);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
