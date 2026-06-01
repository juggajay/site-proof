/**
 * Hold-point notification scheduling helpers, extracted verbatim from
 * backend/src/routes/holdpoints.ts as a slice of the holdpoints route split
 * (engineering-health Workstream 1).
 *
 * Pure date math with no Prisma / request dependency: given a project's working
 * hours and working-day configuration, compute when a hold-point notification
 * should actually fire (rolling before-hours, after-hours, and non-working-day
 * requests forward to the start of the next working day) and count the working
 * days between two dates for minimum-notice-period enforcement. Behaviour — the
 * default working hours ('07:00'–'17:00') and days ('1,2,3,4,5'), the
 * adjustment branch order, the returned object shape, and the human-readable
 * reason strings — is preserved exactly as it was inline in the route file. The
 * helpers are unit-tested in scheduling.test.ts.
 */

// Utility function to calculate appropriate notification time based on working hours
export function calculateNotificationTime(
  requestedDate: Date,
  workingHoursStart: string = '07:00',
  workingHoursEnd: string = '17:00',
  workingDays: string = '1,2,3,4,5', // Mon-Fri by default
): { scheduledTime: Date; adjustedForWorkingHours: boolean; reason?: string } {
  const [startHour, startMin] = workingHoursStart.split(':').map(Number);
  const [endHour, endMin] = workingHoursEnd.split(':').map(Number);
  const workingDaysList = workingDays.split(',').map(Number); // 0=Sun, 1=Mon, etc.

  const notificationTime = new Date(requestedDate);
  let adjustedForWorkingHours = false;
  let reason: string | undefined;

  // Check if requested time is within working hours
  const requestedHour = notificationTime.getHours();
  const requestedMin = notificationTime.getMinutes();
  const requestedDay = notificationTime.getDay();

  const requestedTimeMinutes = requestedHour * 60 + requestedMin;
  const startTimeMinutes = startHour * 60 + startMin;
  const endTimeMinutes = endHour * 60 + endMin;

  // Check if it's a working day
  if (!workingDaysList.includes(requestedDay)) {
    adjustedForWorkingHours = true;
    reason = 'Scheduled for non-working day';

    // Find next working day
    let daysToAdd = 1;
    while (!workingDaysList.includes((requestedDay + daysToAdd) % 7)) {
      daysToAdd++;
      if (daysToAdd > 7) break; // Safety to prevent infinite loop
    }
    notificationTime.setDate(notificationTime.getDate() + daysToAdd);
    notificationTime.setHours(startHour, startMin, 0, 0);
    reason = `Adjusted to next working day (${notificationTime.toDateString()}) at ${workingHoursStart}`;
  }
  // Check if before working hours start
  else if (requestedTimeMinutes < startTimeMinutes) {
    adjustedForWorkingHours = true;
    notificationTime.setHours(startHour, startMin, 0, 0);
    reason = `Adjusted to start of working hours (${workingHoursStart})`;
  }
  // Check if after working hours end
  else if (requestedTimeMinutes >= endTimeMinutes) {
    adjustedForWorkingHours = true;

    // Schedule for next working day
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

// Utility function to calculate working days between two dates
export function calculateWorkingDays(
  fromDate: Date,
  toDate: Date,
  workingDays: string = '1,2,3,4,5', // Mon-Fri by default
): number {
  const workingDaysList = workingDays.split(',').map(Number); // 0=Sun, 1=Mon, etc.
  let count = 0;
  const current = new Date(fromDate);
  current.setHours(0, 0, 0, 0);
  const target = new Date(toDate);
  target.setHours(0, 0, 0, 0);

  while (current < target) {
    if (workingDaysList.includes(current.getDay())) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}
