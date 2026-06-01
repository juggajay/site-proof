import { describe, expect, it } from 'vitest';
import {
  buildNcrListResponse,
  buildNcrResponse,
  buildNcrUpdatedResponse,
} from './ncrCoreResponses.js';

describe('ncrCoreResponses', () => {
  it('builds the list envelope with pagination and the backward-compatible ncrs alias', () => {
    const ncrs = [
      { id: 'ncr-1', ncrNumber: 'NCR-001' },
      { id: 'ncr-2', ncrNumber: 'NCR-002' },
    ];

    expect(buildNcrListResponse(ncrs, 25, 2, 10)).toEqual({
      data: ncrs,
      pagination: {
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      },
      ncrs,
    });
  });

  it('builds the shared single-NCR envelope for detail and create responses', () => {
    const ncr = { id: 'ncr-1', ncrNumber: 'NCR-001' };

    expect(buildNcrResponse(ncr)).toEqual({ ncr });
  });

  it('builds the update envelope with the existing success message', () => {
    const ncr = { id: 'ncr-1', status: 'closed' };

    expect(buildNcrUpdatedResponse(ncr)).toEqual({
      ncr,
      message: 'NCR updated',
    });
  });
});
