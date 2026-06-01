import type { Prisma } from '@prisma/client';

// =============================================================================
// Docket entry totals: the transaction-scoped row lock and the labour/plant
// submitted-total refreshers used by docket entry mutations. Extracted verbatim
// from dockets.ts to keep entry-mutation behavior identical (behavior-preserving)
// — same `FOR UPDATE` lock query, aggregate fields, null→0 numeric coercion,
// dailyDocket update fields, and return shapes.
// =============================================================================

export type DocketEntryMutationTx = Prisma.TransactionClient;

export async function lockDocketForEntryMutation(
  tx: DocketEntryMutationTx,
  docketId: string,
): Promise<void> {
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM daily_dockets
    WHERE id = ${docketId}
    FOR UPDATE
  `;
}

export async function refreshLabourSubmittedTotals(
  tx: DocketEntryMutationTx,
  docketId: string,
): Promise<{ hours: number; cost: number }> {
  const aggregate = await tx.docketLabour.aggregate({
    where: { docketId },
    _sum: {
      submittedHours: true,
      submittedCost: true,
    },
  });
  const hours = Number(aggregate._sum.submittedHours) || 0;
  const cost = Number(aggregate._sum.submittedCost) || 0;

  await tx.dailyDocket.update({
    where: { id: docketId },
    data: {
      totalLabourSubmitted: cost,
    },
  });

  return { hours, cost };
}

export async function refreshPlantSubmittedTotals(
  tx: DocketEntryMutationTx,
  docketId: string,
): Promise<{ hours: number; cost: number }> {
  const aggregate = await tx.docketPlant.aggregate({
    where: { docketId },
    _sum: {
      hoursOperated: true,
      submittedCost: true,
    },
  });
  const hours = Number(aggregate._sum.hoursOperated) || 0;
  const cost = Number(aggregate._sum.submittedCost) || 0;

  await tx.dailyDocket.update({
    where: { id: docketId },
    data: {
      totalPlantSubmitted: cost,
    },
  });

  return { hours, cost };
}
