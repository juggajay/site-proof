import { describe, expect, it } from 'vitest';
import {
  buildScheduledReportDeletedResponse,
  buildScheduledReportResponse,
  buildScheduledReportsResponse,
} from './reportResponses.js';

describe('reportResponses', () => {
  it('builds the scheduled report list envelope with the max count', () => {
    const schedules = [{ id: 'schedule-1', reportType: 'project' }];

    expect(buildScheduledReportsResponse(schedules, 5)).toEqual({
      schedules,
      maxSchedules: 5,
    });
  });

  it('includes project timezone metadata when provided for scheduled reports', () => {
    const schedules = [{ id: 'schedule-1', reportType: 'lot-status' }];

    expect(buildScheduledReportsResponse(schedules, 5, 'Australia/Perth')).toEqual({
      schedules,
      maxSchedules: 5,
      projectTimeZone: 'Australia/Perth',
    });
  });

  it('builds the single scheduled report envelope', () => {
    const schedule = { id: 'schedule-1', enabled: true };

    expect(buildScheduledReportResponse(schedule)).toEqual({ schedule });
  });

  it('includes project timezone metadata when provided for a scheduled report mutation', () => {
    const schedule = { id: 'schedule-1', enabled: true };

    expect(buildScheduledReportResponse(schedule, 'Australia/Brisbane')).toEqual({
      schedule,
      projectTimeZone: 'Australia/Brisbane',
    });
  });

  it('builds the scheduled report deletion success response', () => {
    expect(buildScheduledReportDeletedResponse()).toEqual({
      success: true,
      message: 'Scheduled report deleted',
    });
  });
});
