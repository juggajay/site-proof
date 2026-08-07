import { describe, expect, it } from 'vitest';

import { MOBILE_FRAG_BUDGET_BYTES, isOverMobileBudget, isTouchApplePlatform } from './mobileBudget';

describe('mobile fragment budget', () => {
  it('is 15 MB — under 2x the proven-safe 8.7 MB device result', () => {
    expect(MOBILE_FRAG_BUDGET_BYTES).toBe(15_000_000);
  });

  it('blocks a mobile device only above the threshold', () => {
    expect(isOverMobileBudget(MOBILE_FRAG_BUDGET_BYTES, true)).toBe(false);
    expect(isOverMobileBudget(MOBILE_FRAG_BUDGET_BYTES + 1, true)).toBe(true);
    expect(isOverMobileBudget(8_700_000, true)).toBe(false);
    expect(isOverMobileBudget(30_300_000, true)).toBe(true);
  });

  it('never blocks desktop, and never blocks an unknown size', () => {
    expect(isOverMobileBudget(500_000_000, false)).toBe(false);
    expect(isOverMobileBudget(null, true)).toBe(false);
  });
});

describe('isTouchApplePlatform (iPad masquerading as desktop Safari)', () => {
  it('catches iPadOS reporting MacIntel with multitouch', () => {
    expect(isTouchApplePlatform({ maxTouchPoints: 5, platform: 'MacIntel' })).toBe(true);
    expect(isTouchApplePlatform({ maxTouchPoints: 5, platform: 'iPad' })).toBe(true);
    expect(isTouchApplePlatform({ maxTouchPoints: 5, platform: 'iPhone' })).toBe(true);
  });

  it('leaves real desktops alone', () => {
    expect(isTouchApplePlatform({ maxTouchPoints: 0, platform: 'MacIntel' })).toBe(false);
    expect(isTouchApplePlatform({ maxTouchPoints: 0, platform: 'Win32' })).toBe(false);
    // Windows touch laptops are not the crashing platform family.
    expect(isTouchApplePlatform({ maxTouchPoints: 10, platform: 'Win32' })).toBe(false);
  });
});
