// =============================================================================
// Lot clone preparation: the pure suggestion/validation behind
// POST /api/lots/:id/clone. Extracted from lots.ts to isolate the adjacent-
// chainage suggestion, the lot-number increment, and the final-range check from
// the route's auth + Prisma read + transactional create. Behaviour preserved:
//   - if chainageStart is not provided and the source has a chainageEnd, suggest
//     the next start from that end; if the source also has a start, reuse the
//     same section length for the suggested end;
//   - if no lotNumber is provided and the source number ends in digits,
//     increment the trailing number preserving its zero-padding; otherwise fall
//     back to `${source.lotNumber}-copy`;
//   - resolve final start/end from provided -> suggested -> source values, and
//     throw AppError.badRequest when the final start exceeds the final end.
// The route still owns request parsing, the source read, role checks, the
// transaction/create, assignment sync, and the response shape.
// =============================================================================

import { AppError } from '../../lib/AppError.js';

/** A stored chainage value (Prisma Decimal) or a plain number/string — anything Number() accepts. */
type ChainageValue = number | string | { toString(): string };

export interface PrepareClonedLotInput<TChainage extends ChainageValue> {
  /** Values supplied in the clone request body (already validated). */
  provided: {
    lotNumber?: string;
    chainageStart?: number | null;
    chainageEnd?: number | null;
  };
  /** The source lot being cloned. */
  source: {
    lotNumber: string;
    chainageStart: TChainage | null;
    chainageEnd: TChainage | null;
  };
}

export interface PreparedClonedLot<TChainage extends ChainageValue> {
  lotNumber: string;
  chainageStart: number | TChainage | null;
  chainageEnd: number | TChainage | null;
}

/**
 * Compute the cloned lot's number and final chainage from the provided body and
 * the source lot. Pure — no I/O. Throws AppError.badRequest for an invalid range.
 */
export function prepareClonedLot<TChainage extends ChainageValue>(
  input: PrepareClonedLotInput<TChainage>,
): PreparedClonedLot<TChainage> {
  const { provided, source } = input;

  // Calculate suggested adjacent chainage if not provided
  let suggestedChainageStart = provided.chainageStart;
  let suggestedChainageEnd = provided.chainageEnd;

  if (suggestedChainageStart === undefined && source.chainageEnd !== null) {
    // Suggest next section starting from where the original ended
    suggestedChainageStart = Number(source.chainageEnd);
    if (source.chainageStart !== null) {
      const sectionLength = Number(source.chainageEnd) - Number(source.chainageStart);
      suggestedChainageEnd = Number(suggestedChainageStart) + sectionLength;
    }
  }

  // If no lotNumber provided, generate a suggestion
  let newLotNumber = provided.lotNumber;
  if (!newLotNumber) {
    // Try to increment the lot number (e.g., LOT-001 -> LOT-002)
    const match = source.lotNumber.match(/^(.*)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const num = parseInt(match[2], 10);
      const paddedNum = String(num + 1).padStart(match[2].length, '0');
      newLotNumber = `${prefix}${paddedNum}`;
    } else {
      newLotNumber = `${source.lotNumber}-copy`;
    }
  }

  const finalChainageStart =
    suggestedChainageStart !== undefined ? suggestedChainageStart : source.chainageStart;
  const finalChainageEnd =
    suggestedChainageEnd !== undefined ? suggestedChainageEnd : source.chainageEnd;
  if (
    finalChainageStart !== null &&
    finalChainageEnd !== null &&
    Number(finalChainageStart) > Number(finalChainageEnd)
  ) {
    throw AppError.badRequest('chainageStart must be less than or equal to chainageEnd');
  }

  return {
    lotNumber: newLotNumber,
    chainageStart: finalChainageStart,
    chainageEnd: finalChainageEnd,
  };
}
