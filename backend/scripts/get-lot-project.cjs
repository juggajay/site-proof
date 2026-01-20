const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lot = await prisma.lot.findFirst({
    where: { lotNumber: 'HP-TEST-001' },
    include: { project: true }
  });
  console.log('Lot Number:', lot?.lotNumber);
  console.log('Lot ID:', lot?.id);
  console.log('Project ID:', lot?.projectId);
  console.log('Project Name:', lot?.project?.name);
}

main().catch(console.error).finally(() => prisma.$disconnect());
