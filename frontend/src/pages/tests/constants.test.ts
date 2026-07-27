import { describe, expect, it } from 'vitest';

import { canAdvanceTestStatus, canSendToLab, nextStatusMap } from './constants';

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

// AT-79 (Wave C2 Phase 2 [C2R-B1]): 'at_lab' had been a visible-but-unreachable
// status since ticket T2 — it was only ever a *source* in nextStatusMap.
describe('send to lab', () => {
  it('is offered only for a requested test', () => {
    expect(canSendToLab({ status: 'requested' })).toBe(true);

    for (const status of ['at_lab', 'results_received', 'entered', 'verified']) {
      expect(canSendToLab({ status })).toBe(false);
    }
  });

  it('leaves the primary advance target unchanged for every status [C2L-h]', () => {
    // Send to lab is a secondary action, NOT a nextStatusMap entry: the map
    // means "the mandatory next step" and the lab hop is optional.
    expect(nextStatusMap).toEqual({
      requested: 'entered',
      at_lab: 'entered',
      results_received: 'entered',
      entered: 'verified',
    });
  });
});
