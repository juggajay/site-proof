// Wave C1 test sufficiency — the rule vocabulary and the verdict shape.
//
// Spec: docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md (Rev 2) §3.2
// (vocabulary + provenance), §4.1 (resolved inputs), §4.2 (outputs).
//
// C1.0 ships this layer UNUSED — no route, no readiness output, no migration
// (spec §11 C1.0). Adoption is C1.1. If fallow flags these exports as unused,
// that is expected-by-design for this phase, exactly as F0.1 did for
// `predicates.ts` (see its header at :15-17).
//
// Rulesets are CODE, not database rows (§3.1): a seeded authority ruleset is
// shipped product data with provenance, reviewable in a PR diff, CI-testable
// and revertable by `git revert`. Tenant-authored/overridable rulesets are C3.

// ---------------------------------------------------------------------------
// Rule vocabulary (§3.2)
// ---------------------------------------------------------------------------

/** Authority provenance. Every field required — an unprovenanced rule cannot be registered. */
export interface RulesetProvenance {
  authority: string; // 'VicRoads' | 'TfNSW'
  document: string; // 'Section 204 — Earthworks'
  edition: string; // 'December 2015, Version 7'
  clause: string; // '204.14(c)' — clause/table, never prose
  pdfPage?: number; // recorded at the confirmation pass (§8.3)
  sourceUrl: string;
  /**
   * From the research appendix. A SPLIT grade (e.g. R44's "A (portal) / C (aetg)")
   * is encoded at its WEAKEST limb — the grade of the source the NUMBERS came
   * from, never the strongest limb available [C1R-B11].
   */
  evidenceGrade: 'A' | 'B' | 'C' | 'D';
  checkedOn: string; // ISO date a human last read the source
  revalidateBy: string; // ISO; CI fails a `confirmed` ruleset past this (§8.3)
}

export const QUANTITY_UNITS = ['m2', 'm3', 't', 'm', 'each'] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

/**
 * The only escalation shape C1 implements (§3.4.1). A ruleset declaring anything
 * else is REJECTED by `validateRuleset` rather than silently mis-evaluated.
 */
export const ESCALATION_SHAPES = ['reset_on_any_failure'] as const;
export type EscalationShape = (typeof ESCALATION_SHAPES)[number];

/**
 * One advisory lot-size cap (§3.3). A cap carrying `areaZoneAliases` applies only
 * when the lot's `areaZone` matches one (case-insensitively); an unqualified cap
 * always applies. The most restrictive matching cap is the one reported.
 */
export interface LotSizeCap {
  unit: QuantityUnit;
  value: number;
  areaZoneAliases?: readonly string[];
  /**
   * D14 §4.1: the cap applies only when `Lot.materialType` matches one of these,
   * case-insensitively. Section 204 Table 204.142 caps a Type A lot at 5,000 m²
   * and Type C at nothing at all `[C1C-3]`, so a bare cap is prohibited there and
   * a material-scoped one is the only encodable form.
   *
   * A cap declaring BOTH `materialAliases` and `areaZoneAliases` requires BOTH to
   * match. An absent limb is "unqualified on that dimension", matching the
   * shipped `areaZoneAliases` semantics exactly.
   *
   * `appliesTo.materialAliases` is deliberately NOT the counterpart of this: a
   * material discriminator on a COUNT rule would make the rule disappear for an
   * unmatched lot, and a rule that does not resolve is SILENT (§7.1) — the
   * under-testing direction, arriving quietly. A cap's failure mode is a missing
   * advisory warning, which is safe.
   */
  materialAliases?: readonly string[];
}

/** The de-escalated regime's figures (§3.2). */
export interface ReducedFrequency {
  minCountByScale: Readonly<Record<string, number>>;
  perQuantity?: { unit: QuantityUnit; every: number };
  consecutiveConformingLots: number;
  escalationShape: EscalationShape;
}

