import { describe, expect, it } from 'vitest';

import {
  INTERVAL_TOO_SMALL_MESSAGE,
  MAX_BULK_LOTS,
  buildBulkLotPreview,
  controlLineChainageExtent,
  parseChainageInput,
  validateBulkLotRange,
  validateRangeAgainstControlLine,
} from './bulkCreateLots';

describe('bulk lot helpers', () => {
  it('parses decimal chainage input using the shared numeric parser', () => {
    expect(parseChainageInput('12.5')).toBe(12.5);
    expect(parseChainageInput('')).toBeNull();
    expect(parseChainageInput('abc')).toBeNull();
  });

  it('returns no range error until the inputs form a valid increasing range', () => {
    expect(validateBulkLotRange(null, 100, 10)).toEqual({ lotCount: null, error: null });
    expect(validateBulkLotRange(100, 100, 10)).toEqual({ lotCount: null, error: null });
    expect(validateBulkLotRange(0, 100, 0)).toEqual({ lotCount: null, error: null });
  });

  it('caps generated ranges at the existing bulk lot maximum', () => {
    expect(validateBulkLotRange(0, MAX_BULK_LOTS + 1, 1)).toEqual({
      lotCount: MAX_BULK_LOTS + 1,
      error: `Bulk create supports up to ${MAX_BULK_LOTS} lots. Increase the interval or narrow the chainage range.`,
    });
  });

  it('detects intervals too small to create distinct rounded chainages', () => {
    expect(validateBulkLotRange(1, 2, 0.0000001)).toEqual({
      lotCount: 10000000,
      error: INTERVAL_TOO_SMALL_MESSAGE,
    });
  });

  it('builds the preview rows with padded numbers and template replacement', () => {
    expect(
      buildBulkLotPreview({
        start: 0,
        end: 250,
        interval: 100,
        lotPrefix: 'EW',
        descriptionTemplate: '{prefix}-{num}: {start}-{end}',
        activityType: 'Earthworks',
        layer: 'Subgrade',
      }),
    ).toEqual({
      error: null,
      lots: [
        {
          lotNumber: 'EW-001',
          description: 'EW-1: 0-100',
          chainageStart: 0,
          chainageEnd: 100,
          activityType: 'Earthworks',
          layer: 'Subgrade',
        },
        {
          lotNumber: 'EW-002',
          description: 'EW-2: 100-200',
          chainageStart: 100,
          chainageEnd: 200,
          activityType: 'Earthworks',
          layer: 'Subgrade',
        },
        {
          lotNumber: 'EW-003',
          description: 'EW-3: 200-250',
          chainageStart: 200,
          chainageEnd: 250,
          activityType: 'Earthworks',
          layer: 'Subgrade',
        },
      ],
    });
  });
});

describe('control line chainage helpers', () => {
  it('computes the extent from ordered or unordered points', () => {
    expect(
      controlLineChainageExtent([{ chainage: 0 }, { chainage: 500 }, { chainage: 1200 }]),
    ).toEqual({ min: 0, max: 1200 });
    expect(controlLineChainageExtent([{ chainage: 900 }, { chainage: 100 }])).toEqual({
      min: 100,
      max: 900,
    });
  });

  it('returns null for unusable point sets', () => {
    expect(controlLineChainageExtent(undefined)).toBeNull();
    expect(controlLineChainageExtent([])).toBeNull();
    expect(controlLineChainageExtent([{ chainage: 5 }])).toBeNull();
    expect(controlLineChainageExtent([{ chainage: 5 }, { chainage: 5 }])).toBeNull();
    expect(controlLineChainageExtent([{ chainage: 0 }, { chainage: NaN }])).toBeNull();
  });

  it('accepts ranges inside the extent and rejects ranges outside it', () => {
    const extent = { min: 0, max: 1000 };
    expect(validateRangeAgainstControlLine(0, 1000, extent, 'MC00')).toBeNull();
    expect(validateRangeAgainstControlLine(200, 800, extent, 'MC00')).toBeNull();
    expect(validateRangeAgainstControlLine(0, 1200, extent, 'MC00')).toContain('MC00');
    expect(validateRangeAgainstControlLine(0, 1200, extent, 'MC00')).toContain('0–1000');
  });
});
