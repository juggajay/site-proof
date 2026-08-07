// The requirement-summary SHAPING rules, pinned against synthetic evaluations.
//
// The engine's own arithmetic is covered by `sufficiency/evaluate.test.ts` and,
// end to end against real packs, by `lotRequirements.db.test.ts`. What lives
// here is the three decisions this mapper makes and nothing else: per-rule
// rather than blended, unknown carried as a REASON rather than a number, and an
// outstanding count that excludes verified failures from the numerator.

import { describe, expect, it } from 'vitest';

import type { SufficiencyEvaluation } from '../../lib/readiness/sufficiency/evaluate.js';
import type { RuleCitation, RuleSufficiency } from '../../lib/readiness/sufficiency/types.js';
import { toLotTestRequirements } from './lotRequirements.js';

const CITATION: RuleCitation = {
  authority: 'VicRoads',
  document: 'Section 204 — Earthworks',
  clause: '204.13(a)',
  edition: 'v8.0 (Nov 2025)',
  confirmed: true,
};

function rule(overrides: Partial<RuleSufficiency> = {}): RuleSufficiency {
  return {
    ruleId: 'pack.v1/compaction-density',
    testType: 'compaction',
    state: 'insufficient',
    requiredCount: 6,
    passingCount: 0,
    pendingCount: 0,
    failedCount: 0,
    regime: 'full',
    unknownCauses: [],
    citation: CITATION,
    ...overrides,
  };
}

function evaluation(overrides: Partial<SufficiencyEvaluation> = {}): SufficiencyEvaluation {
  return {
    state: 'insufficient',
    mode: 'warn',
    ruleset: { id: 'pack.v1', status: 'confirmed' },
    rules: [rule()],
    unknownCauses: [],
    maxLotSizeExceedances: [],
    unlinkedPassingTestIds: [],
    sufficiencyBlocks: false,
    verdict: { subjectType: 'lot', subjectId: 'lot-1', sufficient: false, reasonCodes: [] },
    ...overrides,
  };
}

describe('unknown is carried as a reason, never as a number', () => {
  it('keeps requiredCount null and ships the cause when the count cannot be computed', () => {
    const summary = toLotTestRequirements(
      'lot-1',
      evaluation({
        state: 'unknown',
        rules: [
          rule({ state: 'unknown', requiredCount: null, unknownCauses: ['quantity_missing'] }),
        ],
      }),
    );

    expect(summary.state).toBe('unknown');
    expect(summary.rules[0]).toMatchObject({
      requiredCount: null,
      unknownCauses: ['quantity_missing'],
      // Nothing can be raised against a requirement nobody can compute — and a
      // zero here would render as "0 of 0", the exact lie this state exists to
      // avoid.
      outstandingCount: 0,
    });
  });

  it('carries the lot-level cause when NO rule resolved at all', () => {
    const summary = toLotTestRequirements(
      'lot-1',
      evaluation({ state: 'unknown', rules: [], unknownCauses: ['activity_not_canonical'] }),
    );

    expect(summary.rules).toEqual([]);
    expect(summary.unknownCauses).toEqual(['activity_not_canonical']);
  });

  it('treats a missing evaluation as unknown, not as satisfied', () => {
    const summary = toLotTestRequirements('lot-1', null);

    expect(summary.state).toBe('unknown');
    expect(summary.ruleset).toBeNull();
    expect(summary.unknownCauses).toEqual(['no_ruleset_for_project']);
  });
});

describe('per rule, never one blended ratio', () => {
  it('keeps a satisfied rule and an empty rule as two separate lines', () => {
    const summary = toLotTestRequirements(
      'lot-1',
      evaluation({
        state: 'insufficient',
        rules: [
          rule({
            ruleId: 'pack.v1/compaction-density',
            testType: 'compaction',
            state: 'satisfied',
            requiredCount: 6,
            passingCount: 6,
          }),
          rule({
            ruleId: 'pack.v1/moisture',
            testType: 'moisture content',
            state: 'insufficient',
            requiredCount: 3,
            passingCount: 0,
          }),
        ],
      }),
    );

    expect(summary.rules.map((r) => [r.testType, r.passingCount, r.requiredCount])).toEqual([
      ['compaction', 6, 6],
      ['moisture content', 0, 3],
    ]);
    // The satisfied rule must not lend its evidence to the empty one.
    expect(summary.rules[1]?.outstandingCount).toBe(3);
  });
});

describe('the numerator is verified AND passing', () => {
  it('excludes a verified failure from the numerator and leaves its slot outstanding', () => {
    const summary = toLotTestRequirements(
      'lot-1',
      evaluation({
        rules: [rule({ requiredCount: 6, passingCount: 2, pendingCount: 1, failedCount: 3 })],
      }),
    );

    const line = summary.rules[0]!;
    expect(line.passingCount).toBe(2);
    expect(line.failedCount).toBe(3);
    // 6 − 2 passing − 1 awaiting = 3 still to raise. The three failures counted
    // toward nothing, so their slots are vacant again.
    expect(line.outstandingCount).toBe(3);
  });

  it('never reports a negative outstanding count when a lot is over-tested', () => {
    const summary = toLotTestRequirements(
      'lot-1',
      evaluation({ rules: [rule({ requiredCount: 6, passingCount: 8, pendingCount: 2 })] }),
    );

    expect(summary.rules[0]?.outstandingCount).toBe(0);
  });
});

describe('ruleset status is exposed, not asserted away', () => {
  it('carries draft status and a lapsed revalidation through to the caller', () => {
    const summary = toLotTestRequirements(
      'lot-1',
      evaluation({ ruleset: { id: 'pack.v1', status: 'draft', revalidationLapsed: true } }),
    );

    expect(summary.ruleset).toEqual({
      id: 'pack.v1',
      status: 'draft',
      revalidationLapsed: true,
      scaleLabel: null,
    });
  });
});