/**
 * `[C1C-6]` The authority's reduced-frequency TRIGGER **without** its figures.
 *
 * VicRoads Section 204 cl. 204.14(c) makes a reduction conditional on the
 * **Superintendent's agreement** plus an established compaction procedure —
 * three consecutive conforming lots is a precondition to **ask**, not an
 * entitlement, and re-entry after a failure needs a FRESH approval. CIVOS has no
 * recorded-approval input, so the streak may only ever be reported as
 * ELIGIBILITY.
 *
 * Declaring this limb makes the engine compute the streak and report
 * `reducedFrequencyEligible`; it can NEVER lower `requiredCount` — that needs
 * {@link ReducedFrequency}, which carries the figures and which no shipped pack
 * declares. The split is structural precisely so no future change can quietly
 * turn eligibility into a reduction (§3.4.1a, §14 AT-8b).
 */
export interface ReducedFrequencyEligibility {
  consecutiveConformingLots: number;
  escalationShape: EscalationShape;
  /** The clause that grants the request — a DIFFERENT clause from the count (§3.2). */
  clause: string;
}

/**
 * D14 §4.4 — the Section 173 small-area exception, as one optional rule limb.
 *
 * PERMISSIVE by its own words ("any lot which has a surface area less than
 * 500 m2 MAY be treated as a small area"), so area determines ELIGIBILITY and
 * never application: an area-triggered automatic reduction would under-state the
 * requirement for every small lot the project chose to test normally, which is
 * the unsafe direction. Same ruling as `[C1C-6]` made for the reduced regime —
 * compute eligibility, never auto-grant.
 */
export interface SmallLotException {
  /**
   * STRICTLY less than. cl. 173.04(d): "any lot which has a surface area less
   * than 500 m2". A lot of exactly 500.0 m² is NOT eligible.
   */
  maxArea: { unit: QuantityUnit; value: number };
  /**
   * Replaces `minCountByScale` for the listed scales ONLY, and ONLY when the lot
   * carries an explicit election (D14.4 — not shipped). Scale C is ABSENT
   * DELIBERATELY: cl. 204.13(a) scopes the exception to Scale A/B, and cl.
   * 173.04(d) engages only "where test requirements are based on CHARACTERISTIC
   * values", while Table 204.131's Scale C column is headed "Minimum MEAN Value
   * of Density Ratio". Scale C is already three-tests-on-the-mean; there is
   * nothing to reduce. DO NOT add `C: 3` "for completeness" — it would imply a
   * reduction that does not exist.
   */
  minCountByScale: Readonly<Record<string, number>>;
  /**
   * cl. 173.04(d) ALSO shifts acceptance: the MEAN of the 3 tests must exceed the
   * scale's characteristic density-ratio requirement by >= this many percentage
   * points, and the statistic changes from characteristic (x̄ − 0.92S) to plain
   * mean. CIVOS evaluates no density-ratio VALUES, so this is CITATION TEXT and
   * is NEVER computed (§6.3 — the gap that can mislead, and the reason the item
   * text must state the shifted threshold beside the reduced count).
   */
  acceptanceShiftPct: number;
  /** Section 173's own provenance — a DIFFERENT document from the rule's. */
  provenance: RulesetProvenance;
}

/**
 * D14 §4.3 — one lot-area band's count figures. Bands are ordered and
 * exhaustive: `validateRule` requires strictly ascending `upToInclusive` with
 * exactly one band omitting it, and that band last.
 */
export interface AreaBand {
  /**
   * Band upper bound, INCLUSIVE — so the authority's `> 1,000, ≤ 5,000 m²` is
   * `upToInclusive: 5000` and the first band whose bound the area does not
   * exceed wins. Omit on exactly one band: the open top band, which must be last.
   */
  upToInclusive?: number;
  /**
   * The band's published floor. Use 1 where the authority publishes no floor —
   * it is inert under the band's own rate, and the pack file must say so inline
   * so nobody reads it as an authority figure.
   */
  minCount: number;
  /** One test per `every` units, combined with `minCount` by `max()` — `requiredTestCount` unchanged. */
  every?: number;
}

