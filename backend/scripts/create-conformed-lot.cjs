const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get first admin project
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@test.com' },
    select: { companyId: true }
  });

  const company = await prisma.company.findUnique({
    where: { id: admin.companyId },
    include: { projects: { take: 1 } }
  });

  const projectId = company.projects[0]?.id;
  if (!projectId) {
    console.log('No project found');
    return;
  }

  console.log('Using project:', projectId, company.projects[0].name);

  // Check if lot already exists
  let lot = await prisma.lot.findFirst({
    where: { projectId, lotNumber: 'CONFORMED-TEST-001' }
  });

  if (!lot) {
    // Create a conformed lot
    lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: 'CONFORMED-TEST-001',
        description: 'Test lot for conformance package feature',
        status: 'conformed',
        lotType: 'standard',
        activityType: 'earthworks'
      }
    });
    console.log('Created conformed lot:', lot.id, lot.lotNumber);
  } else {
    // Update status to conformed
    lot = await prisma.lot.update({
      where: { id: lot.id },
      data: { status: 'conformed' }
    });
    console.log('Updated existing lot to conformed:', lot.id, lot.lotNumber);
  }

  console.log('Lot details:', JSON.stringify(lot, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
