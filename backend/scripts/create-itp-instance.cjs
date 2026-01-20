const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find the lot and template
  const lot = await prisma.lot.findFirst({
    where: { lotNumber: 'HP-TEST-001' }
  });

  const template = await prisma.iTPTemplate.findFirst({
    where: { name: 'Mobile HP Test ITP' }
  });

  if (!lot || !template) {
    console.log('Lot or template not found');
    return;
  }

  console.log('Lot ID:', lot.id);
  console.log('Template ID:', template.id);

  // Create ITP instance
  const instance = await prisma.iTPInstance.create({
    data: {
      lotId: lot.id,
      templateId: template.id,
      status: 'not_started',
    },
  });

  console.log('ITP Instance created:', instance.id);

  // Verify
  const verifyLot = await prisma.lot.findFirst({
    where: { lotNumber: 'HP-TEST-001' },
    include: {
      itpInstance: {
        include: {
          template: {
            include: {
              checklistItems: true
            }
          }
        }
      }
    }
  });

  console.log('Verification:');
  console.log('  Lot:', verifyLot?.lotNumber);
  console.log('  ITP Instance:', verifyLot?.itpInstance?.id);
  console.log('  Template:', verifyLot?.itpInstance?.template?.name);
  console.log('  Checklist Items:', verifyLot?.itpInstance?.template?.checklistItems?.length);

  if (verifyLot?.itpInstance?.template?.checklistItems) {
    for (const item of verifyLot.itpInstance.template.checklistItems) {
      console.log(`    - ${item.description} (pointType: ${item.pointType})`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
