// =============================================================================
// Docket submission guards: the pure precondition checks run before a docket is
// submitted for approval (POST /api/dockets/:id/submit). Extracted verbatim
// from the inline checks in dockets.ts — same conditions, same error shapes:
//   - non-draft/non-rejected status -> AppError.badRequest (VALIDATION_ERROR)
//   - no labour and no plant entries -> new AppError(400, ..., 'ENTRY_REQUIRED')
//   - any labour entry with no lot allocation -> new AppError(400, ..., 'LOT_REQUIRED')
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

interface DocketSubmissionGuardOptions {
  allowedStatuses?: string[];
  invalidStatusMessage?: string;
}

/**
 * Throws if the docket cannot be submitted for approval. Returns void when all
 * preconditions pass. Mirrors the original inline guard order exactly.
 */
export function assertDocketSubmittable(
  docket: DocketSubmissionSource,
  options: DocketSubmissionGuardOptions = {},
): void {
  const allowedStatuses = options.allowedStatuses ?? ['draft', 'rejected'];
  if (!allowedStatuses.includes(docket.status)) {
    throw AppError.badRequest(
      options.invalidStatusMessage ?? 'Only draft or rejected dockets can be submitted',
    );
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

  // Feature #890: Require lot selection for every labour row. Lot-level cost and
  // evidence rollups assume each labour entry is scoped to its worked lot.
  if (docket.labourEntries.length > 0) {
    const allLabourEntriesHaveLotAllocation = docket.labourEntries.every(
      (entry) => entry.lotAllocations && entry.lotAllocations.length > 0,
    );
    if (!allLabourEntriesHaveLotAllocation) {
      throw new AppError(
        400,
        'Every labour entry must be allocated to a lot before submitting the docket.',
        'LOT_REQUIRED',
      );
    }
  }
}
