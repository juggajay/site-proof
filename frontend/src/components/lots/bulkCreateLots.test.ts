import { describe, expect, it } from 'vitest';

import {
  INTERVAL_TOO_SMALL_MESSAGE,
  MAX_BULK_LOTS,
  buildBulkLotPreview,
  parseChainageInput,
  validateBulkLotRange,
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
