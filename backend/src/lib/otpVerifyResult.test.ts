import { describe, expect, it } from 'vitest';

import { isOtpVerifyResultValid } from './otpVerifyResult.js';

describe('isOtpVerifyResultValid', () => {
  it('accepts boolean true', () => {
    expect(isOtpVerifyResultValid(true)).toBe(true);
  });

  it('rejects boolean false', () => {
    expect(isOtpVerifyResultValid(false)).toBe(false);
  });

  it('accepts otplib object results with valid true', () => {
    expect(isOtpVerifyResultValid({ valid: true })).toBe(true);
  });

  it('rejects otplib object results with valid false', () => {
    expect(isOtpVerifyResultValid({ valid: false })).toBe(false);
  });

  it('rejects unexpected return shapes', () => {
    expect(isOtpVerifyResultValid({ valid: 'true' })).toBe(false);
    expect(isOtpVerifyResultValid({})).toBe(false);
    expect(isOtpVerifyResultValid(null)).toBe(false);
  });
});
