import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

import {
  VARIATION_NUMBER_RETRY_LIMIT,
  createVariationWithAllocatedNumber,
} from './variationNumberAllocation.js';

function txClientReturning(rows: Array<{ variationNumber: string }>) {
  return { variation: { findMany: vi.fn().mockResolvedValue(rows) } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createVariationWithAllocatedNumber', () => {
  it('starts at VAR-0001 when no variations exist yet', async () => {
    const tx = txClientReturning([]);
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    const result = await createVariationWithAllocatedNumber(
      'project-1',
      async (_tx, variationNumber) => ({
        variationNumber,
      }),
    );

    expect(result).toEqual({ variationNumber: 'VAR-0001' });
    expect(tx.variation.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1', variationNumber: { startsWith: 'VAR-' } },
      select: { variationNumber: true },
    });
  });

  it('derives the next number from the highest existing sequence, not row count', async () => {
    const tx = txClientReturning([
      { variationNumber: 'VAR-0002' },
      { variationNumber: 'VAR-0007' },
    ]);
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    const result = await createVariationWithAllocatedNumber(
      'project-1',
      async (_tx, variationNumber) => ({
        variationNumber,
      }),
    );

    expect(result).toEqual({ variationNumber: 'VAR-0008' });
  });

  it('retries on a [projectId, variationNumber] unique-constraint clash and succeeds', async () => {
    const tx = txClientReturning([{ variationNumber: 'VAR-0001' }]);
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    const p2002 = { code: 'P2002', meta: { target: ['projectId', 'variationNumber'] } };
    let attempts = 0;
    const result = await createVariationWithAllocatedNumber(
      'project-1',
      async (_tx, variationNumber) => {
        attempts += 1;
        if (attempts === 1) {
          throw p2002;
        }
        return { variationNumber };
      },
    );

    expect(attempts).toBe(2);
    expect(result).toEqual({ variationNumber: 'VAR-0002' });
  });

  it('rethrows the unique-constraint error once the retry limit is exhausted', async () => {
    const tx = txClientReturning([]);
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    const p2002 = { code: 'P2002', meta: { target: ['projectId', 'variationNumber'] } };
    let attempts = 0;

    await expect(
      createVariationWithAllocatedNumber('project-1', async () => {
        attempts += 1;
        throw p2002;
      }),
    ).rejects.toBe(p2002);

    expect(attempts).toBe(VARIATION_NUMBER_RETRY_LIMIT);
  });
});