/**
 * D14 §4.3 — a count table keyed by lot area, and OPTIONALLY by scale first.
 *
 * Exactly one of {@link AreaBandedCounts.byScale} / {@link AreaBandedCounts.bands}
 * is declared; `validateRule` rejects both or neither.
 */
export interface AreaBandedCounts {
  /**
   * The unit the bands are expressed in. The quantity is resolved PER THIS UNIT
   * (§4.6): the lot's own quantity when it is already in this unit, else the
   * summed geometry area when this unit is 'm2'. Nothing else resolves, and
   * nothing is ever converted.
   */
  unit: QuantityUnit;
  /**
   * The TWO-DIMENSIONAL form: (scale key) × (lot area band). Must declare a
   * non-empty band list for EVERY `Ruleset.scaleKeys` entry and no key outside
   * it, mirroring `checkCounts`. Mutually exclusive with `bands`.
   */
  byScale?: Readonly<Record<string, readonly AreaBand[]>>;
  /**
   * D14.5 §4.3 — ONE band list, used whatever the lot's scale, for the case where
   * the governing specification FIXES the row and the user has nothing to choose.
   * Every TfNSW pavement compaction spec (R71 Table R71.1, R73 cl. 8.4.3, R75 cl.
   * 7.4.3) pins specified relative compaction at 100 % or 102 %, so a pavement lot
   * is always on Table Q6/L.1's `> 100.0` row.
   *
   * A rule carrying `bands` is SCALE-INDEPENDENT and `evaluateRule` suppresses its
   * `scale_not_selected` / `scale_not_recognised` causes (§4.3.2): asking a
   * question whose answer provably cannot change the number would leave every
   * pavement lot reading `unknown` forever on a pack that deliberately declares no
   * `defaultScale`. Mutually exclusive with `byScale`.
   */
  bands?: readonly AreaBand[];
}

