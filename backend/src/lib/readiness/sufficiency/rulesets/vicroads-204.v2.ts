// Seed pack — VicRoads/DTP Section 204 (Earthworks), CIVOS pack revision 2.
// D14.2, docs/plans/d14-q6-pack-spec-2026-07-27.md §6.
//
// WHY .v2 AND NOT AN IN-PLACE EDIT OF .v1 — §6.5's own conditional, taken at the
// branch the evidence points to. §6.5 permits editing `vicroads-204.v1` in place
// ONLY while C1.2 has not shipped, because until then no `RequirementEvaluation`
// row references a sufficiency `ruleId` and a `.v2` would protect zero rows. The
// §6.5 pre-flight was run for this PR and FAILED: C1.2 landed as #1594, and
// `requirements/lotConformance.v1.ts`, `holdPointRelease.v1.ts` and
// `claimMember.v1.ts` all emit a `sufficiency` key, with
// `buildSufficiencySnapshotV1` persisting `rules[].ruleId` into an IMMUTABLE
// table at all three decision points. So instances exist, §6.5's second
// condition ("the exemption expires with C1.2 ... no exceptions") is in force,
// and this file is what it prescribes. `vicroads-204.v1.ts` STAYS in the tree,
// frozen and `effectiveTo`-closed, so every historical `ruleId` still resolves.
//
// `.vN` is the CIVOS PACK REVISION, not the authority's edition — the edition is
// `provenance.edition`, which is unchanged at Section 204 v8.0, November 2025.
// The counts are byte-identical to v1: this revision adds one advisory cap and
// one advisory disclosure limb, and changes NO required count in any direction.
//
// STATUS: `confirmed`. Two grade-A primary-source passes stand behind it, both
// read from the issuing department's own catalogue rather than a republication:
//   * docs/research/c1-pack-confirmation-vicroads-204-2026-07-27.md — clause
//     204.13(a), Table 204.142, clause 204.14(c), the Wyndham contamination.
//   * docs/research/c1-sec173-small-lots-2026-07-27.md — Section 173 cl.
//     173.04(d) quantified: < 500 m², 3 tests, mean, +2.0 %, permissive.
//
// CONFIRMED VERBATIM, carried forward from v1 unchanged:
//   * clause 204.13(a) — six tests per lot for Scale A/B compaction, three for
//     Scale C. UNCHANGED across v5.0 (Oct 2013) through v8.0 (Nov 2025). NOT
//     Table 204.142 (which carries lot SIZE and the reduced lot-sampling
//     interval) and NOT RC 500.05 (which carries no per-scale counts at all).
//   * `defaultScale: 'A'` — "Where the compaction scale has not been specified,
//     Compaction Scale A shall apply."
//   * clause 204.14(c) — the reduced-frequency trigger, three consecutive lots.
//
// NEW IN THIS REVISION:
//   * `materialTypes: ['Type A','Type B','Type C']` — Table 204.142's own row
//     vocabulary, recordable per lot as `Lot.materialType` (D14.1's column).
//   * `maxLotSize` — the 5,000 m² cap, TYPE A ONLY, closing [C1C-3] (§6.1).
//   * `smallLot` — Section 173 cl. 173.04(d), ADVISORY-ONLY (§6.2). No count
//     changes: applying the exception needs an election (`Lot.smallAreaElected`)
//     that does not exist and that Jay's J3 deferred.
//
// NOT encoded, deliberately — each one is a "confident wrong number" avoided:
//
//   * NO 500 m² "under paved areas" cap. It is a WYNDHAM CITY COUNCIL amendment
//     ("a maximum of 500m² under paved areas"), absent from every version of the
//     VicRoads/DTP document [C1C-2]. Shipping it would assert an authority
//     requirement the authority never wrote, into immutable decision snapshots.
//
//   * NO Type B and NO Type C cap [C1C-3]. Table 204.142 splits Type B into
//     THREE rows: ripped and re-compacted below Cut Floor Level -> 10,000 m²;
//     placed within 400 mm of top of Type B Material -> 10,000 m²; placed MORE
//     than 400 mm below top of Type B material -> one day's production, NO area
//     cap. A cap keyed to `materialAliases: ['type b']` would be WRONG for the
//     third sub-row, fabricating a limit on material the specification caps only
//     by production day; the sub-rows are discriminated by vertical position
//     relative to the Type B top / Cut Floor Level, which maps to nothing CIVOS
//     records. Type C has no area cap at all, so there is nothing to encode.
//     RESIDUAL UNDER-WARNING, stated rather than hidden: offering 'Type B' so a
//     user can SUPPRESS the Type A cap also suppresses the 10,000 m² cap two of
//     the three sub-rows do carry, so a 12,000 m² Type B lot warns about
//     nothing. The direction is safe — a missing ADVISORY warning, never a
//     missing count and never a block — and it closes when the sub-row
//     discriminator is researched.
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
//   * NO acceptance arithmetic. The +2.0 % shift and the characteristic -> mean
//     statistic switch of cl. 173.04(d) are CITATION TEXT and are never computed:
//     CIVOS counts tests and evaluates no density-ratio values (§6.3). That is
//     the one place a correct verdict can be READ wrongly, so the item text must
//     state the shifted threshold beside the reduced count rather than offering a
//     bare "3 tests".
//
// KNOWN CEILINGS:
//   * A RULE LABEL IS NOT A USER-VISIBLE DISCLOSURE CHANNEL [D14X-3]. The label
//     below carries "unless a Sec 173 small lot", and `shortfallSentence`
//     (`evidenceReadiness/conformanceItems.ts`) composes its sentence from the
//     counts and the CITATION and has never read `rule.label` — so that escape
//     reached no user until D14.2 put the quantified exception in the ITEM TEXT.
//     Anything a user must see belongs in the item text or the citation.
//   * Clause 204.14 restricts MATERIAL PROPERTY testing to Scale A or B only, and
//     `scaleKeys` is declared at Ruleset level. Not a C1 problem — this pack ships
//     one compaction rule — but a CBR/PI/grading rule added here could not express
//     its narrower ['A','B'] key set.

