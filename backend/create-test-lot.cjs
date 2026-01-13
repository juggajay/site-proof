const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projectId = 'commercial-test-project-id';

  // Create a new conformed lot for testing
  const lot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: 'CLAIM-TEST-LOT-001',
      description: 'Test lot for claims feature testing',
      lotType: 'chainage',
      activityType: 'Earthworks',
      status: 'conformed',
      budgetAmount: 15000
    }
  });
  console.log('Created lot:', lot.lotNumber, 'status:', lot.status, 'budget:', lot.budgetAmount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
