import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function main() {
  // Get the lot's ITP instance with full data
  const instance = await prisma.iTPInstance.findUnique({
    where: { lotId: '3a39e326-2eae-4b09-b8d2-94e46bb272e0' },
    include: {
      template: {
        include: {
          checklistItems: {
            orderBy: { sequenceNumber: 'asc' }
          }
        }
      }
    }
  });

  if (!instance) {
    console.log('No ITP instance found');
    return;
  }

  console.log('=== RAW DATABASE DATA ===');
  console.log('Template:', instance.template.name);
  console.log('Checklist Items:');
  instance.template.checklistItems.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.description}`);
    console.log(`     - pointType: ${item.pointType}`);
    console.log(`     - evidenceRequired: ${item.evidenceRequired}`);
  });

  console.log('\n=== TRANSFORMED DATA (like API would return) ===');
  const transformed = instance.template.checklistItems.map(item => ({
    id: item.id,
    description: item.description,
    category: item.responsibleParty || 'general',
    isHoldPoint: item.pointType === 'hold_point',
    pointType: item.pointType || 'standard',
    evidenceRequired: item.evidenceRequired || 'none',
    order: item.sequenceNumber,
    acceptanceCriteria: item.acceptanceCriteria
  }));

  transformed.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.description}`);
    console.log(`     - pointType: ${item.pointType}`);
    console.log(`     - evidenceRequired: ${item.evidenceRequired}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
