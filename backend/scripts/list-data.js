import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true, name: true, companyId: true } });
  const lots = await prisma.lot.findMany({ select: { id: true, lotNumber: true, projectId: true, assignedSubcontractorId: true } });
  const projectUsers = await prisma.projectUser.findMany({ include: { user: { select: { email: true } } } });
  console.log('Projects:', JSON.stringify(projects, null, 2));
  console.log('Lots:', JSON.stringify(lots, null, 2));
  console.log('Project Users:', JSON.stringify(projectUsers, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
