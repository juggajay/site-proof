import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find an HP that is in 'notified' status to test release
  const hp = await prisma.holdPoint.findFirst({
    where: { status: 'notified' },
    include: { lot: { include: { project: true } } }
  });

  if (!hp) {
    console.log('No HP in notified status found. Let me reset one for testing...');

    // Find a released HP to reset
    const releasedHP = await prisma.holdPoint.findFirst({
      where: { status: 'released' },
      include: { lot: true }
    });

    if (releasedHP) {
      await prisma.holdPoint.update({
        where: { id: releasedHP.id },
        data: {
          status: 'notified',
          releasedAt: null,
          releasedByName: null,
          releaseMethod: null,
          releaseNotes: null
        }
      });
      console.log(`Reset HP ${releasedHP.id} to 'notified' status for testing`);
    }
    return;
  }

  console.log('Found HP to test:', {
    id: hp.id,
    lotNumber: hp.lot.lotNumber,
    projectId: hp.lot.projectId,
    projectName: hp.lot.project.name
  });

  // Check project users who would be notified
  const projectUsers = await prisma.projectUser.findMany({
    where: { projectId: hp.lot.projectId },
    include: { user: { select: { id: true, email: true, fullName: true } } }
  });

  console.log('\nProject users who would be notified:', projectUsers.map(pu => ({
    userId: pu.userId,
    email: pu.user.email,
    fullName: pu.user.fullName
  })));

  // Create the notifications manually to test
  const releasedByName = 'Test Release Script';
  const notificationsToCreate = projectUsers.map(pu => ({
    userId: pu.userId,
    projectId: hp.lot.projectId,
    type: 'hold_point_release',
    title: 'Hold Point Released',
    message: `Hold point "${hp.description}" on lot ${hp.lot.lotNumber} has been released by ${releasedByName}.`,
    linkUrl: `/projects/${hp.lot.projectId}/hold-points`
  }));

  console.log('\nNotifications to create:', notificationsToCreate);

  if (notificationsToCreate.length > 0) {
    const result = await prisma.notification.createMany({
      data: notificationsToCreate
    });
    console.log(`\nCreated ${result.count} notifications!`);
  }

  // Verify notifications were created
  const createdNotifications = await prisma.notification.findMany({
    where: { type: 'hold_point_release' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('\nRecently created HP release notifications:', JSON.stringify(createdNotifications, null, 2));
}

main().finally(() => prisma.$disconnect());
