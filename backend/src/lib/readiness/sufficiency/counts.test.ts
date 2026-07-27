// Wave C1 acceptance test AT-1 — the required-count arithmetic (spec §3.2.1).

import { describe, expect, it } from 'vitest';
import { requiredTestCount, testAttributesToRule, testCountSufficient } from './counts.js';
import {
  LAB_REFERENCE,
  candidateCategories,
  createCategoryResolver,
  ruleCategoryOf,
} from './testCategories.js';

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

// F1 §4.4. Both sides are RESOLVED CATEGORIES now, never raw strings
// [C1C-15] [C1C-16]. The synthetic `'compaction'` cases below are KEPT — they
// are the identity case and they still assert the set arithmetic — and they gain
// real-vocabulary siblings built through the shipped resolver, because a fixture
// that invents a vocabulary the product never writes is what let this defect
// live (§2.5).
describe('rule attribution over resolved categories (F1 §4.4)', () => {
  it('attributes when a candidate category equals the rule category — the identity case', () => {
    expect(testAttributesToRule('compaction', ['compaction'])).toBe(true);
    expect(testAttributesToRule('compaction', ['cbr', 'compaction'])).toBe(true);
    expect(testAttributesToRule('compaction', ['cbr'])).toBe(false);
    expect(testAttributesToRule('compaction', [])).toBe(false);
  });

  it('never attributes on an unresolved rule category', () => {
    expect(testAttributesToRule(null, ['compaction'])).toBe(false);
    expect(testAttributesToRule('', ['compaction'])).toBe(false);
  });

  it.each([
    // [test testType, linked item testType, attributes?]
    ['Density Ratio', null, true], // modal datalist :261 — the headline case
    ['density_ratio', null, true], // 18 production rows + sampleProjectData.ts
    ['compaction', null, true], // 25 legacy production rows
    ['Field Density Nuclear', null, true], // modal datalist :263
    ['Certificate Review Required', 'AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00', true], // item limb
    ['AS 1012.9 (Compressive Strength)', null, false], // concrete strength, unmapped
    ['survey', null, false],
    ['MDD Standard', 'AS 1289.5.4.1, RC 316.00, RC 316.10', false], // [F1C-B2] the lab limb
    ['MDD Modified', null, false],
  ])('real vocabulary: %s (item %s) attributes to `compaction` = %s', (own, item, expected) => {
    const resolve = createCategoryResolver();
    const candidates = candidateCategories(resolve(own), resolve(item));
    expect(testAttributesToRule(ruleCategoryOf(resolve, 'compaction'), candidates)).toBe(expected);
  });

  it('a rule whose own testType resolves to a lab reference attributes to nothing', () => {
    // Unreachable today (AT-22 forbids it), asserted so it stays unreachable.
    const resolve = createCategoryResolver();
    expect(resolve('MDD Standard')).toBe(LAB_REFERENCE);
    expect(ruleCategoryOf(resolve, 'MDD Standard')).toBe(null);
  });
});
