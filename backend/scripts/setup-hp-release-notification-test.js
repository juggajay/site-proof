// Setup test data for Feature #925: HP release notification to team
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Setting up HP release notification test data...');

  // Find a project with hold points
  const holdPoint = await prisma.holdPoint.findFirst({
    where: {
      status: 'released' // Find a released one to reset
    },
    include: {
      lot: {
        include: {
          project: true
        }
      }
    }
  });

  if (!holdPoint) {
    console.log('No hold point found, checking for lots with ITPs...');

    // Find a lot with an ITP that has hold point items
    const lotWithHP = await prisma.lot.findFirst({
      where: {
        itpInstance: {
          template: {
            checklistItems: {
              some: { pointType: 'hold_point' }
            }
          }
        }
      },
      include: {
        project: true,
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  where: { pointType: 'hold_point' },
                  take: 1
                }
              }
            }
          }
        },
        holdPoints: true
      }
    });

    if (!lotWithHP) {
      console.error('No lot with hold point template found');
      return;
    }

    console.log(`Found lot with HP template: ${lotWithHP.lotNumber}`);

    const hpItem = lotWithHP.itpInstance?.template?.checklistItems[0];
    if (!hpItem) {
      console.error('No hold point item found');
      return;
    }

    // Check if HP already exists
    let hp = lotWithHP.holdPoints.find(h => h.itpChecklistItemId === hpItem.id);

    if (hp) {
      // Reset to awaiting release
      hp = await prisma.holdPoint.update({
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
      console.log('Reset existing HP to notified status');
    } else {
      // Create new HP
      hp = await prisma.holdPoint.create({
        data: {
          lotId: lotWithHP.id,
          itpChecklistItemId: hpItem.id,
          pointType: 'hold_point',
          description: hpItem.description,
          status: 'notified',
          notificationSentAt: new Date(),
          scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      console.log('Created new HP in notified status');
    }

    console.log(`Hold Point ID: ${hp.id}`);
    console.log(`Project: ${lotWithHP.project.name}`);
    return;
  }

  console.log(`Found released HP on lot: ${holdPoint.lot.lotNumber}`);
  console.log(`Project: ${holdPoint.lot.project.name}`);

  // Reset hold point to awaiting release status
  const updatedHP = await prisma.holdPoint.update({
    where: { id: holdPoint.id },
    data: {
      status: 'notified',
      releasedAt: null,
      releasedByName: null,
      releasedByOrg: null,
      releaseMethod: null,
      releaseNotes: null
    }
  });

  console.log(`Reset HP to 'notified' status`);
  console.log(`Hold Point ID: ${updatedHP.id}`);

  // Ensure project has users
  const projectUsers = await prisma.projectUser.findMany({
    where: { projectId: holdPoint.lot.projectId },
    include: { user: true }
  });

  console.log(`\nProject has ${projectUsers.length} team members:`);
  projectUsers.forEach(pu => {
    console.log(`  - ${pu.user.email} (${pu.role})`);
  });

  // Ensure admin user is in project
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@test.com' }
  });

  if (adminUser) {
    const adminInProject = projectUsers.find(pu => pu.userId === adminUser.id);
    if (!adminInProject) {
      await prisma.projectUser.create({
        data: {
          projectId: holdPoint.lot.projectId,
          userId: adminUser.id,
          role: 'admin'
        }
      });
      console.log(`Added admin@test.com to project`);
    }
  }

  // Clear existing HP release notifications
  const deleted = await prisma.notification.deleteMany({
    where: {
      type: 'hold_point_release',
      projectId: holdPoint.lot.projectId
    }
  });
  console.log(`Cleared ${deleted.count} existing HP release notifications`);

  console.log('\n=== Test Data Ready ===');
  console.log(`Project: ${holdPoint.lot.project.name}`);
  console.log(`Lot: ${holdPoint.lot.lotNumber}`);
  console.log(`Hold Point ID: ${updatedHP.id}`);
  console.log(`\nTo test Feature #925:`);
  console.log(`1. Navigate to project "${holdPoint.lot.project.name}" > Hold Points`);
  console.log(`2. Find lot "${holdPoint.lot.lotNumber}" with "Awaiting Release" status`);
  console.log(`3. Click "Record Release" and fill in details`);
  console.log(`4. After submit, check notifications bell - should show "Hold Point Released"`);
  console.log(`5. Check server logs for email notification output`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
