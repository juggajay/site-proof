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
      notificationAlert: {
        findFirst: vi.fn().mockResolvedValue(null),
        // Auto-resolution pass runs before creation; no active alerts to resolve.
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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
    ...overrides,
  };
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

describe('processSystemAlerts race handling (partial unique index on active alerts)', () => {
  it('treats a P2002 on alert create as a lost race: skips it and sends no notification', async () => {
    const alertCreate = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    const notificationCreate = vi.fn();
    const notificationCreateMany = vi.fn();
    const deps = buildDeps();
    (
      deps.prisma as unknown as { notificationAlert: { create: ReturnType<typeof vi.fn> } }
    ).notificationAlert.create = alertCreate;
    (
      deps.prisma as unknown as { notification: { create: ReturnType<typeof vi.fn> } }
    ).notification.create = notificationCreate;
    (
      deps.prisma as unknown as { notification: { createMany: ReturnType<typeof vi.fn> } }
    ).notification.createMany = notificationCreateMany;

    const result = await processSystemAlerts(
      { now: new Date('2026-06-20T12:00:00.000Z'), projectIds: ['project-1'] },
      deps,
    );

    // The stale hold point from buildDeps loses the race: no alert counted,
    // no recipients notified, run does not crash.
    expect(result.staleHoldPointAlerts).toBe(0);
    expect(result.alertsCreated).toBe(0);
    expect(result.skippedAlerts).toBe(1);
    expect(result.createdAlerts).toEqual([]);
    // Neither individual nor bulk notifications go out after a lost race.
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(notificationCreateMany).not.toHaveBeenCalled();
  });

  it('reports created alerts with their details for the admin check endpoint', async () => {
    const result = await processSystemAlerts(
      { now: new Date('2026-06-20T12:00:00.000Z'), projectIds: ['project-1'] },
      buildDeps(),
    );

    expect(result.createdAlerts).toHaveLength(1);
    expect(result.createdAlerts[0]).toMatchObject({
      type: 'stale_hold_point',
      entityId: 'hp-1',
      projectName: 'Gateway Upgrade',
      severity: 'high',
    });
    expect(result.createdAlerts[0].alertId).toMatch(/^alert-/);
  });
});

describe('processSystemAlerts missing-diary alert is retired', () => {
  it('never creates a pending_approval/diary alert, even with no hold points or NCRs', async () => {
    const alertCreate = vi.fn().mockResolvedValue({ id: 'alert-x' });
    const deps = buildDeps({
      findProjectUsersByRoles: vi
        .fn()
        .mockResolvedValue([{ id: 'pm-1', email: 'pm@x.com', fullName: 'PM' }]),
    });
    // No hold points and no NCRs => the only thing the old scan would have
    // created here is a missing-diary alert. It must not be created.
    (
      deps.prisma as unknown as { holdPoint: { findMany: ReturnType<typeof vi.fn> } }
    ).holdPoint.findMany = vi.fn().mockResolvedValue([]);
    (
      deps.prisma as unknown as { notificationAlert: { create: ReturnType<typeof vi.fn> } }
    ).notificationAlert.create = alertCreate;

    const result = await processSystemAlerts(
      { now: new Date('2026-06-23T12:00:00.000Z'), projectIds: ['project-1'] },
      deps,
    );

    expect(alertCreate).not.toHaveBeenCalled();
    expect(result.alertsCreated).toBe(0);
    expect(result.createdAlerts).toEqual([]);
  });
});
