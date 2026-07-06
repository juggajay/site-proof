import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Prisma client module so checkConformancePrerequisites can be
// characterized without touching a real database. lot.findUnique and
// holdPoint.findMany are used.
const mocks = vi.hoisted(() => ({
  lotFindUnique: vi.fn(),
  lotFindMany: vi.fn(),
  holdPointFindMany: vi.fn(),
}));

vi.mock('./prisma.js', () => ({
  prisma: {
    lot: { findUnique: mocks.lotFindUnique, findMany: mocks.lotFindMany },
    holdPoint: { findMany: mocks.holdPointFindMany },
  },
}));

import {
  buildItpChecklistCompleteness,
  checkConformancePrerequisites,
  checkConformancePrerequisitesBatch,
  computeConformanceResult,
  getClaimBlockingReasonsForConformedLot,
  isItpCompletionFinished,
  itpRequiresTest,
} from './conformancePrerequisites.js';

/**
 * Characterizes the pure (DB-free) ITP checklist completeness used by the lot
 * conformance gate. Owner decision (2026-06-11): an item is "finished" when its
 * completion status is 'completed' OR 'not_applicable', consistent with how lot
 * auto-progression already counts them. Any other status ('failed', 'pending',
 * 'in_progress', or a missing completion) remains unfinished and still blocks.
 *
 * Hold-point bypass guard: an N/A'd hold-point sign-off item only satisfies
 * conformance when its HoldPoint is released. This is enforced by the
 * DB-backed checkConformancePrerequisites, not by the pure functions below.
 *
 * DELIBERATELY CHANGED FROM OLD BEHAVIOUR: the tests below that previously
 * pinned N/A as a blocker have been updated to reflect the owner decision.
 * Specifically: "does not count not_applicable as finished" is now reversed —
 * N/A IS counted as finished. The hold-point exception is tested separately
 * in the checkConformancePrerequisites suite at the bottom of this file.
 */

const items = [
  { id: 'i1', description: 'First', pointType: 'standard' },
  { id: 'i2', description: 'Second', pointType: 'witness_point' },
  { id: 'i3', description: 'Third', pointType: 'hold_point' },
];

describe('isItpCompletionFinished', () => {
  // DELIBERATELY CHANGED: N/A now counts as finished (owner decision 2026-06-11).
  // The old test "does not count not_applicable as finished" is reversed below.
  it('counts completed as finished', () => {
    expect(isItpCompletionFinished('completed')).toBe(true);
  });

  it('counts not_applicable as finished (owner decision — N/A satisfies conformance)', () => {
    expect(isItpCompletionFinished('not_applicable')).toBe(true);
  });

  it('does not count failed, pending, in_progress, or missing as finished', () => {
    expect(isItpCompletionFinished('failed')).toBe(false);
    expect(isItpCompletionFinished('pending')).toBe(false);
    expect(isItpCompletionFinished('in_progress')).toBe(false);
    expect(isItpCompletionFinished(null)).toBe(false);
    expect(isItpCompletionFinished(undefined)).toBe(false);
  });
});

