import { describe, expect, it } from 'vitest';

import {
  getProjectLimitForTier,
  getUserLimitForTier,
  normalizeSubscriptionTier,
} from './tierLimits.js';

describe('subscription tier limits', () => {
  it('normalizes cased and padded paid tier values before applying limits', () => {
    expect(normalizeSubscriptionTier(' Professional ')).toBe('professional');
    expect(getProjectLimitForTier(' Enterprise ')).toBe(50);
    expect(getUserLimitForTier(' UNLIMITED ')).toBe(Infinity);
  });

  it('falls back unknown and blank tier values to basic', () => {
    expect(normalizeSubscriptionTier('')).toBe('basic');
    expect(normalizeSubscriptionTier('team')).toBe('basic');
    expect(getProjectLimitForTier('team')).toBe(3);
    expect(getUserLimitForTier(null)).toBe(5);
  });
});
