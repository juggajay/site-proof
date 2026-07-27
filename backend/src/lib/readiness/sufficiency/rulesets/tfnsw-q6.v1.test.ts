// D14.3 acceptance tests AT-36, AT-37, AT-38, AT-39, AT-40, AT-41a, AT-54,
// AT-55(a) and AT-56 — the TfNSW Q6 pack
// (docs/plans/d14-q6-pack-spec-2026-07-27.md §5, §14).
//
// AT-36 IS THE DELIVERABLE OF THIS PHASE, not the pack file. Every expectation
// below is read off the published table in
// `docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md` §3.1 — Q6 Ed 2 /
// Rev 0, Annexure Q6/L cl. L1, Table Q6/L.1, PDF p. 42 — and written as a
// NUMBER, never as code output. The nine rate-bearing cells publish a rate
// rather than a count, so their expectation is hand-computed here from the
// published rate and floor at a named representative area, with the published
// cell text quoted beside it.
//
// Driven against the SHIPPED pack. A synthetic fixture would pass with every
// one of the 25 cells wrong, which is the only thing this file exists to catch.

import { describe, expect, it } from 'vitest';

import { buildSufficiencyAdvisoryItems } from '../../../evidenceReadiness/conformanceItems.js';
import { evaluateSufficiency } from '../evaluate.js';
import { resolveRuleset, rulesForLot } from '../registry.js';
import type { QuantityUnit, ResolvedSufficiency } from '../types.js';
import { TFNSW_Q6_V1 as PACK } from './tfnsw-q6.v1.js';

it('is the pack an NSW / TfNSW project actually resolves — under either spec-set name', () => {
  expect(resolveRuleset({ state: 'NSW', specSet: 'TfNSW' })).toBe(PACK);
  expect(resolveRuleset({ state: 'nsw', specSet: 'rms' })).toBe(PACK);
});

interface LotShape {
  scale?: string | null;
  /** The lot's OWN recorded quantity, in whatever unit it was measured in. */
  quantity?: { value: number; unit: QuantityUnit } | null;
  /** Summed `LotGeometry.areaM2` — a SECOND source, m² only (§4.6). */
  geometryAreaM2?: number | null;
  /** Defaults to earthworks; D14.5's pavement cases pass a pavement slug. */
  activitySlug?: string;
}

function resolved(lot: LotShape): ResolvedSufficiency {
  return {
    mode: 'warn',
    ruleset: PACK,
    rules: rulesForLot(PACK, {
      activitySlug: lot.activitySlug ?? 'earthworks_general',
      layer: null,
      areaZone: null,
    }),
    scale:
      lot.scale === undefined || lot.scale === null
        ? { value: null, source: 'none' }
        : { value: lot.scale, source: 'lot' },
    quantity: lot.quantity
      ? { value: lot.quantity.value, unit: lot.quantity.unit, source: 'lot' }
      : { value: null, unit: null, source: 'none' },
    areaZone: null,
    materialType: null,
    geometryAreaM2: lot.geometryAreaM2 ?? null,
    regimeByRuleId: new Map(),
    activityCanonical: true,
  };
}

function evaluate(lot: LotShape) {
  return evaluateSufficiency({
    subjectId: 'lot-1',
    resolved: resolved(lot),
    tests: [],
    checklistItems: [],
  });
}

/** The required count for a band at an area, or null when the lot reads `unknown`. */
function required(scale: string, areaM2: number): number | null {
  return (
    evaluate({ scale, quantity: { value: areaM2, unit: 'm2' } }).rules[0]?.requiredCount ?? null
  );
}

// ---------------------------------------------------------------------------
// AT-36 — all 25 cells of Table Q6/L.1.
// ---------------------------------------------------------------------------

/**
 * The representative area for each published lot-area column. FIXED HERE so the
 * test cannot drift onto areas that happen to agree.
 */
const AREAS = {
  'up to 50': 25,
  'over 50 to 500': 300,
  'over 500 to 1,000': 800,
  'over 1,000 to 5,000': 3000,
  'over 5,000': 9000,
} as const;

/**
 * Table Q6/L.1 "Minimum Number of Samples Per Lot (n)", read off the research
 * report's §3.1 transcription. Flat cells are the published integer; rate cells
 * carry the published cell text and the arithmetic in the comment beside them.
 */
