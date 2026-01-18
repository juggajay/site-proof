import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROJECT_ID = '92921cc5-92d9-4a22-98e8-df875809179d';

async function main() {
  console.log('Setting up test data for Feature #589: ITP point type display\n');

  // Find the Point Type Test ITP template
  let template = await prisma.iTPTemplate.findFirst({
    where: {
      projectId: PROJECT_ID,
      name: 'Point Type Test ITP'
    },
    include: {
      checklistItems: true
    }
  });

  if (!template) {
    console.log('Template not found, creating new one...');
    template = await prisma.iTPTemplate.create({
      data: {
        projectId: PROJECT_ID,
        name: 'Point Type Test ITP',
        activityType: 'Earthworks',
        checklistItems: {
          create: [
            { description: 'Standard inspection item', sequenceNumber: 1, pointType: 'standard', responsibleParty: 'general' },
            { description: 'Witness inspection item', sequenceNumber: 2, pointType: 'witness', responsibleParty: 'general' },
            { description: 'Hold point inspection item', sequenceNumber: 3, pointType: 'hold_point', responsibleParty: 'general' }
          ]
        }
      },
      include: {
        checklistItems: true
      }
    });
    console.log('✓ Created template:', template.name);
  } else {
    console.log('✓ Found existing template:', template.name);

    // Update the point types of existing items
    const items = template.checklistItems;
    if (items.length >= 3) {
      await prisma.iTPChecklistItem.update({
        where: { id: items[0].id },
        data: { pointType: 'standard', description: 'Standard inspection item' }
      });
      console.log('✓ Updated item 1 to standard');

      await prisma.iTPChecklistItem.update({
        where: { id: items[1].id },
        data: { pointType: 'witness', description: 'Witness inspection item' }
      });
      console.log('✓ Updated item 2 to witness');

      await prisma.iTPChecklistItem.update({
        where: { id: items[2].id },
        data: { pointType: 'hold_point', description: 'Hold point inspection item' }
      });
      console.log('✓ Updated item 3 to hold_point');
    }
  }

  // Show current state
  const updatedTemplate = await prisma.iTPTemplate.findFirst({
    where: { name: 'Point Type Test ITP' },
    include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } }
  });

  console.log('\n=== Template Data ===');
  console.log('Template ID:', updatedTemplate.id);
  console.log('Name:', updatedTemplate.name);
  console.log('Checklist Items:');
  updatedTemplate.checklistItems.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.description} - pointType: ${item.pointType}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
