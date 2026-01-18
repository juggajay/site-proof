import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const lots = await prisma.lot.findMany({
    take: 5,
    select: {
      id: true,
      lotNumber: true,
      projectId: true
    }
  });
  console.log('Lots:');
  console.log(JSON.stringify(lots, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
