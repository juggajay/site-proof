// Wave C1 test sufficiency — the counting/arithmetic limb (spec §3.2.1).
//
// A LEAF module: it imports types only. `predicates.ts` re-exports
// `testCountSufficient` from here rather than from `evaluate.ts` (which the spec
// §4.3 snippet names) purely to avoid a circular import — `evaluate.ts` imports
// `testPassing`/`testFailing` FROM `predicates.ts`, so re-exporting out of
// `evaluate.ts` would make predicates ↔ evaluate cyclic. Same intent, same
// contract: `contracts.test.ts:59-64` cites a real predicate-library export.

import type { TestCategory } from './testCategories.js';
import type { QuantityUnit } from './types.js';

/**
 * Does a test attribute to a rule? (F1 §4.4)
 *
 * Both sides are RESOLVED CATEGORIES, never raw strings `[C1C-15]` `[C1C-16]`.
 * Raw-string equality was not an attribution rule; it was a coincidence that
 * held only for synthetic fixtures, and it is why a VIC lot with six verified
 * `Density Ratio` tests read 0 of 6 (F1 §3).
 *
 * The candidate list comes from `testCategories.candidateCategories` — the ONE
 * place attribution candidates are decided `[C1C-20]`. Do not build one here or
 * at a call site: `evaluate.ts` and `regime.ts` are both callers, and a second
 * construction is how the lab-reference exclusion gets bypassed `[F1C-B2]`.
 */
export function testAttributesToRule(
  ruleCategory: TestCategory | null,
  candidates: readonly TestCategory[],
): boolean {
  if (!ruleCategory) return false;
  return candidates.includes(ruleCategory);
}

/**
 * §3.2.1 required count:
 *
 *     requiredCount = max( minCountByScale[scale],
 *                          perQuantity ? ceil(quantity / perQuantity.every) : 0 )
 *
 * The `max` is the right reading of a statistical-validity floor, and it is a
 * NO-OP for everything C1 ships: no rule in either seed pack carries a
 * `perQuantity` limb, because no cited authority supplies a per-area frequency
 * figure [C1R-1]. Specified so a confirmed edition can supply one without a
 * redesign; covered by a synthetic rule only (§14 AT-4).
 *
 * `every <= 0` would divide to Infinity — a confident wrong required count.
 * `validateRuleset` rejects it in CI; this guard makes it unreachable at runtime.
 */
export function requiredTestCount(
  minCount: number,
  perQuantity: { unit: QuantityUnit; every: number } | undefined,
  quantity: number | null,
): number {
  const coverage =
    perQuantity && perQuantity.every > 0 && quantity !== null && quantity > 0
      ? Math.ceil(quantity / perQuantity.every)
      : 0;
  return Math.max(minCount, coverage);
}

/**
 * The sufficiency evaluator's boolean limb, re-exported by `predicates.ts` (§4.3)
 * so `REASON_CODE_PROVENANCE` can cite a real predicate-library export for
 * `insufficient_test_count` / `test_sufficiency_met` instead of dishonestly
 * tagging them `'engine'`.
 *
 * A null `requiredCount` (state `unknown`) is NEVER sufficient — unknown never
 * reads as satisfied (§4.2.1, §7.1).
 */
export function testCountSufficient(counts: {
  requiredCount: number | null;
  passingCount: number;
}): boolean {
  return counts.requiredCount !== null && counts.passingCount >= counts.requiredCount;
}
