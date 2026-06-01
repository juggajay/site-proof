// =============================================================================
// Docket submission guards: the pure precondition checks run before a docket is
// submitted for approval (POST /api/dockets/:id/submit). Extracted verbatim
// from the inline checks in dockets.ts — same conditions, same error shapes:
//   - non-draft/non-rejected status -> AppError.badRequest (VALIDATION_ERROR)
//   - no labour and no plant entries -> new AppError(400, ..., 'ENTRY_REQUIRED')
//   - labour entries with no lot allocation -> new AppError(400, ..., 'LOT_REQUIRED')
// The 'ENTRY_REQUIRED'/'LOT_REQUIRED' codes are intentionally distinct from the
// default VALIDATION_ERROR code and surface on the wire; preserve them exactly.
// The route still owns request parsing, all Prisma reads/updates, the
// subcontractor access check, audit logging, and notifications.
// =============================================================================

import { AppError } from '../../lib/AppError.js';

export interface DocketSubmissionSource {
  status: string;
  labourEntries: Array<{ lotAllocations?: unknown[] | null }>;
  plantEntries: unknown[];
}

/**
 * Throws if the docket cannot be submitted for approval. Returns void when all
 * preconditions pass. Mirrors the original inline guard order exactly.
 */
export function assertDocketSubmittable(docket: DocketSubmissionSource): void {
  if (!['draft', 'rejected'].includes(docket.status)) {
    throw AppError.badRequest('Only draft or rejected dockets can be submitted');
  }

  // Feature #891: Require at least one entry before submission
  const hasLabourEntries = docket.labourEntries && docket.labourEntries.length > 0;
  const hasPlantEntries = docket.plantEntries && docket.plantEntries.length > 0;
  if (!hasLabourEntries && !hasPlantEntries) {
    throw new AppError(
      400,
      'At least one labour or plant entry is required before submitting the docket.',
      'ENTRY_REQUIRED',
    );
  }

  // Feature #890: Require lot selection for docket submission
  // Check if docket has labour entries that need lot allocation
  if (docket.labourEntries.length > 0) {
    const hasAnyLotAllocation = docket.labourEntries.some(
      (entry) => entry.lotAllocations && entry.lotAllocations.length > 0,
    );
    if (!hasAnyLotAllocation) {
      throw new AppError(
        400,
        'At least one labour entry must be allocated to a lot before submitting the docket.',
        'LOT_REQUIRED',
      );
    }
  }
}
