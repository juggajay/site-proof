export function buildScheduledReportsResponse(
  schedules: unknown[],
  maxSchedules: number,
  projectTimeZone?: string,
) {
  return { schedules, maxSchedules, ...(projectTimeZone ? { projectTimeZone } : {}) };
}

export function buildScheduledReportResponse(schedule: unknown, projectTimeZone?: string) {
  return { schedule, ...(projectTimeZone ? { projectTimeZone } : {}) };
}

export function buildScheduledReportDeletedResponse() {
  return {
    success: true,
    message: 'Scheduled report deleted',
  };
}
