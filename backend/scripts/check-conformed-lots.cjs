const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check for conformed lots
  const conformedLots = await prisma.lot.findMany({
    where: { status: 'conformed' },
    select: { id: true, lotNumber: true, status: true, projectId: true },
    take: 5
  });
  console.log('Conformed lots:', JSON.stringify(conformedLots, null, 2));

  // Get lots by status
  const lotsByStatus = await prisma.lot.groupBy({
    by: ['status'],
    _count: { status: true }
  });
  console.log('Lots by status:', JSON.stringify(lotsByStatus, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
