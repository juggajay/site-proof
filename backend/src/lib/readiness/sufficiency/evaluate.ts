// Wave C1 — the PURE test-sufficiency evaluator (spec §4).
//
// Pure and synchronous, like the conformance gate it will plug into: resolved
// inputs in (§4.1), a three-valued verdict out (§4.2). It never queries — the
// M39 guarantee that the single conform path and the batched claim path produce
// byte-identical results depends on `computeConformanceResult` staying DB-free
// (`conformancePrerequisites.ts:461-473` — F1.2 corrects this citation; `:372-423`
// is the `CONFORMANCE_LOT_SELECT` column list, and the wrong line range was
// inherited from here into two specs `[F1C-C1]`), and C1 keeps it that way by resolving
// per path and passing the bundle IN, exactly as `releasedHoldPointItemIds`
// already does [C1R-B1] [C1R-C5].
//
// C1.0 ships this unused — no call site (spec §11 C1.0).

import { testFailing, testPassing, testPendingByStatus } from '../predicates.js';
import type { TestSufficiencyVerdict, TestReasonCode } from '../contracts/futureConsumers.js';
import { requiredTestCount, testAttributesToRule, testCountSufficient } from './counts.js';
import {
  candidateCategories,
  createCategoryResolver,
  ruleCategoryOf,
  type CategoryResolver,
  type Resolution,
} from './testCategories.js';
import type {
  FrequencyRule,
  MaxLotSizeExceedance,
  QuantityUnit,
  ResolvedSufficiency,
  RuleSufficiency,
  RulesetStatus,
  SufficiencyChecklistItem,
  SufficiencyMode,
  SufficiencyState,
  SufficiencyTestRow,
  UnknownCause,
} from './types.js';

export interface SufficiencyEvaluationInput {
  subjectId: string;
  resolved: ResolvedSufficiency;
  /** The lot's own tests — already fetched by both paths (`:327-335`). */
  tests: readonly SufficiencyTestRow[];
  /** The ITP checklist items, to resolve `itpChecklistItemId` → item test type. */
  checklistItems: readonly SufficiencyChecklistItem[];
  /**
   * F1 §4.6 `[F1C-B4]`. The BATCH-SCOPED category resolver. Supplied by the
   * batched claim path so 5,000 lots share one cache over the few dozen distinct
   * strings they actually carry; absent everywhere else (the single-lot path,
   * every unit test), where a fresh per-call resolver is created instead.
   * Behaviour is identical either way — memoizing a pure function is
   * transparent — only the cache lifetime differs.
   */
  resolveCategory?: CategoryResolver;
}

export interface SufficiencyEvaluation {
  /** Worst state across rules; `unknown` when no rule resolved. */
  state: SufficiencyState;
  /**
   * C1.2: carried through from the resolved inputs so a DECISION SNAPSHOT can
   * record which pack governed and what gate strength was in force, without the
   * snapshot builder needing the `ResolvedSufficiency` the evaluator consumed
   * (`ConformanceCheckResult` exposes the evaluation, not the resolution).
   */
  mode: SufficiencyMode;
  /**
   * Null when no ruleset resolved for the project/activity.
   *
   * D14 §4.7: `scaleLabel` rides here because the readiness item builder receives
   * the EVALUATION, not the `ResolvedSufficiency`, and the prompts it writes name
   * a concept the pack owns ("testing scale" on VIC, "specified relative
   * compaction" on NSW). Null = the pack declares no label and the shipped
   * default wording stands.
   */
  ruleset: { id: string; status: RulesetStatus; scaleLabel?: string | null } | null;
  /** ALWAYS populated, even though the verdict's field is optional (§14 AT-2). */
  rules: RuleSufficiency[];
  /** Lot-level causes, set only when NO rule resolved (§7.1 rows 1-3). */
  unknownCauses: readonly UnknownCause[];
  /** §3.3 advisory. Never blocks. */
  maxLotSizeExceedances: MaxLotSizeExceedance[];
  /** Passing verified tests no resolved rule could attribute (§4.3). */
  unlinkedPassingTestIds: string[];
  /**
   * The ONE place gate strength is decided (§5.1.2) [C1R-B5]. `unknown` never
   * blocks, `off`/`warn` never block, a `draft` ruleset never blocks — three
   * guarantees in one expression.
   */
  sufficiencyBlocks: boolean;
  verdict: TestSufficiencyVerdict;
}

