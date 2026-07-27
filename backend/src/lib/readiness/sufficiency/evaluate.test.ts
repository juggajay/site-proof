// Wave C1 acceptance tests AT-2, AT-3, AT-4, AT-9 — the pure evaluator (spec §4, §5.1.2).

import { describe, expect, it } from 'vitest';
import type { TestSufficiencyVerdict } from '../contracts/futureConsumers.js';
import { isReadinessReasonCode } from '../contracts/reasonCodes.js';
import { evaluateSufficiency } from './evaluate.js';
import {
  UNKNOWN_CAUSES,
  type FrequencyRule,
  type ResolvedSufficiency,
  type Ruleset,
  type RulesetProvenance,
  type RulesetStatus,
  type SufficiencyTestRow,
  type UnknownCause,
} from './types.js';

// A SYNTHETIC ruleset — never a shipped pack. The shipped packs are draft and
// carry no `reduced` / `perQuantity` limb, so exercising those limbs against
// them is impossible by design (§8.3, §3.2.1).
const PROVENANCE: RulesetProvenance = {
  authority: 'SyntheticAuthority',
  document: 'Synthetic Section 1',
  clause: 'Table 1.1',
  edition: '2026 edition',
  pdfPage: 1,
  sourceUrl: 'https://example.invalid/spec',
  evidenceGrade: 'A',
  checkedOn: '2026-07-26',
  revalidateBy: '2099-01-01',
};

function rule(overrides: Partial<FrequencyRule> = {}): FrequencyRule {
  return {
    id: 'synthetic.v1/compaction',
    label: 'Minimum compaction tests per lot',
    testType: 'compaction',
    appliesTo: { activitySlugs: ['earthworks_general'] },
    minCountByScale: { A: 6 },
    provenance: PROVENANCE,
    ...overrides,
  };
}

function ruleset(overrides: Partial<Ruleset> = {}): Ruleset {
  return {
    id: 'synthetic.v1',
    state: 'vic',
    specSet: 'synthetic',
    scaleKeys: ['A'],
    effectiveFrom: '2020-01-01',
    status: 'confirmed',
    rules: [rule()],
    provenance: PROVENANCE,
    ...overrides,
  };
}

function resolved(overrides: Partial<ResolvedSufficiency> = {}): ResolvedSufficiency {
  const set = overrides.ruleset === undefined ? ruleset() : overrides.ruleset;
  return {
    mode: 'warn',
    ruleset: set,
    rules: set ? set.rules : [],
    scale: { value: 'A', source: 'lot' },
    quantity: { value: null, unit: null, source: 'none' },
    areaZone: null,
    materialType: null,
    geometryAreaM2: null,
    regimeByRuleId: new Map(),
    activityCanonical: true,
    ...overrides,
  };
}

function testRow(overrides: Partial<SufficiencyTestRow> = {}): SufficiencyTestRow {
  return {
    id: 'test-1',
    itpChecklistItemId: null,
    testType: 'compaction',
    passFail: 'pass',
    status: 'verified',
    ...overrides,
  };
}

function evaluate(
  overrides: Partial<ResolvedSufficiency> = {},
  tests: readonly SufficiencyTestRow[] = [],
) {
  return evaluateSufficiency({
    subjectId: 'lot-1',
    resolved: resolved(overrides),
    tests,
    checklistItems: [],
  });
}