const TABLE_Q6_L1: ReadonlyArray<
  readonly [string, readonly [number, number, number, number, number]]
> = [
  [
    '<=90.0%',
    [
      1, // <= 50 m²: published 1
      1, // > 50-500: published 1
      1, // > 500-1,000: published 1
      2, // > 1,000-5,000: "1 per 2,000 m² (min 2)" -> max(2, ceil(3000/2000)=2) = 2
      3, // > 5,000: "1 per 3,000 m²" (no floor) -> max(1, ceil(9000/3000)=3) = 3
    ],
  ],
  [
    '>90.0-95.0%',
    [
      1, // published 1
      2, // published 2
      4, // "1 per 250 m² (min 3)" -> max(3, ceil(800/250)=4) = 4
      3, // "1 per 1,000 m² (min 3)" -> max(3, ceil(3000/1000)=3) = 3
      5, // "1 per 2,000 m²" (no floor) -> max(1, ceil(9000/2000)=5) = 5
    ],
  ],
  [
    '>95.0-98.0%',
    [
      1, // published 1
      3, // published 3
      4, // published 4
      5, // published 5
      6, // "1 per 2,000 m² (min 6)" -> max(6, ceil(9000/2000)=5) = 6
    ],
  ],
  [
    // Q6 publishes this row IDENTICALLY to the one above. Not a copy-paste slip.
    '>98.0-100.0%',
    [
      1, // published 1
      3, // published 3
      4, // published 4
      5, // published 5
      6, // "1 per 2,000 m² (min 6)" -> max(6, ceil(9000/2000)=5) = 6
    ],
  ],
  [
    '>100.0%',
    [
      1, // published 1
      3, // published 3
      4, // published 4
      6, // "1 per 500 m² (min 5)" -> max(5, ceil(3000/500)=6) = 6
      10, // "1 per 1,000 m² (min 10)" -> max(10, ceil(9000/1000)=9) = 10
    ],
  ],
];

describe('AT-36 every cell of Table Q6/L.1', () => {
  const columns = Object.entries(AREAS);
  for (const [band, cells] of TABLE_Q6_L1) {
    for (const [index, [columnName, area]] of columns.entries()) {
      it(`${band} at ${columnName} m² (${area} m²) requires ${cells[index]}`, () => {
        expect(required(band, area)).toBe(cells[index]);
      });
    }
  }

  it('covers all five published bands and no band the table does not have', () => {
    expect(TABLE_Q6_L1.map(([band]) => band)).toEqual([...PACK.scaleKeys]);
  });
});

