// Wave D `D1b.0` — the Logan-18 crosswalk (spec
// `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3, §2.3, §4.3.2, `[DR2-B1]`).
//
// A LEAF data module in the same species as `readiness/sufficiency/rulesets/` and
// `readiness/sufficiency/testCategories.ts`: shipped product data with a citation
// per entry, reviewable in a PR diff, CI-testable, revertable by `git revert`.
// It imports only the canonical categoriser's types.
//
// WHAT IT IS. Logan City Council Planning Scheme Policy 5 §5.6.5(1)(c) requires
// copies of test results in respect of eighteen enumerated matters, (i) to
// (xviii). `[DR2-B1]` found that no crosswalk from those onto CIVOS's canonical
// `TestCategory` vocabulary existed — the canonical resolver is
// Victorian-compaction-only by its own governance note (`testCategories.ts:49-56`)
// — and that the folio therefore could not name what it was looking at. This is
// that crosswalk.
//
// SOURCE. **Grade A, primary, read verbatim.** `Logan Planning Scheme 2015 —
// Planning Scheme Policy 5 (Infrastructure), 2019 Amendment` (based on Logan
// Planning Scheme 2015 Version 6.0), §5.6.5 "As constructed documentation",
// clause (1)(c), sub-items (i)–(xviii). Every `psp5Name` below is the clause's own
// wording, transcribed, not summarised.
//
// `[LP5-DELTA]` THE SPEC'S RENDERING AND THE CLAUSE DISAGREE, AND THE CLAUSE WINS.
// Spec §2.2 and `docs/research/d0-adac-handover-research-2026-07-28.md:23` render
// the list as running prose: "fill and trench compaction, sub-grade CBR and
// compaction, …". Expanding that prose's conjunctions yields eighteen entries
// too, which is exactly why nobody caught it — but they are NOT THE SAME
// EIGHTEEN. The clause makes "compaction of fill INCLUDING compaction of trench
// backfill" ONE item, and closes the list with an open-ended (xviii) "any other
// job specific testing" that the prose rendering drops entirely. Two of the
// eighteen were wrong before this file was read against the source.
//
// GOVERNANCE, copied from `testCategories.ts:39-47` because the failure shape is
// identical:
//   * ADDING a canonical category to an entry OPENS a gate silently — a lot that
//     could not evidence a PSP5 matter suddenly can, and nobody sees a symptom.
//     Pack-class change: it needs the review, stating which lots' folios change.
//   * REMOVING one, or moving an entry to unmapped, can only UNDER-state
//     coverage. That is loud, visible on the folio itself, and one line to
//     recover. Normal PR.
//   * `unmappedReason` is REQUIRED whenever `canonicalCategories` is empty. An
//     empty set with no reason is `[DR2-B1]`'s fake coverage inverted — a silent
//     nothing. The type forbids it and AT-145 asserts it.

import type { TestCategory } from '../readiness/sufficiency/testCategories.js';

export const LOGAN_18_CROSSWALK_VERSION = 'logan-psp5-18.v1';

/** The clause the eighteen are enumerated under. */
export const LOGAN_18_CLAUSE = '5.6.5(1)(c)';

/**
 * The clause's own stem, transcribed, so the table's scope is legible without
 * leaving the file.
 */
export const LOGAN_18_CLAUSE_STEM = 'copies of test results in respect of:';

export interface Logan18Entry {
  /** The clause's own roman numeral, `i` … `xviii`. */
  readonly numeral: string;
  /** 1…18, the ordinal of that numeral. Convenience only; the numeral is the citation. */
  readonly number: number;
  /** Stable id. The folio and any later profile version key off this, not the ordinal. */
  readonly id: string;
  /** The clause's own wording, transcribed. */
  readonly psp5Name: string;
  /**
   * Canonical `TestCategory` values (keys of `routes/testResults/specifications.ts`,
   * asserted in the test, not imported — production code in `lib/` must not import
   * from `routes/`). Empty iff `unmappedReason` is set.
   *
   * A mapping never means "satisfied". It means a verified `TestResult` in one of
   * these categories is EVIDENCE TOWARD this matter. Whether the matter applies to
   * a given lot, and whether the count is sufficient, are determinations CIVOS
   * does not make.
   */
  readonly canonicalCategories: readonly TestCategory[];
  /** Required exactly when `canonicalCategories` is empty. */
  readonly unmappedReason?: string;
  /**
   * True for (xviii) alone: the clause's own catch-all. It is the reason an
   * unresolvable test-type string must never be reported as "outside the pack" —
   * job-specific testing required by the engineer IS a pack item, and CIVOS
   * cannot tell which unresolved string is one.
   */
  readonly openEnded?: boolean;
}

