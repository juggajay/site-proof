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
