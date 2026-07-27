// Seed pack — VicRoads Section 204 (Earthworks), version 1. Spec §8.2.
//
// STATUS: `draft`. The §8.3 step-1 confirmation pass — a human opening the
// CURRENT PUBLISHED VicRoads/DTP document and verifying every number against its
// cited clause/table — HAS NOT RUN. So the four confirmation-provenance fields
// (`edition`, `sourceUrl`, `pdfPage`, `checkedOn`, `revalidateBy`) are recorded
// as EMPTY/ABSENT rather than guessed, and `validateRuleset` enforces that a
// `confirmed` ruleset cannot have them empty. A draft ruleset is EVALUATED
// NORMALLY (numbers shown, `citation.confirmed: false`) and can NEVER block, by
// construction (§4.2 [C1R-B5], §5.1.2).
//
// Promotion to `confirmed` is a Jay/human task (§16.0 D13). Note §8.3 step 3:
// once instances exist, confirmation emits a NEW version (`vicroads-204.v2.ts`)
// with `effectiveTo` set here — never an in-place edit. No instances exist yet
// (C1.0 has no call sites), so a pre-C1.1 promotion in place is still safe.
//
// FIGURES, and where they come from: the research appendix's VicRoads claim
// "6 tests/lot (Scale A/B compaction), 3 (Scale C)" and "Type A lot = one day's
// production or 5,000 m², whichever is the lesser". Grade 'A' — but grade is the
// grade of the SOURCE, not a substitute for reading the document, which is why
// this ships draft.
//
// The 500 m² "under paved areas" cap is DELIBERATELY ABSENT: it is a Wyndham
// City Council amendment misattributed to VicRoads, and appears in no version of
// the VicRoads/DTP document (confirmed against v8.0 Nov 2025 primary and the
// legacy text). See docs/research/c1-pack-confirmation-vicroads-204-2026-07-27.md.
// The 5,000 m² cap is Type A material ONLY per that same confirmation pass, and
// FrequencyRule has no material-type discriminator yet — so it is over-broad as
// encoded. Left as-is for a follow-up correction slice; DO NOT promote this pack
// to `confirmed` until that lands.
//
// NOT encoded, deliberately:
//   * NO `reduced` limb [C1R-B8]. The appendix supplies the 204.14(c) TRIGGER
//     ("test every lot until 3 consecutive conform → reduced frequency; any
//     failure reverts to full testing") and NO reduced count. A guessed reduced
//     count would emit a confident wrong required count — the exact defect the
//     regime machinery exists to prevent. `validateRuleset` also refuses a
//     `reduced` limb on any draft ruleset.
//   * NO `perQuantity` limb (§3.2.1 [C1R-1]) — no cited authority supplies a
//     per-area frequency figure.
//   * NO production-day limb (§3.3) — CIVOS records no production day; that is
//     C2's [C1R-4]. Only the AREA limb of the lot-size cap is evaluable, and it
//     is advisory only.
//   * NO `defaultScale`. No cited authority supplies a defensible default Scale
//     for VicRoads, and §16 D6 says a ruleset with no defensible default
//     declares none — its lots read `scale_not_selected` until a scale is
//     entered. This is a launch-friction call worth Jay's eyes (see PR body).

import type { FrequencyRule, RulesetProvenance, Ruleset } from '../types.js';

const RULESET_ID = 'vicroads-204.v1';

const PROVENANCE: RulesetProvenance = {
  authority: 'VicRoads',
  document: 'Section 204 — Earthworks',
  clause: 'Table 204.142',
  edition: '',
  sourceUrl: '',
  evidenceGrade: 'A',
  checkedOn: '',
  revalidateBy: '',
};

/**
 * Minimum counts are scoped to COMPACTION [C1R-7]: the appendix's claim is a
 * compaction-density figure, not a blanket per-lot count for every test type.
 *
 * `activitySlugs`: the two earthworks Level-2 slugs whose material is compacted.
 * `geosynthetics` is in the same family but has no density requirement, so it is
 * excluded rather than swept in by family.
 */
const COMPACTION_DENSITY: FrequencyRule = {
  id: `${RULESET_ID}/compaction-density`,
  label: 'Minimum compaction density tests per lot',
  testType: 'compaction',
  appliesTo: {
    activitySlugs: ['earthworks_general', 'earthworks_subgrade_prep'],
  },
  minCountByScale: { A: 6, B: 6, C: 3 },
  maxLotSize: [{ unit: 'm2', value: 5000 }],
  provenance: PROVENANCE,
};

export const VICROADS_204_V1: Ruleset = {
  id: RULESET_ID,
  state: 'vic',
  specSet: 'vicroads',
  scaleKeys: ['A', 'B', 'C'],
  effectiveFrom: '2015-01-01',
  status: 'draft',
  rules: [COMPACTION_DENSITY],
  provenance: PROVENANCE,
};