describe('buildItpChecklistCompleteness', () => {
  it('reports complete when every item is completed', () => {
    const result = buildItpChecklistCompleteness(items, [
      { checklistItemId: 'i1', status: 'completed' },
      { checklistItemId: 'i2', status: 'completed' },
      { checklistItemId: 'i3', status: 'completed' },
    ]);

    expect(result).toEqual({
      completedCount: 3,
      totalCount: 3,
      completed: true,
      incompleteItems: [],
    });
  });

  // DELIBERATELY CHANGED: N/A now counts as finished (owner decision 2026-06-11).
  // The old test expected completed=false when one item was N/A; it is now true.
  it('reports complete when one item is N/A and the rest are completed (N/A satisfies)', () => {
    const result = buildItpChecklistCompleteness(items, [
      { checklistItemId: 'i1', status: 'completed' },
      { checklistItemId: 'i2', status: 'not_applicable' },
      { checklistItemId: 'i3', status: 'completed' },
    ]);

    expect(result.completed).toBe(true);
    expect(result.completedCount).toBe(3);
    expect(result.incompleteItems).toEqual([]);
  });

  it('blocks (incomplete) when one item is failed', () => {
    const result = buildItpChecklistCompleteness(items, [
      { checklistItemId: 'i1', status: 'completed' },
      { checklistItemId: 'i2', status: 'failed' },
      { checklistItemId: 'i3', status: 'completed' },
    ]);

    expect(result.completed).toBe(false);
    expect(result.completedCount).toBe(2);
    expect(result.incompleteItems).toEqual([
      { id: 'i2', description: 'Second', pointType: 'witness_point' },
    ]);
  });

  it('blocks (incomplete) when one item has no completion record', () => {
    const result = buildItpChecklistCompleteness(items, [
      { checklistItemId: 'i1', status: 'completed' },
      { checklistItemId: 'i2', status: 'completed' },
      // i3 has no completion at all
    ]);

    expect(result.completed).toBe(false);
    expect(result.completedCount).toBe(2);
    expect(result.incompleteItems).toEqual([
      { id: 'i3', description: 'Third', pointType: 'hold_point' },
    ]);
  });

  it('blocks completed items that are still pending verification', () => {
    const result = buildItpChecklistCompleteness(items, [
      { checklistItemId: 'i1', status: 'completed', verificationStatus: 'verified' },
      { checklistItemId: 'i2', status: 'completed', verificationStatus: 'pending_verification' },
      { checklistItemId: 'i3', status: 'completed', verificationStatus: 'none' },
    ]);

    expect(result.completed).toBe(false);
    expect(result.completedCount).toBe(2);
    expect(result.incompleteItems).toEqual([
      { id: 'i2', description: 'Second', pointType: 'witness_point' },
    ]);
  });

  it.each(['pending_verification', 'rejected'])(
    'blocks N/A items that are %s instead of accepted',
    (verificationStatus) => {
      const result = buildItpChecklistCompleteness(items, [
        { checklistItemId: 'i1', status: 'completed', verificationStatus: 'none' },
        { checklistItemId: 'i2', status: 'not_applicable', verificationStatus },
        { checklistItemId: 'i3', status: 'completed', verificationStatus: 'none' },
      ]);

      expect(result.completed).toBe(false);
      expect(result.completedCount).toBe(2);
      expect(result.incompleteItems).toEqual([
        { id: 'i2', description: 'Second', pointType: 'witness_point' },
      ]);
    },
  );

  it('is not complete for an empty checklist (matches existing semantics)', () => {
    const result = buildItpChecklistCompleteness([], []);

    expect(result).toEqual({
      completedCount: 0,
      totalCount: 0,
      completed: false,
      incompleteItems: [],
    });
  });
});

/**
 * Characterizes the pure predicate that decides whether a lot's ITP actually
 * requires a test. Real civil QA ties testing to specific ITP points, not to
 * every lot: conformance only blocks on a passing verified test when the ITP
 * has at least one test point (evidenceRequired === 'test' OR a non-empty
 * testType). This mirrors the testItems filter in
 * routes/itp/helpers/lotProgression.ts so the two definitions can't drift.
 *
 * The conformance gate that consumes this (checkConformancePrerequisites) is
 * DB-backed; the mocked-Prisma suite below exercises how the gate wires this
 * predicate into canConform/blockingReasons. Here we lock down the field
 * semantics that drive the gate.
 */
describe('itpRequiresTest', () => {
  it('returns false for an ITP with no checklist items', () => {
    expect(itpRequiresTest([])).toBe(false);
  });

  it('returns false when no item demands a test (none/photo/document, no testType)', () => {
    expect(
      itpRequiresTest([
        { evidenceRequired: 'none', testType: null },
        { evidenceRequired: 'photo', testType: null },
        { evidenceRequired: 'document', testType: null },
      ]),
    ).toBe(false);
  });

  it('returns true when an item has evidenceRequired === "test"', () => {
    expect(
      itpRequiresTest([
        { evidenceRequired: 'none', testType: null },
        { evidenceRequired: 'test', testType: null },
      ]),
    ).toBe(true);
  });

  it('returns true when an item has a non-empty testType (even if evidenceRequired is not "test")', () => {
    expect(itpRequiresTest([{ evidenceRequired: 'photo', testType: 'Compaction' }])).toBe(true);
  });

  it('treats an empty-string testType as no test (no false positive)', () => {
    expect(itpRequiresTest([{ evidenceRequired: 'none', testType: '' }])).toBe(false);
  });

  it('treats missing fields (undefined) as no test', () => {
    expect(itpRequiresTest([{}, { evidenceRequired: undefined, testType: undefined }])).toBe(false);
  });
});

