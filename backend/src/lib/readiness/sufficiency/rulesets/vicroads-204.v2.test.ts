// D14.2 acceptance tests AT-44, AT-46, AT-46a and AT-47 — the VicRoads pack
// upgrade (docs/plans/d14-q6-pack-spec-2026-07-27.md §6).
//
// Driven against the SHIPPED pack, never a synthetic one: the deliverable here is
// the encoded authority numbers (5,000 m² Type A; < 500 m²; 3; +2.0 %), so a test
// built on a fixture would pass with every one of them wrong.
//
// End to end through the item builder on purpose. `[D14X-3]` is precisely the
// defect of a ceiling that exists in the pack, is true, and reaches no user —
// the escape lived in `rule.label`, and `shortfallSentence` has never read
// `rule.label`. Asserting the pack contents alone would reproduce that mistake.

import { describe, expect, it } from 'vitest';

import { buildSufficiencyAdvisoryItems } from '../../../evidenceReadiness/conformanceItems.js';
import { evaluateSufficiency } from '../evaluate.js';
import { resolveRuleset, rulesForLot } from '../registry.js';
import type { ResolvedSufficiency, SufficiencyTestRow } from '../types.js';
import { VICROADS_204_V2 as PACK } from './vicroads-204.v2.js';

it('is the pack a VIC / VicRoads project actually resolves', () => {
  expect(resolveRuleset({ state: 'VIC', specSet: 'VicRoads' })).toBe(PACK);
});

interface LotShape {
  scale?: string | null;
  areaM2?: number | null;
  materialType?: string | null;
  passing?: number;
}

function resolved(lot: LotShape): ResolvedSufficiency {
  return {
    mode: 'warn',
    ruleset: PACK,
    rules: rulesForLot(PACK, { activitySlug: 'earthworks_general', layer: null, areaZone: null }),
    scale:
      lot.scale === undefined
        ? { value: PACK.defaultScale ?? null, source: 'ruleset_default' }
        : { value: lot.scale, source: lot.scale === null ? 'none' : 'lot' },
    quantity:
      lot.areaM2 === undefined || lot.areaM2 === null
        ? { value: null, unit: null, source: 'none' }
        : { value: lot.areaM2, unit: 'm2', source: 'lot' },
    areaZone: null,
    materialType: lot.materialType ?? null,
    geometryAreaM2: null,
    regimeByRuleId: new Map(),
    activityCanonical: true,
  };
}

function evaluate(lot: LotShape) {
  const tests: SufficiencyTestRow[] = Array.from({ length: lot.passing ?? 0 }, (_u, i) => ({
    id: `test-${i}`,
    itpChecklistItemId: null,
    testType: 'compaction',
    passFail: 'pass',
    status: 'verified',
  }));
  return evaluateSufficiency({
    subjectId: 'lot-1',
    resolved: resolved(lot),
    tests,
    checklistItems: [],
  });
}

function items(lot: LotShape) {
  return buildSufficiencyAdvisoryItems(evaluate(lot));
}

