// Wave C1 — the PURE test-sufficiency evaluator (spec §4).
//
// Pure and synchronous, like the conformance gate it will plug into: resolved
// inputs in (§4.1), a three-valued verdict out (§4.2). It never queries — the
// M39 guarantee that the single conform path and the batched claim path produce
// byte-identical results depends on `computeConformanceResult` staying DB-free
// (`conformancePrerequisites.ts:374-382`), and C1 keeps it that way by resolving
// per path and passing the bundle IN, exactly as `releasedHoldPointItemIds`
// already does [C1R-B1] [C1R-C5].
//
// C1.0 ships this unused — no call site (spec §11 C1.0).

import { testFailing, testPassing, testPendingByStatus } from '../predicates.js';
import type { TestSufficiencyVerdict, TestReasonCode } from '../contracts/futureConsumers.js';
import { requiredTestCount, testAttributesToRule, testCountSufficient } from './counts.js';
import type {
  FrequencyRule,
  MaxLotSizeExceedance,
  ResolvedSufficiency,
  RuleSufficiency,
  SufficiencyChecklistItem,
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
}

export interface SufficiencyEvaluation {
  /** Worst state across rules; `unknown` when no rule resolved. */
  state: SufficiencyState;
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

/** Test types a checklist item link contributes, keyed by item id. */
function itemTestTypeIndex(items: readonly SufficiencyChecklistItem[]): Map<string, string | null> {
  return new Map(items.map((item) => [item.id, item.testType ?? null]));
}

function candidateTestTypes(
  test: SufficiencyTestRow,
  itemTestTypes: Map<string, string | null>,
): (string | null | undefined)[] {
  const linked = test.itpChecklistItemId ? itemTestTypes.get(test.itpChecklistItemId) : null;
  return [test.testType, linked];
}

/**
 * Caps are filtered to the lot's OWN unit before the most-restrictive one is
 * chosen: comparing raw `value` across units would let a small cap in an
 * unrelated unit win and then be discarded, silently swallowing a real
 * exceedance in the unit the lot actually carries. C1 does no unit conversion.
 */
function matchingCap(
  rule: FrequencyRule,
  areaZone: string | null,
  unit: MaxLotSizeExceedance['unit'] | null,
): { unit: MaxLotSizeExceedance['unit']; value: number } | null {
  if (unit === null) return null;
  const zone = (areaZone || '').trim().toLowerCase();
  const applicable = (rule.maxLotSize ?? []).filter((cap) => {
    if (cap.unit !== unit) return false;
    if (!cap.areaZoneAliases || cap.areaZoneAliases.length === 0) return true;
    return cap.areaZoneAliases.some((alias) => alias.trim().toLowerCase() === zone) && zone !== '';
  });
  if (applicable.length === 0) return null;
  // Most restrictive matching cap wins.
  return applicable.reduce((worst, cap) => (cap.value < worst.value ? cap : worst));
}

function evaluateRule(
  rule: FrequencyRule,
  input: SufficiencyEvaluationInput,
  itemTestTypes: Map<string, string | null>,
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
  // No `reduced` limb => no regime concept for this rule. A rule WITH the limb
  // whose regime could not be resolved falls back to `full`: `reduced` must be
  // EARNED, and over-testing is the safe direction (§3.4.1).
  const resolvedRegime = resolved.regimeByRuleId.get(rule.id) ?? null;
  const regime = rule.reduced ? (resolvedRegime?.regime ?? 'full') : null;
  const figures = regime === 'reduced' && rule.reduced ? rule.reduced : rule;

  // --- quantity ----------------------------------------------------------
  const perQuantity = figures.perQuantity;
  const quantityUsable =
    resolved.quantity.value !== null &&
    perQuantity !== undefined &&
    resolved.quantity.unit === perQuantity.unit;
  if (perQuantity && !quantityUsable) {
    // `ponytail:` no unit conversion in C1 — a quantity in the wrong unit is
    // "missing" for this rule, never silently converted.
    causes.push('quantity_missing');
  }

  // --- counts ------------------------------------------------------------
  const attributed = input.tests.filter((test) =>
    testAttributesToRule(rule.testType, candidateTestTypes(test, itemTestTypes)),
  );
  for (const test of attributed) attributedTestIds.add(test.id);
  const passingCount = attributed.filter(testPassing).length;
  const pendingCount = attributed.filter(testPendingByStatus).length;
  const failedCount = attributed.filter(testFailing).length;

  const minCount = scaleValue === null ? null : (figures.minCountByScale[scaleValue] ?? null);
  const requiredCount =
    causes.length > 0 || minCount === null
      ? null
      : requiredTestCount(minCount, perQuantity, resolved.quantity.value);

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
  const itemTestTypes = itemTestTypeIndex(input.checklistItems);
  const attributedTestIds = new Set<string>();
  const rules = resolved.rules.map((rule) =>
    evaluateRule(rule, input, itemTestTypes, attributedTestIds),
  );

  const unknownCauses = rules.length === 0 ? lotLevelCauses(resolved) : [];

  const state: SufficiencyState = rules.some((rule) => rule.state === 'insufficient')
    ? 'insufficient'
    : rules.length > 0 && rules.every((rule) => rule.state === 'satisfied')
      ? 'satisfied'
      : 'unknown';

  const maxLotSizeExceedances: MaxLotSizeExceedance[] = [];
  for (const rule of resolved.rules) {
    const cap = matchingCap(rule, resolved.areaZone, resolved.quantity.unit);
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
