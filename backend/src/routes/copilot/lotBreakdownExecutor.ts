import type { AiProposal, Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { bulkCreateLotsCoreSchema } from '../lots/validation.js';
import { createBulkLots } from '../lots/bulkCreateCore.js';
import { applyHandlers, rollbackHandlers, type AppliedRecordGroup } from './proposalService.js';

export const LOT_BREAKDOWN_STAGE = 'lot_breakdown';

// apply: the reviewed candidate is the concrete lot list the review UI generated
// with buildBulkLotPreview (the single source of truth for naming/cross-product),
// plus per-activity ITP template ids the human picked and the geometry request.
// Re-validate it with the SAME schema the POST /bulk route uses (500-cap, chainage
// ranges, per-distinct-template guard inside createBulkLots), then create lots +
// ITP instances + geometry through the shared bulk-create core inside the
// deciding transaction.
applyHandlers[LOT_BREAKDOWN_STAGE] = async (
  tx: Prisma.TransactionClient,
  proposal: AiProposal,
  effectivePayload: unknown,
): Promise<AppliedRecordGroup[]> => {
  const parsed = bulkCreateLotsCoreSchema.safeParse(effectivePayload);
  if (!parsed.success) {
    throw AppError.fromZodError(parsed.error);
  }

  const { createdLots, itpInstanceIds, geometryIds } = await createBulkLots(tx, {
    projectId: proposal.projectId,
    lotsData: parsed.data.lots,
    itpTemplateId: parsed.data.itpTemplateId,
    geometry: parsed.data.geometry,
  });

  const groups: AppliedRecordGroup[] = [{ model: 'Lot', ids: createdLots.map((l) => l.id) }];
  if (itpInstanceIds.length > 0) groups.push({ model: 'ITPInstance', ids: itpInstanceIds });
  if (geometryIds.length > 0) groups.push({ model: 'LotGeometry', ids: geometryIds });
  return groups;
};

// Refuse rollback if any created lot has accumulated real work — deleting it
// would take inspection/test/docket/NCR evidence with it. Names the count.
async function assertCreatedLotsHaveNoProgress(
  tx: Prisma.TransactionClient,
  lotIds: string[],
): Promise<void> {
  if (lotIds.length === 0) return;

  // One query covers every progress relation hanging off the lot; comments key
  // off (entityType, entityId) rather than a FK, so they need their own count.
  const inUse = await tx.lot.findMany({
    where: {
      id: { in: lotIds },
      OR: [
        { testResults: { some: {} } },
        { holdPoints: { some: {} } },
        { ncrLots: { some: {} } },
        { documents: { some: {} } },
        { docketLabourLots: { some: {} } },
        { docketPlantLots: { some: {} } },
        { itpInstance: { completions: { some: {} } } },
      ],
    },
    select: { id: true, lotNumber: true },
  });
  const commentedLots = await tx.comment.findMany({
    where: { entityType: 'Lot', entityId: { in: lotIds }, deletedAt: null },
    select: { entityId: true },
    distinct: ['entityId'],
  });

  const affected = new Set<string>([
    ...inUse.map((l) => l.id),
    ...commentedLots.map((c) => c.entityId),
  ]);
  if (affected.size === 0) return;

  const sample = inUse
    .slice(0, 5)
    .map((l) => l.lotNumber)
    .join(', ');
  throw new AppError(
    400,
    `Cannot undo — ${affected.size} lot(s) from this breakdown already have recorded work ` +
      `(ITP completions, test results, hold points, dockets, photos, comments, or NCRs)` +
      `${sample ? `: ${sample}` : ''}. Remove that work before rolling back.`,
    'LOTS_IN_USE',
  );
}

// rollback: guard progress, then delete the created lots. Lot delete cascades
// their ITP instances and geometries (schema onDelete: Cascade), so deleting the
// Lot group is sufficient to reverse the whole create.
rollbackHandlers[LOT_BREAKDOWN_STAGE] = async (
  tx: Prisma.TransactionClient,
  _proposal: AiProposal,
  groups: AppliedRecordGroup[],
): Promise<void> => {
  const lotIds = groups.find((g) => g.model === 'Lot')?.ids ?? [];
  if (lotIds.length === 0) return;

  await assertCreatedLotsHaveNoProgress(tx, lotIds);
  await tx.lot.deleteMany({ where: { id: { in: lotIds } } });
};