/**
 * The eighteen, in clause order.
 *
 * EIGHT ARE UNMAPPED and that is the honest half of this table. Three name a
 * material "quality" whose constituent tests the clause does not enumerate; one
 * names spray and application RATES rather than a test; three name hydraulic or
 * water tests for which CIVOS has no canonical category at all; and one is the
 * clause's own open-ended catch-all. Guessing any of them would manufacture
 * exactly the coverage `[DR2-B1]` caught Rev 2 claiming.
 */
export const LOGAN_18: readonly Logan18Entry[] = Object.freeze([
  {
    numeral: 'i',
    number: 1,
    id: 'fill_and_trench_compaction',
    // ONE item, not two. The prose rendering the spec was written against split
    // it; the clause says "including", not "and". `[LP5-DELTA]`.
    psp5Name: 'the compaction of fill including compaction of trench backfill',
    canonicalCategories: ['compaction'],
  },
  {
    numeral: 'ii',
    number: 2,
    id: 'subgrade_cbr',
    psp5Name: 'the sub-grade CBR',
    canonicalCategories: ['cbr'],
  },
  {
    numeral: 'iii',
    number: 3,
    id: 'subgrade_compaction',
    psp5Name: 'the sub-grade compaction',
    canonicalCategories: ['compaction'],
  },
  {
    numeral: 'iv',
    number: 4,
    id: 'cbr15_material_quality',
    psp5Name: 'the CBR 15 material quality',
    canonicalCategories: [],
    // Not `['cbr']`: the CBR value is (ii)'s test. "Material quality" of a CBR 15
    // select fill is a property SET (grading, plasticity, and depending on the
    // specification more) that the clause does not enumerate. Mapping it to
    // whichever canonical categories look plausible would let one grading test
    // read as "CBR 15 material quality supplied".
    unmappedReason:
      'the clause names a material "quality" without enumerating its constituent tests; ' +
      'CIVOS does not guess which canonical categories constitute it',
  },
  {
    numeral: 'v',
    number: 5,
    id: 'cbr15_compaction',
    psp5Name: 'the CBR 15 compaction',
    canonicalCategories: ['compaction'],
  },
  {
    numeral: 'vi',
    number: 6,
    id: 'subsoil_drain_filter_media_grading',
    psp5Name: 'the sub-soil drain filter media grading',
    canonicalCategories: ['grading'],
  },
  {
    numeral: 'vii',
    number: 7,
    id: 'bedding_material_grading',
    psp5Name: 'the grading of all bedding materials used in the works',
    canonicalCategories: ['grading'],
  },
  {
    numeral: 'viii',
    number: 8,
    id: 'base_material_quality',
    psp5Name: 'the base course material quality',
    canonicalCategories: [],
    unmappedReason:
      'the clause names a material "quality" without enumerating its constituent tests; ' +
      'CIVOS does not guess which canonical categories constitute it',
  },
  {
    numeral: 'ix',
    number: 9,
    id: 'base_compaction',
    psp5Name: 'the base course compaction',
    canonicalCategories: ['compaction'],
  },
  {
    numeral: 'x',
    number: 10,
    id: 'subbase_material_quality',
    psp5Name: 'the sub-base course material quality',
    canonicalCategories: [],
    unmappedReason:
      'the clause names a material "quality" without enumerating its constituent tests; ' +
      'CIVOS does not guess which canonical categories constitute it',
  },
  {
    numeral: 'xi',
    number: 11,
    id: 'subbase_compaction',
    psp5Name: 'the sub-base course compaction',
    canonicalCategories: ['compaction'],
  },
  {
    numeral: 'xii',
    number: 12,
    id: 'prime_primer_seal_rates',
    psp5Name: 'the prime or primer seal spray and application rates',
    canonicalCategories: [],
    // A spray and application rate is a RECORD OF WHAT WAS APPLIED, not a
    // laboratory or field test. `testTypeSpecifications` has no rate key, and
    // inventing one here would put a matter into the folio that no test result
    // can ever resolve to.
    unmappedReason:
      'a spray and application rate is a placement record, not a test; CIVOS has no ' +
      'canonical test category for it',
  },
  {
    numeral: 'xiii',
    number: 13,
    id: 'ac_core_tests',
    psp5Name: 'the AC core tests',
    // A core is cut for both determinations; either is evidence toward the matter.
    canonicalCategories: ['asphalt_density', 'asphalt_thickness'],
  },
  {
    numeral: 'xiv',
    number: 14,
    id: 'concrete_testing',
    psp5Name:
      'any concrete testing required by the standard specifications in Part 3 Standards of ' +
      'this planning scheme policy',
    canonicalCategories: ['concrete_strength', 'concrete_slump'],
  },
  {
    numeral: 'xv',
    number: 15,
    id: 'sewer_pressure_tests',
    psp5Name: 'sewer pressure tests',
    canonicalCategories: [],
    unmappedReason:
      'CIVOS has no canonical test category for hydraulic pressure testing ' +
      '(`testTypeSpecifications` carries none)',
  },
  {
    numeral: 'xvi',
    number: 16,
    id: 'water_main_pressure_tests',
    psp5Name: 'water main pressure tests',
    canonicalCategories: [],
    unmappedReason:
      'CIVOS has no canonical test category for hydraulic pressure testing ' +
      '(`testTypeSpecifications` carries none)',
  },
  {
    numeral: 'xvii',
    number: 17,
    id: 'water_quality_tests',
    // The clause's own parenthetical matters to the folio: this one is submitted
    // separately, AFTER the as-constructed data is approved, so its absence from a
    // folio is expected rather than a shortfall.
    psp5Name:
      'water quality tests in accordance with the document Requirements for water quality ' +
      'test results - Connection of new water mains (to be submitted separately, after ' +
      'approval of As constructed data)',
    canonicalCategories: [],
    unmappedReason:
      'CIVOS has no canonical test category for potable-water quality sampling ' +
      '(`testTypeSpecifications` carries none); the clause also submits it separately, ' +
      'after as-constructed approval',
  },
  {
    numeral: 'xviii',
    number: 18,
    id: 'other_job_specific_testing',
    psp5Name: 'any other job specific testing carried out or required by the engineer',
    canonicalCategories: [],
    unmappedReason:
      'an open-ended catch-all defined by the engineer, not by a test category; CIVOS ' +
      'cannot enumerate it',
    openEnded: true,
  },
] as const satisfies readonly Logan18Entry[]);