export interface FrequencyRule {
  /** Stable, referenced by snapshots forever: 'vicroads-204.v1/compaction-density'. */
  id: string;
  /** Short factual label. NEVER a quotation of specification prose (§8.4). */
  label: string;
  /** Test-type key from `routes/testResults/specifications.ts`. */
  testType: string;
  appliesTo: {
    activitySlugs: readonly string[]; // Level-2 slugs (activityTaxonomy.ts:61)
    layerAliases?: readonly string[]; // case-insensitive match against Lot.layer
    /** [C1R-3] Material/zone discrimination, e.g. 'under paved areas'. */
    areaZoneAliases?: readonly string[];
  };
  /**
   * Statistical-validity floor, per scale. Scale key set is ruleset-defined.
   *
   * D14 §4.3: now OPTIONAL — a rule supplies its counts through this OR
   * {@link FrequencyRule.countByAreaBand}. `validateRule` rejects a rule
   * declaring both or neither, so "optional" never means "absent".
   */
  minCountByScale?: Readonly<Record<string, number>>;
  /**
   * D14 §4.3 — a TWO-DIMENSIONAL count table, (scale key) × (lot area band).
   *
   * TfNSW Q6 Table Q6/L.1 is exactly this shape and is NOT expressible as
   * `minCountByScale` + `perQuantity`, contrary to C1 spec §8.2 `[C1C-13]`: that
   * pairing reproduces only the open top column. Worked counter-example — a
   * 400 m² lot at `> 95.0, ≤ 98.0` is published as 3, and
   * `max(6, ceil(400/2000))` yields 6, over-strict by 100 % on the commonest
   * small-lot case.
   *
   * MUTUALLY EXCLUSIVE with `minCountByScale`, `perQuantity` and `smallLot`
   * (§4.3.1). When present the resolved quantity is REQUIRED — an unresolvable
   * one yields `quantity_missing`, never a floor.
   */
  countByAreaBand?: AreaBandedCounts;
  /**
   * Coverage limb: one test per `every` units. OPTIONAL and, for everything C1
   * ships, ABSENT — no cited authority in the appendix supplies a per-area
   * frequency figure [C1R-1]. The limb exists because the program names it and
   * because a confirmed edition may supply one; it ships unexercised, covered
   * by a synthetic rule only (§14 AT-4).
   */
  perQuantity?: { unit: QuantityUnit; every: number };
  /**
   * Advisory only: the ruleset's maximum lot size. Never blocks (§3.3).
   *
   * A LIST, not the single object §3.2's proposed type shows, so one rule can
   * carry several zone-qualified caps without being split — a second rule would
   * duplicate the COUNT requirement and yield two identical shortfall warnings
   * plus a double-counted `insufficientRules` aggregate (§5.4.3).
   *
   * §3.3's motivating example (a 500 m² "under paved areas" cap beside the
   * 5,000 m² one) is WITHDRAWN — the confirmation pass proved it a Wyndham City
   * Council amendment misattributed to VicRoads, and it ships nowhere. The list
   * shape stays for the packs that legitimately need multiple caps.
   */
  maxLotSize?: readonly LotSizeCap[];
  /**
   * The de-escalated regime. STRUCTURALLY ABSENT unless a CONFIRMED edition
   * supplies reduced figures [C1R-B8] — the appendix supplies the 204.14(c)
   * TRIGGER and NO reduced count. A guessed reduced count would emit a confident
   * wrong required count, the exact defect §3.4 exists to prevent.
   * `validateRuleset` asserts `reduced` cannot exist on a `draft` ruleset (§8.3).
   */
  reduced?: ReducedFrequency;
  /**
   * `[C1C-6]` Eligibility-only regime trigger — the streak is computed and
   * REPORTED, never applied. Mutually exclusive with `reduced` in practice: a
   * rule carrying figures does not need the eligibility-only limb.
   * `validateRuleset` rejects declaring both.
   */
  reducedFrequencyEligibility?: ReducedFrequencyEligibility;
  /**
   * D14 §4.4 — the Section 173 small-area exception. Declaring it makes the
   * engine compute and DISCLOSE eligibility; it can never lower `requiredCount`
   * on its own, because application needs an election CIVOS does not yet record
   * (`Lot.smallAreaElected`, phase D14.4, deferred by Jay's J3).
   */
  smallLot?: SmallLotException;
  provenance: RulesetProvenance;
}

export type RulesetStatus = 'draft' | 'confirmed';

export interface Ruleset {
  id: string; // 'vicroads-204.v1'
  state: string; // matched case-insensitively against Project.state
  specSet: string; // pre-normalized via itpMatcher.normalizeSpecSet
  scaleKeys: readonly string[]; // what a lot may declare
  /** Applied when Lot.testScale is null (§16 D6). Absent = no default. */
  defaultScale?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  /**
   * 'draft'     — registered and EVALUATED NORMALLY, numbers shown, citation
   *               tagged unconfirmed; structurally cannot block (§5.1.2).
   * 'confirmed' — a human verified every number against the cited edition (§8.3).
   */
  status: RulesetStatus;
  /**
   * D14 §4.2: the material classes this authority recognises — 'Type A' |
   * 'Type B' | 'Type C' for Section 204. Drives the lot-form control and the
   * route-level whitelist (`assertLotSufficiencyAttributes`), exactly as
   * `scaleKeys` does for the scale. Absent = this authority has no material
   * classification, the control is not rendered, and any non-null value is
   * rejected at the boundary.
   */
  materialTypes?: readonly string[];
  /**
   * D14 §4.2: what the authority CALLS the thing `Lot.testScale` carries.
   * Defaults to 'Testing scale' (Section 204's "Compaction Scale A/B/C"); TfNSW
   * Q6 keys its table by 'Specified relative compaction' (§3.2). One string, so
   * the hard-coded lot-form label and the readiness prompts stop lying on NSW
   * projects (§4.7).
   */
  scaleLabel?: string;
  rules: readonly FrequencyRule[];
  provenance: RulesetProvenance;
  /**
   * External review M7 — set by `resolveRuleset`/`effectiveRulesets` on a pack
   * whose `provenance.revalidateBy` has passed, at the same moment `status` is
   * degraded from `confirmed` to `draft`. It is the REASON for that degrade, so
   * a lapsed pack is distinguishable from one that was born `draft`.
   *
   * RUNTIME-ONLY: never declared in a pack file (a pack that shipped it would be
   * asserting its own staleness), and never persisted — the immutable snapshot
   * records the status that governed the decision, which is the honest fact.
   */
  revalidationLapsed?: boolean;
}

