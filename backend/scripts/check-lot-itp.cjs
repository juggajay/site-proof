const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lot = await prisma.lot.findFirst({
    where: { lotNumber: 'HP-TEST-001' },
    include: {
      itpInstance: {
        include: {
          template: {
            include: {
              checklistItems: true
            }
          },
          completions: true
        }
      }
    }
  });

  console.log('Lot:', lot?.lotNumber);
  console.log('ITP Instance:', lot?.itpInstance?.id || 'NOT CREATED');
  console.log('Template:', lot?.itpInstance?.template?.name || 'N/A');
  console.log('Checklist Items:', lot?.itpInstance?.template?.checklistItems?.length || 0);

  if (lot?.itpInstance?.template?.checklistItems) {
    for (const item of lot.itpInstance.template.checklistItems) {
      console.log(`  - ${item.description} (pointType: ${item.pointType})`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