describe('AT-2 the real evaluator satisfies TestSufficiencyVerdict', () => {
  it('always populates `state` and `rules` even though both are OPTIONAL on the contract', () => {
    const result = evaluate({}, [testRow()]);
    const verdict: TestSufficiencyVerdict = result.verdict;
    expect(verdict.subjectType).toBe('lot');
    expect(verdict.subjectId).toBe('lot-1');
    expect(verdict.state).toBe('insufficient'); // 1 passing, 6 required
    expect(verdict.rules).toHaveLength(1);
    expect(verdict.rules?.[0]?.requiredCount).toBe(6);
    expect(verdict.rules?.[0]?.passingCount).toBe(1);
  });

  it('emits only reasonCodes inside the closed vocabulary', () => {
    for (const scenario of [
      evaluate({}, [testRow()]), // insufficient
      evaluate(
        {},
        Array.from({ length: 6 }, (_, i) => testRow({ id: `t${i}` })),
      ), // satisfied
      evaluate({ ruleset: null }), // unknown
    ]) {
      expect(scenario.verdict.reasonCodes.length).toBeGreaterThan(0);
      for (const code of scenario.verdict.reasonCodes) {
        expect(isReadinessReasonCode(code)).toBe(true);
      }
    }
  });

  it('the four-key contract fixture still type-checks (the widening stayed OPTIONAL)', () => {
    const legacy: TestSufficiencyVerdict = {
      subjectType: 'lot',
      subjectId: 'lot-1',
      sufficient: false,
      reasonCodes: ['no_passing_verified_test'],
    };
    expect(legacy.state).toBeUndefined();
    expect(legacy.rules).toBeUndefined();
  });

  it('counts pass / pending / verified-fail separately and reads `satisfied` at the floor', () => {
    const result = evaluate({}, [
      ...Array.from({ length: 6 }, (_, i) => testRow({ id: `pass-${i}` })),
      testRow({ id: 'pending-1', passFail: 'pending', status: 'at_lab' }),
      testRow({ id: 'fail-1', passFail: 'fail', status: 'verified' }),
      // An UNVERIFIED failure is neither passing nor failing evidence.
      testRow({ id: 'fail-2', passFail: 'fail', status: 'entered' }),
    ]);
    const [only] = result.rules;
    expect(only.passingCount).toBe(6);
    expect(only.pendingCount).toBe(2); // at_lab + entered are both pending statuses
    expect(only.failedCount).toBe(1);
    expect(only.state).toBe('satisfied');
    expect(result.verdict.sufficient).toBe(true);
    expect(result.verdict.reasonCodes).toContain('test_sufficiency_met');
  });

  it('attributes a test through its linked checklist item, not only its own testType', () => {
    const result = evaluateSufficiency({
      subjectId: 'lot-1',
      resolved: resolved(),
      tests: [testRow({ id: 'linked', testType: 'other', itpChecklistItemId: 'item-1' })],
      checklistItems: [{ id: 'item-1', evidenceRequired: 'test', testType: 'Compaction' }],
    });
    expect(result.rules[0].passingCount).toBe(1);
    expect(result.unlinkedPassingTestIds).toEqual([]);
  });

  it('reports passing tests no rule could attribute (tests_unlinked_to_itp_item)', () => {
    const result = evaluate({}, [testRow({ id: 'orphan', testType: 'cbr' })]);
    expect(result.unlinkedPassingTestIds).toEqual(['orphan']);
    expect(result.verdict.reasonCodes).toContain('tests_unlinked_to_itp_item');
  });

  it('carries the citation, tagging a DRAFT ruleset unconfirmed rather than unknown', () => {
    const draft = ruleset({ status: 'draft' as RulesetStatus });
    const result = evaluate({ ruleset: draft, rules: draft.rules }, [testRow()]);
    expect(result.rules[0].citation).toEqual({
      authority: 'SyntheticAuthority',
      document: 'Synthetic Section 1',
      clause: 'Table 1.1',
      edition: '2026 edition',
      confirmed: false,
    });
    // Draft still produces REAL numbers — the [C1R-B5] correction.
    expect(result.rules[0].requiredCount).toBe(6);
    expect(result.rules[0].state).toBe('insufficient');
  });
});