// ---------------------------------------------------------------------------
// Resolved inputs (§4.1) — fetched PER PATH and passed into the pure evaluator,
// the `releasedHoldPointItemIds` pattern already in `conformancePrerequisites.ts`
// [C1R-B1] [C1R-C5]. The evaluator never queries.
// ---------------------------------------------------------------------------

export const SUFFICIENCY_MODES = ['off', 'warn', 'block'] as const;
export type SufficiencyMode = (typeof SUFFICIENCY_MODES)[number];

export type ScaleSource = 'lot' | 'ruleset_default' | 'none';
export type QuantitySource = 'lot' | 'geometry' | 'none';

export type FrequencyRegime = 'full' | 'reduced';

export interface ResolvedRegime {
  /**
   * The OPERATIVE regime — what `requiredCount` is actually computed at. Only a
   * rule carrying `reduced` FIGURES can ever be 'reduced' (§3.4.1a `[C1C-6]`).
   */
  regime: FrequencyRegime;
  /**
   * `[C1C-6]` The streak is met, so the contractor is eligible to REQUEST a
   * reduced frequency from the Superintendent. Advisory: it never lowers a count.
   */
  eligible: boolean;
  /** The stream entries the regime was derived from — recorded in the snapshot. */
  basisLotIds: string[];
  /** Serialized stream key (§3.4.2), for the verdict's `regimeBasis`. */
  streamKey: string;
}

/** Everything the PURE evaluator needs. Resolved by `resolve.ts` per path. */
export interface ResolvedSufficiency {
  mode: SufficiencyMode; // Project.testSufficiencyMode
  ruleset: Ruleset | null; // null => no ruleset for this project/activity
  rules: readonly FrequencyRule[]; // the subset matching activity/layer/areaZone
  scale: { value: string | null; source: ScaleSource };
  quantity: { value: number | null; unit: QuantityUnit | null; source: QuantitySource };
  /** `Lot.areaZone` — selects which §3.3 lot-size cap applies. */
  areaZone: string | null;
  /** D14 §3.1 — `Lot.materialType`. NULL matches no material-scoped cap. */
  materialType: string | null;
  /**
   * D14 §4.6: the summed `LotGeometry.areaM2`, kept SEPARATELY from `quantity`
   * because the lot's own quantity legitimately wins for `quantity` (§6 D5) while
   * still being the WRONG UNIT for a given rule. A rule needing m² can fall back
   * here even when the lot itself is measured in m³ or chainage metres — which is
   * how earthworks lots are ordinarily measured, so without this an m²-keyed pack
   * reads `unknown` forever on real data. NULL when the lot has no geometry, or
   * none carrying an area.
   */
  geometryAreaM2: number | null;
  /** Absent entry => regime unresolvable for that rule (or the rule has no `reduced` limb). */
  regimeByRuleId: ReadonlyMap<string, ResolvedRegime>;
  /** `activitySlug` NULL (fold 'family' | 'none') — drives `activity_not_canonical`. */
  activityCanonical: boolean;
}

// ---------------------------------------------------------------------------
// Row shapes the pure evaluator consumes. Structural subsets of what the two
// conformance paths already fetch (`conformancePrerequisites.ts:327-335` test
// select, `:250-256` required-item shape) — so those payloads assign directly
// and C1 adds NO new per-lot test query.
// ---------------------------------------------------------------------------

