import { Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { prisma } from '../../lib/prisma.js';

const VARIATION_NUMBER_PATTERN = /^VAR-(\d+)$/;

export const VARIATION_NUMBER_RETRY_LIMIT = 5;

type VariationTransactionClient = Prisma.TransactionClient;

function normalizeUniqueTargetField(value: string) {
  return value.replace(/_/g, '').toLowerCase();
}

export function isUniqueConstraintOn(error: unknown, fields: string[]) {
  const candidate = error as { code?: unknown; meta?: { target?: unknown } };
  if (candidate?.code !== 'P2002') {
    return false;
  }

  const target = candidate.meta?.target;
  if (!Array.isArray(target)) {
    return false;
  }

  const normalizedTarget = target
    .filter((field): field is string => typeof field === 'string')
    .map(normalizeUniqueTargetField);
  return fields.every((field) => normalizedTarget.includes(normalizeUniqueTargetField(field)));
}

export function getNextVariationNumber(
  existingVariationNumbers: Array<{ variationNumber: string }>,
) {
  const highestSequence = existingVariationNumbers.reduce((highest, variation) => {
    const match = VARIATION_NUMBER_PATTERN.exec(variation.variationNumber);
    if (!match) {
      return highest;
    }

    return Math.max(highest, Number(match[1]));
  }, 0);

  return `VAR-${String(highestSequence + 1).padStart(4, '0')}`;
}

export async function createVariationWithAllocatedNumber<T>(
  projectId: string,
  create: (tx: VariationTransactionClient, variationNumber: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= VARIATION_NUMBER_RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existingVariationNumbers = await tx.variation.findMany({
          where: {
            projectId,
            variationNumber: { startsWith: 'VAR-' },
          },
          select: { variationNumber: true },
        });
        const variationNumber = getNextVariationNumber(existingVariationNumbers);
        return create(tx, variationNumber);
      });
    } catch (error) {
      if (
        attempt < VARIATION_NUMBER_RETRY_LIMIT &&
        isUniqueConstraintOn(error, ['projectId', 'variationNumber'])
      ) {
        continue;
      }
      throw error;
    }
  }

  throw AppError.conflict('Could not allocate a variation number. Please try again.');
}
