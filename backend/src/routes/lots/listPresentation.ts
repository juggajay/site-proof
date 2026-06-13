// =============================================================================
// Lot list presentation: the pure response-mapping behind GET /api/lots.
// Extracted from lots.ts to isolate the post-fetch transform (budget
// visibility, subcontractor-assignment filtering, and the singular->array
// `itpInstances` compatibility shape) from the route's auth + Prisma fetches.
// Behaviour is preserved exactly:
//   - `budgetAmount` is replaced with `null` unless `canViewBudgetAmount`.
//   - when `subcontractorCompanyId` is set, `subcontractorAssignments` is
//     filtered to that company; otherwise the query's assignments pass through.
//   - when `subcontractorCompanyId` is set, the legacy assigned subcontractor
//     fields are hidden unless they refer to that same company.
//   - when `includeITP` is true, the singular `itpInstance` is exposed as
//     `itpInstances: [itpInstance]` (or `[]`); otherwise no ITP transform.
// The spread (`...lot`) is intentional: it preserves every selected lot field
// AND its original key order, so the serialized response stays byte-identical.
// =============================================================================

/** Minimal shape the presenter needs from each lot's active assignment row. */
export type LotListAssignment = { subcontractorCompanyId: string };

export interface PresentLotListOptions {
  /** When false, `budgetAmount` is nulled out for the caller. */
  canViewBudgetAmount: boolean;
  /** When set, assignments are filtered to this company; null leaves them as-is. */
  subcontractorCompanyId: string | null;
  /** When true, adds the `itpInstances` compatibility array. */
  includeITP: boolean;
}

/**
 * Transform the lots returned by Prisma `findMany` into the GET /api/lots
 * response items. Pure — no I/O, no access checks; the route owns those.
 */
export function presentLotList<
  TLot extends {
    budgetAmount: unknown;
    subcontractorAssignments: LotListAssignment[];
    assignedSubcontractorId?: string | null;
    assignedSubcontractor?: unknown;
    itpInstance?: unknown;
  },
>(lots: TLot[], options: PresentLotListOptions) {
  const { canViewBudgetAmount, subcontractorCompanyId, includeITP } = options;

  // Apply budget visibility + subcontractor assignment filtering.
  const visibleLots = lots.map((lot) => {
    const visibleLot = {
      ...lot,
      budgetAmount: canViewBudgetAmount ? lot.budgetAmount : null,
      subcontractorAssignments: subcontractorCompanyId
        ? lot.subcontractorAssignments.filter(
            (assignment) => assignment.subcontractorCompanyId === subcontractorCompanyId,
          )
        : lot.subcontractorAssignments,
    };

    if (subcontractorCompanyId && lot.assignedSubcontractorId !== subcontractorCompanyId) {
      if ('assignedSubcontractorId' in visibleLot) {
        visibleLot.assignedSubcontractorId = null;
      }
      if ('assignedSubcontractor' in visibleLot) {
        visibleLot.assignedSubcontractor = null;
      }
    }

    return visibleLot;
  });

  // Frontend expects itpInstances array, but we have singular itpInstance.
  return includeITP
    ? visibleLots.map((lot) => ({
        ...lot,
        itpInstances: lot.itpInstance ? [lot.itpInstance] : [],
      }))
    : visibleLots;
}
