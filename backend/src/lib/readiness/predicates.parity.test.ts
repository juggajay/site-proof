import { describe, expect, it } from 'vitest';
import { computeConformanceResult } from '../conformancePrerequisites.js';
import { lotConformable } from './predicates.js';

// Parity proof (execution spec §5, F0.1 acceptance): feed synthetic lots
// through the LIVE authoritative gate `computeConformanceResult` and assert
// `lotConformable(result.prerequisites)` reproduces `result.canConform` on every
// permutation. If this ever diverges, the predicate has drifted from the source.

type Completion = { checklistItemId: string; status: string; verificationStatus?: string | null };
type ChecklistItem = {
  id: string;
  description: string;
  pointType: string;
  evidenceRequired?: string | null;
  testType?: string | null;
};
type TestResult = {
  id: string;
  itpChecklistItemId: string | null;
  testType: string;
  passFail: string;
  status: string;
};

function makeLot(opts: {
  status?: string;
  checklistItems?: ChecklistItem[];
  completions?: Completion[];
  testResults?: TestResult[];
  openNcr?: boolean;
  noItp?: boolean;
}) {
  const {
    status = 'in_progress',
    checklistItems = [],
    completions = [],
    testResults = [],
    openNcr = false,
    noItp = false,
  } = opts;
  return {
    id: 'lot-1',
    lotNumber: 'L1',
    status,
    projectId: 'proj-1',
    itpInstance: noItp
      ? null
      : { templateSnapshot: null, template: { checklistItems }, completions },
    testResults,
    ncrLots: openNcr
      ? [{ ncr: { id: 'ncr-1', ncrNumber: 'NCR-1', description: 'x', status: 'open' } }]
      : [],
  };
}

const standardItem: ChecklistItem = { id: 'i1', description: 'Item 1', pointType: 'standard' };
const testItem: ChecklistItem = {
  id: 'i2',
  description: 'Test item',
  pointType: 'standard',
  evidenceRequired: 'test',
  testType: 'compaction',
};
const holdPointItem: ChecklistItem = {
  id: 'i3',
  description: 'HP signoff',
  pointType: 'hold_point',
};

const scenarios: Array<{ name: string; lot: ReturnType<typeof makeLot>; released?: string[] }> = [
  { name: 'no ITP assigned', lot: makeLot({ noItp: true }) },
  {
    name: 'ITP assigned, empty checklist (completed=false)',
    lot: makeLot({ checklistItems: [], completions: [] }),
  },
  {
    name: 'ITP incomplete (1 of 2 done)',
    lot: makeLot({
      checklistItems: [standardItem, { id: 'i1b', description: 'Item 1b', pointType: 'standard' }],
      completions: [{ checklistItemId: 'i1', status: 'completed' }],
    }),
  },
  {
    name: 'ITP complete, no test required → conformable',
    lot: makeLot({
      checklistItems: [standardItem],
      completions: [{ checklistItemId: 'i1', status: 'completed' }],
    }),
  },
  {
    name: 'ITP complete but completion rejected → incomplete',
    lot: makeLot({
      checklistItems: [standardItem],
      completions: [{ checklistItemId: 'i1', status: 'completed', verificationStatus: 'rejected' }],
    }),
  },
  {
    name: 'test required, no result → not conformable',
    lot: makeLot({
      checklistItems: [testItem],
      completions: [{ checklistItemId: 'i2', status: 'completed' }],
    }),
  },
  {
    name: 'test required, failing result → not conformable',
    lot: makeLot({
      checklistItems: [testItem],
      completions: [{ checklistItemId: 'i2', status: 'completed' }],
      testResults: [
        {
          id: 't1',
          itpChecklistItemId: 'i2',
          testType: 'compaction',
          passFail: 'fail',
          status: 'entered',
        },
      ],
    }),
  },
  {
    name: 'test required, passing-unverified → not conformable',
    lot: makeLot({
      checklistItems: [testItem],
      completions: [{ checklistItemId: 'i2', status: 'completed' }],
      testResults: [
        {
          id: 't1',
          itpChecklistItemId: 'i2',
          testType: 'compaction',
          passFail: 'pass',
          status: 'entered',
        },
      ],
    }),
  },
  {
    name: 'test required, passing-verified → conformable',
    lot: makeLot({
      checklistItems: [testItem],
      completions: [{ checklistItemId: 'i2', status: 'completed' }],
      testResults: [
        {
          id: 't1',
          itpChecklistItemId: 'i2',
          testType: 'compaction',
          passFail: 'pass',
          status: 'verified',
        },
      ],
    }),
  },
  {
    name: 'test passing-verified by testType match (no direct link)',
    lot: makeLot({
      checklistItems: [testItem],
      completions: [{ checklistItemId: 'i2', status: 'completed' }],
      testResults: [
        {
          id: 't1',
          itpChecklistItemId: null,
          testType: 'Compaction',
          passFail: 'pass',
          status: 'verified',
        },
      ],
    }),
  },
  {
    name: 'complete + open NCR → not conformable',
    lot: makeLot({
      checklistItems: [standardItem],
      completions: [{ checklistItemId: 'i1', status: 'completed' }],
      openNcr: true,
    }),
  },
  {
    name: 'N/A hold-point signoff, hold point UNRELEASED → blocked',
    lot: makeLot({
      checklistItems: [holdPointItem],
      completions: [{ checklistItemId: 'i3', status: 'not_applicable' }],
    }),
    released: [],
  },
  {
    name: 'N/A hold-point signoff, hold point RELEASED → conformable',
    lot: makeLot({
      checklistItems: [holdPointItem],
      completions: [{ checklistItemId: 'i3', status: 'not_applicable' }],
    }),
    released: ['i3'],
  },
];

describe('lotConformable parity with computeConformanceResult.canConform', () => {
  it.each(scenarios)('$name', ({ lot, released }) => {
    const result = computeConformanceResult(lot, new Set(released ?? []));
    expect(result.prerequisites).toBeDefined();
    expect(lotConformable(result.prerequisites!)).toBe(result.canConform);
  });
});