/**
 * The lot's resolved categories, computed ONCE per lot before `rules.map(...)`
 * so a multi-rule pack does not re-resolve the same strings per rule (F1 §4.4).
 */
interface LotCategories {
  tests: Map<string, Resolution>;
  items: Map<string, Resolution>;
}

function resolveLotCategories(
  input: SufficiencyEvaluationInput,
  resolve: CategoryResolver,
): LotCategories {
  return {
    tests: new Map(input.tests.map((test) => [test.id, resolve(test.testType)])),
    items: new Map(input.checklistItems.map((item) => [item.id, resolve(item.testType)])),
  };
}

/**
 * The test's candidate categories, through the ONE shared helper `[C1C-20]`.
 * `regime.ts` `streamEntryConforming` calls the same helper — this is not a
 * per-call-site rule.
 */
function candidatesFor(test: SufficiencyTestRow, categories: LotCategories): readonly string[] {
  return candidateCategories(
    categories.tests.get(test.id) ?? null,
    test.itpChecklistItemId ? (categories.items.get(test.itpChecklistItemId) ?? null) : null,
  );
}

/**
 * Caps are filtered to the lot's OWN unit before the most-restrictive one is
 * chosen: comparing raw `value` across units would let a small cap in an
 * unrelated unit win and then be discarded, silently swallowing a real
 * exceedance in the unit the lot actually carries. C1 does no unit conversion.
 */
function aliasHit(aliases: readonly string[] | undefined, value: string | null): boolean {
  if (!aliases || aliases.length === 0) return true; // unqualified on this dimension
  const needle = (value || '').trim().toLowerCase();
  if (!needle) return false; // a NULL/blank lot value matches no qualified limb
  return aliases.some((alias) => alias.trim().toLowerCase() === needle);
}

function matchingCap(
  rule: FrequencyRule,
  areaZone: string | null,
  materialType: string | null,
  unit: MaxLotSizeExceedance['unit'] | null,
): { unit: MaxLotSizeExceedance['unit']; value: number } | null {
  if (unit === null) return null;
  const applicable = (rule.maxLotSize ?? []).filter(
    (cap) =>
      cap.unit === unit &&
      aliasHit(cap.areaZoneAliases, areaZone) &&
      // D14 §4.1: a cap declaring BOTH limbs requires BOTH to match.
      aliasHit(cap.materialAliases, materialType),
  );
  if (applicable.length === 0) return null;
  // Most restrictive matching cap wins.
  return applicable.reduce((worst, cap) => (cap.value < worst.value ? cap : worst));
}

/**
 * D14 §4.6 — the quantity a rule may count against, resolved PER THE UNIT THE
 * RULE NEEDS rather than per the lot.
 *
 * The lot's own recorded quantity legitimately wins for `resolved.quantity`
 * (§6 D5), but it is frequently in the wrong unit for a given rule: an
 * earthworks lot is ordinarily measured in m³ or chainage metres, and an m²-keyed
 * rule then reads `unknown` forever even though the lot carries a drawn polygon
 * with a real area. This consults the geometry as a SECOND source for that one
 * case, and rewrites nothing.
 */
