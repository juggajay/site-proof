import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import { sumClaimedPercentages } from './workflowValidation.js';

type ClaimedLotDelegate = Pick<Prisma.ClaimedLotDelegate, 'findMany'>;
type PrismaLike = { claimedLot: ClaimedLotDelegate };

/**
 * Build a map of lotId -> cumulative claimed percentage, summed across every
 * claim line item the lot currently appears on. Deleting/voiding a draft claim
 * cascades its ClaimedLot rows, so the surviving rows are the source of truth
 * for how much of each lot has already been claimed.
 *
 * Lots with no prior claims are omitted from the map (callers treat a missing
 * entry as 0% claimed).
 */
export async function getCumulativeClaimedPercentByLot(
  lotIds: string[],
  client: PrismaLike = prisma,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (lotIds.length === 0) {
    return result;
  }

  const rows = await client.claimedLot.findMany({
    where: { lotId: { in: lotIds } },
    select: { lotId: true, percentageComplete: true },
  });

  const byLot = new Map<string, Array<{ percentageComplete: unknown }>>();
  for (const row of rows) {
    const existing = byLot.get(row.lotId);
    if (existing) {
      existing.push(row);
    } else {
      byLot.set(row.lotId, [row]);
    }
  }

  for (const [lotId, lotRows] of byLot) {
    result.set(lotId, sumClaimedPercentages(lotRows));
  }

  return result;
}
