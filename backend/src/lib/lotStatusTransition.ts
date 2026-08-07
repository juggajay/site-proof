import type { Lot, Prisma } from '@prisma/client';

import { AppError } from './AppError.js';

export interface LotStatusEventInput {
  actorId?: string | null;
  source: 'user' | 'system' | 'import' | 'backfill';
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  effectiveAt?: Date;
  metadata?: Prisma.InputJsonValue;
}

export async function transitionLotStatus(
  tx: Prisma.TransactionClient,
  opts: {
    lotId: string;
    to: string;
    /** Merged into the update's where — preserves callers' optimistic guards. */
    guard?: Prisma.LotWhereInput;
    /** Extra columns written in the SAME update (e.g. conformedAt, claimedInId). Never contains status. Unchecked variant so scalar FKs are assignable, matching what updateMany accepted before. */
    extraData?: Omit<Prisma.LotUncheckedUpdateInput, 'status'>;
    event: LotStatusEventInput;
  },
): Promise<Lot> {
  const before = await tx.lot.findUnique({
    where: { id: opts.lotId },
    select: { id: true, status: true },
  });
  if (!before) {
    throw AppError.notFound('Lot');
  }

  const updated = await tx.lot.update({
    // Guard first so the mandatory unique id always wins the spread.
    where: { ...opts.guard, id: opts.lotId },
    data: { status: opts.to, ...opts.extraData },
  });

  if (before.status !== opts.to) {
    await tx.lotStatusEvent.create({
      data: {
        lotId: opts.lotId,
        fromStatus: before.status,
        toStatus: opts.to,
        effectiveAt: opts.event.effectiveAt ?? new Date(),
        actorId: opts.event.actorId ?? null,
        source: opts.event.source,
        sourceEntityType: opts.event.sourceEntityType ?? null,
        sourceEntityId: opts.event.sourceEntityId ?? null,
        metadata: opts.event.metadata,
      },
    });
  }

  return updated;
}

export async function transitionLotStatusesWhere(
  tx: Prisma.TransactionClient,
  opts: {
    where: Prisma.LotWhereInput;
    to: string;
    extraData?: Omit<Prisma.LotUncheckedUpdateManyInput, 'status'>;
    event: LotStatusEventInput;
    /** Called instead of the default AppError.conflict when rows moved between read and write. */
    onCountMismatch?: (matched: { id: string; lotNumber: string }[], updatedCount: number) => never;
  },
): Promise<{
  count: number;
  lots: { id: string; lotNumber: string; fromStatus: string }[];
}> {
  const matched = await tx.lot.findMany({
    where: opts.where,
    select: { id: true, lotNumber: true, status: true },
  });
  if (matched.length === 0) {
    return { count: 0, lots: [] };
  }

  const result = await tx.lot.updateMany({
    where: { AND: [{ id: { in: matched.map((lot) => lot.id) } }, opts.where] },
    data: { status: opts.to, ...opts.extraData },
  });

  if (result.count !== matched.length) {
    if (opts.onCountMismatch) {
      opts.onCountMismatch(matched, result.count);
    }
    throw AppError.conflict(
      'One or more lots changed while this operation was being recorded. Refresh and try again.',
    );
  }

  const events = matched
    .filter((lot) => lot.status !== opts.to)
    .map((lot) => ({
      lotId: lot.id,
      fromStatus: lot.status,
      toStatus: opts.to,
      effectiveAt: opts.event.effectiveAt ?? new Date(),
      actorId: opts.event.actorId ?? null,
      source: opts.event.source,
      sourceEntityType: opts.event.sourceEntityType ?? null,
      sourceEntityId: opts.event.sourceEntityId ?? null,
      metadata: opts.event.metadata,
    }));
  if (events.length > 0) {
    await tx.lotStatusEvent.createMany({ data: events });
  }

  return {
    count: result.count,
    lots: matched.map((lot) => ({
      id: lot.id,
      lotNumber: lot.lotNumber,
      fromStatus: lot.status,
    })),
  };
}
