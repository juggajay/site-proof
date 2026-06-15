import { AppError } from './AppError.js';

/**
 * Lot deletion blocker checks, extracted verbatim from backend/src/routes/lots.ts.
 *
 * A lot cannot be deleted while it is conformed/claimed, has unreleased hold
 * points (real records or virtual ITP hold-point items), has released hold
 * point evidence that must be retained, or carries docket allocations. These
 * functions throw AppError.badRequest errors so HTTP status (400
 * VALIDATION_ERROR), response messages, and the `error.details` shape (domain
 * markers under details.code) stay explicit at the route boundary. The route
 * handlers still own data fetching, permission checks, and the actual
 * delete/deleteMany.
 *
 * Input types are structural (not Prisma-generated) so the single-delete
 * (`include`) and bulk-delete (`select`) query shapes both satisfy them.
 */

interface DeletableLotData {
  status: string;
  holdPoints?: Array<{ id: string; status?: string | null }> | null;
  itpInstance?: {
    template?: { checklistItems?: Array<{ id: string }> | null } | null;
    completions?: Array<{ checklistItemId: string; verificationStatus: string | null }> | null;
  } | null;
  docketLabourLots?: Array<{ id: string }> | null;
  docketPlantLots?: Array<{ id: string }> | null;
}

interface BulkDeletableLotData extends DeletableLotData {
  lotNumber: string;
}

function getHoldPointStatusCounts(lot: DeletableLotData) {
  const holdPoints = lot.holdPoints ?? [];
  return {
    unreleased: holdPoints.filter((holdPoint) => holdPoint.status !== 'released').length,
    released: holdPoints.filter((holdPoint) => holdPoint.status === 'released').length,
  };
}

/**
 * Throws if a single lot cannot be deleted. Checks run in the same order as the
 * original DELETE /api/lots/:id handler: conformed, claimed, unreleased real
 * hold points, released real hold points, unreleased virtual (ITP) hold points,
 * then docket allocations.
 */
export function assertLotDeletable(lot: DeletableLotData): void {
  // Check if lot is conformed or claimed - cannot delete these
  if (lot.status === 'conformed') {
    throw AppError.badRequest(
      'Cannot delete a conformed lot. Conformed lots have been quality-approved.',
      {
        code: 'LOT_CONFORMED',
      },
    );
  }

  if (lot.status === 'claimed') {
    throw AppError.badRequest(
      'Cannot delete a claimed lot. This lot is part of a progress claim.',
      {
        code: 'LOT_CLAIMED',
      },
    );
  }

  const holdPointCounts = getHoldPointStatusCounts(lot);

  // Check for unreleased hold points (actual records in hold_points table)
  if (holdPointCounts.unreleased > 0) {
    throw AppError.badRequest(
      `This lot has ${holdPointCounts.unreleased} unreleased hold point(s). Release all hold points before deleting the lot.`,
      {
        code: 'UNRELEASED_HOLD_POINTS',
        unreleasedHoldPoints: holdPointCounts.unreleased,
      },
    );
  }

  if (holdPointCounts.released > 0) {
    throw AppError.badRequest(
      `This lot has ${holdPointCounts.released} released hold point(s). Released hold point evidence must be retained; archive the lot instead of deleting it.`,
      {
        code: 'RELEASED_HOLD_POINTS',
        releasedHoldPoints: holdPointCounts.released,
      },
    );
  }

  // Check for virtual hold points (ITP checklist items with hold_point type that haven't been released)
  if (lot.itpInstance?.template?.checklistItems) {
    const holdPointItems = lot.itpInstance.template.checklistItems;
    const releasedCompletions =
      lot.itpInstance.completions?.filter((c) => c.verificationStatus === 'verified') || [];

    // Find hold point items that haven't been verified/released
    const unreleasedHoldPoints = holdPointItems.filter(
      (item) => !releasedCompletions.some((c) => c.checklistItemId === item.id),
    );

    if (unreleasedHoldPoints.length > 0) {
      throw AppError.badRequest(
        `This lot has ${unreleasedHoldPoints.length} unreleased hold point(s). Release all hold points before deleting the lot.`,
        {
          code: 'UNRELEASED_HOLD_POINTS',
          unreleasedHoldPoints: unreleasedHoldPoints.length,
        },
      );
    }
  }

  // Check for docket allocations - lots with docket costs cannot be deleted
  const docketLabourCount = lot.docketLabourLots?.length || 0;
  const docketPlantCount = lot.docketPlantLots?.length || 0;
  const totalDocketAllocations = docketLabourCount + docketPlantCount;

  if (totalDocketAllocations > 0) {
    throw AppError.badRequest(
      `This lot has ${totalDocketAllocations} docket allocation(s) (${docketLabourCount} labour, ${docketPlantCount} plant). Remove docket allocations before deleting the lot.`,
      {
        code: 'HAS_DOCKET_ALLOCATIONS',
        docketAllocations: {
          labour: docketLabourCount,
          plant: docketPlantCount,
          total: totalDocketAllocations,
        },
      },
    );
  }
}

