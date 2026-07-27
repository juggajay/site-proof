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
}

/** The de-escalated regime's figures (§3.2). */
export interface ReducedFrequency {
  minCountByScale: Readonly<Record<string, number>>;
  perQuantity?: { unit: QuantityUnit; every: number };
  consecutiveConformingLots: number;
  escalationShape: EscalationShape;
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
  /** Statistical-validity floor, per scale. Scale key set is ruleset-defined. */
  minCountByScale: Readonly<Record<string, number>>;
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
   * A LIST, not the single object §3.2's proposed type shows, because §3.3 needs
   * TWO caps on the SAME rule ("5,000 m² generally, and 500 m² under paved
   * areas — a second `maxLotSize` on the rule whose `appliesTo.areaZoneAliases`
   * matches paved-area zones"). Encoding the paved limb as a separate rule
   * instead would duplicate the compaction COUNT requirement for paved lots —
   * two identical shortfall warnings and a double-counted
   * `insufficientRules` aggregate (§5.4.3). See the PR body.
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
  rules: readonly FrequencyRule[];
  provenance: RulesetProvenance;
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
  regime: FrequencyRegime;
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
  regime: FrequencyRegime | null;
  regimeBasis?: { streamKey: string; lotIds: string[] };
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
