// D14 §9.2, AT-35 — the hoisted pack-scoped whitelist, as a pure unit.
//
// Route-level coverage of the same control across all five write paths is
// AT-50a/AT-50b in `routes/lots/testSufficiencyEntry.db.test.ts`; this file pins
// the comparison itself, which is where the vocabulary decisions live.

import { describe, expect, it } from 'vitest';

import { AppError } from '../../AppError.js';
import { assertLotSufficiencyAttributes } from './lotAttributeValidation.js';

// VIC / VicRoads resolves the CONFIRMED `vicroads-204.v2` (D14.2 §6.5 minted it;
// v1 is frozen), scaleKeys A/B/C, materialTypes Type A / Type B / Type C.
const VIC = { state: 'VIC', specificationSet: 'VicRoads' };
// A national baseline spec set has no shipped pack at all.
const NO_PACK = { state: 'QLD', specificationSet: 'Austroads' };

function problem(fn: () => void): AppError {
  try {
    fn();
  } catch (err) {
    return err as AppError;
  }
  throw new Error('expected AppError.badRequest, got no throw');
}

describe('AT-35 assertLotSufficiencyAttributes', () => {
  it('accepts a scale the resolved pack actually uses', () => {
    expect(() => assertLotSufficiencyAttributes(VIC, { testScale: 'B' })).not.toThrow();
  });

  it('rejects a scale outside scaleKeys, NAMING the valid list', () => {
    const err = problem(() => assertLotSufficiencyAttributes(VIC, { testScale: 'Z' }));
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('Valid scales: A, B, C');
  });

  it('accepts a materialType the resolved pack actually declares (D14.2)', () => {
    expect(() => assertLotSufficiencyAttributes(VIC, { materialType: 'Type A' })).not.toThrow();
  });

  it('rejects a materialType outside materialTypes, NAMING the valid list', () => {
    const err = problem(() => assertLotSufficiencyAttributes(VIC, { materialType: 'Type Z' }));
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('Valid material types: Type A, Type B, Type C');
  });

  it('rejects any non-null value on a project whose authority has no pack', () => {
    expect(
      problem(() => assertLotSufficiencyAttributes(NO_PACK, { testScale: 'A' })).statusCode,
    ).toBe(400);
    expect(
      problem(() => assertLotSufficiencyAttributes(NO_PACK, { materialType: 'Type A' })).message,
    ).toContain('no governing test-frequency specification');
  });

  it('always accepts null and undefined — clearing a field is not a vocabulary question', () => {
    expect(() =>
      assertLotSufficiencyAttributes(VIC, { testScale: null, materialType: null }),
    ).not.toThrow();
    expect(() => assertLotSufficiencyAttributes(NO_PACK, { testScale: null })).not.toThrow();
    expect(() => assertLotSufficiencyAttributes(NO_PACK, {})).not.toThrow();
  });

  it('names the lot when a caller supplies one — the bulk paths refuse whole batches', () => {
    const err = problem(() => assertLotSufficiencyAttributes(VIC, { testScale: 'Z' }, 'LOT-042'));
    expect(err.message).toContain('on lot LOT-042');
  });
});
