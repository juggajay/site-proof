import { describe, expect, it } from 'vitest';

import { buildLotConformedResponse, buildLotStatusOverrideResponse } from './statusResponses.js';

describe('lot status response helpers', () => {
  it('builds the conformed response shape', () => {
    const lot = { id: 'lot-1', lotNumber: 'LOT-001', status: 'conformed' };

    expect(buildLotConformedResponse(lot)).toEqual({
      message: 'Lot conformed successfully',
      lot,
    });
  });

  it('builds the override response shape and trims the persisted reason echo', () => {
    const lot = { id: 'lot-2', lotNumber: 'LOT-002', status: 'hold_point' };

    expect(buildLotStatusOverrideResponse(lot, 'in_progress', '  Site decision  ')).toEqual({
      message: 'Status overridden successfully',
      lot,
      previousStatus: 'in_progress',
      reason: 'Site decision',
    });
  });
});
