// Seed pack — TfNSW Q6 Quality Management (Major Works), Annexure Q6/L.
// D14.3, docs/plans/d14-q6-pack-spec-2026-07-27.md §5.
//
// THIS PACK REPLACES `tfnsw-r44.v1`, WHICH IS DELETED [C1C-9] [C1C-7].
// That pack encoded a flat `minCount: 6` under the name R44. Both halves were
// wrong, and grade-A primary source proves it
// (docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md):
//   * WRONG DOCUMENT. R44 Ed 6 publishes NO testing frequency at all. Its cl.
//     1.2.5 and Annexure R44/L Table R44/L.1 both defer — the "Minimum
//     Frequency" cell for every relative-compaction row is the literal single
//     character `Q`, a pointer to Specification TfNSW Q.
//   * WRONG NUMBER. 6 is ONE CELL of Q6 Table Q6/L.1 — the floor for a
//     > 5,000 m² lot specified at > 95.0-100.0 % relative compaction — encoded
//     as if unconditional. It is wrong in BOTH directions: over-strict on a
//     typical 3,000 m² Selected Material Zone lot (published 5), under-strict on
//     a > 5,000 m² lot specified at 102 % (published 1 per 1,000 m², min 10).
// Do not resurrect it. Git history and the research report preserve it.
//
// STATUS: `confirmed`. One grade-A primary-source pass stands behind every
// number: the Q6 PDF was fetched from the issuing department's own portal
// (standards.transport.nsw.gov.au) and read in full, and Table Q6/L.1 is
// transcribed verbatim in that report's §3.1. Nothing here comes from anywhere
// else, and every finding of that report is either encoded below or accounted
// for in this header.
//
// SCOPE — NSW MAJOR WORKS (Jay's decision J2). `specSet: 'tfnsw'` matches every
// NSW/TfNSW project, so a minor-works contract let under a different Q-series
// specification resolves this table too. Jay's call is that NSW major works IS
// the market and that population does not justify a per-project specification
// selector. The ceiling therefore has to reach the USER, not just this comment:
// it rides `provenance.document` — "Q6 - Quality Management (Major Works)" —
// which `shortfallSentence` renders as part of the citation on every readiness
// item. A rule LABEL would not: `shortfallSentence` has never read one [D14X-3].
//
// WHY THE BAND RIDES `Lot.testScale` AND THERE IS NO NEW COLUMN (§3.2). Q6 keys
// its table by SPECIFIED RELATIVE COMPACTION, which is precisely what
// `Lot.testScale` already is — "the testing scale the governing specification
// regiments by", validated against the resolved ruleset's `scaleKeys` and never
// silently coerced. VicRoads regiments by Compaction Scale A/B/C; TfNSW
// regiments by band. Same slot, different authority vocabulary. The keys ARE the
// band labels, in ASCII, spelling both bounds, so a user reading "98 %" off a
// drawing lands on the right row: Q6's edges are exclusive-below/inclusive-above
// (`> 95.0, <= 98.0`), which `'>95.0-98.0%'` says and `'B'` could not.
//
// NO `defaultScale`, DELIBERATELY. Q6 publishes no "where unspecified, assume X"
// sentence (unlike Section 204's Scale A default, which vicroads-204 quotes
// verbatim). So an NSW lot with no band recorded reads `unknown` /
// `scale_not_selected` and shows the prompt until a human enters it. Erring to
// the strictest band would assert a requirement this lot's specification did not
// state, on a surface that can eventually gate a claim.
//
// COMPANION ACCEPTANCE SOURCE, recorded and NOT encoded. R44 Ed 6/Rev 0 (June
// 2023, TS 02158.1) Table R44.7 "Minimum Characteristic Values of Relative
// Compaction" publishes the five thresholds — 90.0 / 95.0 / 98.0 / 100.0 /
// 102.0 % — that determine which band a lot sits in. Only those five VALUES are
// transcribed in the research; the location -> percentage MAPPING is not. So the
// band is ASKED FOR, never derived: a guessed mapping picks the wrong table row,
// which is a confident wrong count.
//
// NOT ENCODED, each one a "confident wrong number" avoided:
//
//   * NO multi-layer minimum. Table Q6/L.1 note (1) + cl. 5.4.3(b) set floors by
//     LAYER COUNT for lots compacted below 98.0 % (total layer area <= 100 m² ->
//     max 5 layers, min 1 test; > 100-500 -> max 3, min 2; > 500-1,000 -> max 2,
//     min 3; total lot thickness <= 600 mm), and the note says take the GREATER
//     of the two. CIVOS records no layer count or thickness.
//     THE DIRECTION OF THIS OMISSION IS UNSAFE AND IS STATED RATHER THAN HIDDEN:
//     a <= 90.0 % lot of 800 m² over two layers is 1 by Table Q6/L.1 and 3 by
//     cl. 5.4.3(b), so omitting it UNDER-STATES. It is named in the rule label,
//     which is a DEVELOPER-FACING RECORD, not a disclosure — see [D14X-3] above.
//
//   * NO cl. 5.4.2 lot-size limbs. "The size of a Lot must not exceed one
//     shift's output" is unevaluable (CIVOS records no production shift), and
//     "Lots which are less than 2 m wide must not be longer than 150 m" needs a
//     lot WIDTH, which CIVOS does not hold (`LotGeometry.lengthM` exists; width
//     does not). Encoding a bare 150 m cap would fire on every lot >= 2 m wide —
//     a fabricated requirement of exactly the class [C1C-2] deleted.
//
//   * NO cl. 5.4.3(a) limb. Non-contiguous areas totalling <= 1,000 m² may be
//     ONE Lot where compaction is < 100.0 %. That is a lot-COMPOSITION
//     permission, not a frequency; CIVOS neither enforces nor needs it.
//
//   * NO statistical acceptance. Q6 Table Q6/L.3's acceptance constants k for
//     n = 3 to >= 20 (0.52 / 0.62 / 0.67 / 0.72 at n = 6 / 0.75 / 0.78 / 0.81 /
//     0.83 / 0.90 / 0.95) and the characteristic value Q_L = x̄ - ks are OUT OF
//     C1 SCOPE — CIVOS counts tests and evaluates no result VALUES. Recorded
//     here so no future agent reads "n = 6" as a basis: it is one row of ten.
//     Likewise cl. L2's "six equally spaced grid lines" is a sampling-LOCATION
//     method and the likely origin of the secondary source's flat "n = 6".
//
//   * NO `reduced` and NO `reducedFrequencyEligibility` — and the reason is NOT
//     "none exists". Q6 cl. 3.8.3 (PDF p. 20) DOES publish one: a Contractor may
//     PROPOSE to the Principal a reduced minimum frequency of testing, by up to
//     50 %, supported by a statistical analysis, revocable at any time. The R44
//     confirmation report recorded this as "NOT FOUND - correctly absent" and
//     that is wrong; the correction is here so nobody re-derives it.
//     It stays unencoded because it is WEAKER than the [C1C-6] pattern:
//     VicRoads 204.14(c)'s trigger (N consecutive conforming lots) is something
//     CIVOS can compute, which is what makes an eligibility advisory honest.
//     Q6's trigger is a statistical analysis judged by the Principal. CIVOS can
//     compute no part of it, so even an advisory would carry no information, and
//     `reduced` FIGURES would be a 50 % cut in the under-testing direction with
//     nothing in a lot record to justify it.
//     AND: TfNSW 3051 Table 3051/L.1 publishes a quantified reduced column gated
//     on "six consecutive Lots conforming", which looks computable and MUST NOT
//     be borrowed — it governs mass-lotted material SUPPLY, not constructed
//     lots. Transplanting it would be the same class of error as the R44
//     misattribution.
//
// KNOWN CEILING — a lab MDD is never one of the n. Q6 counts SAMPLES at
// semi-random locations within the lot area, indexed by specified relative
// compaction (cl. L2, Figure Q6/L.1); a laboratory maximum-dry-density
// determination has no in-lot sampling location and no relative-compaction
// value, so it structurally cannot be counted
// (docs/research/c1-mdd-exclusion-research-2026-07-27.md, grade A). That is
// enforced upstream by `testCategories.ts`, which resolves lab-reference method
// codes to `LAB_REFERENCE` rather than to `compaction`; this pack needs no alias
// of its own and adds none.

