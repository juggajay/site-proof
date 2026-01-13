const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projectId = '28490410-acc1-4d6d-8638-6bfb3f339d92';

  // Check all lots with conformed status in this specific project
  const conformedLots = await prisma.lot.findMany({
    where: {
      status: 'conformed',
      projectId: projectId
    }
  });
  console.log('Conformed lots in project:', conformedLots.length);
  conformedLots.forEach(l => console.log('  -', l.lotNumber, l.status));

  // Check all lots in the project
  const allLots = await prisma.lot.findMany({
    where: { projectId: projectId }
  });
  console.log('All lots in project:', allLots.length);
  allLots.forEach(l => console.log('  -', l.lotNumber, ':', l.status));
}

main().catch(console.error).finally(() => prisma.$disconnect());
