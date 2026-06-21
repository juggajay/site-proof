import { describe, expect, it, vi } from 'vitest';
import { assertCompanyProjectCapacity } from './projectCreationLimit.js';

function createProjectLimitClient({
  subscriptionTier = 'basic',
  projectCount = 0,
}: {
  subscriptionTier?: string | null;
  projectCount?: number;
} = {}) {
  const calls: string[] = [];
  const client = {
    $queryRaw: vi.fn(async <T = unknown>() => {
      calls.push('lock');
      return [{ id: 'company-1' }] as T;
    }),
    company: {
      findUnique: vi.fn(async () => {
        calls.push('company');
        return { subscriptionTier };
      }),
    },
    project: {
      count: vi.fn(async () => {
        calls.push('count');
        return projectCount;
      }),
    },
  };

  return { calls, client };
}

describe('assertCompanyProjectCapacity', () => {
  it('locks the company row before counting projects', async () => {
    const { calls, client } = createProjectLimitClient({ projectCount: 2 });

    await assertCompanyProjectCapacity(client, 'company-1');

    expect(calls).toEqual(['lock', 'company', 'count']);
    expect(client.project.count).toHaveBeenCalledWith({ where: { companyId: 'company-1' } });
  });

  it('rejects project creation when the tier limit is already reached', async () => {
    const { calls, client } = createProjectLimitClient({ projectCount: 3 });

    await expect(assertCompanyProjectCapacity(client, 'company-1')).rejects.toThrow(
      'basic subscription allows up to 3 projects',
    );
    expect(calls).toEqual(['lock', 'company', 'count']);
  });

  it('does not count projects for unlimited-tier companies', async () => {
    const { calls, client } = createProjectLimitClient({ subscriptionTier: 'unlimited' });

    await assertCompanyProjectCapacity(client, 'company-1');

    expect(calls).toEqual(['lock', 'company']);
    expect(client.project.count).not.toHaveBeenCalled();
  });

  it('normalizes cased and padded paid tiers before applying the project cap', async () => {
    const { calls, client } = createProjectLimitClient({
      subscriptionTier: ' Professional ',
      projectCount: 9,
    });

    await assertCompanyProjectCapacity(client, 'company-1');

    expect(calls).toEqual(['lock', 'company', 'count']);
  });

  it('normalizes cased and padded tiers in project cap errors', async () => {
    const { client } = createProjectLimitClient({
      subscriptionTier: ' Professional ',
      projectCount: 10,
    });

    await expect(assertCompanyProjectCapacity(client, 'company-1')).rejects.toThrow(
      'professional subscription allows up to 10 projects',
    );
  });
});
