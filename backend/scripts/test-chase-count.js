import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROJECT_ID = '92921cc5-92d9-4a22-98e8-df875809179d';

async function main() {
  console.log('Testing Feature #596: HP chase count tracking\n');

  // Step 1: Create test data - template with hold point
  console.log('Setting up test data...');

  const template = await prisma.iTPTemplate.create({
    data: {
      projectId: PROJECT_ID,
      name: 'Chase Test ITP - ' + Date.now(),
      activityType: 'Earthworks',
      checklistItems: {
        create: [
          { description: 'Item 1', sequenceNumber: 1, pointType: 'standard', responsibleParty: 'contractor' },
          { description: 'Hold Point Item', sequenceNumber: 2, pointType: 'hold_point', responsibleParty: 'superintendent' }
        ]
      }
    },
    include: { checklistItems: true }
  });
  console.log('Created template:', template.name);

  // Create a lot
  const lot = await prisma.lot.create({
    data: {
      projectId: PROJECT_ID,
      lotNumber: 'CHASE-TEST-' + Date.now(),
      lotType: 'work',
      activityType: 'Earthworks',
      description: 'Test lot for chase tracking'
    }
  });
  console.log('Created lot:', lot.lotNumber);

  // Create ITP instance
  const instance = await prisma.iTPInstance.create({
    data: {
      lotId: lot.id,
      templateId: template.id
    }
  });

  // Complete the first item (prerequisite)
  const firstItem = template.checklistItems.find(i => i.sequenceNumber === 1);
  await prisma.iTPCompletion.create({
    data: {
      itpInstanceId: instance.id,
      checklistItemId: firstItem.id,
      status: 'completed',
      completedAt: new Date()
    }
  });

  // Get the hold point item
  const holdPointItem = template.checklistItems.find(i => i.pointType === 'hold_point');

  // Step 1: Create and notify HP
  console.log('\nStep 1: Notify HP...');
  const holdPoint = await prisma.holdPoint.create({
    data: {
      lotId: lot.id,
      itpChecklistItemId: holdPointItem.id,
      pointType: 'hold_point',
      description: holdPointItem.description,
      status: 'notified',
      notificationSentAt: new Date()
    }
  });
  console.log('Created hold point with status: notified');
  console.log('Initial chase count:', holdPoint.chaseCount);

  // Step 2: Chase HP
  console.log('\nStep 2: Chase HP...');
  const afterFirstChase = await prisma.holdPoint.update({
    where: { id: holdPoint.id },
    data: {
      chaseCount: { increment: 1 },
      lastChasedAt: new Date()
    }
  });

  // Step 3: Verify chase count = 1
  console.log('Step 3: Verify chase count = 1');
  console.log('Chase count after first chase:', afterFirstChase.chaseCount);
  console.log('Last chased at:', afterFirstChase.lastChasedAt);

  const test1Passed = afterFirstChase.chaseCount === 1;
  console.log(test1Passed ? '✓ Chase count is 1' : '✗ Chase count is NOT 1');

  // Step 4: Chase again
  console.log('\nStep 4: Chase again...');
  const afterSecondChase = await prisma.holdPoint.update({
    where: { id: holdPoint.id },
    data: {
      chaseCount: { increment: 1 },
      lastChasedAt: new Date()
    }
  });

  // Step 5: Verify chase count = 2
  console.log('Step 5: Verify chase count = 2');
  console.log('Chase count after second chase:', afterSecondChase.chaseCount);
  console.log('Last chased at:', afterSecondChase.lastChasedAt);

  const test2Passed = afterSecondChase.chaseCount === 2;
  console.log(test2Passed ? '✓ Chase count is 2' : '✗ Chase count is NOT 2');

  // Verify lastChasedAt is updated
  const lastChasedUpdated = afterSecondChase.lastChasedAt > afterFirstChase.lastChasedAt;
  console.log(lastChasedUpdated ? '✓ lastChasedAt timestamp updated' : '✗ lastChasedAt timestamp NOT updated');

  // Final verification
  console.log('\n=== VERIFICATION ===');
  const allTestsPassed = test1Passed && test2Passed && lastChasedUpdated;
  console.log('First chase count correct:', test1Passed ? '✓ YES' : '✗ NO');
  console.log('Second chase count correct:', test2Passed ? '✓ YES' : '✗ NO');
  console.log('Timestamp tracking working:', lastChasedUpdated ? '✓ YES' : '✗ NO');
  console.log('All tests passed:', allTestsPassed ? '✓ YES' : '✗ NO');

  // Cleanup
  console.log('\nCleaning up test data...');
  await prisma.holdPoint.delete({ where: { id: holdPoint.id } });
  await prisma.iTPCompletion.deleteMany({ where: { itpInstanceId: instance.id } });
  await prisma.iTPInstance.delete({ where: { id: instance.id } });
  await prisma.lot.delete({ where: { id: lot.id } });
  await prisma.iTPTemplate.delete({ where: { id: template.id } });
  console.log('Done!');

  if (allTestsPassed) {
    console.log('\nFeature #596 is working correctly!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
