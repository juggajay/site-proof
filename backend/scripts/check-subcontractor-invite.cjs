const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find the invited subcontractor company
  const subcontractor = await prisma.subcontractorCompany.findFirst({
    where: {
      companyName: { contains: 'TEST_INVITE_254' }
    },
    select: {
      id: true,
      companyName: true,
      abn: true,
      primaryContactName: true,
      primaryContactEmail: true,
      primaryContactPhone: true,
      status: true,
      createdAt: true,
      projectId: true
    }
  });

  if (subcontractor) {
    console.log('Found invited subcontractor:');
    console.log(JSON.stringify(subcontractor, null, 2));
  } else {
    console.log('Subcontractor not found - checking all subcontractors:');
    const all = await prisma.subcontractorCompany.findMany({
      select: { companyName: true, status: true },
      take: 10
    });
    console.log(JSON.stringify(all, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
