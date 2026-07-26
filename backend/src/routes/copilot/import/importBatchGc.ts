/**
 * Wave B `[WBR2-3]` §3.1.2 — retention of abandoned import batches.
 *
 * A batch that has not reached a terminal state and has not been touched for 30
 * days is swept to `cancelled`, and its `parseResult`/`dryRun` are nulled (both
 * are reproducible from the source). Without this there is no terminal state for
 * "the reviewer walked away", and abandoned batches accumulate forever holding a
 * parsed grid.
 *
 * The source `Document` is KEPT. It is a project document the contractor
 * uploaded, and deleting user files on a timer is not a decision an importer
 * gets to make.
 *
 * Driven by the `@@index([status, updatedAt])` on ImportBatch.
 */
import { Prisma } from '@prisma/client';

import { prisma as defaultPrisma } from '../../../lib/prisma.js';
import type { ImportBatchStatus } from './batchState.js';

export const ABANDONED_IMPORT_BATCH_DAYS = 30;

/**
 * The in-progress states, listed positively. `applied` is deliberately absent
 * even though it is not a terminal state: an applied batch is the migration's
 * audit record and is retained indefinitely — only its rollback moves it on.
 * Sweeping by "not terminal" would have cancelled every applied import.
 */
const SWEEPABLE_STATUSES: ImportBatchStatus[] = [
  'uploaded',
  'parsed',
  'mapped',
  'dry_run',
  'review',
];

type PrismaLike = Pick<typeof defaultPrisma, 'importBatch'>;

export async function sweepAbandonedImportBatches(
  now: Date = new Date(),
  client: PrismaLike = defaultPrisma,
): Promise<number> {
  const cutoff = new Date(now.getTime() - ABANDONED_IMPORT_BATCH_DAYS * 24 * 60 * 60 * 1000);

  const result = await client.importBatch.updateMany({
    where: {
      status: { in: SWEEPABLE_STATUSES },
      updatedAt: { lt: cutoff },
    },
    data: {
      status: 'cancelled',
      parseResult: Prisma.DbNull,
      dryRun: Prisma.DbNull,
    },
  });

  return result.count;
}
