// Script to create an overdue test for testing Feature #197
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

  // Set dates to 20 days ago (overdue)
  const twentyDaysAgo = new Date();
  twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);

  // Create an overdue test result
  const test = await prisma.testResult.create({
    data: {
      projectId: project.id,
      testType: 'Overdue CBR Test',
      testRequestNumber: 'TR-OVERDUE-002',
      status: 'at_lab',  // Not verified, so will be overdue
      passFail: 'pending',
      createdAt: twentyDaysAgo,
      sampleDate: twentyDaysAgo,
    }
  });

  console.log('Created overdue test:', test.id);
  console.log('Status:', test.status);
  console.log('Created At:', test.createdAt, '(20 days ago - OVERDUE)');
  console.log('Sample Date:', test.sampleDate);
  console.log('\nProject ID:', project.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
