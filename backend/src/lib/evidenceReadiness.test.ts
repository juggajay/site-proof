import { describe, expect, it } from 'vitest';
import {
  buildLotReadinessFromInputs,
  filterCommercialReadiness,
  type LotReadinessInput,
} from './evidenceReadiness.js';

function baseInput(overrides: Partial<LotReadinessInput> = {}): LotReadinessInput {
  return {
    lot: {
      id: 'lot-1',
      lotNumber: 'LOT-001',
      status: 'not_started',
      budgetAmount: null,
      claimedInId: null,
    },
    canViewCommercial: true,
    conformStatus: {
      canConform: false,
      blockingReasons: ['No ITP assigned to this lot', 'No passing verified test result'],
      prerequisites: {
        itpAssigned: false,
        itpCompleted: false,
        itpCompletedCount: 0,
        itpTotalCount: 0,
        itpIncompleteItems: [],
        hasPassingTest: false,
        testResults: [],
        noOpenNcrs: true,
        openNcrs: [],
      },
    },
    evidenceCounts: {
      unreleasedHoldPoints: 0,
      releasedHoldPoints: 0,
      approvedDockets: 0,
      diaryEntries: 0,
      documents: 0,
      photos: 0,
      pendingTests: 0,
    },
    ...overrides,
  };
}

describe('evidence readiness helpers', () => {
  it('turns existing conformance prerequisites into action blockers', () => {
    const readiness = buildLotReadinessFromInputs(
      baseInput({
        conformStatus: {
          canConform: false,
          blockingReasons: ['ITP incomplete', 'No passing verified test result'],
          prerequisites: {
            itpAssigned: true,
            itpCompleted: false,
            itpCompletedCount: 1,
            itpTotalCount: 3,
            itpIncompleteItems: [
              { id: 'item-2', description: 'Hold point release', pointType: 'hold_point' },
              { id: 'item-3', description: 'Survey check', pointType: 'standard' },
            ],
            hasPassingTest: false,
            testResults: [
              { id: 'test-1', testType: 'Compaction', passFail: 'pending', status: 'submitted' },
            ],
            noOpenNcrs: true,
            openNcrs: [],
          },
        },
      }),
    );

    expect(readiness.conformance.state).toBe('blocked');
    expect(readiness.conformance.blockers.map((readinessItem) => readinessItem.code)).toEqual([
      'itp_incomplete',
      'no_passing_verified_test',
    ]);
    expect(
      readiness.conformance.blockers.every((readinessItem) => readinessItem.blocksAction),
    ).toBe(true);
    expect(readiness.summary.actionBlockerCount).toBe(3);
  });

  it('treats unreleased hold points as claim evidence blockers without disabling claim selection', () => {
    const readiness = buildLotReadinessFromInputs(
      baseInput({
        lot: {
          id: 'lot-2',
          lotNumber: 'LOT-002',
          status: 'conformed',
          budgetAmount: 12000,
          claimedInId: null,
        },
        conformStatus: {
          canConform: true,
          blockingReasons: [],
          prerequisites: {
            itpAssigned: true,
            itpCompleted: true,
            itpCompletedCount: 3,
            itpTotalCount: 3,
            itpIncompleteItems: [],
            hasPassingTest: true,
            testResults: [
              { id: 'test-2', testType: 'Compaction', passFail: 'pass', status: 'verified' },
            ],
            noOpenNcrs: true,
            openNcrs: [],
          },
        },
        evidenceCounts: {
          unreleasedHoldPoints: 2,
          releasedHoldPoints: 1,
          approvedDockets: 1,
          diaryEntries: 1,
          documents: 3,
          photos: 2,
          pendingTests: 0,
        },
      }),
    );

    const holdPointBlocker = readiness.claim.blockers.find(
      (readinessItem) => readinessItem.code === 'unreleased_hold_points',
    );

    expect(readiness.conformance.state).toBe('already_conformed');
    expect(readiness.claim.state).toBe('warning');
    expect(holdPointBlocker?.severity).toBe('blocker');
    expect(holdPointBlocker?.blocksAction).toBe(false);
    expect(readiness.summary.blockerCount).toBe(1);
    expect(readiness.summary.actionBlockerCount).toBe(0);
  });

  it('physically removes commercial readiness fields for subcontractor callers', () => {
    const readiness = buildLotReadinessFromInputs(
      baseInput({
        canViewCommercial: true,
        lot: {
          id: 'lot-3',
          lotNumber: 'LOT-003',
          status: 'conformed',
          budgetAmount: null,
          claimedInId: null,
        },
        conformStatus: {
          canConform: true,
          blockingReasons: [],
          prerequisites: {
            itpAssigned: true,
            itpCompleted: true,
            itpCompletedCount: 1,
            itpTotalCount: 1,
            itpIncompleteItems: [],
            hasPassingTest: true,
            testResults: [
              { id: 'test-3', testType: 'Compaction', passFail: 'pass', status: 'verified' },
            ],
            noOpenNcrs: true,
            openNcrs: [],
          },
        },
      }),
    );

    expect(readiness.claim).toHaveProperty('budgetAmount', null);
    expect(readiness.claim.blockers.map((readinessItem) => readinessItem.code)).toContain(
      'missing_budget',
    );

    const filtered = filterCommercialReadiness(readiness);

    expect(filtered.claim).not.toHaveProperty('budgetAmount');
    expect(filtered.claim.blockers.map((readinessItem) => readinessItem.code)).not.toContain(
      'missing_budget',
    );
    expect(JSON.stringify(filtered)).not.toContain('budgetAmount');
  });

  it('marks claimed lots as already claimed action blockers for claim readiness', () => {
    const readiness = buildLotReadinessFromInputs(
      baseInput({
        lot: {
          id: 'lot-4',
          lotNumber: 'LOT-004',
          status: 'claimed',
          budgetAmount: 1000,
          claimedInId: 'claim-1',
        },
      }),
    );

    expect(readiness.claim.state).toBe('already_claimed');
    expect(readiness.claim.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'already_claimed',
          blocksAction: true,
        }),
      ]),
    );
  });
});
