export function buildScheduledReportsResponse(schedules: unknown[], maxSchedules: number) {
  return { schedules, maxSchedules };
}

export function buildScheduledReportResponse(schedule: unknown) {
  return { schedule };
}

export function buildScheduledReportDeletedResponse() {
  return {
    success: true,
    message: 'Scheduled report deleted',
  };
}
