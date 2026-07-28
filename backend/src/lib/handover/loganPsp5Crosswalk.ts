// Wave D `D1b.0` — the Logan-18 crosswalk (spec
// `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3, §2.3, §4.3.2, `[DR2-B1]`).
//
// A LEAF data module in the same species as `readiness/sufficiency/rulesets/` and
// `readiness/sufficiency/testCategories.ts`: shipped product data with a citation
// per entry, reviewable in a PR diff, CI-testable, revertable by `git revert`.
// It imports only the canonical categoriser's types.
//
// WHAT IT IS. Logan City Council Planning Scheme Policy 5 §5.6.5(1)(b) requires
// test results across EIGHTEEN named categories. `[DR2-B1]` found that no such
// crosswalk existed — the canonical resolver is Victorian-compaction-only by its
// own governance note (`testCategories.ts:49-56`) — and that the folio therefore
// could not name a missing category. This is that crosswalk.
//
// SOURCE AND FIDELITY, stated before the data so nobody has to infer it.
//   * The clause is grade A: downloaded, text-extracted and read directly by the
//     D.0 author (`docs/research/d0-adac-handover-research-2026-07-28.md:23`,
//     evidence table `:44`).
//   * What this repo holds is D.0's RENDERING of the clause as running prose, not
//     a transcription of a numbered list. The eighteen entries below are the
//     EXPANSION of that prose's conjunctions ("fill AND trench compaction" -> two
//     entries, "base AND sub-base course quality AND compaction" -> four).
//   * The check on that expansion is arithmetic and it is the reason this table
//     ships rather than a fetch of the PDF: the expansion yields EXACTLY 18, and
//     the clause says 18. A different split does not.
//   * `[LP5-FIDELITY]` A future agent holding the PDF itself should re-derive
//     `psp5Name` verbatim and correct any entry here. Correcting a NAME is a
//     normal PR; changing a `canonicalCategories` set is a pack-class change
//     (see GOVERNANCE).
//
// GOVERNANCE, copied from `testCategories.ts:39-47` because the failure shape is
// identical:
//   * ADDING a canonical category to an entry OPENS a gate silently — a lot that
//     could not evidence a PSP5 category suddenly can, and nobody sees a symptom.
//     Pack-class change: it needs the review, stating which lots' folios change.
//   * REMOVING one, or moving an entry to `unmapped`, can only UNDER-state
//     coverage. That is loud, visible on the folio itself, and one line to
//     recover. Normal PR.
//   * `unmappedReason` is REQUIRED whenever `canonicalCategories` is empty. An
//     empty set with no reason is the "fake coverage" failure `[DR2-B1]` punished,
//     inverted — a silent nothing. The type forbids it and AT-145 asserts it.

import type { TestCategory } from '../readiness/sufficiency/testCategories.js';

export const LOGAN_18_CROSSWALK_VERSION = 'logan-psp5-18.v1';

/**
 * The clause every entry below is drawn from.
 *
 * NO SUB-CLAUSE LETTER, deliberately. D.0 records letters for exactly two items —
 * `(a)` the consultant's certificate and `(e)` the CCTV video. The letter carrying
 * the test-result list is not in the material this repo holds, and writing a
 * plausible `(b)` would be a fabricated citation in a document whose entire point
 * is that citations are real. `loganPsp5Profile.test.ts` asserts no other item
 * grows a letter.
 */
export const LOGAN_18_CLAUSE = '5.6.5(1)';

/**
 * The verbatim string this table expands, recorded so the expansion is auditable
 * without leaving the file. From
 * `docs/research/d0-adac-handover-research-2026-07-28.md:23`.
 */
export const LOGAN_18_SOURCE_PROSE =
  'test results across 18 named categories (fill and trench compaction, sub-grade ' +
  'CBR and compaction, CBR 15 quality and compaction, sub-soil drain filter grading, ' +
  'bedding grading, base and sub-base course quality and compaction, prime/primer ' +
  'seal rates, AC core tests, concrete testing, sewer and water main pressure tests, ' +
  'water quality)';

/**
 * A PSP5 category CIVOS can see evidence for, or one it demonstrably cannot.
 *
 * `mapped` never means "satisfied". It means a verified `TestResult` in one of
 * the named canonical categories is EVIDENCE TOWARD this PSP5 category. Whether
 * the category is required for a given lot, and whether the count is sufficient,
 * are determinations CIVOS does not make (see `resolveLogan18Coverage`).
 */
export interface Logan18Entry {
  /** 1…18, the position in the expansion of {@link LOGAN_18_SOURCE_PROSE}. */
  readonly number: number;
  /** Stable id; the folio and any future profile version key off this, not the number. */
  readonly id: string;
  /** The category name as PSP5's prose names it. */
  readonly psp5Name: string;
  /**
   * Canonical `TestCategory` values (keys of `routes/testResults/specifications.ts`,
   * asserted in the test, not imported — production code in `lib/` must not import
   * from `routes/`). Empty iff `unmappedReason` is set.
   */
  readonly canonicalCategories: readonly TestCategory[];
  /** Required exactly when `canonicalCategories` is empty. */
  readonly unmappedReason?: string;
}

/**
 * The eighteen. Ordered as the prose orders them.
 *
 * SEVEN ARE UNMAPPED and that is the honest half of this table. Three name a
 * material "quality" whose constituent tests the clause does not enumerate; one
 * names an application RATE rather than a test; three name hydraulic or water
 * tests for which CIVOS has no canonical category at all. Guessing any of them
 * would manufacture exactly the coverage `[DR2-B1]` caught Rev 2 claiming.
 */