export interface SufficiencyTestRow {
  id: string;
  itpChecklistItemId: string | null;
  testType: string;
  passFail: string;
  status: string;
}

export interface SufficiencyChecklistItem {
  id: string;
  evidenceRequired?: string | null;
  testType?: string | null;
}

// ---------------------------------------------------------------------------
// Outputs (§4.2) — three-valued, over the F0 reasonCode vocabulary.
// ---------------------------------------------------------------------------

export type SufficiencyState = 'satisfied' | 'insufficient' | 'unknown';

export const UNKNOWN_CAUSES = [
  'no_ruleset_for_project', // national-baseline spec set, or no pack for this authority
  'no_rule_for_activity', // ruleset exists, no rule matches activity/layer/zone
  'activity_not_canonical', // activitySlug NULL (fold 'family' | 'none')
  'scale_not_selected', // scale-keyed rule, no lot scale and no ruleset default
  'scale_not_recognised', // Lot.testScale not in ruleset.scaleKeys
  'quantity_missing', // rule has a perQuantity limb, no quantity resolvable
] as const;

/**
 * `ruleset_edition_unconfirmed` is deliberately NOT a cause [C1R-B5]: a draft
 * ruleset EVALUATES NORMALLY and carries `citation.confirmed: false`. Draft
 * non-blocking is structural (§5.1.2), not an unknown state.
 */
export type UnknownCause = (typeof UNKNOWN_CAUSES)[number];

export interface RuleCitation {
  authority: string;
  document: string;
  clause: string;
  edition: string;
  /** false for a `draft` ruleset — the carrier for "unconfirmed", NOT an UnknownCause. */
  confirmed: boolean;
}

export interface RuleSufficiency {
  ruleId: string;
  testType: string;
  state: SufficiencyState;
  requiredCount: number | null; // null only when state === 'unknown'
  passingCount: number;
  pendingCount: number;
  failedCount: number;
  /**
   * The OPERATIVE regime — what `requiredCount` was actually computed at.
   * `[C1C-6]` For `vicroads-204` this is ALWAYS 'full' in C1: 204.14(c) makes a
   * reduction conditional on the Superintendent's agreement, and no approval
   * input exists. Eligibility is reported separately and never lowers the count.
   */
  regime: FrequencyRegime | null;
  /** `[C1C-6]` Advisory only: "eligible to REQUEST reduced frequency" (§3.4.1a). */
  reducedFrequencyEligible?: boolean;
  regimeBasis?: { streamKey: string; lotIds: string[] };
  /**
   * D14 §4.4 — the lot's area is under the rule's `smallLot.maxArea` and its
   * scale is one the exception covers. ADVISORY: `requiredCount` above is still
   * the full count, because applying the exception needs an election (D14.4).
   * Additive-optional, so it does NOT bump `resultSchemaVersion` (C1 §5.4.2).
   */
  smallAreaEligible?: boolean;
  /**
   * The figures the disclosure sentence is built from, present only when
   * `smallAreaEligible`. Mirrors the shipped `reducedFrequencyEligible` /
   * `regimeBasis` pairing: the boolean is the verdict a snapshot records, the
   * object is what the item text needs and the item builder cannot otherwise
   * reach (it receives the EVALUATION, never the `FrequencyRule`).
   */
  smallAreaBasis?: {
    maxArea: { unit: QuantityUnit; value: number };
    requiredCount: number;
    acceptanceShiftPct: number;
    /** Section 173 — a DIFFERENT document from the rule's own citation. */
    citation: RuleCitation;
  };
  unknownCauses: readonly UnknownCause[];
  citation: RuleCitation;
}

/** §3.3 — advisory only, never blocks. */
export interface MaxLotSizeExceedance {
  ruleId: string;
  unit: QuantityUnit;
  limit: number;
  actual: number;
}
