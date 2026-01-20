const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Update the checklist item to be a hold point
  const updated = await prisma.iTPChecklistItem.updateMany({
    where: {
      template: { name: 'Mobile HP Test ITP' }
    },
    data: {
      pointType: 'hold_point',
      responsibleParty: 'contractor'
    }
  });
  console.log('Updated', updated.count, 'checklist items to hold_point');

  // Verify
  const template = await prisma.iTPTemplate.findFirst({
    where: { name: 'Mobile HP Test ITP' },
    include: { checklistItems: true }
  });
  console.log('Template now:', JSON.stringify(template, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
