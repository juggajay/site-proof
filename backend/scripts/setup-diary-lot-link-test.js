import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROJECT_ID = '92921cc5-92d9-4a22-98e8-df875809179d';

async function main() {
  console.log('Setting up test data for Feature #584: Diary activity lot link\n');

  // Step 1: Get an existing lot from this project
  const lot = await prisma.lot.findFirst({
    where: {
      projectId: PROJECT_ID,
      lotNumber: { startsWith: 'CONCURRENT' }
    }
  });

  if (!lot) {
    throw new Error('No lot found in project');
  }
  console.log('✓ Found lot:', lot.lotNumber, '(id:', lot.id, ')');

  // Step 2: Create a diary entry for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if diary already exists
  let diary = await prisma.dailyDiary.findFirst({
    where: {
      projectId: PROJECT_ID,
      date: today
    }
  });

  if (diary) {
    console.log('✓ Found existing diary for today (id:', diary.id, ')');
  } else {
    diary = await prisma.dailyDiary.create({
      data: {
        projectId: PROJECT_ID,
        date: today,
        status: 'draft',
        weatherConditions: 'Fine',
        temperatureMin: 18,
        temperatureMax: 28,
        rainfallMm: 0,
        weatherNotes: 'Good weather for site work',
        generalNotes: 'Test diary entry for Feature #584'
      }
    });
    console.log('✓ Created diary entry for today (id:', diary.id, ')');
  }

  // Step 3: Add an activity linked to the lot
  const existingActivity = await prisma.diaryActivity.findFirst({
    where: {
      diaryId: diary.id,
      lotId: lot.id
    }
  });

  if (existingActivity) {
    console.log('✓ Activity already exists for this lot (id:', existingActivity.id, ')');
  } else {
    const activity = await prisma.diaryActivity.create({
      data: {
        diaryId: diary.id,
        lotId: lot.id,
        description: 'Earthworks excavation to formation level',
        quantity: 150,
        unit: 'm³',
        notes: 'Completed box cut for drainage structure'
      }
    });
    console.log('✓ Created activity linked to lot (id:', activity.id, ')');
  }

  console.log('\n=== Test Data Ready ===');
  console.log('Project ID:', PROJECT_ID);
  console.log('Diary ID:', diary.id);
  console.log('Diary Date:', today.toISOString().split('T')[0]);
  console.log('Lot ID:', lot.id);
  console.log('Lot Number:', lot.lotNumber);
  console.log('\nGo to Daily Diary page, select today\'s date, then click Activities tab to see the linked lot!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