describe('getClaimBlockingReasonsForConformedLot — force-conformance override', () => {
  // A conformed lot whose ITP is incomplete AND missing a required test, plus an
  // open NCR: without the override, all three block; with the override, only the
  // NCR (a post-conformance regression) still blocks.
  const conformance = {
    prerequisites: {
      itpAssigned: true,
      itpCompleted: false,
      itpCompletedCount: 1,
      itpTotalCount: 3,
      testRequired: true,
      hasPassingTest: false,
      noOpenNcrs: false,
      openNcrs: [{ id: 'ncr-1', ncrNumber: 'NCR-001', description: 'Reopened', status: 'open' }],
    },
  };

  it('blocks on ITP + test + NCR when not overridden', () => {
    expect(getClaimBlockingReasonsForConformedLot(conformance)).toEqual([
      'ITP checklist incomplete (1/3 items completed)',
      'ITP requires a matching passing verified test result',
      '1 open NCR(s) must be closed',
    ]);
  });

  it('suppresses ITP-incomplete + test-outstanding but keeps the open-NCR regression when overridden', () => {
    expect(
      getClaimBlockingReasonsForConformedLot(conformance, { conformanceOverridden: true }),
    ).toEqual(['1 open NCR(s) must be closed']);
  });

  it('keeps the N/A hold-point regression enforced even when overridden', () => {
    const withNaHoldPoint = {
      prerequisites: {
        itpAssigned: true,
        itpCompleted: false,
        itpCompletedCount: 0,
        itpTotalCount: 1,
        testRequired: false,
        hasPassingTest: false,
        noOpenNcrs: true,
        openNcrs: [],
        noNaHoldPointBypass: false,
        naHoldPointBlockerCount: 2,
      },
    };
    expect(
      getClaimBlockingReasonsForConformedLot(withNaHoldPoint, { conformanceOverridden: true }),
    ).toEqual(['2 hold point items marked N/A but not released']);
  });
});

/**
 * Characterizes the DB-backed conform gate itself (checkConformancePrerequisites)
 * with a mocked Prisma client. This is the wiring the pure predicates above feed
 * into: canConform = itpAssigned && itpCompleted && (!testRequired || hasPassingTest)
 * && noOpenNcrs && noNaHoldPointBypass, plus the matching blockingReasons.
 *
 * Key behaviour pins:
 *  - a no-test-point ITP conforms with NO test result,
 *  - a test-point ITP still BLOCKS until a passing verified test exists,
 *  - a standard item N/A → conformance passes (NEW: owner decision 2026-06-11),
 *  - hold-point item N/A + hold point NOT released → blocked with specific message,
 *  - hold-point item N/A + hold point released → passes,
 *  - witness-point N/A → passes (witness ≠ hold),
 *  - open NCR / missing test gates unchanged,
 *  - force-conform still bypasses everything (not tested here — route-level).
 *
 * NOTE: this file imports prisma transitively, so the global vitest setup
 * (src/test/setup.ts) runs assertSafeTestDatabaseUrl() on load. The Prisma
 * client is mocked here (no real DB), but the guard still aborts any run whose
 * DATABASE_URL points at a non-local host — so this suite is validated in CI.
 */

interface ChecklistItemFixture {
  id: string;
  description: string;
  pointType: string;
  responsibleParty?: string;
  evidenceRequired: string | null;
  testType: string | null;
}

function makeLot(opts: {
  status?: string;
  checklistItems: ChecklistItemFixture[];
  templateSnapshot?: string | null;
  completionStatuses: Record<
    string,
    string | { status: string; verificationStatus?: string | null }
  >;
  testResults?: {
    id: string;
    testType: string;
    passFail: string;
    status: string;
    itpChecklistItemId?: string | null;
  }[];
  ncrs?: { id: string; ncrNumber: string; description: string; status: string }[];
}) {
  return {
    id: 'lot-1',
    lotNumber: 'LOT-001',
    status: opts.status ?? 'completed',
    projectId: 'project-1',
    itpInstance: {
      templateSnapshot: opts.templateSnapshot ?? null,
      template: {
        checklistItems: opts.checklistItems.map((item) => ({
          ...item,
          responsibleParty: item.responsibleParty ?? 'contractor',
        })),
      },
      completions: Object.entries(opts.completionStatuses).map(([checklistItemId, status]) => ({
        checklistItemId,
        status: typeof status === 'string' ? status : status.status,
        verificationStatus: typeof status === 'string' ? 'none' : status.verificationStatus,
      })),
    },
    testResults: (opts.testResults ?? []).map((testResult) => ({
      ...testResult,
      itpChecklistItemId: testResult.itpChecklistItemId ?? null,
    })),
    ncrLots: (opts.ncrs ?? []).map((ncr) => ({ ncr })),
  };
}

