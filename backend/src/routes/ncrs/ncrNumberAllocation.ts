// Race-safe NCR number allocation shared by the standalone NCR create route
// and the NCR-from-failed-ITP-item path.
//
// NCR numbers are unique per project (@@unique([projectId, ncrNumber])). Deriving
// the next number and creating the NCR must happen inside one transaction with a
// retry on the unique-constraint violation so concurrent creators don't both
// compute the same number and 500.
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { getNextNcrNumber, isUniqueConstraintOn } from './ncrCoreValidation.js';

export const NCR_NUMBER_RETRY_LIMIT = 5;

type NcrTransactionClient = Prisma.TransactionClient;

/**
 * Allocate the next sequential NCR number for a project (max existing sequence + 1)
 * and run `create` inside a transaction, retrying on a unique-constraint clash so
 * concurrent NCR creators do not produce duplicate numbers / 500s.
 *
 * The `create` callback receives the transaction client and the allocated number,
 * and is responsible for the actual `tx.nCR.create(...)` plus any in-transaction
 * side effects (e.g. lot status updates).
 */
export async function createNcrWithAllocatedNumber<T>(
  projectId: string,
  create: (tx: NcrTransactionClient, ncrNumber: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= NCR_NUMBER_RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existingNcrNumbers = await tx.nCR.findMany({
          where: {
            projectId,
            ncrNumber: { startsWith: 'NCR-' },
          },
          select: { ncrNumber: true },
        });
        const ncrNumber = getNextNcrNumber(existingNcrNumbers);
        return create(tx, ncrNumber);
      });
    } catch (error) {
      if (
        attempt < NCR_NUMBER_RETRY_LIMIT &&
        isUniqueConstraintOn(error, ['projectId', 'ncrNumber'])
      ) {
        continue;
      }
      throw error;
    }
  }

  throw AppError.conflict('Could not allocate an NCR number. Please try again.');
}
