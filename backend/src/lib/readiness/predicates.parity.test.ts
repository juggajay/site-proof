import { describe, expect, it } from 'vitest';
import { computeConformanceResult } from '../conformancePrerequisites.js';
import { lotConformable } from './predicates.js';
import type { FrequencyRule, ResolvedSufficiency, SufficiencyMode } from './sufficiency/types.js';

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
  // Wave C2 Phase 3 [C2L-B1]: the two lab-lifecycle columns. Present here so the
  // parity permutations run with them POPULATED — a lifecycle state is not a
  // count, and neither the gate nor the predicate may start reading them.
  sentToLabAt?: Date | null;
  expectedResultDate?: Date | null;
  // Wave C3 Phase B1 [C3S-B3]: the four sample-point columns, populated in the
  // permutations below for the same reason the C2 stamps are — WHERE a sample
  // was taken is not a count, and neither the gate nor the predicate may start
  // reading it. If one ever does, the parity permutation moves and this fails.
  sampleLatitude?: number | null;
  sampleLongitude?: number | null;
  sampleLocationSource?: string | null;
  sampleLocationAccuracyM?: number | null;
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
    // AT-63: the same conformable lot, with a long-overdue lab wait stamped on
    // the verified row. `sentToLabAt`/`expectedResultDate` must move nothing.
    name: 'test required, passing-verified WITH lab lifecycle stamps → conformable',
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
          sentToLabAt: new Date('2026-01-01T00:00:00.000Z'),
          expectedResultDate: new Date('2026-01-05T00:00:00.000Z'),
        },
      ],
    }),
  },
  {
    // AT-63: a row still sitting at the lab, overdue against a user-supplied
    // date, is exactly as pending as it was before the columns existed.
    name: 'test required, row still at_lab and overdue → not conformable',
    lot: makeLot({
      checklistItems: [testItem],
      completions: [{ checklistItemId: 'i2', status: 'completed' }],
      testResults: [
        {
          id: 't1',
          itpChecklistItemId: 'i2',
          testType: 'compaction',
          passFail: 'pending',
          status: 'at_lab',
          sentToLabAt: new Date('2026-01-01T00:00:00.000Z'),
          expectedResultDate: new Date('2026-01-05T00:00:00.000Z'),
        },
      ],
    }),
  },
  {
    // AT-81: the same conformable lot, with a captured sample point on the
    // verified row. A location must move nothing — the result was verified on
    // the sample, not on the pin.
    name: 'test required, passing-verified WITH a captured sample point → conformable',
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
          sampleLatitude: -33.8688,
          sampleLongitude: 151.2093,
          sampleLocationSource: 'gps',
          sampleLocationAccuracyM: 6,
        },
      ],
    }),
  },
  {
    // AT-81: an UNLOCATED failing row is exactly as unconformable as it was
    // before the columns existed — no location is not a second kind of missing.
    name: 'test required, failing result with NO captured location → not conformable',
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
          sampleLatitude: null,
          sampleLongitude: null,
          sampleLocationSource: null,
          sampleLocationAccuracyM: null,
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

// ---------------------------------------------------------------------------
// Wave C1 (§14 AT-14). The permutation space above is EXTENDED, not rewritten:
// every scenario is re-run against the full sufficiency mode × ruleset status ×
// state cross-product, so parity is proven with the new limb in play too.
// ---------------------------------------------------------------------------

const SUFFICIENCY_RULE: FrequencyRule = {
  id: 'parity/compaction',
  label: 'Parity fixture compaction rule',
  testType: 'compaction',
  appliesTo: { activitySlugs: ['earthworks_general'] },
  minCountByScale: { A: 6 },
  provenance: {
    authority: 'Fixture',
    document: 'Parity',
    clause: '1',
    edition: 'v1',
    pdfPage: 1,
    sourceUrl: 'https://example.test',
    evidenceGrade: 'A',
    checkedOn: '2026-07-27',
    revalidateBy: '2099-01-01',
  },
};

function resolved(
  mode: SufficiencyMode,
  status: 'draft' | 'confirmed',
  rules: FrequencyRule[],
): ResolvedSufficiency {
  return {
    mode,
    ruleset: {
      id: 'parity.v1',
      state: 'vic',
      specSet: 'vicroads',
      scaleKeys: ['A'],
      defaultScale: 'A',
      effectiveFrom: '2020-01-01',
      status,
      rules,
      provenance: SUFFICIENCY_RULE.provenance,
    },
    rules,
    materialType: null,
    geometryAreaM2: null,
    scale: { value: 'A', source: 'ruleset_default' },
    quantity: { value: null, unit: null, source: 'none' },
    areaZone: null,
    regimeByRuleId: new Map(),
    activityCanonical: true,
  };
}

const sufficiencyPermutations: { name: string; sufficiency: ResolvedSufficiency }[] = [];
for (const mode of ['off', 'warn', 'block'] as const) {
  for (const status of ['draft', 'confirmed'] as const) {
    // A rule that resolves and is SHORT (0 of 6), and the unresolved case where
    // no rule matches the activity at all.
    sufficiencyPermutations.push({
      name: `${mode}/${status}/insufficient`,
      sufficiency: resolved(mode, status, [SUFFICIENCY_RULE]),
    });
    sufficiencyPermutations.push({
      name: `${mode}/${status}/no-rule`,
      sufficiency: resolved(mode, status, []),
    });
  }
}

describe('AT-14 parity holds across every sufficiency permutation', () => {
  for (const permutation of sufficiencyPermutations) {
    it.each(scenarios)(`${permutation.name} — $name`, ({ lot, released }) => {
      const result = computeConformanceResult(
        lot,
        new Set(released ?? []),
        permutation.sufficiency,
      );
      expect(result.prerequisites).toBeDefined();
      expect(lotConformable(result.prerequisites!)).toBe(result.canConform);
    });
  }

  // §5.1.2's structural guarantee, restated at the parity boundary: only ONE of
  // the twelve permutations can move the gate, and it is the specced one.
  it('only mode=block on a CONFIRMED ruleset with a shortfall changes canConform', () => {
    for (const scenario of scenarios) {
      const released = new Set(scenario.released ?? []);
      const baseline = computeConformanceResult(scenario.lot, released).canConform;
      for (const permutation of sufficiencyPermutations) {
        const where = `${permutation.name} — ${scenario.name}`;
        const result = computeConformanceResult(scenario.lot, released, permutation.sufficiency);
        const shouldBlock = permutation.name === 'block/confirmed/insufficient';
        expect(result.prerequisites!.sufficiencyBlocks, where).toBe(shouldBlock);
        // Sufficiency can only ever REMOVE conformability, and only in the one
        // specced cell. Eleven of the twelve leave the decision byte-identical.
        expect(result.canConform, where).toBe(baseline && !shouldBlock);
      }
    }
  });
});
