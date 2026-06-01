import { describe, expect, it } from 'vitest';
import { buildDocketSubmittedResponse } from './submissionResponse.js';

describe('buildDocketSubmittedResponse', () => {
  it('preserves the submitted docket response shape', () => {
    const submittedAt = new Date('2026-05-21T09:00:00.000Z');

    expect(
      buildDocketSubmittedResponse({ id: 'docket-1', status: 'pending_approval', submittedAt }, [
        { user: { email: 'foreman@example.com', fullName: 'Frank Foreman' } },
        { user: { email: 'pm@example.com', fullName: null } },
      ]),
    ).toEqual({
      message: 'Docket submitted for approval',
      docket: {
        id: 'docket-1',
        status: 'pending_approval',
        submittedAt,
      },
      notifiedUsers: [
        { email: 'foreman@example.com', fullName: 'Frank Foreman' },
        { email: 'pm@example.com', fullName: null },
      ],
    });
  });

  it('keeps an empty approver list as an empty notifiedUsers array', () => {
    expect(
      buildDocketSubmittedResponse(
        { id: 'docket-1', status: 'pending_approval', submittedAt: null },
        [],
      ),
    ).toEqual({
      message: 'Docket submitted for approval',
      docket: {
        id: 'docket-1',
        status: 'pending_approval',
        submittedAt: null,
      },
      notifiedUsers: [],
    });
  });
});