export function quantityFor(resolved: ResolvedSufficiency, unit: QuantityUnit): number | null {
  if (resolved.quantity.value !== null && resolved.quantity.unit === unit) {
    return resolved.quantity.value;
  }
  // ponytail: the ONLY cross-source fallback, and it is not a conversion — the
  // geometry is genuinely measured in m². Never convert m3 -> m2 or m -> m2:
  // that needs a depth or a width CIVOS does not hold.
  if (unit === 'm2' && resolved.geometryAreaM2 !== null && resolved.geometryAreaM2 > 0) {
    return resolved.geometryAreaM2;
  }
  return null;
}

function evaluateRule(
  rule: FrequencyRule,
  input: SufficiencyEvaluationInput,
  categories: LotCategories,
  resolveRuleCategory: (testType: string) => string | null,
  attributedTestIds: Set<string>,
): RuleSufficiency {
  const { resolved } = input;
  const ruleset = resolved.ruleset;
  const causes: UnknownCause[] = [];

  // --- scale -------------------------------------------------------------
  const scaleValue = resolved.scale.value;
  if (scaleValue === null) {
    causes.push('scale_not_selected');
  } else if (ruleset && !ruleset.scaleKeys.includes(scaleValue)) {
    causes.push('scale_not_recognised');
  }

  // --- regime ------------------------------------------------------------
  // Neither `reduced` figures nor an eligibility trigger => no regime concept
  // for this rule. A regime-bearing rule whose regime could not be resolved
  // falls back to `full`: `reduced` must be EARNED, and over-testing is the safe
  // direction (§3.4.1).
  const regimeBearing = Boolean(rule.reduced || rule.reducedFrequencyEligibility);
  const resolvedRegime = resolved.regimeByRuleId.get(rule.id) ?? null;
  const regime = regimeBearing ? (resolvedRegime?.regime ?? 'full') : null;
  const figures = regime === 'reduced' && rule.reduced ? rule.reduced : rule;

  // --- quantity ----------------------------------------------------------
  const perQuantity = figures.perQuantity;
  // D14 §4.6: resolved per the RULE's unit, with the m² geometry fallback, not
  // per the lot. Still no unit conversion — a quantity in the wrong unit with no
  // usable geometry is "missing" for this rule, never silently converted.
  const perQuantityValue = perQuantity ? quantityFor(resolved, perQuantity.unit) : null;
  if (perQuantity && perQuantityValue === null) {
    causes.push('quantity_missing');
  }

  // --- counts ------------------------------------------------------------
  // The rule's own testType goes through the SAME resolver, so a pack could in
  // principle declare an alias as its key and still work — AT-22 requires it to
  // be a canonical key, so in practice this is an identity lookup.
  const ruleCategory = resolveRuleCategory(rule.testType);
  const attributed = input.tests.filter((test) =>
    testAttributesToRule(ruleCategory, candidatesFor(test, categories)),
  );
  for (const test of attributed) attributedTestIds.add(test.id);
  const passingCount = attributed.filter(testPassing).length;
  const pendingCount = attributed.filter(testPendingByStatus).length;
  const failedCount = attributed.filter(testFailing).length;

  const minCount = scaleValue === null ? null : (figures.minCountByScale[scaleValue] ?? null);
  const requiredCount =
    causes.length > 0 || minCount === null
      ? null
      : requiredTestCount(minCount, perQuantity, perQuantityValue);

  const state: SufficiencyState =
    requiredCount === null
      ? 'unknown'
      : testCountSufficient({ requiredCount, passingCount })
        ? 'satisfied'
        : 'insufficient';

  return {
    ruleId: rule.id,
    testType: rule.testType,
    state,
    requiredCount,
    passingCount,
    pendingCount,
    failedCount,
    regime,
    ...(regimeBearing ? { reducedFrequencyEligible: resolvedRegime?.eligible ?? false } : {}),
    ...(resolvedRegime && regime
      ? {
          regimeBasis: {
            streamKey: resolvedRegime.streamKey,
            lotIds: resolvedRegime.basisLotIds,
          },
        }
      : {}),
    unknownCauses: causes,
    citation: {
      authority: rule.provenance.authority,
      document: rule.provenance.document,
      clause: rule.provenance.clause,
      edition: rule.provenance.edition,
      confirmed: ruleset?.status === 'confirmed',
    },
  };
}

