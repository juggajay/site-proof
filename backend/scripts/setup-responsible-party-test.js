import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROJECT_ID = '92921cc5-92d9-4a22-98e8-df875809179d';

async function main() {
  console.log('Setting up test data for Feature #591: ITP responsible party display\n');

  // Find or create the Responsible Party Test ITP template
  let template = await prisma.iTPTemplate.findFirst({
    where: {
      projectId: PROJECT_ID,
      name: 'Responsible Party Test ITP'
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
        name: 'Responsible Party Test ITP',
        activityType: 'Earthworks',
        checklistItems: {
          create: [
            { description: 'Contractor survey setup', sequenceNumber: 1, pointType: 'standard', responsibleParty: 'contractor', evidenceRequired: 'none' },
            { description: 'Subcontractor excavation', sequenceNumber: 2, pointType: 'witness', responsibleParty: 'subcontractor', evidenceRequired: 'photo' },
            { description: 'Superintendent inspection', sequenceNumber: 3, pointType: 'hold_point', responsibleParty: 'superintendent', evidenceRequired: 'document' },
            { description: 'Another contractor task', sequenceNumber: 4, pointType: 'standard', responsibleParty: 'contractor', evidenceRequired: 'none' }
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

    // Update the responsible parties of existing items
    const items = template.checklistItems;
    if (items.length >= 3) {
      await prisma.iTPChecklistItem.update({
        where: { id: items[0].id },
        data: { responsibleParty: 'contractor', description: 'Contractor survey setup' }
      });
      console.log('Updated item 1 to contractor');

      await prisma.iTPChecklistItem.update({
        where: { id: items[1].id },
        data: { responsibleParty: 'subcontractor', description: 'Subcontractor excavation' }
      });
      console.log('Updated item 2 to subcontractor');

      await prisma.iTPChecklistItem.update({
        where: { id: items[2].id },
        data: { responsibleParty: 'superintendent', description: 'Superintendent inspection' }
      });
      console.log('Updated item 3 to superintendent');
    }
  }

  // Show current state
  const updatedTemplate = await prisma.iTPTemplate.findFirst({
    where: { name: 'Responsible Party Test ITP' },
    include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } }
  });

  console.log('\n=== Template Data ===');
  console.log('Template ID:', updatedTemplate.id);
  console.log('Name:', updatedTemplate.name);
  console.log('Checklist Items:');
  updatedTemplate.checklistItems.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.description} - responsibleParty: ${item.responsibleParty}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
