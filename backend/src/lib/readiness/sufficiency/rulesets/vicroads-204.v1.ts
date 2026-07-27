// Seed pack — VicRoads/DTP Section 204 (Earthworks), version 1. Spec §8.2.
//
// SUPERSEDED BY `vicroads-204.v2` ON 2026-07-27, AND FROZEN. Do not edit this
// file again: C1.2 (#1594) ships `buildSufficiencySnapshotV1`, which writes
// `rules[].ruleId: 'vicroads-204.v1/compaction-density'` into the IMMUTABLE
// `RequirementEvaluation` table at all three decision points. Those rows are
// evidence. Editing this pack's content would silently change what a past
// decision means, which is exactly what F0's "definitions are never edited in
// place once instances exist" forbids.
//
// D14's §6.5 allowed ONE in-place edit while C1.2 had not shipped and the
// instance count was zero. That exemption expired when C1.2 landed, and D14.2
// took the other branch of §6.5's own conditional: mint `.v2`, close this pack
// with `effectiveTo`, and leave the file in the tree so every historical
// `ruleId` still resolves to the definition it was decided under.
//
// STATUS: `confirmed`. The §8.3 step-1 confirmation pass RAN on 2026-07-27
// against the CURRENT PUBLISHED primary document — not a council republication,
// not a secondary page — and returned grade A (primary) evidence. Report:
// docs/research/c1-pack-confirmation-vicroads-204-2026-07-27.md; folded into the
// spec as [C1C-1] … [C1C-6].
//
// CONFIRMED VERBATIM:
//   * clause 204.13(a) — six tests per lot for Scale A/B compaction, three for
//     Scale C. UNCHANGED across v5.0 (Oct 2013) through v8.0 (Nov 2025). NOT
//     Table 204.142 (which carries lot SIZE and the reduced lot-sampling
//     interval) and NOT RC 500.05 (which carries no per-scale counts at all).
//   * `defaultScale: 'A'` — "Where the compaction scale has not been specified,
//     Compaction Scale A shall apply."
//   * clause 204.14(c) — the reduced-frequency trigger, three consecutive lots.
//
// NOT encoded, deliberately — each one is a "confident wrong number" avoided:
//
//   * NO `maxLotSize`, NEITHER limb.
//     - The 500 m² "under paved areas" cap is a WYNDHAM CITY COUNCIL amendment
//       ("a maximum of 500m² under paved areas"), absent from every version of
//       the VicRoads/DTP document [C1C-2]. Shipping it would have asserted an
//       authority requirement the authority never wrote, into immutable decision
//       snapshots.
//     - The 5,000 m² cap is TYPE A MATERIAL ONLY (Type B is 10,000 m² or a day's
//       production; Type C has NO area cap). `appliesTo` has no material-type
//       discriminator, so a bare cap would fire falsely on a 5,000–10,000 m²
//       Type B lot and invent a cap for Type C [C1C-3]. The discriminator is a
//       named scope item (§16 D14), not a C1 deliverable.
//
//   * NO `reduced` limb — right call, and the reason matters [C1C-5]. Section 204
//     v8.0 DOES publish reduced figures: Table 204.142's third column, every
//     2nd / 2nd / 2nd / 3rd / 6th lot of like material and work. Those are a
//     LOT-SAMPLING INTERVAL ("which lots get tested at all"), not a per-lot count
//     ("how many tests in this lot") — clause 204.13(a)'s six is unconditional
//     and has no reduced variant, so a lot that IS tested under the reduced
//     regime still requires six.
//     WARNING TO A FUTURE AGENT: do NOT "fix" this by encoding {A:2, B:2, C:6}
//     into `minCountByScale`. That reads as "2 tests per lot" and is
//     catastrophically wrong. Encoding the interval needs a NEW limb
//     (e.g. `lotSamplingInterval: { everyNthLot: 2 }`), gated on a recorded
//     Superintendent approval.
//
//   * NO `perQuantity` limb — confirmed: Section 204 v8.0 publishes no per-area
//     frequency figure (its only area figures are Table 204.142's lot-size caps).
//     Note this is NOT true of every authority — TfNSW Q6 Table Q6/L.1 is a
//     per-area frequency table throughout [C1C-7].
//
//   * NO production-day limb (§3.3) — CIVOS records no production day; C2 owns it.
//
// KNOWN CEILINGS carried in the rule's own label/citation rather than hidden:
//   * Section 173 SMALL LOTS. Clause 204.13(a)'s six is qualified "unless the lot
//     is to be treated as a small lot in accordance with Section 173". CIVOS has
//     no small-lot concept, so an unqualified "requires 6" OVER-states the
//     requirement for one — the §3.4 failure direction, inverted [C1C-1].
//   * Clause 204.14 restricts MATERIAL PROPERTY testing to Scale A or B only, and
//     `scaleKeys` is declared at Ruleset level. Not a C1 problem — this pack ships
//     one compaction rule — but a CBR/PI/grading rule added here could not express
//     its narrower ['A','B'] key set.

