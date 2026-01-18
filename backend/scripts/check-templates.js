// Script to check templates and HP items
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.itpTemplate.findMany({
    include: {
      checklistItems: true
    }
  });

  for (const t of templates) {
    console.log('Template:', t.name, '- ID:', t.id);
    const hps = t.checklistItems.filter(i => i.pointType === 'hold_point');
    console.log('  HP items:', hps.length);
    hps.forEach(hp => console.log('    -', hp.id, hp.description?.substring(0, 50)));
  }

  // Also check existing hold points
  console.log('\n--- Existing Hold Points ---');
  const holdPoints = await prisma.holdPoint.findMany({
    include: { lot: true }
  });

  for (const hp of holdPoints) {
    console.log('HP:', hp.id);
    console.log('  Lot:', hp.lot.lotNumber);
    console.log('  Status:', hp.status);
    console.log('  Scheduled:', hp.scheduledDate);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
