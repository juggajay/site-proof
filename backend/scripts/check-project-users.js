import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const projectId = 'cb950c13-368c-4e33-afb9-27e79fd90dcd';

  // Check ProjectUser entries
  const projectUsers = await prisma.projectUser.findMany({
    where: { projectId },
    include: { user: { select: { email: true, fullName: true } } }
  });
  console.log('ProjectUser entries for this project:', JSON.stringify(projectUsers, null, 2));

  // Check ProjectTeamMember entries
  const teamMembers = await prisma.projectTeamMember.findMany({
    where: { projectId },
    include: { user: { select: { email: true, fullName: true } } }
  });
  console.log('\nProjectTeamMember entries:', JSON.stringify(teamMembers, null, 2));

  // Check the HP we just released
  const hp = await prisma.holdPoint.findFirst({
    where: { lot: { lotNumber: 'HP-TEST-LOT-003' } },
    include: { lot: { include: { project: true } } }
  });
  console.log('\nHP Details:', hp ? {
    id: hp.id,
    status: hp.status,
    releasedAt: hp.releasedAt,
    releasedByName: hp.releasedByName,
    lotNumber: hp.lot.lotNumber,
    projectId: hp.lot.projectId,
    projectName: hp.lot.project.name
  } : 'Not found');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
