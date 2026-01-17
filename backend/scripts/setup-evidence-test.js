import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROJECT_ID = '92921cc5-92d9-4a22-98e8-df875809179d';

async function main() {
  console.log('Setting up test data for Feature #590: ITP evidence required indicator\n');

  // Find the Evidence Test ITP template
  let template = await prisma.iTPTemplate.findFirst({
    where: {
      projectId: PROJECT_ID,
      name: 'Evidence Test ITP'
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
        name: 'Evidence Test ITP',
        activityType: 'Earthworks',
        checklistItems: {
          create: [
            { description: 'Standard item - no evidence', sequenceNumber: 1, pointType: 'standard', responsibleParty: 'general', evidenceRequired: 'none' },
            { description: 'Photo required item', sequenceNumber: 2, pointType: 'standard', responsibleParty: 'general', evidenceRequired: 'photo' },
            { description: 'Test required item', sequenceNumber: 3, pointType: 'witness', responsibleParty: 'general', evidenceRequired: 'test' },
            { description: 'Document required item', sequenceNumber: 4, pointType: 'hold_point', responsibleParty: 'general', evidenceRequired: 'document' }
          ]
        }
      },
      include: {
        checklistItems: true
      }
    });
    console.log('Created template:', template.name);
  } else {
    console.log('Found existing template:', template.name);

    // Update the evidence types of existing items
    const items = template.checklistItems;
    if (items.length >= 4) {
      await prisma.iTPChecklistItem.update({
        where: { id: items[0].id },
        data: { evidenceRequired: 'none', description: 'Standard item - no evidence' }
      });
      console.log('Updated item 1 to none');

      await prisma.iTPChecklistItem.update({
        where: { id: items[1].id },
        data: { evidenceRequired: 'photo', description: 'Photo required item' }
      });
      console.log('Updated item 2 to photo');

      await prisma.iTPChecklistItem.update({
        where: { id: items[2].id },
        data: { evidenceRequired: 'test', description: 'Test required item' }
      });
      console.log('Updated item 3 to test');

      await prisma.iTPChecklistItem.update({
        where: { id: items[3].id },
        data: { evidenceRequired: 'document', description: 'Document required item' }
      });
      console.log('Updated item 4 to document');
    }
  }

  // Show current state
  const updatedTemplate = await prisma.iTPTemplate.findFirst({
    where: { name: 'Evidence Test ITP' },
    include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } }
  });

  console.log('\n=== Template Data ===');
  console.log('Template ID:', updatedTemplate.id);
  console.log('Name:', updatedTemplate.name);
  console.log('Checklist Items:');
  updatedTemplate.checklistItems.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.description} - evidenceRequired: ${item.evidenceRequired}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