const NON_TEST_ITEM: ChecklistItemFixture = {
  id: 'i1',
  description: 'Visual inspection',
  pointType: 'standard',
  evidenceRequired: 'photo',
  testType: null,
};

const TEST_ITEM: ChecklistItemFixture = {
  id: 'i2',
  description: 'Compaction test',
  pointType: 'standard',
  evidenceRequired: 'test',
  testType: 'Compaction',
};

const HOLD_POINT_ITEM: ChecklistItemFixture = {
  id: 'hp1',
  description: 'Inspector hold point',
  pointType: 'hold_point',
  evidenceRequired: 'none',
  testType: null,
};

const WITNESS_POINT_ITEM: ChecklistItemFixture = {
  id: 'wp1',
  description: 'Superintendent witness',
  pointType: 'witness',
  responsibleParty: 'superintendent',
  evidenceRequired: 'none',
  testType: null,
};

const SUPER_SIGNOFF_ITEM: ChecklistItemFixture = {
  id: 'ss1',
  description: 'Superintendent sign-off (non-witness)',
  pointType: 'standard',
  responsibleParty: 'superintendent',
  evidenceRequired: 'none',
  testType: null,
};

const WITNESS_POINT_TYPE_ITEM: ChecklistItemFixture = {
  id: 'wpt1',
  description: 'Superintendent witness point',
  pointType: 'witness_point',
  responsibleParty: 'superintendent',
  evidenceRequired: 'none',
  testType: null,
};

const PASSING_VERIFIED_TEST = {
  id: 'test-1',
  testType: 'Compaction',
  passFail: 'pass',
  status: 'verified',
};

const WRONG_TYPE_PASSING_VERIFIED_TEST = {
  id: 'test-2',
  testType: 'Slump',
  passFail: 'pass',
  status: 'verified',
};

