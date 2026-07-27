// D14 §9.2 `[D14R-B5]` `[D14X-2]` — the ONE place a lot's pack-scoped attributes
// are whitelisted, and a HARD PRECONDITION FOR BLOCK MODE.
//
// The hole this closes. `assertTestScaleValidForLots` shipped module-private in
// `routes/lots/bulkMutationRoutes.ts` with a SINGLE call site, so four of the
// five write paths — single create, PATCH, `bulkCreateCore` and the copilot lot-
// breakdown executor (which rides `createBulkLots`) — wrote `testScale` with no
// `scaleKeys` check at all. Two independent reviews found the same hole by
// different routes, and the external one named its cost: it is a PRIVILEGE
// BYPASS. On a `block`-mode project a `quality_manager` — who may conform but may
// NOT force-conform — PATCHes `testScale: 'Z'` onto an under-tested lot; the
// value is stored, the evaluator honestly reads `scale_not_recognised` ->
// `unknown`, `unknown` does not block, and the lot conforms with NO override
// record of any kind. The gate is not merely bypassed; the bypass is invisible
// afterwards.
//
// What this does NOT fix, and why the evaluator's own guard is still required:
// rows written BEFORE this shipped can already carry an unrecognised scale. A
// validator cannot clean them, and `scale_not_recognised` stays a live state by
// design. Validation is the PREVENTION; the evaluator's `causes` guard is the
// CONTAINMENT.
//
// Pure: it resolves the ruleset from the project's own state/spec set and
// compares strings. No DB, no route knowledge, no Express.

import { AppError } from '../../AppError.js';
import { resolveRuleset } from './registry.js';

export interface LotSufficiencyAttributeValues {
  /** `undefined` = not being written. `null` = cleared, and always accepted. */
  testScale?: string | null;
  materialType?: string | null;
}

export interface LotSufficiencyAttributeProject {
  state: string | null;
  specificationSet: string | null;
}

/**
 * Reject a `testScale` or `materialType` the project's governing specification
 * does not use, at the trust boundary, NEVER silently coerced.
 *
 * `null` clears a field and is always accepted (§3.4: not recorded errs to full
 * frequency). A project whose authority has no shipped pack rejects any non-null
 * value — there is no vocabulary to have meant.
 *
 * @param subject an optional lot identifier, named in the message. The bulk paths
 *   supply it because they reject the WHOLE batch and the user has to be told
 *   which row caused it; the single-lot paths already know which lot they are on.
 */
export function assertLotSufficiencyAttributes(
  project: LotSufficiencyAttributeProject,
  values: LotSufficiencyAttributeValues,
  subject?: string,
): void {
  const { testScale, materialType } = values;
  if (!testScale && !materialType) return;
  const on = subject ? ` on lot ${subject}` : '';

  const ruleset = resolveRuleset({ state: project.state, specSet: project.specificationSet });
  if (!ruleset) {
    throw AppError.badRequest(
      `${subject ? `Lot ${subject}` : 'This lot'} is on a project with no governing test-frequency specification, so a testing scale or material type cannot be set on it.`,
    );
  }

  if (testScale && !ruleset.scaleKeys.includes(testScale)) {
    throw AppError.badRequest(
      `"${testScale}" is not a testing scale ${ruleset.provenance.document} uses${on}. Valid scales: ${ruleset.scaleKeys.join(', ')}.`,
    );
  }

  if (materialType) {
    const materialTypes = ruleset.materialTypes;
    if (!materialTypes || materialTypes.length === 0) {
      throw AppError.badRequest(
        `${ruleset.provenance.document} does not classify lots by material type, so one cannot be set${on}.`,
      );
    }
    if (!materialTypes.includes(materialType)) {
      throw AppError.badRequest(
        `"${materialType}" is not a material type ${ruleset.provenance.document} uses${on}. Valid material types: ${materialTypes.join(', ')}.`,
      );
    }
  }
}
