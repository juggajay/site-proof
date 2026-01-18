// Script to create an overdue test for testing Feature #197
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find a project with test results
  const project = await prisma.project.findFirst();

  if (!project) {
    console.log('No projects found');
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
      testType: 'Overdue Compaction Test',
      testRequestNumber: 'TR-OVERDUE-001',
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
