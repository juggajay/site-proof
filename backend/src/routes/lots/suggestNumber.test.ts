import { describe, expect, it } from 'vitest';
import { resolveLotPrefix, resolveLotStartingNumber, suggestLotNumber } from './suggestNumber.js';

describe('lots suggest-number helpers (pure)', () => {
  describe('resolveLotPrefix', () => {
    it('defaults null/undefined/empty to "LOT-" and keeps a provided prefix', () => {
      expect(resolveLotPrefix(null)).toBe('LOT-');
      expect(resolveLotPrefix(undefined)).toBe('LOT-');
      expect(resolveLotPrefix('')).toBe('LOT-');
      expect(resolveLotPrefix('CIV-')).toBe('CIV-');
    });
  });

  describe('resolveLotStartingNumber', () => {
    it('defaults null/undefined/0 to 1 and keeps a provided number', () => {
      expect(resolveLotStartingNumber(null)).toBe(1);
      expect(resolveLotStartingNumber(undefined)).toBe(1);
      expect(resolveLotStartingNumber(0)).toBe(1);
      expect(resolveLotStartingNumber(5)).toBe(5);
    });
  });

  describe('suggestLotNumber', () => {
    it('returns LOT-001 with defaults when there are no existing lots', () => {
      expect(
        suggestLotNumber({
          prefix: resolveLotPrefix(null),
          startingNumber: resolveLotStartingNumber(null),
          existingLotNumbers: [],
        }),
      ).toEqual({ suggestedNumber: 'LOT-001', nextNumber: 1 });
    });

    it('preserves padding for a custom prefix and larger starting number', () => {
      expect(
        suggestLotNumber({ prefix: 'CIV-', startingNumber: 1000, existingLotNumbers: [] }),
      ).toEqual({ suggestedNumber: 'CIV-1000', nextNumber: 1000 });

      // 3-digit minimum padding still applies for small starting numbers.
      expect(
        suggestLotNumber({ prefix: 'CIV-', startingNumber: 5, existingLotNumbers: [] }),
      ).toEqual({ suggestedNumber: 'CIV-005', nextNumber: 5 });
    });

    it('increments the highest valid existing suffix', () => {
      expect(
        suggestLotNumber({
          prefix: 'LOT-',
          startingNumber: 1,
          existingLotNumbers: ['LOT-001', 'LOT-003', 'LOT-002'],
        }),
      ).toEqual({ suggestedNumber: 'LOT-004', nextNumber: 4 });
    });

    it('grows the padding when the next number has more digits', () => {
      expect(
        suggestLotNumber({ prefix: 'LOT-', startingNumber: 1, existingLotNumbers: ['LOT-0999'] }),
      ).toEqual({ suggestedNumber: 'LOT-1000', nextNumber: 1000 });
    });

    it('escapes regex metacharacters in the prefix so they match literally', () => {
      // The "." must be treated literally: "A.B-005" matches, "AXB-009" must not.
      expect(
        suggestLotNumber({ prefix: 'A.B-', startingNumber: 1, existingLotNumbers: ['A.B-005'] }),
      ).toEqual({ suggestedNumber: 'A.B-006', nextNumber: 6 });

      expect(
        suggestLotNumber({ prefix: 'A.B-', startingNumber: 1, existingLotNumbers: ['AXB-009'] }),
      ).toEqual({ suggestedNumber: 'A.B-001', nextNumber: 1 });
    });

    it('ignores invalid, non-matching, and non-positive suffixes', () => {
      expect(
        suggestLotNumber({
          prefix: 'LOT-',
          startingNumber: 1,
          existingLotNumbers: ['LOT-abc', 'OTHER-005', 'LOT-000', 'LOT-007'],
        }),
      ).toEqual({ suggestedNumber: 'LOT-008', nextNumber: 8 });
    });
  });
});
