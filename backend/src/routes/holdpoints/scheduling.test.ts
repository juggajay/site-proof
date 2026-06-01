import { describe, expect, it } from 'vitest';
import { calculateNotificationTime, calculateWorkingDays } from './scheduling.js';

/**
 * Characterizes the pure hold-point scheduling helpers extracted verbatim from
 * backend/src/routes/holdpoints.ts. These freeze the working-hours adjustment
 * logic (branch order, the next-working-day roll-forward, the exact reason
 * strings) and the working-day count between two dates.
 *
 * Every Date is built with the LOCAL constructor `new Date(y, mIdx, d, h, m)`
 * rather than an ISO string, because the implementation reads/writes local-time
 * fields (getHours/getDay/setHours/toDateString). Local construction makes the
 * inputs — and therefore these assertions — independent of the machine/CI
 * timezone. No database is touched: scheduling.ts has no imports.
 *
 * Calendar anchors used below (verified): 2026-06-01 Mon, -05 Fri, -06 Sat,
 * -07 Sun, -08 Mon. Default config is 07:00–17:00, working days Mon–Fri.
 */

const JUNE = 5; // zero-based month index for June

describe('calculateNotificationTime', () => {
  it('leaves an in-hours weekday request unchanged (no adjustment)', () => {
    const requested = new Date(2026, JUNE, 1, 10, 30, 0); // Mon 10:30
    const result = calculateNotificationTime(requested);

    expect(result.adjustedForWorkingHours).toBe(false);
    expect(result.reason).toBeUndefined();
    // Same instant as the input — nothing was moved.
    expect(result.scheduledTime.getTime()).toBe(requested.getTime());
    expect(result.scheduledTime.getHours()).toBe(10);
    expect(result.scheduledTime.getMinutes()).toBe(30);
  });

  it('moves a before-hours weekday request to the start of working hours, same day', () => {
    const requested = new Date(2026, JUNE, 1, 5, 0, 0); // Mon 05:00
    const result = calculateNotificationTime(requested);

    expect(result.adjustedForWorkingHours).toBe(true);
    expect(result.reason).toBe('Adjusted to start of working hours (07:00)');
    expect(result.scheduledTime.getDate()).toBe(1); // still Mon the 1st
    expect(result.scheduledTime.getDay()).toBe(1);
    expect(result.scheduledTime.getHours()).toBe(7);
    expect(result.scheduledTime.getMinutes()).toBe(0);
  });

  it('moves an after-hours weekday request to the next working day at start of hours', () => {
    const requested = new Date(2026, JUNE, 1, 18, 30, 0); // Mon 18:30 (>= 17:00)
    const result = calculateNotificationTime(requested);

    expect(result.adjustedForWorkingHours).toBe(true);
    expect(result.reason).toBe(
      'Scheduled after hours - moved to next working day (Tue Jun 02 2026) at 07:00',
    );
    expect(result.scheduledTime.getDate()).toBe(2); // Tue the 2nd
    expect(result.scheduledTime.getDay()).toBe(2);
    expect(result.scheduledTime.getHours()).toBe(7);
    expect(result.scheduledTime.getMinutes()).toBe(0);
  });

  it('rolls a Saturday request forward to Monday (skips the weekend)', () => {
    const requested = new Date(2026, JUNE, 6, 10, 0, 0); // Sat 10:00
    const result = calculateNotificationTime(requested);

    expect(result.adjustedForWorkingHours).toBe(true);
    expect(result.reason).toBe('Adjusted to next working day (Mon Jun 08 2026) at 07:00');
    expect(result.scheduledTime.getDate()).toBe(8); // Mon the 8th
    expect(result.scheduledTime.getDay()).toBe(1);
    expect(result.scheduledTime.getHours()).toBe(7);
  });

  it('rolls a Sunday request forward one day to Monday', () => {
    const requested = new Date(2026, JUNE, 7, 10, 0, 0); // Sun 10:00
    const result = calculateNotificationTime(requested);

    expect(result.adjustedForWorkingHours).toBe(true);
    expect(result.reason).toBe('Adjusted to next working day (Mon Jun 08 2026) at 07:00');
    expect(result.scheduledTime.getDate()).toBe(8);
    expect(result.scheduledTime.getDay()).toBe(1);
    expect(result.scheduledTime.getHours()).toBe(7);
  });

  it('honours custom working hours and days passed by the caller', () => {
    // Wed 08:00 with hours 09:00-12:00 -> before-hours adjustment to 09:00.
    const requested = new Date(2026, JUNE, 3, 8, 0, 0); // Wed
    const result = calculateNotificationTime(requested, '09:00', '12:00', '1,2,3,4,5');

    expect(result.adjustedForWorkingHours).toBe(true);
    expect(result.reason).toBe('Adjusted to start of working hours (09:00)');
    expect(result.scheduledTime.getHours()).toBe(9);
    expect(result.scheduledTime.getMinutes()).toBe(0);
  });
});

describe('calculateWorkingDays', () => {
  it('returns 0 when from and to fall on the same calendar day', () => {
    const from = new Date(2026, JUNE, 1, 9, 0, 0);
    const to = new Date(2026, JUNE, 1, 15, 0, 0);
    expect(calculateWorkingDays(from, to)).toBe(0);
  });

  it('counts weekdays in a Mon -> Fri range (excludes the target day)', () => {
    const from = new Date(2026, JUNE, 1); // Mon
    const to = new Date(2026, JUNE, 5); // Fri
    expect(calculateWorkingDays(from, to)).toBe(4);
  });

  it('counts only the working days across a weekend (Fri -> Mon = 1)', () => {
    const from = new Date(2026, JUNE, 5); // Fri
    const to = new Date(2026, JUNE, 8); // Mon
    expect(calculateWorkingDays(from, to)).toBe(1);
  });

  it('returns 0 for a weekend-only range (Sat -> Mon)', () => {
    const from = new Date(2026, JUNE, 6); // Sat
    const to = new Date(2026, JUNE, 8); // Mon
    expect(calculateWorkingDays(from, to)).toBe(0);
  });

  it('counts a full week Mon -> next Mon as 5 working days', () => {
    const from = new Date(2026, JUNE, 1); // Mon
    const to = new Date(2026, JUNE, 8); // next Mon
    expect(calculateWorkingDays(from, to)).toBe(5);
  });

  it('returns 0 when the range is reversed (to is before from)', () => {
    const from = new Date(2026, JUNE, 8);
    const to = new Date(2026, JUNE, 1);
    expect(calculateWorkingDays(from, to)).toBe(0);
  });

  it('respects a custom working-days set (e.g. include Saturday)', () => {
    // Fri -> Mon counting Mon-Sat (1..6): Fri + Sat = 2 working days.
    const from = new Date(2026, JUNE, 5); // Fri
    const to = new Date(2026, JUNE, 8); // Mon
    expect(calculateWorkingDays(from, to, '1,2,3,4,5,6')).toBe(2);
  });
});