// ---------------------------------------------------------------------------
// AT-37 — the band edges. Q6's columns are `> x, <= y`, so an area of exactly y
// takes the LOWER band and y + 0.1 takes the next. Every expectation is
// hand-computed from the published cell for the band the area lands in.
// ---------------------------------------------------------------------------
describe('AT-37 band boundaries are inclusive above, in every one of the five bands', () => {
  it.each([
    // [band, area, expected, why]
    // `<=90.0%` — the first three published cells are all 1, encoded as one
    // collapsed band, so 50 and 500 are interior points of it.
    ['<=90.0%', 50, 1, 'published 1'],
    ['<=90.0%', 50.1, 1, 'still the "all ones" band'],
    ['<=90.0%', 500, 1, 'published 1'],
    ['<=90.0%', 500.1, 1, 'still the "all ones" band'],
    ['<=90.0%', 1000, 1, 'published 1 — the last cell of the collapsed band'],
    ['<=90.0%', 1000.1, 2, '1 per 2,000 (min 2) -> max(2, ceil(1000.1/2000)=1)'],
    ['<=90.0%', 5000, 3, '1 per 2,000 (min 2) -> max(2, ceil(5000/2000)=3)'],
    ['<=90.0%', 5000.1, 2, '1 per 3,000 -> max(1, ceil(5000.1/3000)=2)'],

    ['>90.0-95.0%', 50, 1, 'published 1'],
    ['>90.0-95.0%', 50.1, 2, 'published 2'],
    ['>90.0-95.0%', 500, 2, 'published 2'],
    ['>90.0-95.0%', 500.1, 3, '1 per 250 (min 3) -> max(3, ceil(500.1/250)=3)'],
    ['>90.0-95.0%', 1000, 4, '1 per 250 (min 3) -> max(3, ceil(1000/250)=4)'],
    ['>90.0-95.0%', 1000.1, 3, '1 per 1,000 (min 3) -> max(3, ceil(1000.1/1000)=2)'],
    ['>90.0-95.0%', 5000, 5, '1 per 1,000 (min 3) -> max(3, ceil(5000/1000)=5)'],
    ['>90.0-95.0%', 5000.1, 3, '1 per 2,000 -> max(1, ceil(5000.1/2000)=3)'],

    ['>95.0-98.0%', 50, 1, 'published 1'],
    ['>95.0-98.0%', 50.1, 3, 'published 3'],
    ['>95.0-98.0%', 500, 3, 'published 3'],
    ['>95.0-98.0%', 500.1, 4, 'published 4'],
    ['>95.0-98.0%', 1000, 4, 'published 4'],
    ['>95.0-98.0%', 1000.1, 5, 'published 5'],
    ['>95.0-98.0%', 5000, 5, 'published 5'],
    ['>95.0-98.0%', 5000.1, 6, '1 per 2,000 (min 6) -> max(6, ceil(5000.1/2000)=3)'],

    ['>98.0-100.0%', 50, 1, 'published 1'],
    ['>98.0-100.0%', 50.1, 3, 'published 3'],
    ['>98.0-100.0%', 500, 3, 'published 3'],
    ['>98.0-100.0%', 500.1, 4, 'published 4'],
    ['>98.0-100.0%', 1000, 4, 'published 4'],
    ['>98.0-100.0%', 1000.1, 5, 'published 5'],
    ['>98.0-100.0%', 5000, 5, 'published 5'],
    ['>98.0-100.0%', 5000.1, 6, '1 per 2,000 (min 6) -> max(6, ceil(5000.1/2000)=3)'],

    ['>100.0%', 50, 1, 'published 1'],
    ['>100.0%', 50.1, 3, 'published 3'],
    ['>100.0%', 500, 3, 'published 3'],
    ['>100.0%', 500.1, 4, 'published 4'],
    ['>100.0%', 1000, 4, 'published 4'],
    ['>100.0%', 1000.1, 5, '1 per 500 (min 5) -> max(5, ceil(1000.1/500)=3)'],
    ['>100.0%', 5000, 10, '1 per 500 (min 5) -> max(5, ceil(5000/500)=10)'],
    ['>100.0%', 5000.1, 10, '1 per 1,000 (min 10) -> max(10, ceil(5000.1/1000)=6)'],
  ])('%s at %s m² requires %s (%s)', (band, area, expected) => {
    expect(required(band as string, area as number)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// AT-56 — the table is NON-MONOTONE in area, and that is faithful.
// ---------------------------------------------------------------------------
it('AT-56 pins the non-monotone edges: a BIGGER lot needing FEWER tests is not a bug', () => {
  // Table Q6/L.1's open top column publishes a COARSER per-area rate than the
  // column below it, so the count genuinely falls across 5,000 m². A future
  // agent "fixing" the monotonicity must fail this assertion, not the pack.
  expect(required('>90.0-95.0%', 5000)).toBe(5);
  expect(required('>90.0-95.0%', 5001)).toBe(3);
  expect(required('<=90.0%', 5000)).toBe(3);
  expect(required('<=90.0%', 5001)).toBe(2);
});

// ---------------------------------------------------------------------------
// AT-38 — the open top bands.
// ---------------------------------------------------------------------------
describe('AT-38 the open top bands', () => {
  it('the two `minCount: 1` placeholders are INERT — the rate always binds above 5,000 m²', () => {
    // `1` there is the vocabulary's way of writing "Q6 publishes no floor for
    // this cell", not an authority figure. Just past the band's lower edge the
    // rate alone already exceeds it, so the placeholder can never be the answer.
    expect(required('<=90.0%', 5001)).toBe(2);
    expect(required('>90.0-95.0%', 5001)).toBe(3);
  });

  it('a 12,000 m² lot at > 100.0 % requires 12 — the rate above the published floor of 10', () => {
    expect(required('>100.0%', 12000)).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// AT-39 / AT-40 — honest degradation. Never a guessed count.
// ---------------------------------------------------------------------------
describe('AT-39 no area resolvable in m² from EITHER source', () => {
  it('reads unknown / quantity_missing with a null count — never a floor', () => {
    const evaluation = evaluate({ scale: '>95.0-98.0%', quantity: null });
    expect(evaluation.rules[0]?.state).toBe('unknown');
    expect(evaluation.rules[0]?.requiredCount).toBeNull();
    expect(evaluation.rules[0]?.unknownCauses).toEqual(['quantity_missing']);
    expect(evaluation.sufficiencyBlocks).toBe(false);
    expect(
      buildSufficiencyAdvisoryItems(evaluation).every((item) => item.blocksAction === false),
    ).toBe(true);
  });

  it('a quantity in a NON-m² unit with no geometry is "missing" for this rule, never converted', () => {
    // Converting m³ or chainage metres to an area needs a depth or a width
    // CIVOS does not hold. AT-54 is the case where a real m² IS available.
    for (const unit of ['m3', 'm', 't'] as const) {
      const evaluation = evaluate({ scale: '>95.0-98.0%', quantity: { value: 4500, unit } });
      expect(evaluation.rules[0]?.unknownCauses, unit).toEqual(['quantity_missing']);
      expect(evaluation.rules[0]?.requiredCount, unit).toBeNull();
    }
  });
});

describe('AT-40 the band itself', () => {
  it('no band recorded, and Q6 declares no default, reads scale_not_selected', () => {
    const evaluation = evaluate({ scale: null, quantity: { value: 3000, unit: 'm2' } });
    expect(PACK.defaultScale).toBeUndefined();
    expect(evaluation.rules[0]?.state).toBe('unknown');
    expect(evaluation.rules[0]?.requiredCount).toBeNull();
    expect(evaluation.rules[0]?.unknownCauses).toEqual(['scale_not_selected']);
    expect(evaluation.verdict.sufficient).toBe(false);
  });

  it('AT-41a an UNRECOGNISED band — the VIC value "A" on an NSW lot — degrades, and does not THROW', () => {
    // API-reachable on any row written before the §9.2 whitelist shipped. The
    // banded branch would otherwise index `byScale['A']` -> undefined and scan
    // it, throwing inside `computeConformanceResult` — which is DB-free and
    // shared by the single-conform path AND the batched claim path, so one such
    // lot would 500 claim create at the 5,000-member ceiling. The batch-level
    // half of AT-41a is in `routes/lots/conformanceSufficiency.db.test.ts`.
    const evaluation = evaluate({ scale: 'A', quantity: { value: 3000, unit: 'm2' } });
    expect(evaluation.rules[0]?.state).toBe('unknown');
    expect(evaluation.rules[0]?.requiredCount).toBeNull();
    expect(evaluation.rules[0]?.unknownCauses).toEqual(['scale_not_recognised']);
    expect(evaluation.sufficiencyBlocks).toBe(false);
  });

  it('neither state can ever read as satisfied, at any mode', () => {
    for (const scale of [null, 'A']) {
      const evaluation = evaluateSufficiency({
        subjectId: 'lot-1',
        resolved: { ...resolved({ scale, quantity: { value: 3000, unit: 'm2' } }), mode: 'block' },
        tests: [],
        checklistItems: [],
      });
      expect(evaluation.verdict.sufficient).toBe(false);
      expect(evaluation.sufficiencyBlocks).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// AT-54 — the one that decides whether Q6 works on real NSW data (§4.6).
// ---------------------------------------------------------------------------
describe('AT-54 an NSW lot measured in m³ or chainage metres, with geometry drawn', () => {
  it('resolves the Q6 rule against the polygon area and requires the published count', () => {
    // Bulk earthworks is ordinarily measured as a VOLUME. `resolve.ts` lets the
    // lot's own quantity win outright, so without §4.6 this lot reads `unknown`
    // forever while carrying a drawn polygon with a real area.
    const lot = {
      scale: '>95.0-98.0%',
      quantity: { value: 4500, unit: 'm3' as const },
      geometryAreaM2: 3000,
    };
    const evaluation = evaluate(lot);
    expect(evaluation.rules[0]?.requiredCount).toBe(5); // Table Q6/L.1, > 1,000-5,000 m² at > 95.0-98.0 %
    expect(evaluation.rules[0]?.unknownCauses).toEqual([]);
    // The per-unit resolution is RULE-LOCAL: the lot's recorded quantity is not
    // rewritten, and every other consumer still sees what the user entered.
    expect(resolved(lot).quantity).toEqual({ value: 4500, unit: 'm3', source: 'lot' });
  });

  it('behaves identically for a lot recorded in chainage metres', () => {
    expect(
      evaluate({
        scale: '>95.0-98.0%',
        quantity: { value: 180, unit: 'm' },
        geometryAreaM2: 3000,
      }).rules[0]?.requiredCount,
    ).toBe(5);
  });

  it('the same lot with NO geometry reads unknown / quantity_missing', () => {
    const evaluation = evaluate({
      scale: '>95.0-98.0%',
      quantity: { value: 4500, unit: 'm3' },
      geometryAreaM2: null,
    });
    expect(evaluation.rules[0]?.requiredCount).toBeNull();
    expect(evaluation.rules[0]?.unknownCauses).toEqual(['quantity_missing']);
  });
});

// ---------------------------------------------------------------------------
// D14.5 — the pavement rules (§5.6). AT-55(b), and the same
// published-numbers-not-code-output discipline as AT-36: every expectation below
// is Table Q6/L.1's `> 100.0` row, transcribed in
// `docs/research/c1-q6-pavements-2026-07-27.md` §2.6 and independently
// republished cell-for-cell by R71's heavy-duty override (§3.1, PDF p. 42).
// ---------------------------------------------------------------------------
const PAVEMENT_SLUGS = ['pavement_unbound', 'pavement_bound', 'pavement_stabilisation'] as const;

/** A pavement lot with NO band recorded — the whole point of the scale-independent limb. */
function pavementRequired(activitySlug: string, areaM2: number, scale: string | null = null) {
  return (
    evaluate({ activitySlug, scale, quantity: { value: areaM2, unit: 'm2' } }).rules[0]
      ?.requiredCount ?? null
  );
}

describe('D14.5 pavement lots ride Table Q6/L.1 row "> 100.0" with no band selected', () => {
  it.each(PAVEMENT_SLUGS)(
    '%s — the five published cells, at the AT-36 representative areas',
    (slug) => {
      expect(pavementRequired(slug, 25)).toBe(1); // <= 50 m²: published 1
      expect(pavementRequired(slug, 300)).toBe(3); // > 50-500: published 3
      expect(pavementRequired(slug, 800)).toBe(4); // > 500-1,000: published 4
      expect(pavementRequired(slug, 3000)).toBe(6); // "1 per 500 (min 5)" -> max(5, 6) = 6
      expect(pavementRequired(slug, 9000)).toBe(10); // "1 per 1,000 (min 10)" -> max(10, 9) = 10
    },
  );

  it('AT-55b the two pins: 3,000 m² requires 6 and 6,000 m² requires 10, with NO testScale', () => {
    // The research's own §7 example said 5 for the first and was wrong — the
    // `> 1,000, <= 5,000` cell publishes 1 per 500 m² (min 5), so 3,000 m² is
    // max(5, ceil(3000/500)) = 6. These are the CORRECTED figures (spec §0.3.3).
    expect(pavementRequired('pavement_unbound', 3000)).toBe(6);
    expect(pavementRequired('pavement_unbound', 6000)).toBe(10); // max(10, ceil(6000/1000)=6)
  });

  it('band EDGES are inclusive above, and the published floors bind where the rate does not', () => {
    expect(pavementRequired('pavement_bound', 50)).toBe(1); // published 1
    expect(pavementRequired('pavement_bound', 50.1)).toBe(3); // published 3
    expect(pavementRequired('pavement_bound', 500)).toBe(3); // published 3
    expect(pavementRequired('pavement_bound', 500.1)).toBe(4); // published 4
    expect(pavementRequired('pavement_bound', 1000)).toBe(4); // published 4
    expect(pavementRequired('pavement_bound', 1000.1)).toBe(5); // max(5, ceil(1000.1/500)=3)
    expect(pavementRequired('pavement_bound', 5000)).toBe(10); // max(5, ceil(5000/500)=10)
    expect(pavementRequired('pavement_bound', 5000.1)).toBe(10); // floor 10 beats ceil(5000.1/1000)=6
    expect(pavementRequired('pavement_bound', 12000)).toBe(12); // rate above the floor of 10
  });

  it('the band is IGNORED, whatever the lot carries — the specification fixed the row', () => {
    // A pavement lot on this pack can still have a band set (the form offers the
    // pack's five earthworks bands). It must change nothing: R71/R73/R75 pin
    // specified relative compaction at 100 %/102 %, so the row is not the user's
    // to choose, and a mis-set band must not lower a count.
    for (const scale of [null, '<=90.0%', '>95.0-98.0%', '>100.0%', 'A']) {
      const evaluation = evaluate({
        activitySlug: 'pavement_unbound',
        scale,
        quantity: { value: 3000, unit: 'm2' },
      });
      expect(evaluation.rules[0]?.requiredCount, `${scale}`).toBe(6);
      // Both scale causes are suppressed — including `scale_not_recognised`, which
      // pre-§9.2 rows can carry. Without the suppression this lot reads `unknown`
      // forever: the pack declares no `defaultScale`.
      expect(evaluation.rules[0]?.unknownCauses, `${scale}`).toEqual([]);
      expect(evaluation.rules[0]?.state, `${scale}`).toBe('insufficient');
    }
  });

  it('the AREA is still required — a pavement lot with none reads unknown, never a floor', () => {
    const evaluation = evaluate({ activitySlug: 'pavement_unbound', quantity: null });
    expect(evaluation.rules[0]?.requiredCount).toBeNull();
    expect(evaluation.rules[0]?.unknownCauses).toEqual(['quantity_missing']);
    expect(evaluation.sufficiencyBlocks).toBe(false);
  });

  it('an m³-measured pavement lot with a drawn polygon still resolves (§4.6)', () => {
    expect(
      evaluate({
        activitySlug: 'pavement_stabilisation',
        quantity: { value: 900, unit: 'm3' },
        geometryAreaM2: 3000,
      }).rules[0]?.requiredCount,
    ).toBe(6);
  });

  it('earthworks and pavement lots see ONE rule each — the two never cross', () => {
    for (const slug of PAVEMENT_SLUGS) {
      const rules = rulesForLot(PACK, { activitySlug: slug, layer: null, areaZone: null });
      expect(rules.map((rule) => rule.id)).toEqual([`${PACK.id}/pavement-compaction-density`]);
    }
    expect(
      rulesForLot(PACK, { activitySlug: 'earthworks_general', layer: null, areaZone: null }).map(
        (rule) => rule.id,
      ),
    ).toEqual([`${PACK.id}/compaction-density`]);
    // `pavement_concrete` is excluded — no concrete-pavement specification was read.
    expect(
      rulesForLot(PACK, { activitySlug: 'pavement_concrete', layer: null, areaZone: null }),
    ).toEqual([]);
  });

  it('the pack carries these two rules and nothing else (§5.6.3 exit item 16)', () => {
    // The five out-of-counter frequencies — binder spread rate per spreader run,
    // water quality per contract, ride quality (a continuous reading), the 3051
    // supply table and Q6 cl. 5.4.2's lot-size constraints — are ABSENT and named
    // in the pack header. So are the four one-quantity-per-lot scope items and the
    // two rules blocked on a canonical test category (straight edge, core integrity).
    expect(PACK.rules.map((rule) => rule.id)).toEqual([
      `${PACK.id}/compaction-density`,
      `${PACK.id}/pavement-compaction-density`,
    ]);
    // The added rule edits no shipped definition — the §6.5 branch this took.
    expect(PACK.rules[0]?.countByAreaBand?.byScale).toBeDefined();
    expect(PACK.effectiveTo).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AT-55(a) — the pack owns the WORD, not the form (§4.7).
// ---------------------------------------------------------------------------
it('AT-55 the readiness prompt on an NSW lot says the pack\'s own words, not "testing scale"', () => {
  const item = buildSufficiencyAdvisoryItems(
    evaluate({ scale: null, quantity: { value: 3000, unit: 'm2' } }),
  ).find((entry) => entry.code === 'test_sufficiency_unknown');
  expect(item?.detail).toContain('specified relative compaction');
  expect(item?.detail).not.toContain('testing scale');
  // J2: the MAJOR WORKS scope reaches the user through the citation, which is
  // the channel `shortfallSentence` actually renders — a rule label would not.
  expect(PACK.provenance.document).toContain('Major Works');
});
