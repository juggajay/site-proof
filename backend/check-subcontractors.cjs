const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projectId = 'commercial-test-project-id';

  // Check SubcontractorCompany records
  const companies = await prisma.subcontractorCompany.findMany({
    where: { projectId },
    select: { id: true, companyName: true, status: true }
  });
  console.log('SubcontractorCompany records:', companies.length);
  companies.forEach(c => console.log('  -', c.companyName, '| status:', c.status));
}

main().catch(console.error).finally(() => prisma.$disconnect());
