import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    where: { name: { contains: 'Subcontractor' } },
    select: { id: true, name: true }
  });
  console.log(JSON.stringify(projects, null, 2));

  // Also check the HP we just reset
  const hp = await prisma.holdPoint.findFirst({
    where: { id: '2b4fa5a9-bf28-418e-bc65-1674c98b31c9' },
    include: { lot: { include: { project: true } } }
  });
  if (hp) {
    console.log('\nHP Project:', hp.lot.project.name);
    console.log('HP Project ID:', hp.lot.projectId);
    console.log('HP Status:', hp.status);
  }
}

main().finally(() => prisma.$disconnect());
