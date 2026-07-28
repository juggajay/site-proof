import { describe, expect, it, vi } from 'vitest';
import { ALERT_ESCALATION_CONFIG } from '../notificationAlertConfig.js';
import {
  processAlertEscalations,
  type AlertEscalationAutomationDependencies,
} from './alertEscalations.js';

/**
 * Wave E1 (spec §4.1.3, exit item 3). E1 is the first release in which a
 * `stale_hold_point` alert can be created at all, so escalation — six roles,
 * twice, at 4 h and 8 h — is held off until the canary population has stayed
 * inside the per-pass caps for one full escalation window plus a reporting day.
 *
 * When the follow-up PR re-enables it, this suite is what flips back: assert
 * `escalated: 1` and `findEscalationUsers` called with
 * STALE_HOLD_POINT_ESCALATION_ROLES, which is what it asserted before E1.
 */
describe('processAlertEscalations stale hold-point hold-off', () => {
  it('does not escalate a stale hold-point alert, even when explicitly targeted by id', async () => {
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
      findEscalationUsers,
      notifyUsers,
    };

    // The alert is 5 h old, past the 4 h first-escalation threshold, and is
    // named directly in alertIds — the path that bypasses the type filter on
    // the scan. It must still be skipped.
    const result = await processAlertEscalations({ now, alertIds: ['alert-1'] }, deps);

    expect(result.escalated).toBe(0);
    expect(result.skippedAlerts).toBe(1);
    expect(findEscalationUsers).not.toHaveBeenCalled();
    expect(notifyUsers).not.toHaveBeenCalled();
  });

  it('leaves the 4 h/8 h timing config in place so re-enabling is a one-line revert', () => {
    expect(ALERT_ESCALATION_CONFIG.stale_hold_point).toMatchObject({
      firstEscalationAfterHours: 4,
      secondEscalationAfterHours: 8,
    });
  });
});
