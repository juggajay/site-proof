import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.iTPChecklistItem.findMany({
    where: { template: { name: 'Evidence Test ITP' } },
    select: { description: true, evidenceRequired: true, pointType: true },
    orderBy: { sequenceNumber: 'asc' }
  });

  console.log('Evidence Test ITP checklist items:');
  items.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.description}`);
    console.log(`     - pointType: ${item.pointType}`);
    console.log(`     - evidenceRequired: ${item.evidenceRequired}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
