import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate } from './docketEditDisplay';

describe('docket edit display – formatCurrency', () => {
  it('formats whole-dollar AUD amounts with no decimals', () => {
    expect(formatCurrency(1234)).toBe('$1,234');
  });

  it('rounds to whole dollars (no fractional cents shown)', () => {
    expect(formatCurrency(1234.56)).toBe('$1,235');
    expect(formatCurrency(0.4)).toBe('$0');
  });

  it('formats zero as $0', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('prefixes negative amounts with a minus sign', () => {
    expect(formatCurrency(-50)).toBe('-$50');
  });
});

describe('docket edit display – formatDate', () => {
  // toLocaleDateString output depends on the runner timezone (the date string is
  // parsed at UTC midnight), so assert only timezone-stable parts: the year of a
  // mid-year date never shifts, and the formatter always returns a string.
  it('includes the year for a valid ISO date', () => {
    expect(formatDate('2026-06-03')).toContain('2026');
  });

  it('returns a non-empty string', () => {
    expect(formatDate('2026-06-03').length).toBeGreaterThan(0);
  });
});