/**
 * Throws if any lot in a bulk request cannot be deleted. Checks run in the same
 * order as the original POST /api/lots/bulk-delete handler and report the
 * offending lot numbers. Note: the conformed/claimed case intentionally has no
 * `details.code` (matching the existing behavior).
 */
export function assertLotsBulkDeletable(lotsToDelete: BulkDeletableLotData[]): void {
  // Check for lots that cannot be deleted (conformed or claimed)
  const undeletableLots = lotsToDelete.filter(
    (lot) => lot.status === 'conformed' || lot.status === 'claimed',
  );

  if (undeletableLots.length > 0) {
    throw AppError.badRequest(
      `Cannot delete ${undeletableLots.length} lot(s) that are conformed or claimed: ${undeletableLots.map((l) => l.lotNumber).join(', ')}`,
    );
  }

  // Check for lots with unreleased hold points
  const lotsWithUnreleasedHP = lotsToDelete.filter(
    (lot) => getHoldPointStatusCounts(lot).unreleased > 0,
  );

  if (lotsWithUnreleasedHP.length > 0) {
    throw AppError.badRequest(
      `Cannot delete ${lotsWithUnreleasedHP.length} lot(s) with unreleased hold points: ${lotsWithUnreleasedHP.map((l) => l.lotNumber).join(', ')}`,
      {
        code: 'UNRELEASED_HOLD_POINTS',
      },
    );
  }

  const lotsWithReleasedHP = lotsToDelete.filter(
    (lot) => getHoldPointStatusCounts(lot).released > 0,
  );

  if (lotsWithReleasedHP.length > 0) {
    throw AppError.badRequest(
      `Cannot delete ${lotsWithReleasedHP.length} lot(s) with released hold points: ${lotsWithReleasedHP.map((l) => l.lotNumber).join(', ')}`,
      {
        code: 'RELEASED_HOLD_POINTS',
      },
    );
  }

  const lotsWithVirtualUnreleasedHP = lotsToDelete.filter((lot) => {
    const holdPointItems = lot.itpInstance?.template?.checklistItems ?? [];
    const verifiedHoldPointCompletions =
      lot.itpInstance?.completions?.filter(
        (completion) => completion.verificationStatus === 'verified',
      ) ?? [];

    return holdPointItems.some(
      (item) =>
        !verifiedHoldPointCompletions.some((completion) => completion.checklistItemId === item.id),
    );
  });

  if (lotsWithVirtualUnreleasedHP.length > 0) {
    throw AppError.badRequest(
      `Cannot delete ${lotsWithVirtualUnreleasedHP.length} lot(s) with unreleased ITP hold points: ${lotsWithVirtualUnreleasedHP.map((l) => l.lotNumber).join(', ')}`,
      {
        code: 'UNRELEASED_HOLD_POINTS',
      },
    );
  }

  const lotsWithDocketAllocations = lotsToDelete.filter(
    (lot) => (lot.docketLabourLots?.length || 0) + (lot.docketPlantLots?.length || 0) > 0,
  );

  if (lotsWithDocketAllocations.length > 0) {
    throw AppError.badRequest(
      `Cannot delete ${lotsWithDocketAllocations.length} lot(s) with docket allocations: ${lotsWithDocketAllocations.map((l) => l.lotNumber).join(', ')}`,
      {
        code: 'HAS_DOCKET_ALLOCATIONS',
      },
    );
  }
}
