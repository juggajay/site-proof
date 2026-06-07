import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Characterizes the race-safe NCR number allocator shared by the standalone NCR
 * create route (ncrCore.ts) and the NCR-from-failed-ITP-item path
 * (itp/completions.ts). Both must derive the next number as max sequence + 1
 * INSIDE a transaction with a retry on the [projectId, ncrNumber] unique
 * constraint — not as a plain row count + 1, which two concurrent "Mark as
 * Failed" submissions can both compute, 500ing the second one.
 *
 * The Prisma client is mocked so no real database is touched.
 */

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  ncrFindMany: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    $transaction: mocks.transaction,
    nCR: { findMany: mocks.ncrFindMany },
  },
}));

import { createNcrWithAllocatedNumber, NCR_NUMBER_RETRY_LIMIT } from './ncrNumberAllocation.js';

// Build a fake transaction client whose nCR.findMany returns the supplied rows.
function txClientReturning(rows: Array<{ ncrNumber: string }>) {
  return { nCR: { findMany: vi.fn().mockResolvedValue(rows) } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createNcrWithAllocatedNumber', () => {
  it('derives the next number from the highest existing sequence (max+1, not count+1)', async () => {
    // Sequence has a gap: a count-based scheme would produce NCR-0003 (count 2 + 1)
    // and collide with the existing NCR-0007. Max+1 must yield NCR-0008.
    const tx = txClientReturning([{ ncrNumber: 'NCR-0002' }, { ncrNumber: 'NCR-0007' }]);
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    let allocatedNumber: string | undefined;
    const result = await createNcrWithAllocatedNumber('project-1', async (_tx, ncrNumber) => {
      allocatedNumber = ncrNumber;
      return { id: 'ncr-1', ncrNumber };
    });

    expect(allocatedNumber).toBe('NCR-0008');
    expect(result).toEqual({ id: 'ncr-1', ncrNumber: 'NCR-0008' });
    expect(tx.nCR.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1', ncrNumber: { startsWith: 'NCR-' } },
      select: { ncrNumber: true },
    });
  });

  it('starts at NCR-0001 when no NCRs exist yet', async () => {
    const tx = txClientReturning([]);
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    const result = await createNcrWithAllocatedNumber('project-1', async (_tx, ncrNumber) => ({
      ncrNumber,
    }));

    expect(result).toEqual({ ncrNumber: 'NCR-0001' });
  });

  it('retries on a [projectId, ncrNumber] unique-constraint clash and succeeds', async () => {
    const tx = txClientReturning([{ ncrNumber: 'NCR-0001' }]);
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    const p2002 = { code: 'P2002', meta: { target: ['projectId', 'ncrNumber'] } };
    let attempts = 0;
    const result = await createNcrWithAllocatedNumber('project-1', async (_tx, ncrNumber) => {
      attempts += 1;
      if (attempts === 1) {
        throw p2002;
      }
      return { ncrNumber };
    });

    expect(attempts).toBe(2);
    expect(result).toEqual({ ncrNumber: 'NCR-0002' });
  });

  it('rethrows the unique-constraint error once the retry limit is exhausted', async () => {
    // Matches the standalone NCR route's prior behaviour: the last attempt's
    // P2002 propagates rather than retrying forever.
    const tx = txClientReturning([]);
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    const p2002 = { code: 'P2002', meta: { target: ['projectId', 'ncrNumber'] } };
    let attempts = 0;

    await expect(
      createNcrWithAllocatedNumber('project-1', async () => {
        attempts += 1;
        throw p2002;
      }),
    ).rejects.toBe(p2002);

    expect(attempts).toBe(NCR_NUMBER_RETRY_LIMIT);
  });

  it('rethrows unrelated errors immediately without retrying', async () => {
    const tx = txClientReturning([]);
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    let attempts = 0;
    await expect(
      createNcrWithAllocatedNumber('project-1', async () => {
        attempts += 1;
        throw new Error('database is on fire');
      }),
    ).rejects.toThrow('database is on fire');

    expect(attempts).toBe(1);
  });
});
