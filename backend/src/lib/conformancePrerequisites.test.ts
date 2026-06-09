import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Prisma client module so checkConformancePrerequisites can be
// characterized without touching a real database. Only lot.findUnique is used.
const mocks = vi.hoisted(() => ({
  lotFindUnique: vi.fn(),
}));

vi.mock('./prisma.js', () => ({
  prisma: {
    lot: { findUnique: mocks.lotFindUnique },
  },
}));

import {
  buildItpChecklistCompleteness,
  checkConformancePrerequisites,
  isItpCompletionFinished,
  itpRequiresTest,
} from './conformancePrerequisites.js';

/**
 * Characterizes the pure (DB-free) ITP checklist completeness used by the lot
 * conformance gate. The key behaviour: an item is "finished" only when its
 * completion status is 'completed'. This preserves the pre-existing conformance
 * semantics — the conform gate has always counted only 'completed' items. Any
 * other status (including 'not_applicable', 'failed', 'pending', or a missing
 * completion) remains unfinished and still blocks. (Whether N/A should count as
 * finished is a separate behaviour decision, deliberately out of scope here.)
 */

const items = [
  { id: 'i1', description: 'First', pointType: 'standard' },
  { id: 'i2', description: 'Second', pointType: 'witness_point' },
  { id: 'i3', description: 'Third', pointType: 'hold_point' },
];

describe('isItpCompletionFinished', () => {
  it('counts only completed as finished', () => {
    expect(isItpCompletionFinished('completed')).toBe(true);
  });

  it('does not count not_applicable, failed, pending, in_progress, missing as finished', () => {
    expect(isItpCompletionFinished('not_applicable')).toBe(false);
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

  it('blocks (incomplete) when one item is N/A and the rest are completed', () => {
    const result = buildItpChecklistCompleteness(items, [
      { checklistItemId: 'i1', status: 'completed' },
      { checklistItemId: 'i2', status: 'not_applicable' },
      { checklistItemId: 'i3', status: 'completed' },
    ]);

    expect(result.completed).toBe(false);
    expect(result.completedCount).toBe(2);
    expect(result.incompleteItems).toEqual([
      { id: 'i2', description: 'Second', pointType: 'witness_point' },
    ]);
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

/**
 * Characterizes the DB-backed conform gate itself (checkConformancePrerequisites)
 * with a mocked Prisma client. This is the wiring the pure predicates above feed
 * into: canConform = itpAssigned && itpCompleted && (!testRequired || hasPassingTest)
 * && noOpenNcrs, plus the matching blockingReasons. The two acceptance cases the
 * test-requirement change targets are pinned here:
 *  - a no-test-point ITP conforms with NO test result, and
 *  - a test-point ITP still BLOCKS until a passing verified test exists,
 * with a verified-test regression so the gate isn't trivially always-open.
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
  evidenceRequired: string | null;
  testType: string | null;
}

function makeLot(opts: {
  status?: string;
  checklistItems: ChecklistItemFixture[];
  completionStatuses: Record<string, string>;
  testResults?: { id: string; testType: string; passFail: string; status: string }[];
  ncrs?: { id: string; ncrNumber: string; description: string; status: string }[];
}) {
  return {
    id: 'lot-1',
    lotNumber: 'LOT-001',
    status: opts.status ?? 'completed',
    projectId: 'project-1',
    itpInstance: {
      template: { checklistItems: opts.checklistItems },
      completions: Object.entries(opts.completionStatuses).map(([checklistItemId, status]) => ({
        checklistItemId,
        status,
      })),
    },
    testResults: opts.testResults ?? [],
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

const PASSING_VERIFIED_TEST = {
  id: 'test-1',
  testType: 'Compaction',
  passFail: 'pass',
  status: 'verified',
};

describe('checkConformancePrerequisites — gate wiring (mocked Prisma)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      'ITP requires a test, but no passing verified test result was recorded',
    );
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
});
