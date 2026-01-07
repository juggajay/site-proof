import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Create a test project for deletion testing
  const project = await prisma.project.create({
    data: {
      id: 'delete-test-project',
      name: 'Project To Delete',
      projectNumber: 'DEL-001',
      companyId: 'main-company-id',
      status: 'active',
      state: 'NSW',
      specificationSet: 'RMS-QA',
    },
  });

  console.log('Created test project:', JSON.stringify(project, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
