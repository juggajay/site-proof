import { describe, expect, it } from 'vitest';
import { STATUS_LABELS, VALID_STATUS_TRANSITIONS } from './statusWorkflow.js';

describe('test result status workflow maps', () => {
  it('keeps verified as a terminal state with no outgoing transitions', () => {
    expect(VALID_STATUS_TRANSITIONS.verified).toEqual([]);
  });

  it('preserves the requested -> at_lab -> results_received -> entered -> verified chain', () => {
    expect(VALID_STATUS_TRANSITIONS.requested).toEqual(['at_lab']);
    expect(VALID_STATUS_TRANSITIONS.at_lab).toEqual(['results_received']);
    expect(VALID_STATUS_TRANSITIONS.results_received).toEqual(['entered']);
    expect(VALID_STATUS_TRANSITIONS.entered).toEqual(['verified']);
  });

  it('exposes the exact status labels used in transition error details', () => {
    expect(STATUS_LABELS).toEqual({
      requested: 'Requested',
      at_lab: 'At Lab',
      results_received: 'Results Received',
      entered: 'Entered',
      verified: 'Verified',
    });
  });

  it('keeps the status key set aligned between transitions and labels', () => {
    const expectedKeys = ['requested', 'at_lab', 'results_received', 'entered', 'verified'];
    expect(Object.keys(VALID_STATUS_TRANSITIONS)).toEqual(expectedKeys);
    expect(Object.keys(STATUS_LABELS)).toEqual(expectedKeys);
  });
});
