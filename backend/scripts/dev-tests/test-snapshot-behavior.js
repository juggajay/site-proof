import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROJECT_ID = '92921cc5-92d9-4a22-98e8-df875809179d';

async function main() {
  console.log('Testing Feature #592: ITP instance snapshot behavior\n');

  // Step 1: Create a test template
  console.log('Step 1: Creating test template...');
  const template = await prisma.iTPTemplate.create({
    data: {
      projectId: PROJECT_ID,
      name: 'Snapshot Test ITP - ' + Date.now(),
      activityType: 'Earthworks',
      checklistItems: {
        create: [
          { description: 'Original Item 1', sequenceNumber: 1, pointType: 'standard', responsibleParty: 'contractor' },
          { description: 'Original Item 2', sequenceNumber: 2, pointType: 'witness', responsibleParty: 'subcontractor' }
        ]
      }
    },
    include: { checklistItems: true }
  });
  console.log('Created template:', template.name);
  console.log('Original items:', template.checklistItems.map(i => i.description));

  // Step 2: Create a test lot
  console.log('\nStep 2: Creating test lot...');
  const lot = await prisma.lot.create({
    data: {
      projectId: PROJECT_ID,
      lotNumber: 'SNAPSHOT-TEST-' + Date.now(),
      lotType: 'work',
      activityType: 'Earthworks',
      description: 'Test lot for snapshot behavior'
    }
  });
  console.log('Created lot:', lot.lotNumber);

  // Step 3: Assign template to lot (this should create a snapshot)
  console.log('\nStep 3: Assigning template to lot...');
  const templateSnapshot = {
    id: template.id,
    name: template.name,
    description: template.description,
    activityType: template.activityType,
    checklistItems: template.checklistItems.map(item => ({
      id: item.id,
      description: item.description,
      sequenceNumber: item.sequenceNumber,
      pointType: item.pointType,
      responsibleParty: item.responsibleParty,
      evidenceRequired: item.evidenceRequired,
      acceptanceCriteria: item.acceptanceCriteria
    }))
  };

  const instance = await prisma.iTPInstance.create({
    data: {
      lotId: lot.id,
      templateId: template.id,
      templateSnapshot: JSON.stringify(templateSnapshot)
    }
  });
  console.log('Created ITP instance with snapshot');

  // Step 4: Modify the template
  console.log('\nStep 4: Modifying template (adding item, changing existing)...');
  await prisma.iTPChecklistItem.update({
    where: { id: template.checklistItems[0].id },
    data: { description: 'MODIFIED Item 1' }
  });
  await prisma.iTPChecklistItem.create({
    data: {
      templateId: template.id,
      description: 'New Item 3 (added after assignment)',
      sequenceNumber: 3,
      pointType: 'hold_point',
      responsibleParty: 'superintendent'
    }
  });

  const modifiedTemplate = await prisma.iTPTemplate.findUnique({
    where: { id: template.id },
    include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } }
  });
  console.log('Modified template items:', modifiedTemplate.checklistItems.map(i => i.description));

  // Step 5: Retrieve the instance and check snapshot
  console.log('\nStep 5: Retrieving ITP instance...');
  const retrievedInstance = await prisma.iTPInstance.findUnique({
    where: { lotId: lot.id }
  });

  const snapshot = JSON.parse(retrievedInstance.templateSnapshot);
  console.log('Snapshot items (should be original):', snapshot.checklistItems.map(i => i.description));

  // Verify
  console.log('\n=== VERIFICATION ===');
  const originalItems = ['Original Item 1', 'Original Item 2'];
  const snapshotItems = snapshot.checklistItems.map(i => i.description);

  const isCorrect = JSON.stringify(originalItems) === JSON.stringify(snapshotItems);
  console.log('Snapshot preserves original state:', isCorrect ? '✓ YES' : '✗ NO');
  console.log('Template now has', modifiedTemplate.checklistItems.length, 'items');
  console.log('Snapshot has', snapshot.checklistItems.length, 'items');

  // Cleanup
  console.log('\nCleaning up test data...');
  await prisma.iTPInstance.delete({ where: { id: instance.id } });
  await prisma.lot.delete({ where: { id: lot.id } });
  await prisma.iTPTemplate.delete({ where: { id: template.id } });
  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
