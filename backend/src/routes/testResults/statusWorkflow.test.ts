import { describe, expect, it } from 'vitest';
import {
  hasRecordedResult,
  RESULT_REQUIRED_CODE,
  RESULT_REQUIRED_MESSAGE,
  STATUS_LABELS,
  VALID_STATUS_TRANSITIONS,
} from './statusWorkflow.js';

describe('test result status workflow maps', () => {
  it('keeps verified as a terminal state with no outgoing transitions', () => {
    expect(VALID_STATUS_TRANSITIONS.verified).toEqual([]);
  });

  it('preserves every original forward edge through the linear chain', () => {
    // Ticket T2 widened the map additively; the original chain is still present.
    expect(VALID_STATUS_TRANSITIONS.requested).toContain('at_lab');
    expect(VALID_STATUS_TRANSITIONS.at_lab).toContain('results_received');
    expect(VALID_STATUS_TRANSITIONS.results_received).toEqual(['entered']);
    expect(VALID_STATUS_TRANSITIONS.entered).toEqual(['verified']);
  });

  it('allows the optional-state short path straight to entered (Ticket T2)', () => {
    // The intermediate lab states are skippable: any pre-entered state may jump
    // to 'entered' (still gated on a recorded result by the route layer).
    expect(VALID_STATUS_TRANSITIONS.requested).toEqual(['at_lab', 'results_received', 'entered']);
    expect(VALID_STATUS_TRANSITIONS.at_lab).toEqual(['results_received', 'entered']);
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

describe('hasRecordedResult (Ticket T2 result gate)', () => {
  it('is true only with a non-null result value AND a definitive pass/fail', () => {
    expect(hasRecordedResult({ resultValue: 98.5, passFail: 'pass' })).toBe(true);
    expect(hasRecordedResult({ resultValue: 12, passFail: 'fail' })).toBe(true);
    // Zero is a legitimate result value, not "blank".
    expect(hasRecordedResult({ resultValue: 0, passFail: 'pass' })).toBe(true);
  });

  it('is false for a blank result value', () => {
    expect(hasRecordedResult({ resultValue: null, passFail: 'pass' })).toBe(false);
    expect(hasRecordedResult({ resultValue: undefined, passFail: 'fail' })).toBe(false);
  });

  it('is false for a pending or unknown pass/fail outcome', () => {
    expect(hasRecordedResult({ resultValue: 98.5, passFail: 'pending' })).toBe(false);
    expect(hasRecordedResult({ resultValue: 98.5, passFail: '' })).toBe(false);
    expect(hasRecordedResult({ resultValue: 98.5, passFail: 'maybe' })).toBe(false);
  });

  it('exposes a stable RESULT_REQUIRED code and message for the gate', () => {
    expect(RESULT_REQUIRED_CODE).toBe('RESULT_REQUIRED');
    expect(RESULT_REQUIRED_MESSAGE).toContain('pass/fail');
  });
});
