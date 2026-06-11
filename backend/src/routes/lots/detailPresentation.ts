// =============================================================================
// Lot detail presentation: the pure response shaping behind GET /api/lots/:id.
// Extracted from lots.ts to isolate the response transform from the route's
// auth + Prisma fetch + subcontractor-company resolution. Behaviour preserved:
//   - `projectId` is retained because portal/detail clients need it for
//     follow-up evidence/document requests.
//   - `assignedSubcontractorId` is retained for head-contractor users and only
//     retained for subcontractor users when it refers to their resolved company.
//   - `budgetAmount` follows the same visibility rule as the lot list.
//   - for subcontractor users, `subcontractorAssignments` is filtered to that
//     user's resolved company, and `assignedSubcontractor` is nulled unless the
//     lot's legacy `assignedSubcontractorId` matches that company.
//   - head-contractor users keep every assignment and the assignedSubcontractor.
// The route still owns resolving `subcontractorCompanyId` (a DB lookup) and the
// `{ lot: lotResponse }` envelope; this helper is pure (no I/O).
// The shaping rebuilds the object instead of mutating it, so the input `lot` is
// never touched and the serialized key order stays identical (re-specifying an
// existing key in the spread keeps its original position).
// =============================================================================

/** Minimal shape the presenter needs from each active assignment row. */
export type LotDetailAssignment = { subcontractorCompanyId: string };

export interface ShapeLotDetailResponseOptions {
  /** True when the requesting user is a subcontractor (gates the filtering). */
  isSubcontractor: boolean;
  /** The subcontractor user's resolved company for this project (may be null). */
  subcontractorCompanyId: string | null;
  /** When false, `budgetAmount` is nulled out for the caller. */
  canViewBudgetAmount: boolean;
}

/**
 * Shape a single lot (as selected by GET /api/lots/:id) into its response body.
 * Pure — no I/O, no access checks; the route owns those.
 */
export function shapeLotDetailResponse<
  TAssignment extends LotDetailAssignment,
  TLot extends {
    projectId: unknown;
    budgetAmount: unknown;
    assignedSubcontractorId: string | null;
    assignedSubcontractor: unknown;
    subcontractorAssignments: TAssignment[];
  },
>(lot: TLot, options: ShapeLotDetailResponseOptions) {
  const { projectId, budgetAmount, assignedSubcontractorId, ...lotResponse } = lot;

  const visibleLotResponse = {
    ...lotResponse,
    projectId,
    budgetAmount: options.canViewBudgetAmount ? budgetAmount : null,
    assignedSubcontractorId:
      !options.isSubcontractor || assignedSubcontractorId === options.subcontractorCompanyId
        ? assignedSubcontractorId
        : null,
  };

  if (!options.isSubcontractor) {
    return visibleLotResponse;
  }

  // Subcontractor users only see their own company's assignment, and the legacy
  // assignedSubcontractor is hidden unless it is their company.
  return {
    ...visibleLotResponse,
    subcontractorAssignments: visibleLotResponse.subcontractorAssignments.filter(
      (assignment) => assignment.subcontractorCompanyId === options.subcontractorCompanyId,
    ),
    assignedSubcontractor:
      lot.assignedSubcontractorId === options.subcontractorCompanyId
        ? visibleLotResponse.assignedSubcontractor
        : null,
  };
}
