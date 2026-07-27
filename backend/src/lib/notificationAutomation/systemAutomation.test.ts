import { describe, expect, it, vi } from 'vitest';
import { STALE_HOLD_POINT_ALERT_ROLES } from '../notificationAlertConfig.js';
import { daysOverdue } from '../readiness/predicates.js';
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

/** Overwrite mocked prisma model methods on a deps object built by buildDeps. */
function withPrisma(
  deps: SystemAutomationDependencies,
  overrides: Record<string, Record<string, ReturnType<typeof vi.fn>>>,
): SystemAutomationDependencies {
  const prisma = deps.prisma as unknown as Record<string, Record<string, unknown>>;
  for (const [model, methods] of Object.entries(overrides)) {
    Object.assign(prisma[model]!, methods);
  }
  return deps;
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
    const deps = withPrisma(buildDeps(), {
      notificationAlert: { create: alertCreate },
      notification: { create: notificationCreate, createMany: notificationCreateMany },
    });

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

/**
 * The alert engine used to `Math.ceil` the NCR overdue age while every dashboard
 * surface floors it via the shared `daysOverdue` helper (#1625), so one NCR's
 * alert body and the widget disagreed by a day. These pin the alert path to the
 * SAME helper, and pin the escalation boundaries the number drives.
 */
describe('overdue-NCR alert age matches the dashboard', () => {
  const NOW = new Date('2026-06-20T12:00:00.000Z');
  const DAY_MS = 24 * 60 * 60 * 1000;

  async function runWithOverdueNcr(dueDate: Date) {
    const alertCreate = vi.fn().mockResolvedValue({ id: 'alert-ncr' });
    const ncr = {
      id: 'ncr-1',
      ncrNumber: 'NCR-001',
      description: 'Kerb out of tolerance',
      dueDate,
      responsibleUserId: 'user-1',
    };
    const deps = withPrisma(buildDeps(), {
      nCR: { findMany: vi.fn().mockResolvedValue([ncr]) },
      holdPoint: { findMany: vi.fn().mockResolvedValue([]) },
      notificationAlert: { create: alertCreate },
    });

    const result = await processSystemAlerts({ now: NOW, projectIds: ['project-1'] }, deps);
    return { result, created: alertCreate.mock.calls[0]![0].data as Record<string, string> };
  }

  it('quotes the same number the dashboard shows for the same NCR', async () => {
    // 41 days and 30 minutes: the "42 vs 41" fixture from the dashboard test.
    const dueDate = new Date(NOW.getTime() - 41 * DAY_MS - 30 * 60 * 1000);
    const { result, created } = await runWithOverdueNcr(dueDate);

    expect(result.overdueNcrAlerts).toBe(1);
    expect(created.message).toContain(`is ${daysOverdue(dueDate, NOW)} day(s) overdue`);
    // Full days elapsed, not rounded up — ceil said 42 here.
    expect(created.message).toContain('is 41 day(s) overdue');
  });

  it('does not escalate to high until a full 4th day has elapsed', async () => {
    // Exactly 3x24h: floor = 3, and 3 > 3 is false.
    expect((await runWithOverdueNcr(new Date(NOW.getTime() - 3 * DAY_MS))).created.severity).toBe(
      'medium',
    );
    // The behaviour change: a minute past 3 days ceil'd to 4 => 'high'. Floor
    // keeps it 'medium' until the 4th day is actually complete.
    expect(
      (await runWithOverdueNcr(new Date(NOW.getTime() - 3 * DAY_MS - 60 * 1000))).created.severity,
    ).toBe('medium');
    expect((await runWithOverdueNcr(new Date(NOW.getTime() - 4 * DAY_MS))).created.severity).toBe(
      'high',
    );
  });

  it('does not escalate to critical until a full 8th day has elapsed', async () => {
    expect(
      (await runWithOverdueNcr(new Date(NOW.getTime() - 7 * DAY_MS - 60 * 1000))).created.severity,
    ).toBe('high');
    expect((await runWithOverdueNcr(new Date(NOW.getTime() - 8 * DAY_MS))).created.severity).toBe(
      'critical',
    );
  });
});

describe('processSystemAlerts missing-diary alert is retired', () => {
  it('never creates a pending_approval/diary alert, even with no hold points or NCRs', async () => {
    const alertCreate = vi.fn().mockResolvedValue({ id: 'alert-x' });
    // No hold points and no NCRs => the only thing the old scan would have
    // created here is a missing-diary alert. It must not be created.
    const deps = withPrisma(
      buildDeps({
        findProjectUsersByRoles: vi
          .fn()
          .mockResolvedValue([{ id: 'pm-1', email: 'pm@x.com', fullName: 'PM' }]),
      }),
      {
        holdPoint: { findMany: vi.fn().mockResolvedValue([]) },
        notificationAlert: { create: alertCreate },
      },
    );

    const result = await processSystemAlerts(
      { now: new Date('2026-06-23T12:00:00.000Z'), projectIds: ['project-1'] },
      deps,
    );

    expect(alertCreate).not.toHaveBeenCalled();
    expect(result.alertsCreated).toBe(0);
    expect(result.createdAlerts).toEqual([]);
  });
});
