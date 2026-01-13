const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // Get all diaries with their dates and personnel
  const diaries = await prisma.dailyDiary.findMany({
    where: { projectId: 'commercial-test-project-id' },
    include: { personnel: true },
    orderBy: { date: 'desc' }
  });

  console.log('All diaries for project:');
  for (const d of diaries) {
    console.log('  Date:', d.date.toISOString(), '| Personnel count:', d.personnel.length);
    if (d.personnel.length > 0) {
      d.personnel.forEach(p => console.log('    -', p.name, p.company));
    }
  }

  // Test the previous-personnel lookup logic for 2026-01-14
  const currentDate = new Date('2026-01-14');
  const previousDate = new Date(currentDate);
  previousDate.setDate(previousDate.getDate() - 1);

  console.log('\nLooking for previous day of 2026-01-14:');
  console.log('  Previous date calculated:', previousDate.toISOString());

  const startOfDay = new Date(previousDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(previousDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  console.log('  Start of day:', startOfDay.toISOString());
  console.log('  End of day:', endOfDay.toISOString());

  const previousDiary = await prisma.dailyDiary.findFirst({
    where: {
      projectId: 'commercial-test-project-id',
      date: {
        gte: startOfDay,
        lte: endOfDay,
      }
    },
    include: { personnel: true }
  });

  if (previousDiary) {
    console.log('  Found diary:', previousDiary.date.toISOString(), '| Personnel:', previousDiary.personnel.length);
  } else {
    console.log('  No diary found for that date range');
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