describe('AT-3 every UnknownCause fires from its own minimal input', () => {
  const scenarios: Record<UnknownCause, () => ReturnType<typeof evaluate>> = {
    no_ruleset_for_project: () => evaluate({ ruleset: null }),
    no_rule_for_activity: () => evaluate({ ruleset: ruleset({ rules: [] }), rules: [] }),
    activity_not_canonical: () =>
      evaluate({ ruleset: ruleset({ rules: [] }), rules: [], activityCanonical: false }),
    scale_not_selected: () => evaluate({ scale: { value: null, source: 'none' } }),
    scale_not_recognised: () => evaluate({ scale: { value: 'Z', source: 'lot' } }),
    quantity_missing: () =>
      evaluate({
        rules: [rule({ perQuantity: { unit: 'm2', every: 500 } })],
        quantity: { value: null, unit: null, source: 'none' },
      }),
  };

  it('covers the whole UnknownCause union — no cause is untested', () => {
    expect(Object.keys(scenarios).sort()).toEqual([...UNKNOWN_CAUSES].sort());
  });

  for (const cause of UNKNOWN_CAUSES) {
    it(`${cause}: fires, reads unknown, is never sufficient and never blocks`, () => {
      const result = scenarios[cause]();
      const causes = [...result.unknownCauses, ...result.rules.flatMap((r) => r.unknownCauses)];
      expect(causes).toContain(cause);
      expect(result.state).toBe('unknown');
      expect(result.verdict.sufficient).toBe(false);
      expect(result.sufficiencyBlocks).toBe(false);
      expect(result.verdict.reasonCodes).toContain('test_sufficiency_unknown');
      for (const ruleResult of result.rules) expect(ruleResult.requiredCount).toBeNull();
    });
  }

  it('unknown never blocks even at mode `block` on a CONFIRMED ruleset', () => {
    for (const cause of UNKNOWN_CAUSES) {
      const base = scenarios[cause]();
      expect(base.sufficiencyBlocks).toBe(false);
    }
    const blocking = evaluate({ mode: 'block', scale: { value: null, source: 'none' } });
    expect(blocking.state).toBe('unknown');
    expect(blocking.sufficiencyBlocks).toBe(false);
  });
});

describe('AT-4 the perQuantity limb — SYNTHETIC ONLY (no shipped rule carries it)', () => {
  // [C1R-1]: no cited authority in the research appendix supplies a per-area
  // frequency figure, so this limb ships UNEXERCISED. This test covers code that
  // no shipped pack reaches, deliberately.
  const perRule = rule({ id: 'synthetic.v1/coverage', perQuantity: { unit: 'm2', every: 500 } });

  it('raises the required count above the scale floor from the lot quantity', () => {
    const result = evaluate(
      {
        rules: [perRule],
        quantity: { value: 5000, unit: 'm2', source: 'lot' },
      },
      Array.from({ length: 6 }, (_, i) => testRow({ id: `t${i}` })),
    );
    expect(result.rules[0].requiredCount).toBe(10);
    expect(result.rules[0].state).toBe('insufficient'); // 6 passing of 10
  });

  it('is `quantity_missing`, never a silent unit conversion, when the units differ', () => {
    const result = evaluate({
      rules: [perRule],
      quantity: { value: 5000, unit: 'm3', source: 'lot' },
    });
    expect(result.rules[0].unknownCauses).toContain('quantity_missing');
    expect(result.rules[0].requiredCount).toBeNull();
  });

  it('uses the reduced limb`s own figures when the regime is reduced', () => {
    const reducedRule = rule({
      reduced: {
        minCountByScale: { A: 3 },
        consecutiveConformingLots: 3,
        escalationShape: 'reset_on_any_failure',
      },
    });
    const result = evaluate(
      {
        rules: [reducedRule],
        regimeByRuleId: new Map([
          [
            reducedRule.id,
            {
              regime: 'reduced' as const,
              eligible: true,
              basisLotIds: ['a', 'b', 'c'],
              streamKey: 'k',
            },
          ],
        ]),
      },
      Array.from({ length: 3 }, (_, i) => testRow({ id: `t${i}` })),
    );
    expect(result.rules[0].regime).toBe('reduced');
    expect(result.rules[0].requiredCount).toBe(3);
    expect(result.rules[0].state).toBe('satisfied');
    expect(result.rules[0].regimeBasis).toEqual({ streamKey: 'k', lotIds: ['a', 'b', 'c'] });
  });

  it('falls back to `full` (over-testing, the safe direction) when the regime is unresolved', () => {
    const reducedRule = rule({
      reduced: {
        minCountByScale: { A: 3 },
        consecutiveConformingLots: 3,
        escalationShape: 'reset_on_any_failure',
      },
    });
    const result = evaluate({ rules: [reducedRule], regimeByRuleId: new Map() });
    expect(result.rules[0].regime).toBe('full');
    expect(result.rules[0].requiredCount).toBe(6);
    expect(result.rules[0].regimeBasis).toBeUndefined();
  });

  it('leaves `regime` null for a rule with no reduced limb', () => {
    expect(evaluate().rules[0].regime).toBeNull();
  });
});