import type { FrequencyRule, RulesetProvenance, Ruleset } from '../types.js';

const RULESET_ID = 'vicroads-204.v2';

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
  // A developer-facing RECORD of the escape, not its disclosure — see the header.
  label: 'Compaction density tests per lot (unless a Sec 173 small lot)',
  testType: 'compaction',
  appliesTo: {
    activitySlugs: ['earthworks_general', 'earthworks_subgrade_prep'],
  },
  minCountByScale: { A: 6, B: 6, C: 3 },
  maxLotSize: [
    {
      unit: 'm2',
      value: 5000,
      // Table 204.142, row "Type A Material", column "Acceptable Lot Size in a
      // Single Layer of Work", verbatim: "One day's production or 5,000 m²,
      // whichever is the lesser". The day's-production limb is unevaluable —
      // CIVOS records no production day — and the area limb is TYPE A ONLY
      // [C1C-3]; see the header for why Type B and Type C stay unencoded.
      materialAliases: ['type a', 'type a material'],
    },
  ],
  // D14 §6.2 — Section 173 cl. 173.04(d) "Testing Small Areas", quantified by
  // docs/research/c1-sec173-small-lots-2026-07-27.md §2(b) from the primary
  // .docx. ADVISORY-ONLY: `Lot.smallAreaElected` does not exist, so nothing is
  // ever applied and NO count changes. Do not "finish" this by reducing the
  // count from area alone — cl. 173.04(d) says a small lot MAY be treated as a
  // small area, so an area-triggered reduction would tell a user "3 of 3,
  // sufficient" on a lot the Superintendent expects six tests on.
  smallLot: {
    // STRICTLY less than: "any lot which has a surface area less than 500 m2".
    maxArea: { unit: 'm2', value: 500 },
    // Scale C ABSENT DELIBERATELY — see `SmallLotException`'s own doc comment.
    minCountByScale: { A: 3, B: 3 },
    // "the mean value of the individual tests exceeds by 2.0% or more the
    // appropriate compaction scale requirement". Citation text; NEVER computed.
    acceptanceShiftPct: 2.0,
    provenance: {
      authority: AUTHORITY,
      document: 'Section 173 – Examination and Testing of Materials and Work (Roadworks)',
      clause: '173.04(d)',
      // The document carries NO version stamp and NO history table — its footer
      // reads only "Section 173 , March 2025". "v5" is the DTP catalogue's
      // version column, not the document's own claim (research §1.1), so the
      // edition string says which is which rather than inventing "v5.0".
      edition: 'March 2025 (catalogue v5)',
      // A .docx, like Section 204: this records the document's own footer page.
      pdfPage: 2,
      sourceUrl:
        'https://content.vic.gov.au/sites/default/files/2025-03/Section-173-Examination-and-Testing-of-Materials-and-Work-%28Roadworks%29.docx',
      evidenceGrade: 'A',
      checkedOn: CHECKED_ON,
      // Clause text is byte-identical across catalogue v4 (May 2024) and v5, and
      // matches pre-2015 text, so 12 months matches the Section 204 cadence.
      revalidateBy: REVALIDATE_BY,
    },
  },
  // [C1C-6] Eligibility ONLY — never a reduction. 204.14(c) requires the
  // Superintendent's agreement plus an established compaction procedure, counts
  // only lots conforming IN THE FIRST TEST, and excludes Section 173 small areas
  // from the streak. CIVOS has no approval input, so the computed streak stays an
  // upper bound reported as "eligible to REQUEST". (The small-area EXCLUSION from
  // the streak lands with the election in D14.4, not here.)
  reducedFrequencyEligibility: {
    consecutiveConformingLots: 3,
    escalationShape: 'reset_on_any_failure',
    clause: '204.14(c)',
  },
  provenance: PROVENANCE,
};

export const VICROADS_204_V2: Ruleset = {
  id: RULESET_ID,
  state: 'vic',
  specSet: 'vicroads',
  scaleKeys: ['A', 'B', 'C'],
  // D14 §6.1 — Table 204.142's own row vocabulary. All three ship even though
  // only Type A carries an encodable cap: the control must offer Type B and
  // Type C so a user can record them and thereby SUPPRESS the Type A cap, which
  // is the entire point of the discriminator.
  materialTypes: ['Type A', 'Type B', 'Type C'],
  // Confirmed verbatim: "Where the compaction scale has not been specified,
  // Compaction Scale A shall apply." (§16 D6 — a ruleset with a defensible
  // default declares one; without it every VIC lot would read `unknown` forever.)
  defaultScale: 'A',
  // The date this CIVOS pack revision opened, matching `vicroads-204.v1`'s
  // `effectiveTo` exactly so the two windows abut with no gap and no overlap.
  // Deliberately NOT v1's 2013-10-01: the field is what `resolveRuleset` selects
  // on, and dating this revision from the authority edition would leave two
  // packs live across the same window with a LEXICAL id tie-break deciding which
  // one a lot got — which breaks at `.v10`.
  effectiveFrom: '2026-07-27',
  status: 'confirmed',
  rules: [COMPACTION_DENSITY],
  provenance: PROVENANCE,
};