// ---------------------------------------------------------------------------
// AT-44 — the Type-A 5,000 m² cap, [C1C-3] closed (§6.1).
// ---------------------------------------------------------------------------
describe('AT-44 the lot-size cap is TYPE A only, and stays advisory', () => {
  it('a 7,400 m² Type A lot is warned, naming the limit — and is not blocked', () => {
    const evaluation = evaluate({ areaM2: 7400, materialType: 'Type A' });
    expect(evaluation.maxLotSizeExceedances).toEqual([
      { ruleId: 'vicroads-204.v2/compaction-density', unit: 'm2', limit: 5000, actual: 7400 },
    ]);
    const warning = items({ areaM2: 7400, materialType: 'Type A' }).find(
      (entry) => entry.code === 'lot_exceeds_max_lot_size',
    );
    expect(warning?.severity).toBe('warning');
    expect(warning?.blocksAction).toBe(false);
    expect(warning?.detail).toContain('5000 m2');
  });

  it('the SAME lot as Type B, as Type C, or with no material recorded says nothing', () => {
    for (const materialType of ['Type B', 'Type C', null]) {
      expect(
        evaluate({ areaM2: 7400, materialType }).maxLotSizeExceedances,
        `${materialType}`,
      ).toEqual([]);
    }
  });

  it('matches the alias case-insensitively, and warns at 12,000 m² too', () => {
    expect(
      evaluate({ areaM2: 12000, materialType: 'type a material' }).maxLotSizeExceedances,
    ).toEqual([
      { ruleId: 'vicroads-204.v2/compaction-density', unit: 'm2', limit: 5000, actual: 12000 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// AT-46 / AT-47 — Section 173 small-area ELIGIBILITY (§6.2). D14.2 ships
// eligibility only: `Lot.smallAreaElected` does not exist, so NO count changes.
// ---------------------------------------------------------------------------
describe('AT-46 the Section 173 exception is disclosed, and changes no count', () => {
  it('a 320 m² Scale B lot is eligible and keeps its required count of 6', () => {
    const [rule] = evaluate({ scale: 'B', areaM2: 320 }).rules;
    expect(rule.smallAreaEligible).toBe(true);
    expect(rule.requiredCount).toBe(6);
    expect(rule.smallAreaBasis).toMatchObject({
      maxArea: { unit: 'm2', value: 500 },
      requiredCount: 3,
      acceptanceShiftPct: 2.0,
      citation: { clause: '173.04(d)', confirmed: true },
    });
  });

  it('the advisory names the reduced count, the MEAN and the +2.0 % shift', () => {
    const advisory = items({ scale: 'B', areaM2: 320 }).find(
      (entry) => entry.title === 'A cheaper testing route is available',
    );
    expect(advisory?.severity).toBe('support');
    expect(advisory?.blocksAction).toBe(false);
    expect(advisory?.detail).toContain('3 compaction tests instead of 6');
    expect(advisory?.detail).toContain('accepted on the mean');
    expect(advisory?.detail).toContain('beat the scale requirement by 2.0 %');
    // §6.3: the one place a correct verdict can be READ wrongly. CIVOS counts
    // tests and evaluates no density-ratio values, so the sentence that offers
    // the reduction must say in the same breath that the harder target is
    // unchecked — otherwise "3 of 3" reads as "passing".
    expect(advisory?.detail).toContain('does not check that threshold');
    expect(advisory?.detail).toContain('173.04(d)');
  });

  it('a 320 m² SCALE C lot emits nothing — the exception does not reach Scale C', () => {
    // cl. 204.13(a) scopes the escape to Scale A/B, and cl. 173.04(d) engages
    // only where acceptance is on CHARACTERISTIC values; Table 204.131's Scale C
    // column is a MEAN. Scale C is already three-tests-on-the-mean.
    const [rule] = evaluate({ scale: 'C', areaM2: 320 }).rules;
    expect(rule.smallAreaEligible).toBeUndefined();
    expect(rule.requiredCount).toBe(3);
    expect(items({ scale: 'C', areaM2: 320 }).map((entry) => entry.title)).not.toContain(
      'A cheaper testing route is available',
    );
  });

  it('a lot with NO area is silently not eligible — and pushes no quantity_missing', () => {
    // §3.4: the compaction rule has no `perQuantity` limb, so making the
    // ADVISORY demand an area would flip a perfectly evaluable Scale A lot to
    // `unknown` and delete a working number from the panel.
    const [rule] = evaluate({ scale: 'B' }).rules;
    expect(rule.smallAreaEligible).toBeUndefined();
    expect(rule.unknownCauses).toEqual([]);
    expect(rule.requiredCount).toBe(6);
  });
});

describe('AT-47 the boundary is STRICTLY less than 500 m²', () => {
  it.each([
    [499.99, true],
    [500, false],
    [500.01, false],
  ])('%s m² -> eligible %s', (areaM2, eligible) => {
    expect(evaluate({ scale: 'A', areaM2 }).rules[0].smallAreaEligible ?? false).toBe(eligible);
  });
});

// ---------------------------------------------------------------------------
// AT-46a `[D14X-3]` — the caveat rides the ITEM TEXT, never the rule label.
// ---------------------------------------------------------------------------
describe('AT-46a the shortfall sentence carries the small-area caveat', () => {
  function shortfall(lot: LotShape): string {
    const entry = items(lot).find((candidate) => candidate.code === 'insufficient_test_count');
    if (!entry) throw new Error('expected an insufficient_test_count item');
    return entry.detail;
  }

  it('an eligible 320 m² Scale B lot with 3 of 6 is told BOTH numbers in one sentence', () => {
    const detail = shortfall({ scale: 'B', areaM2: 320, passing: 3 });
    expect(detail).toContain('Requires 6 compaction tests');
    expect(detail).toContain('This lot is under 500 m2');
    expect(detail).toContain('allows 3 tests instead, accepted on the mean');
    expect(detail).toContain('beat the scale requirement by 2.0 %');
  });

  it('a 700 m² Scale B lot and a 320 m² Scale C lot carry NO caveat', () => {
    expect(shortfall({ scale: 'B', areaM2: 700, passing: 3 })).not.toContain('instead');
    expect(shortfall({ scale: 'C', areaM2: 320, passing: 1 })).not.toContain('instead');
  });

  it('the caveat is NOT the rule label — the label reaches no user at all', () => {
    // The pack's label says "unless a Sec 173 small lot" and always has;
    // `shortfallSentence` composes from counts and the CITATION and never reads
    // it. This assertion is what stops a future agent "restoring" the label as
    // the disclosure channel.
    const label = PACK.rules[0].label;
    expect(label).toContain('Sec 173');
    expect(shortfall({ scale: 'B', areaM2: 320, passing: 3 })).not.toContain(label);
  });
});