/**
 * Canonical category -> the PSP5 matters it is evidence toward.
 *
 * DERIVED, never hand-maintained, so the reverse direction cannot drift from the
 * forward one.
 */
const REVERSE: ReadonlyMap<TestCategory, readonly Logan18Entry[]> = (() => {
  const out = new Map<TestCategory, Logan18Entry[]>();
  for (const entry of LOGAN_18) {
    for (const category of entry.canonicalCategories) {
      const bucket = out.get(category);
      if (bucket) bucket.push(entry);
      else out.set(category, [entry]);
    }
  }
  return out;
})();

/**
 * True when this matter shares a canonical category with any other, i.e. a
 * matching test CANNOT be attributed to it specifically.
 *
 * This is the crosswalk's most important honest limb and it is COMPUTED from the
 * table rather than declared per entry. Five of the eighteen are "compaction" of
 * different materials at different levels; the canonical vocabulary has one
 * `compaction` with no layer or material discriminator — the same gap
 * `vicroads-204.v1.ts:40-44` records for `appliesTo`. So a verified compaction
 * test is evidence toward five matters and proof of none, and the folio must say
 * so rather than tick a box.
 */
export function isAmbiguouslyAttributed(entry: Logan18Entry): boolean {
  return entry.canonicalCategories.some((category) => (REVERSE.get(category)?.length ?? 0) > 1);
}

/** The matters a canonical category is evidence toward. Empty for an unmapped category. */
export function logan18EntriesForCategory(category: TestCategory): readonly Logan18Entry[] {
  return REVERSE.get(category) ?? [];
}

/** The clause's own catch-all, (xviii). */
export const LOGAN_18_OPEN_ENDED = LOGAN_18.filter((entry) => entry.openEnded);
