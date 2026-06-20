import { describe, expect, it } from 'vitest';

import { canAdvanceTestStatus } from './constants';

describe('test workflow status actions', () => {
  it('allows result entry before a certificate is attached', () => {
    expect(canAdvanceTestStatus({ status: 'requested', certificateDocId: null })).toBe(true);
  });

  it('requires a certificate before an entered test can be verified', () => {
    expect(canAdvanceTestStatus({ status: 'entered', certificateDocId: null })).toBe(false);
    expect(canAdvanceTestStatus({ status: 'entered', certificateDocId: 'doc-1' })).toBe(true);
  });

  it('does not expose an advance action for terminal statuses', () => {
    expect(canAdvanceTestStatus({ status: 'verified', certificateDocId: 'doc-1' })).toBe(false);
  });
});