import type { FrequencyRule, RulesetProvenance, Ruleset } from '../types.js';

const RULESET_ID = 'vicroads-204.v1';

// The document is issued by the Department of Transport and Planning on behalf
// of Head, Transport for Victoria; 'VicRoads' remains the trading brand the
// specification is known by in the field, so the string names both [C1C-1].
const AUTHORITY = 'DTP (VicRoads)';
const DOCUMENT = 'Section 204 – Earthworks';
const EDITION = 'v8.0, November 2025';
// It is a .docx, so `pdfPage` records the document's own footer page.
const SOURCE_URL = 'https://content.vic.gov.au/Section-204-Earthworks-v8.docx';
const CHECKED_ON = '2026-07-27';
// v7.0 (Feb 2023) → v8.0 (Nov 2025) was ~33 months, so 12 is comfortably
// conservative. CI fails a `confirmed` ruleset past this date (§8.3 step 4).
const REVALIDATE_BY = '2027-07-27';

const PROVENANCE: RulesetProvenance = {
  authority: AUTHORITY,
  document: DOCUMENT,
  // The ruleset-level clause is the testing clause the pack is built from; each
  // RULE cites the clause carrying its own number (§3.2 "one rule, one clause").
  clause: '204.13(a)',
  edition: EDITION,
  pdfPage: 13,
  sourceUrl: SOURCE_URL,
  evidenceGrade: 'A',
  checkedOn: CHECKED_ON,
  revalidateBy: REVALIDATE_BY,
};

/**
 * Minimum counts are scoped to COMPACTION [C1R-7]: clause 204.13(a) is a
 * compaction-density figure, not a blanket per-lot count for every test type.
 *
 * `activitySlugs`: the two earthworks Level-2 slugs whose material is compacted.
 * `geosynthetics` is in the same family but has no density requirement, so it is
 * excluded rather than swept in by family.
 */
const COMPACTION_DENSITY: FrequencyRule = {
  id: `${RULESET_ID}/compaction-density`,
  // The Section 173 escape is in the label so the user can see it (§4.4 [C1C-1]).
  label: 'Compaction density tests per lot (unless a Sec 173 small lot)',
  testType: 'compaction',
  appliesTo: {
    activitySlugs: ['earthworks_general', 'earthworks_subgrade_prep'],
  },
  minCountByScale: { A: 6, B: 6, C: 3 },
  // [C1C-6] Eligibility ONLY — never a reduction. 204.14(c) requires the
  // Superintendent's agreement plus an established compaction procedure, counts
  // only lots conforming IN THE FIRST TEST, and excludes Section 173 small areas
  // from the streak. CIVOS has no approval input and no small-area concept, so
  // the computed streak is an upper bound reported as "eligible to REQUEST".
  reducedFrequencyEligibility: {
    consecutiveConformingLots: 3,
    escalationShape: 'reset_on_any_failure',
    clause: '204.14(c)',
  },
  provenance: PROVENANCE,
};

export const VICROADS_204_V1: Ruleset = {
  id: RULESET_ID,
  state: 'vic',
  specSet: 'vicroads',
  scaleKeys: ['A', 'B', 'C'],
  // Confirmed verbatim: "Where the compaction scale has not been specified,
  // Compaction Scale A shall apply." (§16 D6 — a ruleset with a defensible
  // default declares one; without it every VIC lot would read `unknown` forever.)
  defaultScale: 'A',
  // The 6/6/3 counts are unchanged from v5.0 (October 2013) onward, so the pack
  // is effective from that edition rather than from the edition read.
  effectiveFrom: '2013-10-01',
  // Closed the day `vicroads-204.v2` opened, so exactly one pack is live at any
  // instant and no lot silently changes pack mid-window. A lookup dated before
  // this still resolves v1 — which is how a past decision's `ruleId` keeps
  // meaning what it meant.
  effectiveTo: '2026-07-27',
  status: 'confirmed',
  rules: [COMPACTION_DENSITY],
  provenance: PROVENANCE,
};