describe('§3.3 lot-size advisory — never blocks', () => {
  const capped = rule({ maxLotSize: [{ unit: 'm2', value: 5000 }] });

  it('fires above the cap and stays advisory at mode `block`', () => {
    const result = evaluate({
      mode: 'block',
      rules: [capped],
      quantity: { value: 7400, unit: 'm2', source: 'geometry' },
    });
    expect(result.maxLotSizeExceedances).toEqual([
      { ruleId: capped.id, unit: 'm2', limit: 5000, actual: 7400 },
    ]);
    expect(result.verdict.reasonCodes).toContain('lot_exceeds_max_lot_size');
  });

  it('prefers the most restrictive matching cap when the lot`s areaZone matches', () => {
    const zoned = rule({
      maxLotSize: [
        { unit: 'm2', value: 5000 },
        { unit: 'm2', value: 500, areaZoneAliases: ['under paved areas'] },
      ],
    });
    const paved = evaluate({
      rules: [zoned],
      areaZone: 'Under Paved Areas',
      quantity: { value: 900, unit: 'm2', source: 'lot' },
    });
    expect(paved.maxLotSizeExceedances[0]).toMatchObject({ limit: 500, actual: 900 });

    const unpaved = evaluate({
      rules: [zoned],
      areaZone: 'embankment',
      quantity: { value: 900, unit: 'm2', source: 'lot' },
    });
    expect(unpaved.maxLotSizeExceedances).toEqual([]);
  });

  it('picks the most restrictive cap IN THE LOT`S OWN UNIT, never across units', () => {
    // A tighter-looking cap in another unit must not win the "most restrictive"
    // comparison and then be discarded, swallowing the real m2 exceedance.
    const mixed = rule({
      maxLotSize: [
        { unit: 'm3', value: 500 },
        { unit: 'm2', value: 5000 },
      ],
    });
    const result = evaluate({
      rules: [mixed],
      quantity: { value: 7400, unit: 'm2', source: 'lot' },
    });
    expect(result.maxLotSizeExceedances).toEqual([
      { ruleId: mixed.id, unit: 'm2', limit: 5000, actual: 7400 },
    ]);
  });

  it('says nothing when the quantity is unknown or the unit does not match the cap', () => {
    expect(evaluate({ rules: [capped] }).maxLotSizeExceedances).toEqual([]);
    expect(
      evaluate({ rules: [capped], quantity: { value: 9999, unit: 'm3', source: 'lot' } })
        .maxLotSizeExceedances,
    ).toEqual([]);
  });
});

// D14 §4.1, AT-34. Section 204 Table 204.142 caps a Type A lot at 5,000 m² and
// Type C at nothing at all, so a bare cap is not encodable there `[C1C-3]` and a
// material-scoped one is the only honest form.
describe('AT-34 material-scoped lot-size caps (§4.1)', () => {
  const typeA = rule({
    maxLotSize: [{ unit: 'm2', value: 5000, materialAliases: ['Type A'] }],
  });
  const big = { value: 7400, unit: 'm2' as const, source: 'lot' as const };

  it('fires only on a case-insensitively matching materialType', () => {
    expect(
      evaluate({ rules: [typeA], materialType: 'type a', quantity: big }).maxLotSizeExceedances,
    ).toEqual([{ ruleId: typeA.id, unit: 'm2', limit: 5000, actual: 7400 }]);
    expect(
      evaluate({ rules: [typeA], materialType: 'Type B', quantity: big }).maxLotSizeExceedances,
    ).toEqual([]);
  });

  it('a NULL or blank materialType matches NOTHING — never recorded, never capped', () => {
    expect(evaluate({ rules: [typeA], quantity: big }).maxLotSizeExceedances).toEqual([]);
    expect(
      evaluate({ rules: [typeA], materialType: '  ', quantity: big }).maxLotSizeExceedances,
    ).toEqual([]);
  });

  it('a cap carrying BOTH limbs requires BOTH to match', () => {
    const both = rule({
      maxLotSize: [
        { unit: 'm2', value: 5000, materialAliases: ['Type A'], areaZoneAliases: ['shoulder'] },
      ],
    });
    const hit = evaluate({
      rules: [both],
      materialType: 'Type A',
      areaZone: 'Shoulder',
      quantity: big,
    });
    expect(hit.maxLotSizeExceedances).toHaveLength(1);
    expect(
      evaluate({ rules: [both], materialType: 'Type A', areaZone: 'verge', quantity: big })
        .maxLotSizeExceedances,
    ).toEqual([]);
    expect(
      evaluate({ rules: [both], materialType: 'Type C', areaZone: 'Shoulder', quantity: big })
        .maxLotSizeExceedances,
    ).toEqual([]);
  });

  it('an UNQUALIFIED cap still always applies — the shipped semantics are unchanged', () => {
    const bare = rule({ maxLotSize: [{ unit: 'm2', value: 5000 }] });
    expect(evaluate({ rules: [bare], quantity: big }).maxLotSizeExceedances).toHaveLength(1);
  });
});

