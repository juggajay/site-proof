// =============================================================================
// Lot bulk-mutation guards: the shared precondition behind both
// POST /api/lots/bulk-update-status and POST /api/lots/bulk-assign-subcontractor.
// Extracted from lots.ts because both routes duplicated the same conformed/
// claimed check + bad-request throw verbatim. Behaviour preserved exactly:
//   - a lot is unmutable when its status is 'conformed' or 'claimed' (exact,
//     lowercase string comparison);
//   - when any are found, throw AppError.badRequest with the same count and
//     comma-separated lot numbers, in the order of the supplied array.
// Uses AppError.badRequest(message) so the wire `error.code` stays
// VALIDATION_ERROR. The routes still own DB reads/updates, role checks, and the
// response shape.
// =============================================================================

import { AppError } from '../../lib/AppError.js';

/** Minimal shape the guard needs from each candidate lot. */
export type BulkMutableLot = { status: string; lotNumber: string };

/**
 * Throw AppError.badRequest if any of the supplied lots are conformed or
 * claimed (and therefore cannot be bulk-mutated). Pure — no I/O.
 */
export function assertLotsBulkMutable(lots: BulkMutableLot[]): void {
  // Check for lots that cannot be updated (conformed or claimed)
  const unupdatableLots = lots.filter(
    (lot) => lot.status === 'conformed' || lot.status === 'claimed',
  );

  if (unupdatableLots.length > 0) {
    throw AppError.badRequest(
      `Cannot update ${unupdatableLots.length} lot(s) that are conformed or claimed: ${unupdatableLots.map((l) => l.lotNumber).join(', ')}`,
    );
  }
}