export const LOGAN_18: readonly Logan18Entry[] = Object.freeze([
  {
    number: 1,
    id: 'fill_compaction',
    psp5Name: 'Fill compaction',
    canonicalCategories: ['compaction'],
  },
  {
    number: 2,
    id: 'trench_compaction',
    psp5Name: 'Trench compaction',
    canonicalCategories: ['compaction'],
  },
  {
    number: 3,
    id: 'subgrade_cbr',
    psp5Name: 'Sub-grade CBR',
    canonicalCategories: ['cbr'],
  },
  {
    number: 4,
    id: 'subgrade_compaction',
    psp5Name: 'Sub-grade compaction',
    canonicalCategories: ['compaction'],
  },
  {
    number: 5,
    id: 'cbr15_quality',
    psp5Name: 'CBR 15 material quality',
    canonicalCategories: [],
    // Not `['cbr']`: the CBR value is entry 3's test. "Quality" of a CBR 15
    // select fill is a material-property SET (grading, plasticity, and depending
    // on the specification more), and the clause as rendered does not enumerate
    // it. Mapping it to whichever canonical categories look plausible would let
    // one grading test read as "CBR 15 quality supplied".
    unmappedReason:
      'PSP5 names a material "quality" without enumerating its constituent tests; ' +
      'CIVOS does not guess which canonical categories constitute it',
  },
  {
    number: 6,
    id: 'cbr15_compaction',
    psp5Name: 'CBR 15 compaction',
    canonicalCategories: ['compaction'],
  },
  {
    number: 7,
    id: 'subsoil_drain_filter_grading',
    psp5Name: 'Sub-soil drain filter material grading',
    canonicalCategories: ['grading'],
  },
  {
    number: 8,
    id: 'bedding_grading',
    psp5Name: 'Bedding material grading',
    canonicalCategories: ['grading'],
  },
  {
    number: 9,
    id: 'base_quality',
    psp5Name: 'Base course material quality',
    canonicalCategories: [],
    unmappedReason:
      'PSP5 names a material "quality" without enumerating its constituent tests; ' +
      'CIVOS does not guess which canonical categories constitute it',
  },
  {
    number: 10,
    id: 'base_compaction',
    psp5Name: 'Base course compaction',
    canonicalCategories: ['compaction'],
  },
  {
    number: 11,
    id: 'subbase_quality',
    psp5Name: 'Sub-base course material quality',
    canonicalCategories: [],
    unmappedReason:
      'PSP5 names a material "quality" without enumerating its constituent tests; ' +
      'CIVOS does not guess which canonical categories constitute it',
  },
  {
    number: 12,
    id: 'subbase_compaction',
    psp5Name: 'Sub-base course compaction',
    canonicalCategories: ['compaction'],
  },
  {
    number: 13,
    id: 'prime_primer_seal_rates',
    psp5Name: 'Prime and primer seal application rates',
    canonicalCategories: [],
    // An application rate is a RECORD OF WHAT WAS APPLIED, not a laboratory or
    // field test. `testTypeSpecifications` has no rate key and inventing one here
    // would put a category into the folio that no test can ever resolve to.
    unmappedReason:
      'an application rate is a placement record, not a test; CIVOS has no canonical ' +
      'test category for it',
  },
  {
    number: 14,
    id: 'ac_core_tests',
    psp5Name: 'Asphalt (AC) core tests',
    // A core is cut for both determinations; either is evidence toward the item.
    canonicalCategories: ['asphalt_density', 'asphalt_thickness'],
  },
  {
    number: 15,
    id: 'concrete_testing',
    psp5Name: 'Concrete testing',
    canonicalCategories: ['concrete_strength', 'concrete_slump'],
  },
  {
    number: 16,
    id: 'sewer_pressure_test',
    psp5Name: 'Sewer pressure test',
    canonicalCategories: [],
    unmappedReason:
      'CIVOS has no canonical test category for hydraulic pressure testing ' +
      '(`testTypeSpecifications` carries none)',
  },
  {
    number: 17,
    id: 'water_main_pressure_test',
    psp5Name: 'Water main pressure test',
    canonicalCategories: [],
    unmappedReason:
      'CIVOS has no canonical test category for hydraulic pressure testing ' +
      '(`testTypeSpecifications` carries none)',
  },
  {
    number: 18,
    id: 'water_quality',
    psp5Name: 'Water quality',
    canonicalCategories: [],
    unmappedReason:
      'CIVOS has no canonical test category for potable-water quality sampling ' +
      '(`testTypeSpecifications` carries none)',
  },
] as const satisfies readonly Logan18Entry[]);

/**
 * Canonical category -> the PSP5 entries it is evidence toward.
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
 * True when this PSP5 entry shares a canonical category with any other, i.e. a
 * matching test CANNOT be attributed to it specifically.
 *
 * This is the crosswalk's most important honest limb and it is COMPUTED from the
 * table rather than asserted per entry. Six PSP5 categories are "compaction" of
 * different materials at different levels; the canonical vocabulary has one
 * `compaction` with no layer or material discriminator (the same gap
 * `vicroads-204.v1.ts:40-44` records for `appliesTo`). So a verified compaction
 * test is evidence toward all six and proof of none, and the folio must say so
 * rather than tick a box.
 */
export function isAmbiguouslyAttributed(entry: Logan18Entry): boolean {
  return entry.canonicalCategories.some((category) => (REVERSE.get(category)?.length ?? 0) > 1);
}

/** The PSP5 entries a canonical category is evidence toward. Empty for an unmapped category. */
export function logan18EntriesForCategory(category: TestCategory): readonly Logan18Entry[] {
  return REVERSE.get(category) ?? [];
}
