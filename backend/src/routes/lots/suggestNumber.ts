// =============================================================================
// Lot number suggestion: the pure calculation behind GET /api/lots/suggest-number.
// Extracted from lots.ts to isolate the prefix/starting-number defaults and the
// next-number/padding maths from the route's auth + Prisma fetches. Behaviour is
// preserved exactly — same `LOT-`/`1` fallbacks, same regex suffix extraction
// (with metacharacter escaping), same invalid/non-positive suffix filtering, and
// same `max(startingNumber digits, nextNumber digits, 3)` zero-padding.
// =============================================================================

/** Project lot prefix with the historical default of `LOT-`. */
export function resolveLotPrefix(lotPrefix: string | null | undefined): string {
  return lotPrefix || 'LOT-';
}

/** Project lot starting number with the historical default of `1`. */
export function resolveLotStartingNumber(lotStartingNumber: number | null | undefined): number {
  return lotStartingNumber || 1;
}

export type SuggestLotNumberInput = {
  prefix: string;
  startingNumber: number;
  existingLotNumbers: string[];
};

/**
 * Compute the next suggested lot number for a project given its resolved prefix,
 * resolved starting number, and the existing lot numbers that already share the
 * prefix. Returns the padded `suggestedNumber` and the raw `nextNumber`.
 */
export function suggestLotNumber(input: SuggestLotNumberInput): {
  suggestedNumber: string;
  nextNumber: number;
} {
  const { prefix, startingNumber, existingLotNumbers } = input;

  let nextNumber = startingNumber;

  if (existingLotNumbers.length > 0) {
    // Extract numbers from existing lot numbers and find the highest
    const numbers = existingLotNumbers
      .map((lotNumber) => {
        const match = lotNumber.match(
          new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)`),
        );
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n) && n > 0);

    if (numbers.length > 0) {
      nextNumber = Math.max(...numbers) + 1;
    }
  }

  // Pad with zeros to match the starting number format
  const paddingLength = Math.max(String(startingNumber).length, String(nextNumber).length, 3);
  const suggestedNumber = `${prefix}${String(nextNumber).padStart(paddingLength, '0')}`;

  return { suggestedNumber, nextNumber };
}