import type { FrequencyRule, RulesetProvenance, Ruleset } from '../types.js';

const RULESET_ID = 'tfnsw-q6.v1';

const AUTHORITY = 'TfNSW';
// The Major Works scope is IN the document name because the citation is the one
// channel that reaches a user (J2, [D14X-3]).
const DOCUMENT = 'Q6 – Quality Management (Major Works)';
const EDITION = 'Ed 2 / Rev 0, February 2024 (TS 01572.1 / IC-QA-Q6)';
// The portal addresses documents by opaque annotation GUID, not by a stable
// per-document page. Currency rests on the portal's SUPERSEDED watermark
// behaviour (this record carries none; retired R44 records do), which is good
// evidence and not a listing — hence the 12-month revalidation and the standing
// human portal re-check before any NSW project is flipped to `block`.
const SOURCE_URL =
  'https://standards.transport.nsw.gov.au/_entity/annotation/d7d76f7e-d6c3-ee11-9079-000d3ad2920b';
const CHECKED_ON = '2026-07-27';
const REVALIDATE_BY = '2027-07-27';

const PROVENANCE: RulesetProvenance = {
  authority: AUTHORITY,
  document: DOCUMENT,
  clause: 'Annexure Q6/L cl. L1, Table Q6/L.1',
  edition: EDITION,
  pdfPage: 42,
  sourceUrl: SOURCE_URL,
  evidenceGrade: 'A',
  checkedOn: CHECKED_ON,
  revalidateBy: REVALIDATE_BY,
};

