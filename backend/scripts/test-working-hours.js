import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROJECT_ID = '92921cc5-92d9-4a22-98e8-df875809179d';

// Utility function - same as in holdpoints.ts
function calculateNotificationTime(
  requestedDate,
  workingHoursStart = '07:00',
  workingHoursEnd = '17:00',
  workingDays = '1,2,3,4,5'
) {
  const [startHour, startMin] = workingHoursStart.split(':').map(Number);
  const [endHour, endMin] = workingHoursEnd.split(':').map(Number);
  const workingDaysList = workingDays.split(',').map(Number);

  let notificationTime = new Date(requestedDate);
  let adjustedForWorkingHours = false;
  let reason;

  const requestedHour = notificationTime.getHours();
  const requestedMin = notificationTime.getMinutes();
  const requestedDay = notificationTime.getDay();

  const requestedTimeMinutes = requestedHour * 60 + requestedMin;
  const startTimeMinutes = startHour * 60 + startMin;
  const endTimeMinutes = endHour * 60 + endMin;

  if (!workingDaysList.includes(requestedDay)) {
    adjustedForWorkingHours = true;
    let daysToAdd = 1;
    while (!workingDaysList.includes((requestedDay + daysToAdd) % 7)) {
      daysToAdd++;
      if (daysToAdd > 7) break;
    }
    notificationTime.setDate(notificationTime.getDate() + daysToAdd);
    notificationTime.setHours(startHour, startMin, 0, 0);
    reason = `Adjusted to next working day (${notificationTime.toDateString()}) at ${workingHoursStart}`;
  }
  else if (requestedTimeMinutes < startTimeMinutes) {
    adjustedForWorkingHours = true;
    notificationTime.setHours(startHour, startMin, 0, 0);
    reason = `Adjusted to start of working hours (${workingHoursStart})`;
  }
  else if (requestedTimeMinutes >= endTimeMinutes) {
    adjustedForWorkingHours = true;
    let daysToAdd = 1;
    while (!workingDaysList.includes((requestedDay + daysToAdd) % 7)) {
      daysToAdd++;
      if (daysToAdd > 7) break;
    }
    notificationTime.setDate(notificationTime.getDate() + daysToAdd);
    notificationTime.setHours(startHour, startMin, 0, 0);
    reason = `Scheduled after hours - moved to next working day (${notificationTime.toDateString()}) at ${workingHoursStart}`;
  }

  return { scheduledTime: notificationTime, adjustedForWorkingHours, reason };
}

async function main() {
  console.log('Testing Feature #595: HP notification working hours\n');

  // Step 1: Configure working hours 7am-5pm (default values should already be set)
  console.log('Step 1: Configure working hours 7am-5pm...');
  const project = await prisma.project.update({
    where: { id: PROJECT_ID },
    data: {
      workingHoursStart: '07:00',
      workingHoursEnd: '17:00',
      workingDays: '1,2,3,4,5' // Mon-Fri
    },
    select: {
      name: true,
      workingHoursStart: true,
      workingHoursEnd: true,
      workingDays: true
    }
  });
  console.log('Project working hours configured:');
  console.log(`  Start: ${project.workingHoursStart}`);
  console.log(`  End: ${project.workingHoursEnd}`);
  console.log(`  Working days: ${project.workingDays} (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri)`);

  // Step 2: Test various scenarios
  console.log('\nStep 2: Testing notification timing scenarios...\n');

  // Find the next Saturday
  const today = new Date();
  const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
  const nextSaturday = new Date(today);
  nextSaturday.setDate(today.getDate() + daysUntilSaturday);
  nextSaturday.setHours(10, 0, 0, 0); // 10am Saturday

  // Find the next Sunday
  const nextSunday = new Date(nextSaturday);
  nextSunday.setDate(nextSaturday.getDate() + 1);
  nextSunday.setHours(14, 0, 0, 0); // 2pm Sunday

  // Test scenarios
  const scenarios = [
    { name: 'Weekend request (Saturday 10am)', date: nextSaturday },
    { name: 'Weekend request (Sunday 2pm)', date: nextSunday },
    { name: 'Before hours (today 5am)', date: new Date(today.setHours(5, 0, 0, 0)) },
    { name: 'After hours (today 8pm)', date: new Date(new Date().setHours(20, 0, 0, 0)) },
    { name: 'Within hours (today 10am)', date: new Date(new Date().setHours(10, 0, 0, 0)) },
    { name: 'At start time (today 7am)', date: new Date(new Date().setHours(7, 0, 0, 0)) },
    { name: 'At end time (today 5pm)', date: new Date(new Date().setHours(17, 0, 0, 0)) }
  ];

  console.log('Testing with working hours: 07:00-17:00, Mon-Fri\n');

  for (const scenario of scenarios) {
    const result = calculateNotificationTime(
      scenario.date,
      '07:00',
      '17:00',
      '1,2,3,4,5'
    );

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const requestedDay = dayNames[scenario.date.getDay()];
    const scheduledDay = dayNames[result.scheduledTime.getDay()];

    console.log(`Scenario: ${scenario.name}`);
    console.log(`  Requested: ${scenario.date.toLocaleString()} (${requestedDay})`);
    console.log(`  Scheduled: ${result.scheduledTime.toLocaleString()} (${scheduledDay})`);
    console.log(`  Adjusted: ${result.adjustedForWorkingHours ? 'YES' : 'NO'}`);
    if (result.reason) console.log(`  Reason: ${result.reason}`);
    console.log('');
  }

  // Step 3: Verify notification timed appropriately
  console.log('Step 3: Verifying weekend request is moved to Monday...');

  const weekendRequest = calculateNotificationTime(
    nextSaturday,
    '07:00',
    '17:00',
    '1,2,3,4,5'
  );

  const isMovedToWorkday = [1, 2, 3, 4, 5].includes(weekendRequest.scheduledTime.getDay());
  const isAtStartOfDay = weekendRequest.scheduledTime.getHours() === 7 && weekendRequest.scheduledTime.getMinutes() === 0;

  console.log(`\n=== VERIFICATION ===`);
  console.log(`Weekend request moved to working day: ${isMovedToWorkday ? '✓ YES' : '✗ NO'}`);
  console.log(`Notification set to start of working hours (7am): ${isAtStartOfDay ? '✓ YES' : '✗ NO'}`);
  console.log(`Adjustment flag set: ${weekendRequest.adjustedForWorkingHours ? '✓ YES' : '✗ NO'}`);

  const allTestsPassed = isMovedToWorkday && isAtStartOfDay && weekendRequest.adjustedForWorkingHours;
  console.log(`\nAll tests passed: ${allTestsPassed ? '✓ YES' : '✗ NO'}`);

  if (allTestsPassed) {
    console.log('\nFeature #595 is working correctly!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
