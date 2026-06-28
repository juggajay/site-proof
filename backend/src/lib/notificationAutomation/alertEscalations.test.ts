import { describe, expect, it, vi } from 'vitest';
import { STALE_HOLD_POINT_ESCALATION_ROLES } from '../notificationAlertConfig.js';
import {
  processAlertEscalations,
  type AlertEscalationAutomationDependencies,
} from './alertEscalations.js';

describe('processAlertEscalations stale hold-point routing', () => {
  it('escalates stale hold-point alerts to canonical site roles plus legacy superintendent', async () => {
    const now = new Date('2026-06-20T12:00:00.000Z');
    const findEscalationUsers = vi
      .fn()
      .mockResolvedValue([{ id: 'manager-1', email: 'pm@example.com', fullName: 'Pat PM' }]);
    const notifyUsers = vi.fn().mockResolvedValue({
      inAppCreated: 1,
      emailsSent: 0,
      emailsQueued: 0,
      emailsFailed: 0,
      usersNotified: 1,
    });
    const deps: AlertEscalationAutomationDependencies = {
      prisma: {
        notificationAlert: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'alert-1',
              type: 'stale_hold_point',
              severity: 'high',
              title: 'Hold Point stale',
              message: 'Hold point has been waiting.',
              entityId: 'hp-1',
              entityType: 'holdpoint',
              projectId: 'project-1',
              assignedToId: 'assigned-1',
              createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
              resolvedAt: null,
              escalationLevel: 0,
            },
          ]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      } as unknown as AlertEscalationAutomationDependencies['prisma'],
      hourMs: 60 * 60 * 1000,
      defaultJobLimit: 100,
      findEscalationUsers,
      notifyUsers,
    };

    const result = await processAlertEscalations({ now, alertIds: ['alert-1'] }, deps);

    expect(result.escalated).toBe(1);
    expect(findEscalationUsers).toHaveBeenCalledWith(
      'project-1',
      STALE_HOLD_POINT_ESCALATION_ROLES,
      'assigned-1',
    );
    expect(notifyUsers).toHaveBeenCalledTimes(1);
    expect(notifyUsers.mock.calls[0]?.[2]).toBe('holdPointReminder');
  });
});