// D14 §4.6. An earthworks lot is ordinarily measured in m³ or chainage metres,
// so an m²-keyed rule reading only `resolved.quantity` returns `unknown` forever
// on real NSW data even when the lot carries a drawn polygon. The fix is a
// per-unit resolution with a geometry fallback — never a conversion.
describe('§4.6 per-unit quantity resolution with the m² geometry fallback', () => {
  const rated = rule({ perQuantity: { unit: 'm2', every: 1000 } });

  it('falls back to the geometry area when the lot`s own quantity is the wrong unit', () => {
    const result = evaluate({
      rules: [rated],
      quantity: { value: 4500, unit: 'm3', source: 'lot' },
      geometryAreaM2: 3000,
    });
    // max(6, ceil(3000/1000)) = 6, and crucially NOT `unknown`.
    expect(result.rules[0].requiredCount).toBe(6);
    expect(result.rules[0].unknownCauses).toEqual([]);
  });

  it('is still `quantity_missing` when NEITHER source supplies the rule`s unit', () => {
    const result = evaluate({
      rules: [rated],
      quantity: { value: 4500, unit: 'm3', source: 'lot' },
    });
    expect(result.rules[0].requiredCount).toBeNull();
    expect(result.rules[0].unknownCauses).toEqual(['quantity_missing']);
  });

  it('never converts a non-m² unit — a tonnage rule gets nothing from a polygon', () => {
    const tonnes = rule({ perQuantity: { unit: 't', every: 500 } });
    const result = evaluate({
      rules: [tonnes],
      quantity: { value: 4500, unit: 'm3', source: 'lot' },
      geometryAreaM2: 3000,
    });
    expect(result.rules[0].unknownCauses).toEqual(['quantity_missing']);
  });

  it('leaves `resolved.quantity` alone — the resolution is rule-local', () => {
    const resolvedInput = resolved({
      rules: [rated],
      quantity: { value: 4500, unit: 'm3', source: 'lot' },
      geometryAreaM2: 3000,
    });
    evaluateSufficiency({
      subjectId: 'lot-1',
      resolved: resolvedInput,
      tests: [],
      checklistItems: [],
    });
    expect(resolvedInput.quantity).toEqual({ value: 4500, unit: 'm3', source: 'lot' });
  });
});

describe('AT-9 sufficiencyBlocks is structurally non-blocking (§5.1.2)', () => {
  const shortfall = [testRow()]; // 1 passing, 6 required => insufficient

  it('blocks in EXACTLY ONE cell of the mode x status x state matrix', () => {
    const blocked: string[] = [];
    for (const mode of ['off', 'warn', 'block'] as const) {
      for (const status of ['draft', 'confirmed'] as const) {
        for (const scenario of ['insufficient', 'unknown', 'satisfied'] as const) {
          const set = ruleset({ status });
          const result = evaluate(
            {
              mode,
              ruleset: set,
              rules: set.rules,
              ...(scenario === 'unknown'
                ? { scale: { value: null, source: 'none' as const } }
                : {}),
            },
            scenario === 'satisfied'
              ? Array.from({ length: 6 }, (_, i) => testRow({ id: `t${i}` }))
              : shortfall,
          );
          if (result.sufficiencyBlocks) blocked.push(`${mode}/${status}/${scenario}`);
        }
      }
    }
    expect(blocked).toEqual(['block/confirmed/insufficient']);
  });

  it('a DRAFT ruleset cannot block, by construction, however short the lot is', () => {
    const draft = ruleset({ status: 'draft' });
    const result = evaluate({ mode: 'block', ruleset: draft, rules: draft.rules }, []);
    expect(result.state).toBe('insufficient');
    expect(result.sufficiencyBlocks).toBe(false);
  });
});
