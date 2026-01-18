// Script to create a test result in "entered" status for testing Feature #204 (rejection)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Use the Subcontractor Test Project
  const projectId = 'cb950c13-368c-4e33-afb9-27e79fd90dcd';

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    console.log('Project not found');
    return;
  }

  console.log('Using project:', project.name, 'ID:', project.id);

  // Create a test result in "entered" status
  const test = await prisma.testResult.create({
    data: {
      projectId: project.id,
      testType: 'Compaction Test',
      testRequestNumber: 'TR-REJECT-001',
      status: 'entered',  // Ready for verification (can be rejected)
      passFail: 'pass',
      laboratoryName: 'ABC Testing Labs',
      resultValue: 97.5,
      resultUnit: '% MDD',
      specificationMin: 95,
      specificationMax: 100,
      sampleDate: new Date(),
    }
  });

  console.log('Created test result:', test.id);
  console.log('Status:', test.status, '(ready for verification or rejection)');
  console.log('Test Type:', test.testType);
  console.log('Result:', test.resultValue, test.resultUnit);
  console.log('\nProject ID:', project.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
