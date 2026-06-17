import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  instanceFindUnique: vi.fn(),
  lotUpdate: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    iTPInstance: { findUnique: mocks.instanceFindUnique },
    lot: { update: mocks.lotUpdate },
  },
}));

vi.mock('../../../lib/serverLogger.js', () => ({
  logError: mocks.logError,
}));

import { updateLotStatusFromITP } from './lotProgression.js';

function makeInstance({
  lotStatus = 'not_started',
  items,
  completions,
}: {
  lotStatus?: string;
  items: Array<{
    id: string;
    evidenceRequired?: string | null;
    testType?: string | null;
  }>;
  completions: Array<{ checklistItemId: string; status: string }>;
}) {
  return {
    id: 'itp-1',
    lot: { id: 'lot-1', status: lotStatus },
    templateSnapshot: null,
    template: { checklistItems: items },
    completions,
  };
}

describe('updateLotStatusFromITP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lotUpdate.mockResolvedValue({});
  });

  it('moves a one-item not-started ITP straight to completed', async () => {
    mocks.instanceFindUnique.mockResolvedValue(
      makeInstance({
        items: [{ id: 'hold-point-1', evidenceRequired: 'none', testType: null }],
        completions: [{ checklistItemId: 'hold-point-1', status: 'completed' }],
      }),
    );

    await updateLotStatusFromITP('itp-1');

    expect(mocks.lotUpdate).toHaveBeenCalledWith({
      where: { id: 'lot-1' },
      data: { status: 'completed' },
    });
  });

  it('moves a partially completed not-started ITP to in progress', async () => {
    mocks.instanceFindUnique.mockResolvedValue(
      makeInstance({
        items: [
          { id: 'item-1', evidenceRequired: 'none', testType: null },
          { id: 'item-2', evidenceRequired: 'none', testType: null },
        ],
        completions: [{ checklistItemId: 'item-1', status: 'completed' }],
      }),
    );

    await updateLotStatusFromITP('itp-1');

    expect(mocks.lotUpdate).toHaveBeenCalledWith({
      where: { id: 'lot-1' },
      data: { status: 'in_progress' },
    });
  });

  it('moves a lot to awaiting_test when all non-test items are done but test items remain', async () => {
    mocks.instanceFindUnique.mockResolvedValue(
      makeInstance({
        items: [
          { id: 'inspection-1', evidenceRequired: 'none', testType: null },
          { id: 'test-1', evidenceRequired: 'test', testType: 'density' },
        ],
        completions: [{ checklistItemId: 'inspection-1', status: 'completed' }],
      }),
    );

    await updateLotStatusFromITP('itp-1');

    expect(mocks.lotUpdate).toHaveBeenCalledWith({
      where: { id: 'lot-1' },
      data: { status: 'awaiting_test' },
    });
  });
});
