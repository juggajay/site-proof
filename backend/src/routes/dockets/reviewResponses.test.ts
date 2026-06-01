import { describe, expect, it } from 'vitest';
import {
  buildDocketQueriedResponse,
  buildDocketQueryResponseSubmittedResponse,
  buildDocketRejectedResponse,
} from './reviewResponses.js';

const notifiedUsers = [
  { email: 'subbie@example.com', fullName: 'Subbie User' },
  { email: 'no-name@example.com', fullName: null },
];

describe('docket review response builders', () => {
  it('preserves the rejection response shape', () => {
    expect(
      buildDocketRejectedResponse({ id: 'docket-1', status: 'rejected' }, notifiedUsers),
    ).toEqual({
      message: 'Docket rejected',
      docket: {
        id: 'docket-1',
        status: 'rejected',
      },
      notifiedUsers,
    });
  });

  it('preserves the query response shape', () => {
    expect(
      buildDocketQueriedResponse({ id: 'docket-2', status: 'queried' }, notifiedUsers),
    ).toEqual({
      message: 'Docket queried successfully',
      docket: {
        id: 'docket-2',
        status: 'queried',
      },
      notifiedUsers,
    });
  });

  it('preserves the subcontractor response-submitted shape', () => {
    expect(
      buildDocketQueryResponseSubmittedResponse({
        id: 'docket-3',
        status: 'pending_approval',
      }),
    ).toEqual({
      message: 'Query response submitted',
      docket: {
        id: 'docket-3',
        status: 'pending_approval',
      },
    });
  });
});
