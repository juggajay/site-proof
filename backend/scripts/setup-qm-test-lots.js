import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Setting up lots for QM testing in NCR Test Project...\n');

  const projectId = 'e9761f0a-d1f7-43b5-bfe2-6d4a648fcff1';

  // Create test lots in the NCR Test Project
  const lots = [
    {
      id: 'qm-test-lot-001',
      lotNumber: 'QM-LOT-001',
      description: 'Earthworks - Cut to Fill CH 1000-1200',
      status: 'in_progress',
      lotType: 'chainage',
      activityType: 'earthworks',
      chainageStart: 1000,
      chainageEnd: 1200,
      offset: 'full',
      layer: 'subgrade',
      projectId,
    },
    {
      id: 'qm-test-lot-002',
      lotNumber: 'QM-LOT-002',
      description: 'Subgrade Preparation CH 1200-1400',
      status: 'awaiting_test',
      lotType: 'chainage',
      activityType: 'subgrade',
      chainageStart: 1200,
      chainageEnd: 1400,
      offset: 'full',
      layer: 'subgrade',
      projectId,
    },
    {
      id: 'qm-test-lot-003',
      lotNumber: 'QM-LOT-003',
      description: 'Drainage Installation - Box Culvert',
      status: 'completed',
      lotType: 'structure',
      activityType: 'drainage',
      chainageStart: 1350,
      chainageEnd: 1350,
      offset: 'full',
      layer: 'drainage',
      projectId,
    },
    {
      id: 'qm-test-lot-004',
      lotNumber: 'QM-LOT-004',
      description: 'Concrete Pavement CH 1400-1600',
      status: 'pending',
      lotType: 'chainage',
      activityType: 'pavement',
      chainageStart: 1400,
      chainageEnd: 1600,
      offset: 'full',
      layer: 'pavement',
      projectId,
    },
  ];

  // Delete existing test lots first
  await prisma.lot.deleteMany({
    where: {
      projectId,
      lotNumber: { startsWith: 'QM-LOT-' }
    }
  });

  // Create the lots
  for (const lot of lots) {
    await prisma.lot.create({ data: lot });
    console.log(`✓ Created lot: ${lot.lotNumber} (${lot.status})`);
  }

  console.log('\n✓ QM test lots created successfully!');
  console.log('\nLots available for testing:');
  const createdLots = await prisma.lot.findMany({
    where: { projectId },
    select: { id: true, lotNumber: true, status: true }
  });
  console.log(createdLots);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
