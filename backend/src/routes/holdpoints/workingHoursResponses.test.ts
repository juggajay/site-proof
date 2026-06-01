import { describe, expect, it } from 'vitest';
import {
  buildNotificationTimeResponse,
  buildProjectWorkingHoursResponse,
  resolveWorkingHours,
} from './workingHoursResponses.js';

describe('working hours responses', () => {
  it('defaults missing working-hours config to the existing weekday window', () => {
    expect(
      resolveWorkingHours({
        workingHoursStart: null,
        workingHoursEnd: null,
        workingDays: null,
      }),
    ).toEqual({
      start: '07:00',
      end: '17:00',
      days: '1,2,3,4,5',
    });
  });

  it('preserves the notification-time response shape', () => {
    const requestedDate = new Date('2026-05-21T04:00:00.000Z');
    const scheduledTime = new Date('2026-05-21T07:00:00.000Z');

    expect(
      buildNotificationTimeResponse(
        requestedDate,
        {
          scheduledTime,
          adjustedForWorkingHours: true,
          reason: 'Adjusted to start of working hours (07:00)',
        },
        {
          workingHoursStart: '07:00',
          workingHoursEnd: '17:00',
          workingDays: '1,2,3,4,5',
        },
      ),
    ).toEqual({
      requestedDateTime: '2026-05-21T04:00:00.000Z',
      scheduledNotificationTime: '2026-05-21T07:00:00.000Z',
      adjustedForWorkingHours: true,
      adjustmentReason: 'Adjusted to start of working hours (07:00)',
      workingHours: {
        start: '07:00',
        end: '17:00',
        days: '1,2,3,4,5',
      },
    });
  });

  it('maps project working-day indexes to the existing day-name array', () => {
    expect(
      buildProjectWorkingHoursResponse({
        id: 'project-1',
        name: 'Gateway Upgrade',
        workingHoursStart: '06:30',
        workingHoursEnd: '16:00',
        workingDays: '1,3,5',
      }),
    ).toEqual({
      projectId: 'project-1',
      projectName: 'Gateway Upgrade',
      workingHours: {
        start: '06:30',
        end: '16:00',
        days: '1,3,5',
        dayNames: ['Monday', 'Wednesday', 'Friday'],
      },
    });
  });
});
