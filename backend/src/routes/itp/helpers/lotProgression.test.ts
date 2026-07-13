import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  instanceFindUnique: vi.fn(),
  instanceUpdate: vi.fn(),
  lotUpdate: vi.fn(),
  auditLogCreate: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    iTPInstance: { findUnique: mocks.instanceFindUnique, update: mocks.instanceUpdate },
    lot: { update: mocks.lotUpdate },
    auditLog: { create: mocks.auditLogCreate },
  },
}));

vi.mock('../../../lib/serverLogger.js', () => ({
  logError: mocks.logError,
}));

import { updateLotStatusFromITP } from './lotProgression.js';

function makeInstance({
  lotStatus = 'not_started',
  instanceStatus = 'not_started',
  items,
  completions,
  holdPoints = [],
}: {
  lotStatus?: string;
  instanceStatus?: string;
  items: Array<{
    id: string;
    evidenceRequired?: string | null;
    testType?: string | null;
    pointType?: string | null;
    responsibleParty?: string | null;
  }>;
  completions: Array<{
    checklistItemId: string;
    status: string;
    verificationStatus?: string | null;
  }>;
  holdPoints?: Array<{
    itpChecklistItemId: string;
    status: string;
  }>;
}) {
  return {
    id: 'itp-1',
    status: instanceStatus,
    lot: { id: 'lot-1', projectId: 'proj-1', lotNumber: 'LOT-001', status: lotStatus, holdPoints },
    templateSnapshot: null,
    template: { checklistItems: items },
    completions,
  };
}

describe('updateLotStatusFromITP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lotUpdate.mockResolvedValue({});
    mocks.instanceUpdate.mockResolvedValue({});
    mocks.auditLogCreate.mockResolvedValue({});
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
    expect(mocks.instanceUpdate).toHaveBeenCalledWith({
      where: { id: 'itp-1' },
      data: { status: 'completed' },
    });
    // Auto-progression audits the transition so the map time scrubber can replay it.
    expect(mocks.auditLogCreate).toHaveBeenCalledTimes(1);
    const audited = mocks.auditLogCreate.mock.calls[0][0].data;
    expect(audited.action).toBe('lot_status_changed');
    expect(JSON.parse(audited.changes).status).toEqual({ from: 'not_started', to: 'completed' });
  });

  it('does not count a rejected completion toward auto-progression', async () => {
    mocks.instanceFindUnique.mockResolvedValue(
      makeInstance({
        items: [{ id: 'item-1', evidenceRequired: 'none', testType: null }],
        completions: [
          { checklistItemId: 'item-1', status: 'completed', verificationStatus: 'rejected' },
        ],
      }),
    );

    await updateLotStatusFromITP('itp-1');

    expect(mocks.lotUpdate).not.toHaveBeenCalled();
    expect(mocks.instanceUpdate).not.toHaveBeenCalled();
  });

  it('does not count a pending-verification completion toward auto-progression', async () => {
    mocks.instanceFindUnique.mockResolvedValue(
      makeInstance({
        items: [{ id: 'item-1', evidenceRequired: 'none', testType: null }],
        completions: [
          {
            checklistItemId: 'item-1',
            status: 'completed',
            verificationStatus: 'pending_verification',
          },
        ],
      }),
    );

    await updateLotStatusFromITP('itp-1');

    expect(mocks.lotUpdate).not.toHaveBeenCalled();
    expect(mocks.instanceUpdate).not.toHaveBeenCalled();
  });

  it('counts an accepted N/A completion toward auto-progression', async () => {
    mocks.instanceFindUnique.mockResolvedValue(
      makeInstance({
        items: [{ id: 'item-1', evidenceRequired: 'none', testType: null }],
        completions: [
          { checklistItemId: 'item-1', status: 'not_applicable', verificationStatus: 'none' },
        ],
      }),
    );

    await updateLotStatusFromITP('itp-1');

    expect(mocks.lotUpdate).toHaveBeenCalledWith({
      where: { id: 'lot-1' },
      data: { status: 'completed' },
    });
    expect(mocks.instanceUpdate).toHaveBeenCalledWith({
      where: { id: 'itp-1' },
      data: { status: 'completed' },
    });
  });

  it.each(['pending_verification', 'rejected'])(
    'does not count an N/A completion with %s verification toward auto-progression',
    async (verificationStatus) => {
      mocks.instanceFindUnique.mockResolvedValue(
        makeInstance({
          items: [{ id: 'item-1', evidenceRequired: 'none', testType: null }],
          completions: [
            { checklistItemId: 'item-1', status: 'not_applicable', verificationStatus },
          ],
        }),
      );

      await updateLotStatusFromITP('itp-1');

      expect(mocks.lotUpdate).not.toHaveBeenCalled();
      expect(mocks.instanceUpdate).not.toHaveBeenCalled();
    },
  );

  it('does not count an N/A hold-point item before the hold point is released', async () => {
    mocks.instanceFindUnique.mockResolvedValue(
      makeInstance({
        items: [
          {
            id: 'hold-point-1',
            evidenceRequired: 'none',
            testType: null,
            pointType: 'hold_point',
          },
        ],
        completions: [
          {
            checklistItemId: 'hold-point-1',
            status: 'not_applicable',
            verificationStatus: 'none',
          },
        ],
        holdPoints: [{ itpChecklistItemId: 'hold-point-1', status: 'notified' }],
      }),
    );

    await updateLotStatusFromITP('itp-1');

    expect(mocks.lotUpdate).not.toHaveBeenCalled();
    expect(mocks.instanceUpdate).not.toHaveBeenCalled();
  });

  it('counts an N/A hold-point item once the hold point is released', async () => {
    mocks.instanceFindUnique.mockResolvedValue(
      makeInstance({
        items: [
          {
            id: 'hold-point-1',
            evidenceRequired: 'none',
            testType: null,
            pointType: 'hold_point',
          },
        ],
        completions: [
          {
            checklistItemId: 'hold-point-1',
            status: 'not_applicable',
            verificationStatus: 'none',
          },
        ],
        holdPoints: [{ itpChecklistItemId: 'hold-point-1', status: 'released' }],
      }),
    );

    await updateLotStatusFromITP('itp-1');

    expect(mocks.lotUpdate).toHaveBeenCalledWith({
      where: { id: 'lot-1' },
      data: { status: 'completed' },
    });
    expect(mocks.instanceUpdate).toHaveBeenCalledWith({
      where: { id: 'itp-1' },
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
    expect(mocks.instanceUpdate).toHaveBeenCalledWith({
      where: { id: 'itp-1' },
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
    expect(mocks.instanceUpdate).toHaveBeenCalledWith({
      where: { id: 'itp-1' },
      data: { status: 'awaiting_test' },
    });
  });

  it('does not rewrite the ITP instance when its stored status is already current', async () => {
    mocks.instanceFindUnique.mockResolvedValue(
      makeInstance({
        lotStatus: 'in_progress',
        instanceStatus: 'completed',
        items: [{ id: 'hold-point-1', evidenceRequired: 'none', testType: null }],
        completions: [{ checklistItemId: 'hold-point-1', status: 'completed' }],
      }),
    );

    await updateLotStatusFromITP('itp-1');

    expect(mocks.lotUpdate).toHaveBeenCalledWith({
      where: { id: 'lot-1' },
      data: { status: 'completed' },
    });
    expect(mocks.instanceUpdate).not.toHaveBeenCalled();
  });
});