describe('checkConformancePrerequisites — gate wiring (mocked Prisma)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no released hold points (overridden per test as needed)
    mocks.holdPointFindMany.mockResolvedValue([]);
  });

  it('loads only conformance fields and filters closed NCRs in the database query', async () => {
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM],
        completionStatuses: { i1: 'completed' },
        testResults: [],
      }),
    );

    await checkConformancePrerequisites('lot-1');

    expect(mocks.lotFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lot-1' },
        include: expect.objectContaining({
          testResults: {
            select: {
              id: true,
              itpChecklistItemId: true,
              testType: true,
              passFail: true,
              status: true,
            },
          },
          ncrLots: {
            where: {
              ncr: {
                status: { notIn: ['closed', 'closed_concession'] },
              },
            },
            include: {
              ncr: {
                select: {
                  id: true,
                  ncrNumber: true,
                  description: true,
                  status: true,
                },
              },
            },
          },
        }),
      }),
    );
  });

  it('conforms a no-test-point lot with NO test result (testRequired false)', async () => {
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM],
        completionStatuses: { i1: 'completed' },
        testResults: [],
      }),
    );

    const result = await checkConformancePrerequisites('lot-1');

    expect(result.prerequisites?.testRequired).toBe(false);
    expect(result.prerequisites?.hasPassingTest).toBe(false);
    expect(result.canConform).toBe(true);
    expect(result.blockingReasons).toEqual([]);
    expect(result.blockingReasons).not.toContain(
      'ITP requires a test, but no passing verified test result was recorded',
    );
  });

  it('uses the assigned ITP snapshot instead of later live-template items', async () => {
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM, TEST_ITEM],
        templateSnapshot: JSON.stringify({
          id: 'template-1',
          name: 'Assigned no-test template',
          checklistItems: [NON_TEST_ITEM],
        }),
        completionStatuses: { i1: 'completed' },
        testResults: [],
      }),
    );

    const result = await checkConformancePrerequisites('lot-1');

    expect(result.prerequisites?.itpTotalCount).toBe(1);
    expect(result.prerequisites?.testRequired).toBe(false);
    expect(result.canConform).toBe(true);
    expect(result.blockingReasons).toEqual([]);
  });

  it('blocks a test-point lot until a passing verified test exists', async () => {
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM, TEST_ITEM],
        completionStatuses: { i1: 'completed', i2: 'completed' },
        testResults: [],
      }),
    );

    const result = await checkConformancePrerequisites('lot-1');

    expect(result.prerequisites?.testRequired).toBe(true);
    expect(result.prerequisites?.hasPassingTest).toBe(false);
    expect(result.canConform).toBe(false);
    expect(result.blockingReasons).toContain(
      'ITP requires a matching passing verified test result',
    );
  });

  it('blocks a test-point lot when the only verified passing test is the wrong test type', async () => {
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM, TEST_ITEM],
        completionStatuses: { i1: 'completed', i2: 'completed' },
        testResults: [WRONG_TYPE_PASSING_VERIFIED_TEST],
      }),
    );

    const result = await checkConformancePrerequisites('lot-1');

    expect(result.prerequisites?.testRequired).toBe(true);
    expect(result.prerequisites?.hasPassingTest).toBe(false);
    expect(result.canConform).toBe(false);
    expect(result.blockingReasons).toContain(
      'ITP requires a matching passing verified test result',
    );
  });

  it('accepts a verified passing test linked directly to the required ITP checklist item', async () => {
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM, TEST_ITEM],
        completionStatuses: { i1: 'completed', i2: 'completed' },
        testResults: [
          {
            ...WRONG_TYPE_PASSING_VERIFIED_TEST,
            itpChecklistItemId: 'i2',
          },
        ],
      }),
    );

    const result = await checkConformancePrerequisites('lot-1');

    expect(result.prerequisites?.hasPassingTest).toBe(true);
    expect(result.canConform).toBe(true);
    expect(result.blockingReasons).toEqual([]);
  });

  it('conforms a test-point lot once a passing verified test is recorded (regression)', async () => {
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM, TEST_ITEM],
        completionStatuses: { i1: 'completed', i2: 'completed' },
        testResults: [PASSING_VERIFIED_TEST],
      }),
    );

    const result = await checkConformancePrerequisites('lot-1');

    expect(result.prerequisites?.testRequired).toBe(true);
    expect(result.prerequisites?.hasPassingTest).toBe(true);
    expect(result.canConform).toBe(true);
    expect(result.blockingReasons).toEqual([]);
  });

  it('blocks conformance when a completed item is still pending verification', async () => {
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM],
        completionStatuses: {
          i1: { status: 'completed', verificationStatus: 'pending_verification' },
        },
        testResults: [],
      }),
    );

    const result = await checkConformancePrerequisites('lot-1');

    expect(result.prerequisites?.itpCompleted).toBe(false);
    expect(result.canConform).toBe(false);
    expect(result.blockingReasons).toContain('ITP checklist incomplete (0/1 items completed)');
  });

  // ---- N/A behaviour (owner decision 2026-06-11) ----

  it('standard item N/A → conformance passes (N/A satisfies for non-hold-point items)', async () => {
    // DELIBERATELY CHANGED: old behaviour blocked on N/A; new behaviour allows it.
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM],
        completionStatuses: { i1: 'not_applicable' },
        testResults: [],
      }),
    );

    const result = await checkConformancePrerequisites('lot-1');

    expect(result.canConform).toBe(true);
    expect(result.blockingReasons).toEqual([]);
    expect(result.prerequisites?.itpCompleted).toBe(true);
  });

  it.each(['pending_verification', 'rejected'])(
    'standard item N/A with %s verification still blocks conformance',
    async (verificationStatus) => {
      mocks.lotFindUnique.mockResolvedValue(
        makeLot({
          checklistItems: [NON_TEST_ITEM],
          completionStatuses: {
            i1: { status: 'not_applicable', verificationStatus },
          },
          testResults: [],
        }),
      );

      const result = await checkConformancePrerequisites('lot-1');

      expect(result.prerequisites?.itpCompleted).toBe(false);
      expect(result.canConform).toBe(false);
      expect(result.blockingReasons).toContain('ITP checklist incomplete (0/1 items completed)');
    },
  );

  it('hold-point item N/A + hold point NOT released → blocked with N/A hold-point message', async () => {
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM, HOLD_POINT_ITEM],
        completionStatuses: { i1: 'completed', hp1: 'not_applicable' },
        testResults: [],
      }),
    );
    // holdPoint.findMany returns no released records → hold point not released
    mocks.holdPointFindMany.mockResolvedValue([]);

    const result = await checkConformancePrerequisites('lot-1');

    expect(result.canConform).toBe(false);
    expect(result.prerequisites?.noNaHoldPointBypass).toBe(false);
    expect(result.prerequisites?.naHoldPointBlockerCount).toBe(1);
    expect(result.blockingReasons).toContain('1 hold point item marked N/A but not released');
  });

  it('hold-point item N/A + hold point released → passes (N/A accepted when released)', async () => {
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM, HOLD_POINT_ITEM],
        completionStatuses: { i1: 'completed', hp1: 'not_applicable' },
        testResults: [],
      }),
    );
    // holdPoint.findMany returns a released record for hp1
    mocks.holdPointFindMany.mockResolvedValue([{ itpChecklistItemId: 'hp1' }]);

    const result = await checkConformancePrerequisites('lot-1');

    expect(result.canConform).toBe(true);
    expect(result.prerequisites?.noNaHoldPointBypass).toBe(true);
    expect(result.prerequisites?.naHoldPointBlockerCount).toBe(0);
    expect(result.blockingReasons).toEqual([]);
  });

  it('hold-point item completed (only possible when released) → passes', async () => {
    // The completions route only allows 'completed' on a hold-point item after
    // the hold point is released. This test verifies the conformance gate
    // does not double-check released status for 'completed' items.
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM, HOLD_POINT_ITEM],
        completionStatuses: { i1: 'completed', hp1: 'completed' },
        testResults: [],
      }),
    );

    const result = await checkConformancePrerequisites('lot-1');

    // No N/A items, so holdPoint.findMany is never called for the guard.
    expect(result.canConform).toBe(true);
    expect(result.blockingReasons).toEqual([]);
  });

  it('witness-point N/A → passes (witness ≠ hold, not subject to bypass guard)', async () => {
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM, WITNESS_POINT_ITEM],
        completionStatuses: { i1: 'completed', wp1: 'not_applicable' },
        testResults: [],
      }),
    );

    const result = await checkConformancePrerequisites('lot-1');

    expect(result.canConform).toBe(true);
    expect(result.blockingReasons).toEqual([]);
    // holdPoint guard was not triggered (no N/A hold-point sign-off items)
    expect(mocks.holdPointFindMany).not.toHaveBeenCalled();
  });

  it('witness_point (superintendent) N/A → passes (not release-gated; M17 drift fix)', async () => {
    // The inline predicate only excluded pointType 'witness', so a
    // 'witness_point' superintendent item was wrongly treated as a hold-point
    // sign-off and blocked conformance. The shared isReleaseGatedChecklistItem
    // excludes both witness variants.
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM, WITNESS_POINT_TYPE_ITEM],
        completionStatuses: { i1: 'completed', wpt1: 'not_applicable' },
        testResults: [],
      }),
    );

    const result = await checkConformancePrerequisites('lot-1');

    expect(result.canConform).toBe(true);
    expect(result.blockingReasons).toEqual([]);
    expect(mocks.holdPointFindMany).not.toHaveBeenCalled();
  });

  it('superintendent non-witness sign-off item N/A + NOT released → blocked', async () => {
    // responsibleParty=superintendent with pointType !== witness is treated as
    // a hold-point sign-off item (mirrors completions.ts:209-212).
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM, SUPER_SIGNOFF_ITEM],
        completionStatuses: { i1: 'completed', ss1: 'not_applicable' },
        testResults: [],
      }),
    );
    mocks.holdPointFindMany.mockResolvedValue([]);

    const result = await checkConformancePrerequisites('lot-1');

    expect(result.canConform).toBe(false);
    expect(result.prerequisites?.naHoldPointBlockerCount).toBe(1);
    expect(result.blockingReasons).toContain('1 hold point item marked N/A but not released');
  });

  it('open NCR gate unchanged (blocks regardless of N/A change)', async () => {
    mocks.lotFindUnique.mockResolvedValue(
      makeLot({
        checklistItems: [NON_TEST_ITEM],
        completionStatuses: { i1: 'completed' },
        ncrs: [{ id: 'ncr-1', ncrNumber: 'NCR-001', description: 'Defect', status: 'open' }],
      }),
    );

    const result = await checkConformancePrerequisites('lot-1');

    expect(result.canConform).toBe(false);
    expect(result.blockingReasons).toContain('1 open NCR(s) must be closed');
  });
});

