import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // The project we were testing on
  const projectId = 'cb950c13-368c-4e33-afb9-27e79fd90dcd';

  // Reset a released HP back to notified for this project
  const releasedHP = await prisma.holdPoint.findFirst({
    where: {
      status: 'released',
      lot: { projectId }
    },
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
    console.log(`Reset HP ${releasedHP.id} (lot: ${releasedHP.lot.lotNumber}) to 'notified' status`);
  } else {
    console.log('No released HP found for this project');
  }

  // Verify admin user is in the project's team
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@test.com' }
  });

  if (adminUser) {
    const existingMembership = await prisma.projectUser.findFirst({
      where: { projectId, userId: adminUser.id }
    });
    if (!existingMembership) {
      await prisma.projectUser.create({
        data: {
          projectId,
          userId: adminUser.id,
          role: 'admin',
          status: 'active'
        }
      });
      console.log('Added admin user to project team');
    } else {
      console.log('Admin user already in project team:', existingMembership.status);
    }
  }

  // Show current state
  const hps = await prisma.holdPoint.findMany({
    where: { lot: { projectId } },
    select: { id: true, status: true, lot: { select: { lotNumber: true } } }
  });
  console.log('\nHold Points in project:', JSON.stringify(hps, null, 2));
}

main().finally(() => prisma.$disconnect());
