import { describe, expect, it } from 'vitest';

import {
  CHAINAGE_MAX,
  CREATE_LOT_DEFAULT_VALUES,
  createLotSchema,
  parseBudgetAmountInput,
  parseChainageInput,
} from './createLotForm';

const validLot = {
  ...CREATE_LOT_DEFAULT_VALUES,
  lotNumber: 'LOT-001',
};

const issueMessagesFor = (value: unknown) => {
  const result = createLotSchema.safeParse(value);
  expect(result.success).toBe(false);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('createLotSchema', () => {
  it('accepts a valid lot form with optional chainages blank', () => {
    expect(createLotSchema.parse(validLot)).toEqual(validLot);
  });

  it('preserves decimal chainage parsing used by the submit payload', () => {
    expect(parseChainageInput('12.5')).toBe(12.5);
    expect(parseChainageInput('')).toBeNull();
  });

  it('preserves decimal budget parsing used by the submit payload', () => {
    expect(parseBudgetAmountInput('1250.25')).toBe(1250.25);
    expect(parseBudgetAmountInput('')).toBeNull();
  });

  it('rejects lot numbers shorter than the existing minimum', () => {
    expect(issueMessagesFor({ ...validLot, lotNumber: 'AB' })).toContain(
      'Lot Number must be at least 3 characters',
    );
  });

  it('rejects invalid optional chainage text', () => {
    expect(issueMessagesFor({ ...validLot, chainageStart: 'abc' })).toContain(
      'Chainage Start must be a valid number',
    );
  });

  it('rejects invalid optional budget text', () => {
    expect(issueMessagesFor({ ...validLot, budgetAmount: 'abc' })).toContain(
      'Budget Amount must be a valid number',
    );
  });

  it('rejects chainage ranges where the end is before the start', () => {
    expect(issueMessagesFor({ ...validLot, chainageStart: '100', chainageEnd: '99.5' })).toContain(
      'Chainage End must be greater than or equal to Chainage Start',
    );
  });

  it('rejects chainages outside the existing configured bounds', () => {
    expect(issueMessagesFor({ ...validLot, chainageEnd: String(CHAINAGE_MAX + 1) })).toContain(
      `Chainage End must be between 0 and ${CHAINAGE_MAX}`,
    );
  });
});
