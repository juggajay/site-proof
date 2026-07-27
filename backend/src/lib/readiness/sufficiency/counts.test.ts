// Wave C1 acceptance test AT-1 — the required-count arithmetic (spec §3.2.1).

import { describe, expect, it } from 'vitest';
import {
  normalizeTestTypeKey,
  requiredTestCount,
  testAttributesToRule,
  testCountSufficient,
} from './counts.js';

describe('AT-1 requiredCount = max(minCount, ceil(quantity / every))', () => {
  it('is the scale floor when no perQuantity limb exists (every shipped C1 rule)', () => {
    expect(requiredTestCount(6, undefined, null)).toBe(6);
    expect(requiredTestCount(6, undefined, 100_000)).toBe(6);
    expect(requiredTestCount(3, undefined, 1)).toBe(3);
  });

  it('takes the coverage limb when it exceeds the floor', () => {
    const per = { unit: 'm2' as const, every: 500 };
    expect(requiredTestCount(6, per, 5000)).toBe(10); // 5000/500 = 10 > 6
    expect(requiredTestCount(6, per, 4501)).toBe(10); // ceil(9.002) = 10
  });

  it('takes the floor when the coverage limb is lower — the statistical-validity floor', () => {
    const per = { unit: 'm2' as const, every: 500 };
    expect(requiredTestCount(6, per, 500)).toBe(6); // 1 test by area, 6 by floor
    expect(requiredTestCount(6, per, 3000)).toBe(6); // exactly 6 by area
    expect(requiredTestCount(6, per, 3001)).toBe(7); // the first area-driven count
  });

  it('boundary cases: exact division, sub-unit quantity, unresolvable quantity', () => {
    const per = { unit: 'm2' as const, every: 500 };
    expect(requiredTestCount(1, per, 1000)).toBe(2); // exact multiple, no off-by-one
    expect(requiredTestCount(1, per, 1)).toBe(1); // ceil(0.002) = 1
    expect(requiredTestCount(6, per, null)).toBe(6); // unknown quantity => floor only
    expect(requiredTestCount(6, per, 0)).toBe(6); // zero contributes nothing
  });

  it('never divides by a non-positive `every` — Infinity would be a confident wrong count', () => {
    expect(requiredTestCount(6, { unit: 'm2', every: 0 }, 5000)).toBe(6);
    expect(requiredTestCount(6, { unit: 'm2', every: -500 }, 5000)).toBe(6);
  });
});

describe('testCountSufficient — the boolean limb predicates.ts re-exports', () => {
  it('is true only when a resolved required count is met', () => {
    expect(testCountSufficient({ requiredCount: 6, passingCount: 6 })).toBe(true);
    expect(testCountSufficient({ requiredCount: 6, passingCount: 7 })).toBe(true);
    expect(testCountSufficient({ requiredCount: 6, passingCount: 5 })).toBe(false);
  });

  it('is FALSE for an unresolved (unknown) required count — unknown never reads as satisfied', () => {
    expect(testCountSufficient({ requiredCount: null, passingCount: 99 })).toBe(false);
  });
});

describe('rule attribution (§4.1)', () => {
  it('matches the test`s own type or its linked checklist item`s type, case/space-insensitively', () => {
    expect(testAttributesToRule('compaction', ['Compaction'])).toBe(true);
    expect(testAttributesToRule('compaction', [' compaction '])).toBe(true);
    expect(testAttributesToRule('compaction', ['cbr', 'compaction'])).toBe(true);
    expect(testAttributesToRule('compaction', ['cbr', null])).toBe(false);
  });

  it('never attributes on an empty rule test type', () => {
    expect(testAttributesToRule('', ['compaction'])).toBe(false);
    expect(normalizeTestTypeKey(undefined)).toBe('');
  });
});
