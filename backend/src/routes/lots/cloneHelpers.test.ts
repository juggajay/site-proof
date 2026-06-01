import { describe, expect, it } from 'vitest';
import { prepareClonedLot } from './cloneHelpers.js';

describe('prepareClonedLot (pure)', () => {
  it('passes provided lotNumber and chainage values through unchanged', () => {
    const result = prepareClonedLot({
      provided: { lotNumber: 'CUSTOM-1', chainageStart: 100, chainageEnd: 200 },
      source: { lotNumber: 'LOT-001', chainageStart: 50, chainageEnd: 80 },
    });
    expect(result).toEqual({ lotNumber: 'CUSTOM-1', chainageStart: 100, chainageEnd: 200 });
  });

  it('suggests the next start from the source end when start is not provided', () => {
    // Source has only an end (no start), so the end falls back to the source end.
    const result = prepareClonedLot({
      provided: {},
      source: { lotNumber: 'LOT-001', chainageStart: null, chainageEnd: 500 },
    });
    expect(result.chainageStart).toBe(500);
    expect(result.chainageEnd).toBe(500);
  });

  it('preserves the source section length for the suggested end', () => {
    const result = prepareClonedLot({
      provided: {},
      source: { lotNumber: 'LOT-001', chainageStart: 100, chainageEnd: 200 },
    });
    // length 100 -> suggested start 200, suggested end 300
    expect(result.chainageStart).toBe(200);
    expect(result.chainageEnd).toBe(300);
  });

  it('coerces non-number (Decimal-like) source chainage with Number()', () => {
    const result = prepareClonedLot({
      provided: {},
      source: {
        lotNumber: 'LOT-001',
        chainageStart: { toString: () => '100' },
        chainageEnd: { toString: () => '200' },
      },
    });
    expect(result.chainageStart).toBe(200);
    expect(result.chainageEnd).toBe(300);
  });

  it('explicit null chainage skips suggestion and stays null', () => {
    const result = prepareClonedLot({
      provided: { chainageStart: null, chainageEnd: null },
      source: { lotNumber: 'LOT-001', chainageStart: 100, chainageEnd: 200 },
    });
    expect(result.chainageStart).toBeNull();
    expect(result.chainageEnd).toBeNull();
  });

  it('increments a trailing numeric lot number', () => {
    const result = prepareClonedLot({
      provided: {},
      source: { lotNumber: 'LOT-001', chainageStart: null, chainageEnd: null },
    });
    expect(result.lotNumber).toBe('LOT-002');
  });

  it('characterizes the greedy-regex padding quirk (LOT-009 -> LOT-0010, not LOT-010)', () => {
    // The greedy `^(.*)(\d+)$` leaves only the LAST digit for the numeric group,
    // so "009" increments as "9" -> "10" while "00" stays in the prefix. This is
    // existing behavior, preserved verbatim by the extraction (not a fix).
    const result = prepareClonedLot({
      provided: {},
      source: { lotNumber: 'LOT-009', chainageStart: null, chainageEnd: null },
    });
    expect(result.lotNumber).toBe('LOT-0010');
  });

  it('falls back to `${lotNumber}-copy` for a non-numeric source lot number', () => {
    const result = prepareClonedLot({
      provided: {},
      source: { lotNumber: 'Bridge', chainageStart: null, chainageEnd: null },
    });
    expect(result.lotNumber).toBe('Bridge-copy');
  });

  it('throws the exact bad-request when final start exceeds final end', () => {
    expect(() =>
      prepareClonedLot({
        provided: { chainageStart: 300, chainageEnd: 100 },
        source: { lotNumber: 'LOT-001', chainageStart: null, chainageEnd: null },
      }),
    ).toThrow('chainageStart must be less than or equal to chainageEnd');
  });
});