/**
 * Table Q6/L.1 "Minimum Number of Samples Per Lot (n)", all 25 cells, verbatim
 * from `docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md` §3.1:
 *
 * | Specified relative compaction | <= 50 m² | > 50, <= 500 | > 500, <= 1,000 | > 1,000, <= 5,000 | > 5,000 |
 * | <= 90.0      | 1 | 1 | 1                 | 1 per 2,000 (min 2) | 1 per 3,000        |
 * | > 90.0-95.0  | 1 | 2 | 1 per 250 (min 3) | 1 per 1,000 (min 3) | 1 per 2,000        |
 * | > 95.0-98.0  | 1 | 3 | 4                 | 5                   | 1 per 2,000 (min 6)|
 * | > 98.0-100.0 | 1 | 3 | 4                 | 5                   | 1 per 2,000 (min 6)|
 * | > 100.0      | 1 | 3 | 4                 | 1 per 500 (min 5)   | 1 per 1,000 (min 10)|
 *
 * THE TABLE IS NON-MONOTONE IN AREA, AND THAT IS FAITHFUL. Band `>90.0-95.0%`
 * requires 5 tests at 5,000 m² and 3 at 5,001 m²; band `<=90.0%` goes 3 -> 2
 * across the same edge, because the open band's per-area rate is COARSER than
 * the band below it. A bigger lot needing fewer tests reads as a bug and is not
 * one. AT-56 pins both edges, so "fixing" the monotonicity fails a named
 * assertion instead of silently over-testing every large NSW lot.
 *
 * `activitySlugs`: the two compacted-material earthworks Level-2 slugs, matching
 * the VicRoads pack's scoping. `geosynthetics` is in the same family and has no
 * density requirement. Pavements are NOT here — Q6 cl. 3.8.3 gives Annexure
 * Q6/L ownership of pavement frequency too, so they get their OWN rules in THIS
 * pack (never a second NSW pack: `resolveRuleset` returns one pack per
 * (state, specSet, window), so two would shadow each other and silently delete
 * one rule set). That is phase D14.5.
 */
