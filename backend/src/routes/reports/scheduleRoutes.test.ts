import { describe, expect, it, vi } from 'vitest';

import { assertScheduledReportCapacity } from './scheduleRoutes.js';

function createCapacityClient(scheduleCount: number) {
  const calls: string[] = [];
  const client = {
    $queryRaw: vi.fn(async <T = unknown>() => {
      calls.push('lock');
      return [{ id: 'project-1' }] as T;
    }),
    scheduledReport: {
      count: vi.fn(async () => {
        calls.push('count');
        return scheduleCount;
      }),
    },
  };

  return { calls, client };
}

describe('assertScheduledReportCapacity', () => {
  it('locks the project row before counting scheduled reports', async () => {
    const { calls, client } = createCapacityClient(24);

    await assertScheduledReportCapacity(client, 'project-1');

    expect(calls).toEqual(['lock', 'count']);
    expect(client.scheduledReport.count).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
    });
  });

  it('rejects when the project is already at the scheduled report cap', async () => {
    const { client } = createCapacityClient(25);

    await expect(assertScheduledReportCapacity(client, 'project-1')).rejects.toThrow(
      'Projects cannot have more than 25 scheduled reports',
    );
  });
});
