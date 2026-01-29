import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROJECT_ID = '92921cc5-92d9-4a22-98e8-df875809179d';

async function main() {
  console.log('Testing Feature #593: ITP template change propagation\n');

  // Step 1: Create a test template
  console.log('Step 1: Creating test template...');
  const template = await prisma.iTPTemplate.create({
    data: {
      projectId: PROJECT_ID,
      name: 'Propagation Test ITP - ' + Date.now(),
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

  // Step 2: Create two test lots and assign the template
  console.log('\nStep 2: Creating test lots...');
  const lot1 = await prisma.lot.create({
    data: {
      projectId: PROJECT_ID,
      lotNumber: 'PROP-TEST-1-' + Date.now(),
      lotType: 'work',
      activityType: 'Earthworks',
      description: 'Test lot 1'
    }
  });
  const lot2 = await prisma.lot.create({
    data: {
      projectId: PROJECT_ID,
      lotNumber: 'PROP-TEST-2-' + Date.now(),
      lotType: 'work',
      activityType: 'Earthworks',
      description: 'Test lot 2'
    }
  });
  console.log('Created lots:', lot1.lotNumber, lot2.lotNumber);

  // Step 3: Assign template to both lots with snapshots
  console.log('\nStep 3: Assigning template to lots...');
  const snapshot1 = {
    id: template.id,
    name: template.name,
    checklistItems: template.checklistItems.map(i => ({
      id: i.id, description: i.description, sequenceNumber: i.sequenceNumber, pointType: i.pointType
    }))
  };

  const instance1 = await prisma.iTPInstance.create({
    data: { lotId: lot1.id, templateId: template.id, templateSnapshot: JSON.stringify(snapshot1) }
  });
  const instance2 = await prisma.iTPInstance.create({
    data: { lotId: lot2.id, templateId: template.id, templateSnapshot: JSON.stringify(snapshot1) }
  });
  console.log('Created instances for both lots');

  // Step 4: Modify the template
  console.log('\nStep 4: Modifying template...');
  await prisma.iTPChecklistItem.update({
    where: { id: template.checklistItems[0].id },
    data: { description: 'UPDATED Item 1' }
  });
  await prisma.iTPChecklistItem.create({
    data: {
      templateId: template.id,
      description: 'New Item 3',
      sequenceNumber: 3,
      pointType: 'hold_point',
      responsibleParty: 'superintendent'
    }
  });
  console.log('Modified template (updated item 1, added item 3)');

  // Step 5: Get lots using template
  console.log('\nStep 5: Checking lots using template...');
  const instances = await prisma.iTPInstance.findMany({
    where: { templateId: template.id },
    include: { lot: { select: { lotNumber: true, status: true } } }
  });
  console.log('Lots using template:', instances.map(i => i.lot.lotNumber));

  // Step 6: Show current snapshots (before propagation)
  console.log('\nStep 6: Current snapshots (before propagation):');
  for (const inst of instances) {
    const snap = JSON.parse(inst.templateSnapshot);
    console.log(`  ${inst.lot.lotNumber}: ${snap.checklistItems.length} items - ${snap.checklistItems.map(i => i.description).join(', ')}`);
  }

  // Step 7: Propagate changes to lot 1 only
  console.log('\nStep 7: Propagating changes to lot 1 only...');
  const updatedTemplate = await prisma.iTPTemplate.findUnique({
    where: { id: template.id },
    include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } }
  });
  const newSnapshot = {
    id: updatedTemplate.id,
    name: updatedTemplate.name,
    checklistItems: updatedTemplate.checklistItems.map(i => ({
      id: i.id, description: i.description, sequenceNumber: i.sequenceNumber, pointType: i.pointType
    }))
  };

  await prisma.iTPInstance.update({
    where: { id: instance1.id },
    data: { templateSnapshot: JSON.stringify(newSnapshot) }
  });
  console.log('Propagated to lot 1');

  // Step 8: Verify results
  console.log('\nStep 8: Verifying results...');
  const finalInstances = await prisma.iTPInstance.findMany({
    where: { templateId: template.id },
    include: { lot: { select: { lotNumber: true } } }
  });

  console.log('\n=== VERIFICATION ===');
  for (const inst of finalInstances) {
    const snap = JSON.parse(inst.templateSnapshot);
    const itemCount = snap.checklistItems.length;
    const hasUpdatedItem = snap.checklistItems.some(i => i.description.includes('UPDATED'));
    const hasNewItem = snap.checklistItems.some(i => i.description === 'New Item 3');
    console.log(`${inst.lot.lotNumber}:`);
    console.log(`  Items: ${itemCount}, Has UPDATED: ${hasUpdatedItem}, Has New Item 3: ${hasNewItem}`);
    console.log(`  Contents: ${snap.checklistItems.map(i => i.description).join(', ')}`);
  }

  // Cleanup
  console.log('\nCleaning up test data...');
  await prisma.iTPInstance.deleteMany({ where: { templateId: template.id } });
  await prisma.lot.deleteMany({ where: { id: { in: [lot1.id, lot2.id] } } });
  await prisma.iTPTemplate.delete({ where: { id: template.id } });
  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
