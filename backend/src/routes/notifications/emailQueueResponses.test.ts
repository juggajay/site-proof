import { describe, expect, it } from 'vitest';
import { buildEmailQueueClearedResponse, buildEmailQueueResponse } from './emailQueueResponses.js';

describe('email queue response helpers', () => {
  it('wraps queued emails with the count used by diagnostics UI', () => {
    const emails = [
      { to: 'one@example.com', subject: 'One' },
      { to: 'two@example.com', subject: 'Two' },
    ];

    expect(buildEmailQueueResponse(emails)).toEqual({
      emails,
      count: 2,
    });
  });

  it('preserves the empty queue shape', () => {
    expect(buildEmailQueueResponse([])).toEqual({
      emails: [],
      count: 0,
    });
  });

  it('preserves the queue-cleared response contract', () => {
    expect(buildEmailQueueClearedResponse()).toEqual({
      success: true,
      message: 'Email queue cleared',
    });
  });
});
