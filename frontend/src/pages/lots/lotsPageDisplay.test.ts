import { describe, expect, it } from 'vitest';
import { LOT_STATUS_COLORS } from './lotsPageDisplay';

describe('LOT_STATUS_COLORS', () => {
  it('keeps the linear map lot status palette keyed by the supported statuses', () => {
    expect(Object.keys(LOT_STATUS_COLORS)).toEqual([
      'pending',
      'in_progress',
      'completed',
      'on_hold',
      'not_started',
    ]);
  });
});
