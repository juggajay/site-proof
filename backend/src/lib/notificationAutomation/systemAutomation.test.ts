import { describe, expect, it, vi } from 'vitest';
import { STALE_HOLD_POINT_ALERT_ROLES } from '../notificationAlertConfig.js';
import { processSystemAlerts, type SystemAutomationDependencies } from './systemAutomation.js';

function buildDeps(
  overrides: Partial<SystemAutomationDependencies> = {},
): SystemAutomationDependencies {
  const now = new Date('2026-06-20T12:00:00.000Z');

  return {
    prisma: {
      projectUser: {
        findMany: vi.fn().mockResolvedValue([{ userId: 'pm-1', role: 'project_manager' }]),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      nCR: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      holdPoint: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'hp-1',
            status: 'requested',
            scheduledDate: new Date(now.getTime() - 25 * 60 * 60 * 1000),
            lot: { id: 'lot-1', lotNumber: 'L-001' },
            itpChecklistItem: { description: 'Client release' },
          },
        ]),
      },
      dailyDiary: {
        findFirst: vi.fn().mockResolvedValue({ id: 'diary-1' }),
      },
      notificationAlert: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'alert-1' }),
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: 'notification-1' }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as SystemAutomationDependencies['prisma'],
    dayMs: 24 * 60 * 60 * 1000,
    hourMs: 60 * 60 * 1000,
    findActiveProjects: vi.fn().mockResolvedValue([
      {
        id: 'project-1',
        name: 'Gateway Upgrade',
        companyId: 'company-1',
        workingHoursEnd: '17:00',
        workingDays: '1,2,3,4,5',
      },
    ]),
    findProjectUsersByRoles: vi.fn().mockResolvedValue([]),
    notifyUsers: vi.fn().mockResolvedValue({
      inAppCreated: 0,
      emailsSent: 0,
      emailsQueued: 0,
      emailsFailed: 0,
      usersNotified: 0,
    }),
    ...overrides,
  };
}

function emptyDelivery() {
  return { inAppCreated: 0, emailsSent: 0, emailsQueued: 0, emailsFailed: 0, usersNotified: 0 };
}

describe('processSystemAlerts stale hold-point routing', () => {
  it('looks up canonical site roles plus legacy superintendent recipients', async () => {
    const findProjectUsersByRoles = vi.fn().mockResolvedValue([]);
    const result = await processSystemAlerts(
      { now: new Date('2026-06-20T12:00:00.000Z'), projectIds: ['project-1'] },
      buildDeps({ findProjectUsersByRoles }),
    );

    expect(result.staleHoldPointAlerts).toBe(1);
    expect(findProjectUsersByRoles).toHaveBeenCalledWith('project-1', STALE_HOLD_POINT_ALERT_ROLES);
  });
});

describe('processSystemAlerts missing-diary alert (M60: single alert that emails AND escalates)', () => {
  it('creates the escalatable alert record and notifies recipients via notifyUsers (in-app + email)', async () => {
    const notifyUsers = vi
      .fn()
      .mockResolvedValue({ ...emptyDelivery(), inAppCreated: 1, usersNotified: 1 });
    const alertCreate = vi.fn().mockResolvedValue({ id: 'alert-diary' });
    const notificationCreateMany = vi.fn().mockResolvedValue({ count: 0 });
    const deps = buildDeps({
      // No diary for the previous working day => missing-diary branch fires.
      findProjectUsersByRoles: vi
        .fn()
        .mockImplementation((_projectId: string, roles: string[]) =>
          roles.includes('foreman') ? [{ id: 'pm-1', email: 'pm@x.com', fullName: 'PM' }] : [],
        ),
      notifyUsers,
    });
    (
      deps.prisma as unknown as { dailyDiary: { findFirst: ReturnType<typeof vi.fn> } }
    ).dailyDiary.findFirst = vi.fn().mockResolvedValue(null);
    (
      deps.prisma as unknown as { notificationAlert: { create: ReturnType<typeof vi.fn> } }
    ).notificationAlert.create = alertCreate;
    (
      deps.prisma as unknown as { notification: { createMany: ReturnType<typeof vi.fn> } }
    ).notification.createMany = notificationCreateMany;

    const result = await processSystemAlerts(
      { now: new Date('2026-06-23T12:00:00.000Z'), projectIds: ['project-1'] },
      deps,
    );

    // Escalatable alert record still created (so check-escalations can climb it).
    expect(alertCreate).toHaveBeenCalled();
    expect(result.missingDiaryAlerts).toBe(1);
    // Recipients notified via the shared in-app + email helper, not a bare createMany.
    expect(notifyUsers).toHaveBeenCalledTimes(1);
    const [users, inApp, emailType] = notifyUsers.mock.calls[0];
    expect(users).toEqual([{ id: 'pm-1', email: 'pm@x.com', fullName: 'PM' }]);
    expect(inApp.type).toBe('alert_missing_diary');
    expect(emailType).toBe('diaryReminder');
    expect(notificationCreateMany).not.toHaveBeenCalled();
  });
});
