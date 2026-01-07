import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function createLots() {
  // Use the NCR Test Project which has 4 lots
  const projectId = 'e9761f0a-d1f7-43b5-bfe2-6d4a648fcff1';

  const newLots = [];
  const statuses = ['pending', 'in_progress', 'awaiting_test', 'completed', 'conformed'];
  const activities = ['earthworks', 'subgrade', 'drainage', 'pavement', 'kerbing'];

  for (let i = 5; i <= 15; i++) {
    newLots.push({
      id: `pagination-lot-${i}`,
      lotNumber: `PAG-LOT-${String(i).padStart(3, '0')}`,
      lotType: 'linear',
      description: `Pagination Test Lot ${i}`,
      projectId,
      status: statuses[i % statuses.length],
      activityType: activities[i % activities.length],
      chainageStart: 1000 + (i * 100),
      chainageEnd: 1000 + (i * 100) + 50,
    });
  }

  for (const lot of newLots) {
    await prisma.lot.upsert({
      where: { id: lot.id },
      update: lot,
      create: lot,
    });
  }

  console.log(`Created ${newLots.length} test lots`);

  const count = await prisma.lot.count({ where: { projectId } });
  console.log(`Total lots in project: ${count}`);
}

createLots().catch(console.error).finally(() => prisma.$disconnect());
