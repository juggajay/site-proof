import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check SubcontractorUser links for our test user
  const userId = '44a4a0d0-f668-4910-971f-2cc559f4727a';
  const subUser = await prisma.subcontractorUser.findFirst({
    where: { userId: userId }
  });
  console.log('SubcontractorUser link for docket-sub@test.com:', subUser);

  // Find approved dockets
  const approvedDockets = await prisma.dailyDocket.findMany({
    where: { status: 'approved' },
    include: {
      subcontractorCompany: true
    },
    orderBy: { approvedAt: 'desc' },
    take: 3
  });

  console.log('\nRecently approved dockets:');
  for (const docket of approvedDockets) {
    console.log(`  - ID: ${docket.id}, Company: ${docket.subcontractorCompany?.companyName}, CompanyId: ${docket.subcontractorCompanyId}`);

    // Check SubcontractorUsers for this company
    const companyUsers = await prisma.subcontractorUser.findMany({
      where: { subcontractorCompanyId: docket.subcontractorCompanyId }
    });
    console.log(`    SubcontractorUsers for this company: ${companyUsers.length}`);
    companyUsers.forEach(cu => {
      console.log(`      - userId: ${cu.userId}, role: ${cu.role}`);
    });
  }

  // List all SubcontractorUser entries
  const allSubUsers = await prisma.subcontractorUser.findMany();
  console.log('\nAll SubcontractorUser entries:', allSubUsers.length);
  allSubUsers.forEach(su => {
    console.log(`  - userId: ${su.userId}, companyId: ${su.subcontractorCompanyId}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
