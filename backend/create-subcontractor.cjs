const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projectId = 'commercial-test-project-id';

  // Create a SubcontractorCompany record
  const subcontractor = await prisma.subcontractorCompany.create({
    data: {
      projectId,
      companyName: 'Test Earthworks Pty Ltd',
      abn: '12 345 678 901',
      status: 'approved',
      primaryContactName: 'John Test',
      primaryContactEmail: 'john@testearthworks.com',
      primaryContactPhone: '0412 345 678'
    }
  });
  console.log('Created SubcontractorCompany:', subcontractor.companyName, '| id:', subcontractor.id, '| status:', subcontractor.status);
}

main().catch(console.error).finally(() => prisma.$disconnect());
