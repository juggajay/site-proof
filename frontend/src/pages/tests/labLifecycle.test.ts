import { describe, it, expect } from 'vitest';
import { getLabWait, formatLabWait } from './constants';
import type { TestResult } from './types';

const NOW = '2026-07-28T03:00:00.000Z';

const atLab = (
  overrides: Partial<TestResult> = {},
): Pick<TestResult, 'status' | 'sentToLabAt' | 'expectedResultDate'> => ({
  status: 'at_lab',
  sentToLabAt: '2026-06-28T00:00:00.000Z', // 30 days before NOW
  expectedResultDate: null,
  ...overrides,
});

describe('getLabWait (Wave C2 Phase 3, spec §3.3.4)', () => {
  // AT-70 [C2L-B9]: elapsed is a FACT and is always shown; "overdue" is a
  // JUDGEMENT and only ever appears where a human supplied the date. CIVOS has
  // no basis to invent a turnaround (J5), so a 30-day wait with no expected date
  // is not late — it is 30 days.
  it('AT-70: 30 days at lab with no expected date shows elapsed and is NOT overdue', () => {
    const wait = getLabWait(atLab(), NOW);
    expect(wait).toEqual({ elapsedDays: 30, overdue: false });
    expect(formatLabWait(wait!)).toBe('at lab 30 days');
  });

  it('AT-70: the same row IS overdue once a user sets a date in the past', () => {
    const wait = getLabWait(atLab({ expectedResultDate: '2026-07-20' }), NOW);
    expect(wait).toEqual({ elapsedDays: 30, overdue: true });
    expect(formatLabWait(wait!)).toBe('at lab 30 days · overdue');
  });

  it('AT-70: a future expected date is not overdue, and today is not overdue', () => {
    expect(getLabWait(atLab({ expectedResultDate: '2026-08-05' }), NOW)?.overdue).toBe(false);
    expect(getLabWait(atLab({ expectedResultDate: '2026-07-28' }), NOW)?.overdue).toBe(false);
  });

  // Overdue is scoped to at_lab: once the result is back, a stale expected date
  // must not keep shouting.
  it('a row that has left at_lab still shows elapsed but is never overdue', () => {
    const wait = getLabWait(atLab({ status: 'entered', expectedResultDate: '2026-07-01' }), NOW);
    expect(wait).toEqual({ elapsedDays: 30, overdue: false });
  });

  it('renders nothing at all when the sample was never sent to a lab', () => {
    expect(
      getLabWait({ status: 'requested', sentToLabAt: null, expectedResultDate: null }, NOW),
    ).toBeNull();
  });

  it('says "1 day", not "1 days"', () => {
    const wait = getLabWait(atLab({ sentToLabAt: '2026-07-27T00:00:00.000Z' }), NOW);
    expect(formatLabWait(wait!)).toBe('at lab 1 day');
  });
});
