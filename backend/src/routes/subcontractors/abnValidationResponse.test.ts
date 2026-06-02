import { describe, expect, it } from 'vitest';
import { buildAbnValidationResponse } from './abnValidationResponse.js';

describe('ABN validation response helper', () => {
  it('normalizes and formats a valid ABN response', () => {
    expect(buildAbnValidationResponse('51 824-753 556', { valid: true })).toEqual({
      abn: '51824753556',
      valid: true,
      error: null,
      formatted: '51 824 753 556',
    });
  });

  it('returns the validation error and no formatted value for invalid ABNs', () => {
    expect(
      buildAbnValidationResponse('12 345 678 900', { valid: false, error: 'Invalid ABN checksum' }),
    ).toEqual({
      abn: '12345678900',
      valid: false,
      error: 'Invalid ABN checksum',
      formatted: null,
    });
  });

  it('preserves null error fallback when invalid validation omits an error', () => {
    expect(buildAbnValidationResponse('12345678900', { valid: false })).toEqual({
      abn: '12345678900',
      valid: false,
      error: null,
      formatted: null,
    });
  });
});
