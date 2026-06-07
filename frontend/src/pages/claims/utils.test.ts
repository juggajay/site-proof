import { describe, expect, it } from 'vitest';
import {
  calculateLotClaimAmount,
  getClaimIncrementError,
  getClaimPercentageError,
  parseClaimPercentageInput,
} from './utils';
import type { ConformedLot } from './types';

function makeLot(overrides: Partial<ConformedLot> = {}): ConformedLot {
  return {
    id: 'lot-1',
    lotNumber: 'LOT-001',
    activity: 'Earthworks',
    budgetAmount: 100000,
    selected: true,
    percentComplete: '50',
    claimedPercentage: 0,
    remainingPercentage: 100,
    ...overrides,
  };
}

describe('claim percentage parsing', () => {
  it('parses decimals in range and rejects out-of-range or invalid input', () => {
    expect(parseClaimPercentageInput('50.5')).toBe(50.5);
    expect(parseClaimPercentageInput('0')).toBe(0);
    expect(parseClaimPercentageInput('100')).toBe(100);
    expect(parseClaimPercentageInput('100.1')).toBeNull();
    expect(parseClaimPercentageInput('abc')).toBeNull();
    expect(parseClaimPercentageInput('')).toBeNull();
  });
});

describe('calculateLotClaimAmount', () => {
  it("computes this claim's increment of the budget", () => {
    expect(calculateLotClaimAmount(makeLot({ percentComplete: '30' }))).toBe(30000);
    expect(calculateLotClaimAmount(makeLot({ budgetAmount: null, percentComplete: '30' }))).toBe(0);
  });
});

describe('getClaimIncrementError', () => {
  it('accepts an increment within the remaining percentage', () => {
    expect(getClaimIncrementError('40', 60)).toBeNull();
    expect(getClaimIncrementError('60', 60)).toBeNull();
  });

  it('rejects an increment above the remaining percentage', () => {
    expect(getClaimIncrementError('61', 60)).toBe('Only 60% of this lot is left to claim.');
    expect(getClaimIncrementError('100', 49.5)).toBe('Only 49.5% of this lot is left to claim.');
  });

  it('still applies the base 0-100 and required validations', () => {
    expect(getClaimIncrementError('', 100)).toBe(getClaimPercentageError(''));
    expect(getClaimIncrementError('100.1', 100)).toBe(getClaimPercentageError('100.1'));
  });

  it('tolerates tiny floating-point drift at the remaining boundary', () => {
    expect(getClaimIncrementError('33.34', 33.33999)).toBeNull();
  });
});