/** §7.1 rows 1-3: why NO rule resolved. */
function lotLevelCauses(resolved: ResolvedSufficiency): UnknownCause[] {
  if (!resolved.ruleset) return ['no_ruleset_for_project'];
  if (!resolved.activityCanonical) return ['activity_not_canonical'];
  return ['no_rule_for_activity'];
}

export function evaluateSufficiency(input: SufficiencyEvaluationInput): SufficiencyEvaluation {
  const { resolved } = input;
  // F1 §4.6: the batch path supplies a shared resolver; everyone else gets a
  // fresh per-call one. Same values either way.
  const resolve = input.resolveCategory ?? createCategoryResolver();
  const categories = resolveLotCategories(input, resolve);
  const attributedTestIds = new Set<string>();
  const rules = resolved.rules.map((rule) =>
    evaluateRule(
      rule,
      input,
      categories,
      (testType) => ruleCategoryOf(resolve, testType),
      attributedTestIds,
    ),
  );

  const unknownCauses = rules.length === 0 ? lotLevelCauses(resolved) : [];

  const state: SufficiencyState = rules.some((rule) => rule.state === 'insufficient')
    ? 'insufficient'
    : rules.length > 0 && rules.every((rule) => rule.state === 'satisfied')
      ? 'satisfied'
      : 'unknown';

  const maxLotSizeExceedances: MaxLotSizeExceedance[] = [];
  for (const rule of resolved.rules) {
    const cap = matchingCap(rule, resolved.areaZone, resolved.materialType, resolved.quantity.unit);
    const actual = resolved.quantity.value;
    if (cap && actual !== null && actual > cap.value) {
      maxLotSizeExceedances.push({
        ruleId: rule.id,
        unit: cap.unit,
        limit: cap.value,
        actual,
      });
    }
  }

  // Only meaningful once at least one rule resolved — with no rules, "no rule
  // could attribute it" is the trivially true no_ruleset case, not a data defect.
  const unlinkedPassingTestIds =
    rules.length === 0
      ? []
      : input.tests
          .filter((test) => testPassing(test) && !attributedTestIds.has(test.id))
          .map((test) => test.id);

  // §5.1.2 — the structural non-blocking expression.
  const sufficiencyBlocks =
    resolved.mode === 'block' &&
    resolved.ruleset?.status === 'confirmed' &&
    rules.some((rule) => rule.state === 'insufficient');

  const reasonCodes: TestReasonCode[] = [];
  if (state === 'insufficient') reasonCodes.push('insufficient_test_count');
  if (state === 'satisfied') reasonCodes.push('test_sufficiency_met');
  if (state === 'unknown' || rules.some((rule) => rule.unknownCauses.length > 0)) {
    reasonCodes.push('test_sufficiency_unknown');
  }
  if (unlinkedPassingTestIds.length > 0) reasonCodes.push('tests_unlinked_to_itp_item');
  if (maxLotSizeExceedances.length > 0) reasonCodes.push('lot_exceeds_max_lot_size');

  return {
    state,
    mode: resolved.mode,
    ruleset: resolved.ruleset
      ? {
          id: resolved.ruleset.id,
          status: resolved.ruleset.status,
          scaleLabel: resolved.ruleset.scaleLabel ?? null,
        }
      : null,
    rules,
    unknownCauses,
    maxLotSizeExceedances,
    unlinkedPassingTestIds,
    sufficiencyBlocks,
    verdict: {
      subjectType: 'lot',
      subjectId: input.subjectId,
      // `unknown` NEVER reads as satisfied (§4.2.1, §7.1).
      sufficient: rules.length > 0 && rules.every((rule) => rule.state === 'satisfied'),
      reasonCodes,
      state,
      rules,
    },
  };
}
