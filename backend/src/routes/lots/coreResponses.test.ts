import { describe, expect, it } from 'vitest';
import {
  buildLotCreatedResponse,
  buildLotDeletedResponse,
  buildLotDetailEnvelope,
  buildLotListEnvelope,
  buildLotsCreatedResponse,
  buildSuggestedLotNumberResponse,
  buildLotClonedResponse,
} from './coreResponses.js';

describe('coreResponses', () => {
  it('builds list and detail envelopes', () => {
    const lots = [{ id: 'lot-1' }];
    const pagination = { page: 1, total: 1 };

    expect(buildLotListEnvelope(lots, pagination)).toEqual({
      data: lots,
      pagination,
      lots,
    });
    expect(buildLotDetailEnvelope(lots[0])).toEqual({ lot: lots[0] });
  });

  it('builds create, bulk-create, clone, and delete responses', () => {
    const lot = { id: 'lot-1', lotNumber: 'EW-001' };
    const lots = [lot, { id: 'lot-2', lotNumber: 'EW-002' }];

    expect(buildLotCreatedResponse(lot)).toEqual({ lot });
    expect(buildLotsCreatedResponse(lots)).toEqual({
      message: 'Successfully created 2 lots',
      lots,
      count: 2,
    });
    expect(buildLotClonedResponse(lot, 'source-1', 'EW-000')).toEqual({
      lot,
      sourceLotId: 'source-1',
      message: 'Lot cloned from EW-000',
    });
    expect(buildLotDeletedResponse()).toEqual({ message: 'Lot deleted successfully' });
  });

  it('builds the suggested lot number response', () => {
    expect(buildSuggestedLotNumberResponse('EW-003', 'EW-', 4, 1)).toEqual({
      suggestedNumber: 'EW-003',
      prefix: 'EW-',
      nextNumber: 4,
      startingNumber: 1,
    });
  });
});