const COMPACTION_DENSITY: FrequencyRule = {
  id: `${RULESET_ID}/compaction-density`,
  // 76 chars, measured. A DEVELOPER-FACING record of the deferred ceiling, not
  // its disclosure — `shortfallSentence` never reads a label [D14X-3].
  label: 'Compaction samples per lot by band and area (excl. multi-layer cl. 5.4.3(b))',
  testType: 'compaction',
  appliesTo: {
    activitySlugs: ['earthworks_general', 'earthworks_subgrade_prep'],
  },
  countByAreaBand: {
    unit: 'm2',
    byScale: {
      '<=90.0%': [
        // The <= 50, > 50-500 and > 500-1,000 cells are all published as 1. This
        // is the ONLY collapse anywhere in the encoding and it is arithmetically
        // identical to writing the three cells out.
        { upToInclusive: 1000, minCount: 1 },
        { upToInclusive: 5000, minCount: 2, every: 2000 },
        // "1 per 3,000 m²" with NO published floor. `minCount: 1` is the
        // vocabulary's way of writing "no floor" and is INERT here: the band
        // starts above 5,000 m², where the rate alone already yields >= 2. It is
        // not an authority figure.
        { minCount: 1, every: 3000 },
      ],
      '>90.0-95.0%': [
        { upToInclusive: 50, minCount: 1 },
        { upToInclusive: 500, minCount: 2 },
        { upToInclusive: 1000, minCount: 3, every: 250 },
        { upToInclusive: 5000, minCount: 3, every: 1000 },
        // "1 per 2,000 m²", no published floor — inert, as above.
        { minCount: 1, every: 2000 },
      ],
      '>95.0-98.0%': [
        { upToInclusive: 50, minCount: 1 },
        { upToInclusive: 500, minCount: 3 },
        { upToInclusive: 1000, minCount: 4 },
        { upToInclusive: 5000, minCount: 5 },
        { minCount: 6, every: 2000 },
      ],
      // Identical to the row above, per the published table — not a copy-paste
      // slip. Q6 publishes the same five cells for > 95.0-98.0 and > 98.0-100.0.
      '>98.0-100.0%': [
        { upToInclusive: 50, minCount: 1 },
        { upToInclusive: 500, minCount: 3 },
        { upToInclusive: 1000, minCount: 4 },
        { upToInclusive: 5000, minCount: 5 },
        { minCount: 6, every: 2000 },
      ],
      '>100.0%': [
        { upToInclusive: 50, minCount: 1 },
        { upToInclusive: 500, minCount: 3 },
        { upToInclusive: 1000, minCount: 4 },
        { upToInclusive: 5000, minCount: 5, every: 500 },
        { minCount: 10, every: 1000 },
      ],
    },
  },
  provenance: PROVENANCE,
};

export const TFNSW_Q6_V1: Ruleset = {
  id: RULESET_ID,
  state: 'nsw',
  specSet: 'tfnsw',
  // Table Q6/L.1's row headings, as ASCII band labels spelling BOTH bounds. They
  // render verbatim in the lot-form select, in the bulk-set modal, and in the
  // route-level whitelist's "Valid scales: ..." message.
  scaleKeys: ['<=90.0%', '>90.0-95.0%', '>95.0-98.0%', '>98.0-100.0%', '>100.0%'],
  // Table Q6/L.1's column-1 heading — what THIS authority calls the thing
  // `Lot.testScale` carries, so the form control and the readiness prompt stop
  // saying "Testing Scale" on an NSW project.
  scaleLabel: 'Specified relative compaction',
  // No `defaultScale` and no `materialTypes` — see the header. TfNSW publishes no
  // "where unspecified assume X" sentence and no Type A/B/C equivalent.
  //
  // Q6 Ed 2/Rev 0 is dated February 2024. Unlike VicRoads' 6/6/3, no evidence
  // exists that Table Q6/L.1's figures predate this edition, so the window opens
  // at the edition actually read rather than at a guessed earlier date.
  effectiveFrom: '2024-02-01',
  status: 'confirmed',
  rules: [COMPACTION_DENSITY],
  provenance: PROVENANCE,
};
