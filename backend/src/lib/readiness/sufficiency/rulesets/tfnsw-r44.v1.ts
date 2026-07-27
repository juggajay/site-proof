// Seed pack — TfNSW R44 (Earthworks), version 1. Spec §8.2, §8.2.1, §16 D14.
//
// STATUS: `draft`, and MISATTRIBUTED — do NOT promote it. C1.1 deliberately does
// NOT re-author it (spec §11 C1.1); it records what the 2026-07-27 primary-source
// confirmation pass found, so the next agent starts from the truth rather than
// from this file's superseded Rev-2 rationale.
//
// WHAT THE CONFIRMATION PASS FOUND [C1C-7]. Report:
// docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md.
//
//   * The appendix's portal annotation record does NOT serve R44. It serves
//     Q6 — Quality Management (Major Works), Ed 2/Rev 0, February 2024.
//   * R44 Ed 6/Rev 0 (June 2023) publishes NO test frequencies at all. Clause
//     1.2.5 defers ("Frequency of testing must also conform to the requirements
//     of TfNSW Q"), and Annexure R44/L Table R44/L.1's "Minimum Frequency" cell
//     is the literal character `Q` for every relative-compaction and
//     moisture-content row.
//   * The `n = 6` below is ONE CELL of Q6 Ed 2/Rev 0, Annexure Q6/L cl. L1,
//     Table Q6/L.1 — a TWO-DIMENSIONAL table (specified relative compaction band
//     × lot area band) whose minimums run 1 to 10 with per-area rates. Flat, it
//     is wrong in BOTH directions: over-strict on a typical 3,000 m² Selected
//     Material Zone lot (which needs 5) and under-strict on a > 5,000 m² lot
//     specified at 102.0 % (which needs 1 per 1,000 m², minimum 10).
//   * Evidence grade for the FACTS is now 'A' (primary PDFs, read in full).
//     Grade A evidence that the ENCODED RULE IS WRONG is still a reason to keep
//     the pack draft — so the grade stays at its weakest limb, 'C', and §8.3's
//     CI rule keeps it unconfirmable and therefore non-blocking (§5.1.2).
//
// HOW TO RE-AUTHOR IT (a later slice, not C1.1): identity `tfnsw-q6.v1`, pairing
// R44 Table R44.7 *Minimum Characteristic Values of Relative Compaction* (the
// acceptance thresholds that select the Q6 row) with Q6 Table Q6/L.1
// *frequencies*. The rule shape is (compaction band) × (lot area band) → minCount
// and/or per-area rate, which `minCountByScale` + `perQuantity` already express.
// THE BLOCKER IS NOT RESEARCH: a lot has no "specified relative compaction"
// field, so no Q6 row can be selected. That attribute is a named scope item
// (§16 D14), recommended for C2 alongside the sample lifecycle.
//
// SCOPE: the count only. No statistic (§16 D8). Note the terminology correction:
// "Characteristic Density Ratio" is NOT TfNSW terminology (0 hits in R44 Ed 6 and
// Q6 Ed 2). The real statistic is the characteristic value of relative
// compaction, Q_L = x̄ − ks, with k from Table Q6/L.3 (n = 6 ⇒ k = 0.72) — so
// n = 6 is a ROW of the k-value table, never a basis. Nothing statistical is
// encoded.
//
// `specSet: 'tfnsw'` is the POST-normalization value: `normalizeSpecSet` folds
// the pre-2019 name 'rms' → 'tfnsw' (`itpMatcher.ts:74-76`), so the 9 live
// projects still carrying 'rms' resolve this pack.
//
// R44's count carries no scale dimension, so the ruleset declares a single scale
// key and defaults to it — a defensible default under §16 D6, which means these
// lots evaluate with no data entry at all.

import type { FrequencyRule, RulesetProvenance, Ruleset } from '../types.js';

const RULESET_ID = 'tfnsw-r44.v1';

const PROVENANCE: RulesetProvenance = {
  authority: 'TfNSW',
  document: 'R44 — Earthworks',
  // [C1C-7] The clause is NOT pinned, and now for a sharper reason than Rev 2's:
  // R44 publishes no frequencies at all — cl. 1.2.5 defers them to TfNSW Q, and
  // the figure below is actually Q6 Table Q6/L.1's. This string is USER-VISIBLE
  // in every citation, so it names the real clause and says where the number
  // does not come from; the full misattribution story is the header above.
  clause: 'R44 cl. 1.2.5 (frequency deferred to TfNSW Q)',
  edition: '',
  sourceUrl: '',
  evidenceGrade: 'C',
  checkedOn: '',
  revalidateBy: '',
};

const DENSITY_SAMPLE_COUNT: FrequencyRule = {
  id: `${RULESET_ID}/density-sample-count`,
  label: 'Minimum density test samples per lot',
  testType: 'compaction',
  appliesTo: {
    activitySlugs: ['earthworks_general', 'earthworks_subgrade_prep'],
  },
  minCountByScale: { standard: 6 },
  provenance: PROVENANCE,
};

export const TFNSW_R44_V1: Ruleset = {
  id: RULESET_ID,
  state: 'nsw',
  specSet: 'tfnsw',
  scaleKeys: ['standard'],
  defaultScale: 'standard',
  effectiveFrom: '2015-01-01',
  status: 'draft',
  rules: [DENSITY_SAMPLE_COUNT],
  provenance: PROVENANCE,
};
