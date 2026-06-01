import { describe, expect, it } from 'vitest';
import {
  buildDiaryReminderCheckResponse,
  buildDiaryReminderSendResponse,
  buildDocketBacklogAlertsResponse,
  buildMissingDiaryAlertsResponse,
} from './diaryReminderResponses.js';

describe('diary reminder responses', () => {
  it('preserves the daily diary reminder check response shape', () => {
    const details = [
      {
        projectId: 'project-1',
        projectName: 'Gateway Upgrade',
        date: '2026-05-21',
        usersNotified: ['foreman@example.com'],
      },
    ];

    expect(buildDiaryReminderCheckResponse('2026-05-21', 3, details, new Set(['user-1']))).toEqual({
      success: true,
      date: '2026-05-21',
      projectsChecked: 3,
      remindersCreated: 1,
      uniqueUsersNotified: 1,
      details,
    });
  });

  it('preserves the manual diary reminder response shape', () => {
    expect(
      buildDiaryReminderSendResponse(
        { id: 'project-1', name: 'Gateway Upgrade' },
        '2026-05-21',
        [
          { id: 'user-1', email: 'foreman@example.com' },
          { id: 'user-2', email: 'pm@example.com' },
        ],
        2,
      ),
    ).toEqual({
      success: true,
      projectId: 'project-1',
      projectName: 'Gateway Upgrade',
      date: '2026-05-21',
      usersNotified: [
        { id: 'user-1', email: 'foreman@example.com' },
        { id: 'user-2', email: 'pm@example.com' },
      ],
      notificationCount: 2,
    });
  });

  it('preserves the missing diary alert check response shape', () => {
    const details = [
      {
        projectId: 'project-1',
        projectName: 'Gateway Upgrade',
        missingDate: '2026-05-20',
        usersNotified: ['owner@example.com'],
      },
    ];

    expect(buildMissingDiaryAlertsResponse('2026-05-20', 4, details, new Set(['user-1']))).toEqual({
      success: true,
      missingDate: '2026-05-20',
      projectsChecked: 4,
      alertsCreated: 1,
      uniqueUsersNotified: 1,
      details,
    });
  });

  it('preserves the overdue docket backlog alert response shape', () => {
    const cutoffTime = new Date('2026-06-01T01:02:03.000Z');
    const details = [
      {
        projectId: 'project-1',
        projectName: 'Gateway Upgrade',
        docketCount: 2,
        docketIds: ['docket-1', 'docket-2'],
        usersNotified: ['pm@example.com'],
      },
    ];

    expect(
      buildDocketBacklogAlertsResponse(cutoffTime, 5, 1, details, new Set(['user-1', 'user-2'])),
    ).toEqual({
      success: true,
      cutoffTime: '2026-06-01T01:02:03.000Z',
      totalOverdueDockets: 5,
      projectsWithBacklog: 1,
      alertsCreated: 1,
      uniqueUsersNotified: 2,
      details,
    });
  });
});
