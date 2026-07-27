/**
 * Wave B B2 — the `import_lot_register` stage handlers.
 *
 * Follows `lotBreakdownExecutor.ts` exactly: apply re-validates the REVIEWED
 * payload with the same Zod schema `POST /api/lots/bulk` uses, writes through the
 * shared `createBulkLots` core inside the deciding transaction, and returns
 * grouped ids; rollback reuses that stage's progress guard so an imported lot
 * that has since accumulated evidence cannot be silently deleted.
 *
 * The payload reaching apply may be an `editedPayload` the reviewer supplied, so
 * it is untrusted input: the dedup and activity rules the dry run enforced are
 * RE-ASSERTED here. The batch id comes from `proposal.importBatchId`, never from
 * the payload, for the same reason.
 */
import type { AiProposal, Prisma } from '@prisma/client';

import { foldActivityValue } from '../../../lib/activityTaxonomy.js';
import { AppError } from '../../../lib/AppError.js';
import { createBulkLots } from '../../lots/bulkCreateCore.js';
import { bulkCreateLotsCoreSchema } from '../../lots/validation.js';
import { assertCreatedLotsHaveNoProgress } from '../lotBreakdownExecutor.js';
import { applyHandlers, rollbackHandlers, type AppliedRecordGroup } from '../proposalService.js';
import { assertBatchTransition } from './batchState.js';

export const IMPORT_LOT_REGISTER_STAGE = 'import_lot_register';

/** Mark the batch applied/rolled back alongside its records, in the same
 *  transaction. `status` is a projection of the proposal, never independent. */
async function projectBatchStatus(
  tx: Prisma.TransactionClient,
  proposal: AiProposal,
  to: 'applied' | 'rolled_back',
): Promise<void> {
  if (!proposal.importBatchId) return;
  const batch = await tx.importBatch.findUnique({
    where: { id: proposal.importBatchId },
    select: { status: true },
  });
  if (!batch) return;
  assertBatchTransition(batch.status, to);
  await tx.importBatch.update({ where: { id: proposal.importBatchId }, data: { status: to } });
}

applyHandlers[IMPORT_LOT_REGISTER_STAGE] = async (
  tx: Prisma.TransactionClient,
  proposal: AiProposal,
  effectivePayload: unknown,
): Promise<AppliedRecordGroup[]> => {
  // The SAME schema the manual bulk route validates against: 500-cap, chainage
  // ranges, no duplicate lot numbers within the batch.
  const parsed = bulkCreateLotsCoreSchema.safeParse(effectivePayload);
  if (!parsed.success) {
    throw AppError.fromZodError(parsed.error);
  }

  // An unrecognised activity cannot be applied — never defaulted. Without this
  // `createBulkLots` would write 'Earthworks' for an empty value, which is the
  // exact defect of the CSV importer this stage retires.
  for (const lot of parsed.data.lots) {
    if (foldActivityValue(lot.activityType ?? '').confidence === 'none') {
      throw AppError.badRequest(
        `Lot ${lot.lotNumber} has no recognised activity. Pick an activity for it or leave it out of this import.`,
        { code: 'IMPORT_ACTIVITY_UNRESOLVABLE' },
      );
    }
  }

  // A lot number that became taken between the dry run and the accept must not
  // reach the unique index as a raw P2002.
  const taken = await tx.lot.findMany({
    where: {
      projectId: proposal.projectId,
      lotNumber: { in: parsed.data.lots.map((lot) => lot.lotNumber) },
    },
    select: { lotNumber: true },
  });
  if (taken.length > 0) {
    throw AppError.badRequest(
      `${taken.length} lot number(s) already exist in this project: ${taken
        .slice(0, 5)
        .map((lot) => lot.lotNumber)
        .join(', ')}. Re-run the dry run.`,
      { code: 'IMPORT_LOT_DUPLICATE' },
    );
  }

  const { createdLots, itpInstanceIds } = await createBulkLots(tx, {
    projectId: proposal.projectId,
    lotsData: parsed.data.lots,
    itpTemplateId: parsed.data.itpTemplateId,
  });

  await projectBatchStatus(tx, proposal, 'applied');

  const groups: AppliedRecordGroup[] = [{ model: 'Lot', ids: createdLots.map((lot) => lot.id) }];
  if (itpInstanceIds.length > 0) groups.push({ model: 'ITPInstance', ids: itpInstanceIds });
  return groups;
};

rollbackHandlers[IMPORT_LOT_REGISTER_STAGE] = async (
  tx: Prisma.TransactionClient,
  proposal: AiProposal,
  groups: AppliedRecordGroup[],
): Promise<void> => {
  const lotIds = groups.find((group) => group.model === 'Lot')?.ids ?? [];

  await assertCreatedLotsHaveNoProgress(tx, lotIds);
  if (lotIds.length > 0) {
    // Lot delete cascades ITP instances and geometry (schema onDelete: Cascade).
    await tx.lot.deleteMany({ where: { id: { in: lotIds } } });
  }

  await projectBatchStatus(tx, proposal, 'rolled_back');
};
