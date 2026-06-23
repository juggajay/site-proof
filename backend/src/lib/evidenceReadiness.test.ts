import { describe, expect, it } from 'vitest';
import {
  buildClaimEvidenceReviewFromInputs,
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
      blockingReasons: ['No ITP assigned to this lot'],
      prerequisites: {
        itpAssigned: false,
        itpCompleted: false,
        itpCompletedCount: 0,
        itpTotalCount: 0,
        itpIncompleteItems: [],
        testRequired: false,
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
          blockingReasons: [
            'ITP checklist incomplete (1/3 items completed)',
            'ITP requires a matching passing verified test result',
          ],
          prerequisites: {
            itpAssigned: true,
            itpCompleted: false,
            itpCompletedCount: 1,
            itpTotalCount: 3,
            itpIncompleteItems: [
              { id: 'item-2', description: 'Hold point release', pointType: 'hold_point' },
              { id: 'item-3', description: 'Survey check', pointType: 'standard' },
            ],
            // This lot's ITP has a test point, so the test blocker still shows.
            testRequired: true,
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

  it('does not raise the test blocker for a no-test-point lot and reports prerequisites met', () => {
    // A lot whose ITP has no test point: the conform gate allows conformance
    // (testRequired false), so the readiness layer must NOT surface a
    // contradictory "No passing verified test result" blocker, and the
    // "Conformance prerequisites met" support line must appear.
    const readiness = buildLotReadinessFromInputs(
      baseInput({
        conformStatus: {
          canConform: true,
          blockingReasons: [],
          prerequisites: {
            itpAssigned: true,
            itpCompleted: true,
            itpCompletedCount: 2,
            itpTotalCount: 2,
            itpIncompleteItems: [],
            testRequired: false,
            hasPassingTest: false,
            testResults: [],
            noOpenNcrs: true,
            openNcrs: [],
          },
        },
      }),
    );

    const codes = readiness.conformance.blockers.map((readinessItem) => readinessItem.code);
    expect(codes).not.toContain('no_passing_verified_test');
    // The conformance bucket has no blockers at all and is ready...
    expect(readiness.conformance.blockers).toEqual([]);
    expect(readiness.conformance.state).toBe('ready');
    // ...and the support line that was previously suppressed now appears.
    expect(readiness.conformance.support.map((readinessItem) => readinessItem.code)).toContain(
      'conformance_prerequisites_met',
    );
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
            testRequired: true,
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
            testRequired: true,
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
    expect(readiness.conformance.support).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'lot_already_claimed',
          title: 'Conformance complete',
          blocksAction: false,
        }),
      ]),
    );
  });

  it('keeps a partially claimed conformed lot selectable and reports remaining percentage', () => {
    const readiness = buildLotReadinessFromInputs(
      baseInput({
        lot: {
          id: 'lot-5',
          lotNumber: 'LOT-005',
          status: 'conformed',
          budgetAmount: 200000,
          claimedInId: null,
          claimedPercentage: 50,
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
            testRequired: true,
            hasPassingTest: true,
            testResults: [
              { id: 'test-5', testType: 'Compaction', passFail: 'pass', status: 'verified' },
            ],
            noOpenNcrs: true,
            openNcrs: [],
          },
        },
      }),
    );

    expect(readiness.claim.state).not.toBe('already_claimed');
    expect(readiness.claim.claimedPercentage).toBe(50);
    expect(readiness.claim.remainingPercentage).toBe(50);
    expect(readiness.claim.blockers.some((blocker) => blocker.blocksAction)).toBe(false);
    expect(readiness.claim.support).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'partially_claimed',
          blocksAction: false,
        }),
      ]),
    );
  });

  it('builds post-claim evidence review with readiness vocabulary', () => {
    const review = buildClaimEvidenceReviewFromInputs({
      analyzedAt: '2026-05-21T00:00:00.000Z',
      claim: {
        id: 'claim-1',
        claimNumber: 7,
        totalClaimedAmount: 1500,
        claimedLots: [
          {
            amountClaimed: 1000,
            lot: {
              id: 'lot-ready',
              lotNumber: 'LOT-READY',
              activityType: 'Earthworks',
              testResults: [{ id: 'test-1', status: 'verified', passFail: 'pass' }],
              ncrLots: [],
              documents: [
                { id: 'photo-1', documentType: 'photo' },
                { id: 'photo-2', documentType: 'photo' },
                { id: 'photo-3', documentType: 'photo' },
              ],
              itpInstance: {
                template: {
                  checklistItems: [
                    { id: 'item-1', pointType: 'standard' },
                    { id: 'item-2', pointType: 'standard' },
                  ],
                },
                completions: [
                  {
                    id: 'completion-1',
                    status: 'completed',
                    verificationStatus: 'verified',
                    checklistItemId: 'item-1',
                  },
                  {
                    id: 'completion-2',
                    status: 'completed',
                    verificationStatus: 'verified',
                    checklistItemId: 'item-2',
                  },
                ],
              },
              holdPoints: [],
            },
          },
          {
            amountClaimed: 500,
            lot: {
              id: 'lot-blocked',
              lotNumber: 'LOT-BLOCKED',
              activityType: 'Drainage',
              testResults: [{ id: 'test-2', status: 'verified', passFail: 'fail' }],
              ncrLots: [
                {
                  ncr: {
                    id: 'ncr-1',
                    status: 'open',
                    severity: 'major',
                  },
                },
              ],
              documents: [],
              itpInstance: null,
              holdPoints: [{ id: 'hp-1', status: 'requested' }],
            },
          },
        ],
      },
    });

    expect(review.claimId).toBe('claim-1');
    expect(review.summary).toMatchObject({
      totalLots: 2,
      readyCount: 1,
      blockedCount: 1,
      totalClaimAmount: 1500,
      recommendedAmount: 1000,
    });
    expect(review.lots[0].claim.state).toBe('ready');
    expect(review.lots[0].claim.support.map((readinessItem) => readinessItem.code)).toContain(
      'itp_complete',
    );
    expect(review.lots[1].claim.state).toBe('blocked');
    expect(review.lots[1].claim.blockers.map((readinessItem) => readinessItem.code)).toEqual(
      expect.arrayContaining(['failed_tests', 'open_major_ncrs', 'unreleased_hold_points']),
    );
    expect(
      review.lots[1].claim.blockers.every((readinessItem) => !readinessItem.blocksAction),
    ).toBe(true);
  });

  it('counts N/A items as complete and excludes rejected items from claim readiness', () => {
    const buildReview = (
      completions: Array<{
        id: string;
        status: string;
        verificationStatus: string | null;
        checklistItemId: string;
      }>,
    ) =>
      buildClaimEvidenceReviewFromInputs({
        analyzedAt: '2026-06-10T00:00:00.000Z',
        claim: {
          id: 'claim-itp',
          claimNumber: 9,
          totalClaimedAmount: 1000,
          claimedLots: [
            {
              amountClaimed: 1000,
              lot: {
                id: 'lot-itp',
                lotNumber: 'LOT-ITP',
                activityType: 'Earthworks',
                testResults: [{ id: 'test-1', status: 'verified', passFail: 'pass' }],
                ncrLots: [],
                documents: [
                  { id: 'photo-1', documentType: 'photo' },
                  { id: 'photo-2', documentType: 'photo' },
                  { id: 'photo-3', documentType: 'photo' },
                ],
                itpInstance: {
                  template: {
                    checklistItems: [
                      { id: 'item-1', pointType: 'standard' },
                      { id: 'item-2', pointType: 'standard' },
                    ],
                  },
                  completions,
                },
                holdPoints: [],
              },
            },
          ],
        },
      }).lots[0].claim;

    // M13: a completed item + an N/A item = fully complete (N/A counts as done).
    const naReview = buildReview([
      { id: 'c1', status: 'completed', verificationStatus: 'verified', checklistItemId: 'item-1' },
      { id: 'c2', status: 'not_applicable', verificationStatus: null, checklistItemId: 'item-2' },
    ]);
    expect(naReview.support.map((readinessItem) => readinessItem.code)).toContain('itp_complete');

    // H5: a completed-but-rejected item must NOT count as complete.
    const rejectedReview = buildReview([
      { id: 'c1', status: 'completed', verificationStatus: 'verified', checklistItemId: 'item-1' },
      { id: 'c2', status: 'completed', verificationStatus: 'rejected', checklistItemId: 'item-2' },
    ]);
    const rejectedCodes = [
      ...rejectedReview.blockers,
      ...rejectedReview.warnings,
      ...rejectedReview.support,
    ].map((readinessItem) => readinessItem.code);
    expect(rejectedCodes).toContain('itp_incomplete');
    expect(rejectedCodes).not.toContain('itp_complete');
  });

  it('treats an unverified passing test as a pending warning, not claim support', () => {
    const review = buildClaimEvidenceReviewFromInputs({
      analyzedAt: '2026-06-07T00:00:00.000Z',
      claim: {
        id: 'claim-pending',
        claimNumber: 8,
        totalClaimedAmount: 1000,
        claimedLots: [
          {
            amountClaimed: 1000,
            lot: {
              id: 'lot-unverified',
              lotNumber: 'LOT-UNVERIFIED',
              activityType: 'Earthworks',
              // Lab certificate received and marked pass, but not yet verified.
              testResults: [{ id: 'test-1', status: 'results_received', passFail: 'pass' }],
              ncrLots: [],
              documents: [
                { id: 'photo-1', documentType: 'photo' },
                { id: 'photo-2', documentType: 'photo' },
                { id: 'photo-3', documentType: 'photo' },
              ],
              itpInstance: {
                template: {
                  checklistItems: [{ id: 'item-1', pointType: 'standard' }],
                },
                completions: [
                  {
                    id: 'completion-1',
                    status: 'completed',
                    verificationStatus: 'verified',
                    checklistItemId: 'item-1',
                  },
                ],
              },
              holdPoints: [],
            },
          },
        ],
      },
    });

    const lot = review.lots[0];
    const codes = (bucket: { code: string }[]) => bucket.map((readinessItem) => readinessItem.code);

    // Unverified pass raises the (previously dead) pending warning...
    expect(codes(lot.claim.warnings)).toContain('pending_tests');
    // ...and must NOT be counted as supporting evidence.
    expect(codes(lot.claim.support)).not.toContain('passing_tests');
    // A warning (and no blocker) downgrades the line out of "ready".
    expect(lot.claim.state).toBe('warning');
    expect(review.summary.readyCount).toBe(0);
    expect(review.summary.reviewCount).toBe(1);
  });

  it('counts a verified passing test as support with no pending warning', () => {
    const review = buildClaimEvidenceReviewFromInputs({
      analyzedAt: '2026-06-07T00:00:00.000Z',
      claim: {
        id: 'claim-verified',
        claimNumber: 9,
        totalClaimedAmount: 1000,
        claimedLots: [
          {
            amountClaimed: 1000,
            lot: {
              id: 'lot-verified',
              lotNumber: 'LOT-VERIFIED',
              activityType: 'Earthworks',
              testResults: [{ id: 'test-1', status: 'verified', passFail: 'pass' }],
              ncrLots: [],
              documents: [
                { id: 'photo-1', documentType: 'photo' },
                { id: 'photo-2', documentType: 'photo' },
                { id: 'photo-3', documentType: 'photo' },
              ],
              itpInstance: {
                template: {
                  checklistItems: [{ id: 'item-1', pointType: 'standard' }],
                },
                completions: [
                  {
                    id: 'completion-1',
                    status: 'completed',
                    verificationStatus: 'verified',
                    checklistItemId: 'item-1',
                  },
                ],
              },
              holdPoints: [],
            },
          },
        ],
      },
    });

    const lot = review.lots[0];
    const codes = (bucket: { code: string }[]) => bucket.map((readinessItem) => readinessItem.code);

    expect(codes(lot.claim.support)).toContain('passing_tests');
    expect(codes(lot.claim.warnings)).not.toContain('pending_tests');
    expect(lot.claim.state).toBe('ready');
    expect(review.summary.readyCount).toBe(1);
  });

  it('surfaces N/A hold-point bypass as a conformance action blocker', () => {
    // When the conform gate reports a hold-point item was N/A'd but the hold
    // point is not released, the readiness layer must surface a conformance
    // blocker with code 'na_hold_point_not_released'.
    const readiness = buildLotReadinessFromInputs(
      baseInput({
        conformStatus: {
          canConform: false,
          blockingReasons: ['1 hold point item marked N/A but not released'],
          prerequisites: {
            itpAssigned: true,
            itpCompleted: true, // N/A counts as finished for completeness
            itpCompletedCount: 2,
            itpTotalCount: 2,
            itpIncompleteItems: [],
            testRequired: false,
            hasPassingTest: false,
            testResults: [],
            noOpenNcrs: true,
            openNcrs: [],
            naHoldPointBlockerCount: 1,
            noNaHoldPointBypass: false,
          },
        },
      }),
    );

    const codes = readiness.conformance.blockers.map((readinessItem) => readinessItem.code);
    expect(codes).toContain('na_hold_point_not_released');
    expect(
      readiness.conformance.blockers.find((b) => b.code === 'na_hold_point_not_released')
        ?.blocksAction,
    ).toBe(true);
    expect(readiness.conformance.state).toBe('blocked');
  });
});
