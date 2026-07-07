import { describe, expect, it } from 'vitest';
import { formatAud, formatAudWhole } from './formatAud';

describe('formatAud', () => {
  it('always shows cents so money surfaces cannot disagree by rounding', () => {
    expect(formatAud(1234)).toBe('$1,234.00');
    expect(formatAud(1234.56)).toBe('$1,234.56');
    expect(formatAud(0)).toBe('$0.00');
    expect(formatAud(-50)).toBe('-$50.00');
  });
});

describe('formatAudWhole', () => {
  it('rounds to whole dollars for the deliberate whole-dollar surfaces', () => {
    expect(formatAudWhole(1234)).toBe('$1,234');
    expect(formatAudWhole(1234.56)).toBe('$1,235');
    expect(formatAudWhole(0)).toBe('$0');
  });
});
