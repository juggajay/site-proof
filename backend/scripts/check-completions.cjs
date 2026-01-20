const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lot = await prisma.lot.findFirst({
    where: { lotNumber: 'HP-TEST-001' },
    include: {
      itpInstance: {
        include: {
          template: { include: { checklistItems: true } },
          completions: true
        }
      }
    }
  });
  console.log('Lot:', lot?.lotNumber);
  console.log('ITP Instance ID:', lot?.itpInstance?.id);
  console.log('Completions:', JSON.stringify(lot?.itpInstance?.completions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
