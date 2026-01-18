const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.subcontractorCompany.deleteMany({
    where: {
      companyName: { contains: 'TEST_INVITE_254' }
    }
  });
  console.log('Deleted:', deleted.count, 'subcontractor(s)');
}

main().catch(console.error).finally(() => prisma.$disconnect());