/**
 * computeConformanceResult is the pure (DB-free) core extracted in M39 so the
 * single-lot and batched create-claim paths share one computation. It takes a
 * fetched lot plus the set of its checklist-item ids whose hold point is
 * released, and must reproduce the gate exactly.
 */
describe('computeConformanceResult — pure conformance core (M39)', () => {
  it('conforms a completed no-test lot with no released hold points needed', () => {
    const result = computeConformanceResult(
      makeLot({ checklistItems: [NON_TEST_ITEM], completionStatuses: { i1: 'completed' } }),
      new Set(),
    );

    expect(result.canConform).toBe(true);
    expect(result.prerequisites?.itpCompleted).toBe(true);
    expect(result.blockingReasons).toEqual([]);
  });

  it('blocks an N/A hold-point sign-off item when its id is NOT in the released set', () => {
    const result = computeConformanceResult(
      makeLot({
        checklistItems: [HOLD_POINT_ITEM],
        completionStatuses: { hp1: 'not_applicable' },
      }),
      new Set(), // hp1 not released
    );

    expect(result.canConform).toBe(false);
    expect(result.prerequisites?.naHoldPointBlockerCount).toBe(1);
    expect(result.prerequisites?.noNaHoldPointBypass).toBe(false);
    expect(result.blockingReasons).toContain('1 hold point item marked N/A but not released');
  });

  it('passes the same N/A hold-point item once its id IS in the released set', () => {
    const result = computeConformanceResult(
      makeLot({
        checklistItems: [HOLD_POINT_ITEM],
        completionStatuses: { hp1: 'not_applicable' },
      }),
      new Set(['hp1']), // hp1 released
    );

    expect(result.canConform).toBe(true);
    expect(result.prerequisites?.naHoldPointBlockerCount).toBe(0);
    expect(result.prerequisites?.noNaHoldPointBypass).toBe(true);
  });

  it('still requires a passing verified test for a test-point lot (released set irrelevant)', () => {
    const result = computeConformanceResult(
      makeLot({ checklistItems: [TEST_ITEM], completionStatuses: { i2: 'completed' } }),
      new Set(),
    );

    expect(result.prerequisites?.testRequired).toBe(true);
    expect(result.prerequisites?.hasPassingTest).toBe(false);
    expect(result.canConform).toBe(false);
    expect(result.blockingReasons).toContain(
      'ITP requires a matching passing verified test result',
    );
  });

  it('classifies each unsatisfied test item as no_result, awaiting_verification, or failing', () => {
    const noResultItem: ChecklistItemFixture = {
      id: 'tr-none',
      description: 'Compaction — density ratio',
      pointType: 'standard',
      evidenceRequired: 'test',
      testType: 'Compaction',
    };
    const awaitingItem: ChecklistItemFixture = {
      id: 'tr-await',
      description: 'CBR',
      pointType: 'standard',
      evidenceRequired: 'test',
      testType: 'CBR',
    };
    const failingItem: ChecklistItemFixture = {
      id: 'tr-fail',
      description: 'Moisture',
      pointType: 'standard',
      evidenceRequired: 'test',
      testType: 'Moisture',
    };
    const satisfiedItem: ChecklistItemFixture = {
      id: 'tr-ok',
      description: 'Slump',
      pointType: 'standard',
      evidenceRequired: 'test',
      testType: 'Slump',
    };

    const result = computeConformanceResult(
      makeLot({
        checklistItems: [noResultItem, awaitingItem, failingItem, satisfiedItem],
        completionStatuses: {
          'tr-none': 'completed',
          'tr-await': 'completed',
          'tr-fail': 'completed',
          'tr-ok': 'completed',
        },
        testResults: [
          // CBR passed but not yet verified.
          { id: 'r-cbr', testType: 'CBR', passFail: 'pass', status: 'results_received' },
          // Moisture recorded but failing.
          { id: 'r-moist', testType: 'Moisture', passFail: 'fail', status: 'verified' },
          // Slump satisfied (passing + verified) — excluded from the breakdown.
          { id: 'r-slump', testType: 'Slump', passFail: 'pass', status: 'verified' },
        ],
      }),
      new Set(),
    );

    expect(result.prerequisites?.outstandingTestItems).toEqual([
      {
        itemId: 'tr-none',
        description: 'Compaction — density ratio',
        testType: 'Compaction',
        state: 'no_result',
      },
      { itemId: 'tr-await', description: 'CBR', testType: 'CBR', state: 'awaiting_verification' },
      { itemId: 'tr-fail', description: 'Moisture', testType: 'Moisture', state: 'failing' },
    ]);
  });

  it('satisfies the test gate via itpChecklistItemId link even when testType does not match', () => {
    // The item requires "Compaction" but the passing verified result is typed
    // "Slump" — the free-text fallback would never match. The explicit link
    // (itpChecklistItemId === item id) is what makes the gate reachable.
    const result = computeConformanceResult(
      makeLot({
        checklistItems: [TEST_ITEM], // id 'i2', testType 'Compaction'
        completionStatuses: { i2: 'completed' },
        testResults: [
          {
            id: 'r-link',
            testType: 'Slump',
            passFail: 'pass',
            status: 'verified',
            itpChecklistItemId: 'i2',
          },
        ],
      }),
      new Set(),
    );

    expect(result.prerequisites?.hasPassingTest).toBe(true);
    expect(result.prerequisites?.outstandingTestItems).toEqual([]);
    expect(result.canConform).toBe(true);
  });

  it('reports unmatched_result_exists when a lot has a result that matches no required item', () => {
    // A result exists on the lot but matches the required item neither by link
    // nor by testType — the honest state is "there is a result, link it",
    // not "no result yet" (the #1336 misclassification).
    const result = computeConformanceResult(
      makeLot({
        checklistItems: [TEST_ITEM], // requires 'Compaction'
        completionStatuses: { i2: 'completed' },
        testResults: [{ id: 'r-orphan', testType: 'Slump', passFail: 'pass', status: 'verified' }],
      }),
      new Set(),
    );

    expect(result.prerequisites?.hasPassingTest).toBe(false);
    expect(result.prerequisites?.outstandingTestItems).toEqual([
      {
        itemId: 'i2',
        description: 'Compaction test',
        testType: 'Compaction',
        state: 'unmatched_result_exists',
      },
    ]);
  });
});

