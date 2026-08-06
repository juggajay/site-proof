import { describe, expect, it } from 'vitest';
import {
  EMPTY_LOT_STATUS_COUNTS,
  LOT_STATUS_OVERVIEW_ITEMS,
  getLotStatusSwatch,
} from './lotStatusOverview';

describe('lotStatusOverview', () => {
  it('keeps the dashboard lot status sequence stable', () => {
    expect(LOT_STATUS_OVERVIEW_ITEMS.map((item) => item.key)).toEqual([
      'not_started',
      'in_progress',
      'awaiting_test',
      'hold_point',
      'ncr_raised',
      'completed',
      'conformed',
      'claimed',
    ]);
    expect(LOT_STATUS_OVERVIEW_ITEMS.map((item) => item.label)).toEqual([
      'Not Started',
      'In Progress',
      'Awaiting Test',
      'Hold Point',
      'NCR Raised',
      'Completed',
      'Conformed',
      'Claimed',
    ]);
  });

  it('keeps every status documented and coloured', () => {
    expect(LOT_STATUS_OVERVIEW_ITEMS).toHaveLength(8);
    for (const item of LOT_STATUS_OVERVIEW_ITEMS) {
      expect(item.description).toMatch(/\S/);
      // Colour lives in `statusColors.ts`, not on this list — but every status
      // here must resolve to a real swatch rather than the unknown fallback.
      expect(getLotStatusSwatch(item.key)).toMatch(/^#[0-9a-f]{6}$/i);
      expect(getLotStatusSwatch(item.key)).not.toBe('#9ca3af');
    }
  });

  it('provides zero counts for every configured status', () => {
    expect(EMPTY_LOT_STATUS_COUNTS).toEqual({
      not_started: 0,
      in_progress: 0,
      awaiting_test: 0,
      hold_point: 0,
      ncr_raised: 0,
      completed: 0,
      conformed: 0,
      claimed: 0,
    });
  });
});
