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

  // Characterization: a single-activity run must reproduce the exact rows the
  // wizard produced before activities became a list — same numbers, same
  // descriptions (no activity suffix), no itpTemplateId key.
  it('builds the preview rows with padded numbers and template replacement', () => {
    expect(
      buildBulkLotPreview({
        start: 0,
        end: 250,
        interval: 100,
        lotPrefix: 'EW',
        descriptionTemplate: '{prefix}-{num}: {start}-{end}',
        activities: [{ activityType: 'Earthworks' }],
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

  it('generates the cross product of intervals × activities with per-activity ITP templates', () => {
    const { lots, error } = buildBulkLotPreview({
      start: 0,
      end: 200,
      interval: 100,
      lotPrefix: 'LOT',
      descriptionTemplate: '{prefix}-{start}-{end}',
      activities: [
        { activityType: 'Earthworks', itpTemplateId: 'tpl-earth' },
        { activityType: 'Pavement', itpTemplateId: 'tpl-pave' },
      ],
      layer: '',
    });

    expect(error).toBeNull();
    // 2 intervals × 2 activities, numbered sequentially, activity-inner so each
    // interval's activities sit next to each other in chainage order.
    expect(lots.map((lot) => lot.lotNumber)).toEqual(['LOT-001', 'LOT-002', 'LOT-003', 'LOT-004']);
    expect(lots.map((lot) => lot.description)).toEqual([
      'LOT-0-100 — Earthworks',
      'LOT-0-100 — Pavement',
      'LOT-100-200 — Earthworks',
      'LOT-100-200 — Pavement',
    ]);
    expect(lots.map((lot) => lot.itpTemplateId)).toEqual([
      'tpl-earth',
      'tpl-pave',
      'tpl-earth',
      'tpl-pave',
    ]);
    // Same interval → identical geometry across activities.
    expect(lots[0].chainageStart).toBe(0);
    expect(lots[1].chainageStart).toBe(0);
    expect(lots[2].chainageStart).toBe(100);
  });

  it('caps on the total generated lots, counting activities', () => {
    // 300 intervals × 2 activities = 600 > MAX_BULK_LOTS.
    expect(validateBulkLotRange(0, 300, 1, 2)).toEqual({
      lotCount: 600,
      error: `Bulk create supports up to ${MAX_BULK_LOTS} lots. Increase the interval or narrow the chainage range.`,
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