/**
 * checkConformancePrerequisitesBatch resolves many lots in a CONSTANT number of
 * queries (one lot.findMany + at most one holdPoint.findMany) instead of the
 * per-lot ~2N+1 the create-claim readiness loop used to fire. Each entry must
 * match what the single-lot gate would have returned.
 */
describe('checkConformancePrerequisitesBatch — constant-query batch (mocked Prisma)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.holdPointFindMany.mockResolvedValue([]);
  });

  function lotWithId<T extends { id: string; lotNumber: string }>(base: T, id: string): T {
    return { ...base, id, lotNumber: id.toUpperCase() };
  }

  it('resolves every lot with a single lot.findMany and no per-lot fan-out', async () => {
    const lotA = lotWithId(
      makeLot({ checklistItems: [NON_TEST_ITEM], completionStatuses: { i1: 'completed' } }),
      'lot-a',
    );
    const lotB = lotWithId(
      makeLot({ checklistItems: [TEST_ITEM], completionStatuses: { i2: 'completed' } }),
      'lot-b',
    );
    mocks.lotFindMany.mockResolvedValue([lotA, lotB]);

    const result = await checkConformancePrerequisitesBatch(['lot-a', 'lot-b']);

    expect(mocks.lotFindMany).toHaveBeenCalledTimes(1);
    // No N/A hold-point sign-off items → the hold-point query is skipped entirely.
    expect(mocks.holdPointFindMany).not.toHaveBeenCalled();

    expect(result.get('lot-a')?.canConform).toBe(true);
    // lot-b is a test point with no passing test → blocked.
    expect(result.get('lot-b')?.canConform).toBe(false);
    expect(result.get('lot-b')?.blockingReasons).toContain(
      'ITP requires a matching passing verified test result',
    );
  });

  it('fires ONE holdPoint.findMany for all lots and scopes released ids per lot', async () => {
    const lotA = lotWithId(
      makeLot({ checklistItems: [HOLD_POINT_ITEM], completionStatuses: { hp1: 'not_applicable' } }),
      'lot-a',
    );
    const lotB = lotWithId(
      makeLot({ checklistItems: [HOLD_POINT_ITEM], completionStatuses: { hp1: 'not_applicable' } }),
      'lot-b',
    );
    mocks.lotFindMany.mockResolvedValue([lotA, lotB]);
    // Only lot-a's hold point is released; lot-b's stays blocked.
    mocks.holdPointFindMany.mockResolvedValue([{ lotId: 'lot-a', itpChecklistItemId: 'hp1' }]);

    const result = await checkConformancePrerequisitesBatch(['lot-a', 'lot-b']);

    expect(mocks.holdPointFindMany).toHaveBeenCalledTimes(1);
    expect(result.get('lot-a')?.prerequisites?.noNaHoldPointBypass).toBe(true);
    expect(result.get('lot-a')?.canConform).toBe(true);
    expect(result.get('lot-b')?.prerequisites?.naHoldPointBlockerCount).toBe(1);
    expect(result.get('lot-b')?.canConform).toBe(false);
  });

  it('returns an empty map (and no queries) for an empty lot id list', async () => {
    const result = await checkConformancePrerequisitesBatch([]);

    expect(result.size).toBe(0);
    expect(mocks.lotFindMany).not.toHaveBeenCalled();
    expect(mocks.holdPointFindMany).not.toHaveBeenCalled();
  });
});
