import { describe, expect, it, vi } from 'vitest';
import {
  addBusinessDays,
  calendarDaysUntil,
  calculateCertificationDueDate,
  calculateLotClaimAmount,
  calculatePaymentDueDate,
  getCertificationDueStatus,
  getClaimIncrementError,
  getClaimPercentageError,
  getClaimPeriodError,
  getPaymentDueStatus,
  parseClaimPercentageInput,
} from './utils';
import { toLocalDateKey } from './sopaBusinessDays';
import type { Claim, ConformedLot } from './types';

describe('calendarDaysUntil (M41 SOPA day-floor)', () => {
  it('counts whole calendar days and is stable across the project-timezone day', () => {
    const due = '2026-06-13';
    // `now` is written as an INSTANT with its Sydney wall time named, because
    // "the same all day" now means the same across the PROJECT timezone's day
    // (M4) — not the machine's. These used to be `new Date(2026, 5, 10, ...)`
    // local-time fixtures, which silently meant a different day off AEST.
    // June = AEST (UTC+10), no DST.
    const sydney = (iso: string) => new Date(iso);

    // Same Sydney calendar day (10 June) at very different times => identical countdown.
    expect(calendarDaysUntil(due, sydney('2026-06-09T14:01:00.000Z'))).toBe(3); // 10 Jun 00:01
    expect(calendarDaysUntil(due, sydney('2026-06-10T13:59:00.000Z'))).toBe(3); // 10 Jun 23:59
    // Due today => 0 (not -1 just because it's the afternoon).
    expect(calendarDaysUntil(due, sydney('2026-06-13T05:00:00.000Z'))).toBe(0); // 13 Jun 15:00
    // Past the due date => negative whole days.
    expect(calendarDaysUntil(due, sydney('2026-06-14T23:00:00.000Z'))).toBe(-2); // 15 Jun 09:00
  });
});

/**
 * M4 (fable deep review 2026-07-28) — a SOPA payment-schedule deadline is a
 * statutory date in the project's jurisdiction. It used to be computed entirely
 * in BROWSER-local time: `new Date(submittedAt)` anchored the business-day walk
 * on the viewer's calendar date, `isSopaNonWorkingDay` read the weekday off the
 * viewer's clock, and the countdown floored to the viewer's midnight. A Perth
 * viewer and a Sydney viewer therefore read different legal due dates for the
 * same claim.
 *
 * Every instant below is deliberately one that falls on DIFFERENT calendar days
 * in Sydney and Perth (14:00Z = 00:00 next-day AEST, 22:00 same-day AWST), so
 * the two viewers are genuinely disagreeing rather than trivially agreeing. The
 * expected values are hard literals, worked from the NSW calendar, not a second
 * call to the code under test.
 */
describe('SOPA due dates are anchored on the project timezone, not the viewer', () => {
  /**
   * Two viewers, one claim. `process.env.TZ` is what Node reads for local-time
   * Date construction, so this is a real timezone swap, not a mock — restored
   * even on failure so it cannot leak into another file in the pool.
   */
  function inTimeZone<T>(timeZone: string, fn: () => T): T {
    const original = process.env.TZ;
    process.env.TZ = timeZone;
    try {
      return fn();
    } finally {
      process.env.TZ = original;
    }
  }

  it('sanity: the fixture instants really are different calendar days in Sydney and Perth', () => {
    // Positive control. If this ever stops holding, the assertions below would
    // pass for the wrong reason (two identical anchors agreeing trivially).
    const instant = '2026-08-04T14:00:00.000Z';
    expect(inTimeZone('Australia/Sydney', () => new Date(instant).getDate())).toBe(5);
    expect(inTimeZone('Australia/Perth', () => new Date(instant).getDate())).toBe(4);
  });

  it('gives Sydney and Perth viewers the same due date for a claim submitted at the day boundary', () => {
    // 2026-08-04T14:00Z = Wed 5 Aug 00:00 in Sydney, Tue 4 Aug 22:00 in Perth.
    // The statutory anchor is the Sydney date, Wed 5 Aug.
    const submittedAt = '2026-08-04T14:00:00.000Z';

    // NSW: 10 business days to a payment schedule, 15 to payment. No NSW public
    // holiday falls in the span (the Aug Bank Holiday is Mon 3 Aug, before it).
    const expectedCert = '2026-08-19';
    const expectedPayment = '2026-08-26';

    for (const timeZone of ['Australia/Sydney', 'Australia/Perth', 'UTC', 'America/New_York']) {
      expect(inTimeZone(timeZone, () => calculateCertificationDueDate(submittedAt, 'NSW'))).toBe(
        expectedCert,
      );
      expect(inTimeZone(timeZone, () => calculatePaymentDueDate(submittedAt, 'NSW'))).toBe(
        expectedPayment,
      );
    }
  });

  it('does not let the viewer flip the anchor across a weekend boundary', () => {
    // The `isSopaNonWorkingDay` limb: 2026-08-09T14:00Z is Mon 10 Aug in Sydney
    // but Sun 9 Aug in Perth. A Sunday anchor makes Mon 10 Aug the FIRST
    // business day; a Monday anchor makes Tue 11 Aug the first. That one-day
    // slip used to travel all the way through to the rendered deadline.
    const submittedAt = '2026-08-09T14:00:00.000Z';
    const expectedCert = '2026-08-24'; // Mon 10 Aug + 10 NSW business days

    expect(
      inTimeZone('Australia/Sydney', () => calculateCertificationDueDate(submittedAt, 'NSW')),
    ).toBe(expectedCert);
    expect(
      inTimeZone('Australia/Perth', () => calculateCertificationDueDate(submittedAt, 'NSW')),
    ).toBe(expectedCert);
  });

  it('counts the days remaining off the project timezone today, not the viewer today', () => {
    // 2026-08-20T14:00Z is Fri 21 Aug in Sydney, Thu 20 Aug in Perth. One claim,
    // one due date: both viewers have five days, not five and six.
    const now = new Date('2026-08-20T14:00:00.000Z');

    expect(inTimeZone('Australia/Sydney', () => calendarDaysUntil('2026-08-26', now))).toBe(5);
    expect(inTimeZone('Australia/Perth', () => calendarDaysUntil('2026-08-26', now))).toBe(5);
  });

  it('renders one due-date chip for both viewers, end to end', () => {
    const submittedAt = '2026-08-04T14:00:00.000Z';
    const claim: Claim = {
      id: 'claim-1',
      claimNumber: 1,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      status: 'submitted',
      totalClaimedAmount: 1000,
      certifiedAmount: null,
      paidAmount: null,
      submittedAt,
      projectState: 'NSW',
      disputeNotes: null,
      disputedAt: null,
      lotCount: 1,
    };

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-20T14:00:00.000Z'));
      const sydney = inTimeZone('Australia/Sydney', () => getPaymentDueStatus(claim));
      const perth = inTimeZone('Australia/Perth', () => getPaymentDueStatus(claim));

      // The date is printed from the statutory calendar date, so it is not the
      // viewer's rendering of an instant.
      expect(sydney?.text).toBe('Due 26/08/2026');
      expect(perth?.text).toBe(sydney?.text);
    } finally {
      vi.useRealTimers();
    }
  });
});

function makeLot(overrides: Partial<ConformedLot> = {}): ConformedLot {
  return {
    id: 'lot-1',
    lotNumber: 'LOT-001',
    activity: 'Earthworks',
    budgetAmount: 100000,
    selected: true,
    percentComplete: '50',
    claimedPercentage: 0,
    remainingPercentage: 100,
    ...overrides,
  };
}

describe('claim percentage parsing', () => {
  it('parses decimals in range and rejects out-of-range or invalid input', () => {
    expect(parseClaimPercentageInput('50.5')).toBe(50.5);
    expect(parseClaimPercentageInput('0')).toBe(0);
    expect(parseClaimPercentageInput('100')).toBe(100);
    expect(parseClaimPercentageInput('100.1')).toBeNull();
    expect(parseClaimPercentageInput('abc')).toBeNull();
    expect(parseClaimPercentageInput('')).toBeNull();
  });
});

describe('calculateLotClaimAmount', () => {
  it("computes this claim's increment of the budget", () => {
    expect(calculateLotClaimAmount(makeLot({ percentComplete: '30' }))).toBe(30000);
  });

  it('returns null for a lot with no budget instead of a confident $0', () => {
    expect(
      calculateLotClaimAmount(makeLot({ budgetAmount: null, percentComplete: '30' })),
    ).toBeNull();
  });
});

describe('getClaimIncrementError', () => {
  it('accepts an increment within the remaining percentage', () => {
    expect(getClaimIncrementError('40', 60)).toBeNull();
    expect(getClaimIncrementError('60', 60)).toBeNull();
  });

  it('rejects an increment above the remaining percentage', () => {
    expect(getClaimIncrementError('61', 60)).toBe('Only 60% of this lot is left to claim.');
    expect(getClaimIncrementError('100', 49.5)).toBe('Only 49.5% of this lot is left to claim.');
  });

  it('still applies the base 0-100 and required validations', () => {
    expect(getClaimIncrementError('', 100)).toBe(getClaimPercentageError(''));
    expect(getClaimIncrementError('100.1', 100)).toBe(getClaimPercentageError('100.1'));
  });

  it('tolerates tiny floating-point drift at the remaining boundary', () => {
    expect(getClaimIncrementError('33.34', 33.33999)).toBeNull();
  });
});

describe('getClaimPeriodError', () => {
  it('accepts an ordered period, including a single-day period', () => {
    expect(getClaimPeriodError('2026-06-01', '2026-06-30')).toBeNull();
    expect(getClaimPeriodError('2026-06-01', '2026-06-01')).toBeNull();
  });

  it('rejects a period that ends before it starts (mirrors the backend rule)', () => {
    expect(getClaimPeriodError('2026-06-10', '2026-06-01')).toBe(
      'Period end must be on or after period start.',
    );
  });

  it('requires both dates', () => {
    expect(getClaimPeriodError('', '2026-06-30')).toBe('Period start and period end are required.');
    expect(getClaimPeriodError('2026-06-01', '')).toBe('Period start and period end are required.');
    expect(getClaimPeriodError('', '')).toBe('Period start and period end are required.');
  });
});

describe('SOPA due dates by project state', () => {
  // Submitted on Mon 2026-06-01 (a non-weekend) so business-day counting is
  // deterministic. Now that state calendars are populated, the reference
  // calculation must also use the state so holidays are counted consistently.
  const submittedAt = '2026-06-01T00:00:00.000Z';

  // The reference calculation anchors on the LOCAL parts of Mon 1 Jun 2026 —
  // which is the project-timezone calendar date of `submittedAt` — so the
  // expectation is timezone-stable, like the code under test (M4).
  const reference = (days: number, state?: string) =>
    toLocalDateKey(addBusinessDays(new Date(2026, 5, 1), days, state));

  it('uses NSW timeframes (10 cert / 15 payment business days) for NSW projects', () => {
    // NSW King's Birthday (Mon 8 Jun) falls within both windows, so state-aware
    // addBusinessDays is used as the reference to match calculateCertificationDueDate.
    expect(calculateCertificationDueDate(submittedAt, 'NSW')).toBe(reference(10, 'NSW'));
    expect(calculatePaymentDueDate(submittedAt, 'NSW')).toBe(reference(15, 'NSW'));
  });

  it('uses WA timeframes (15 cert / 20 payment business days) for WA projects', () => {
    expect(calculateCertificationDueDate(submittedAt, 'WA')).toBe(reference(15, 'WA'));
    expect(calculatePaymentDueDate(submittedAt, 'WA')).toBe(reference(20, 'WA'));
  });

  it('WA payment due is later than NSW (the original NSW-for-all bug)', () => {
    const nswDue = calculatePaymentDueDate(submittedAt, 'NSW');
    const waDue = calculatePaymentDueDate(submittedAt, 'WA');
    expect(nswDue).not.toBeNull();
    expect(waDue).not.toBeNull();
    expect(new Date(waDue ?? '').getTime()).toBeGreaterThan(new Date(nswDue ?? '').getTime());
  });

  it('uses QLD timeframes (15 schedule / 10 payment business days) for QLD projects', () => {
    // QLD BIF s76 (schedule 15 BD) / s73 (payment 10 BD default) — the previous
    // 10/15 had these reversed.
    expect(calculateCertificationDueDate(submittedAt, 'QLD')).toBe(reference(15));
    expect(calculatePaymentDueDate(submittedAt, 'QLD')).toBe(reference(10));
  });

  it('suppresses VIC due dates for claims submitted after the 15 Apr 2026 reforms', () => {
    const preReform = '2026-04-14T00:00:00.000Z';
    const postReform = '2026-04-15T00:00:00.000Z';

    expect(calculateCertificationDueDate(preReform, 'VIC')).not.toBeNull();
    expect(calculatePaymentDueDate(preReform, 'VIC')).not.toBeNull();
    expect(calculateCertificationDueDate(postReform, 'VIC')).toBeNull();
    expect(calculatePaymentDueDate(postReform, 'VIC')).toBeNull();
  });

  it('defaults to NSW timeframes when the state is missing/undefined', () => {
    const nswCert = calculateCertificationDueDate(submittedAt, 'NSW');
    const nswPayment = calculatePaymentDueDate(submittedAt, 'NSW');
    expect(calculateCertificationDueDate(submittedAt)).toBe(nswCert);
    expect(calculatePaymentDueDate(submittedAt)).toBe(nswPayment);
  });

  it('returns null for omitted/unrecognised jurisdictions (NT, TAS, ACT, ZZ) instead of faking NSW dates', () => {
    // NT uses the West-Coast model; TAS/ACT were only Low–Med confidence (§F5) so
    // they are omitted from SOPA_TIMEFRAMES. None may silently inherit NSW numbers.
    for (const state of ['NT', 'TAS', 'ACT', 'ZZ']) {
      expect(calculateCertificationDueDate(submittedAt, state)).toBeNull();
      expect(calculatePaymentDueDate(submittedAt, state)).toBeNull();
    }
  });

  it('pins one business-day boundary: +10 business days from a Monday is the Monday 14 calendar days later', () => {
    // Construct the start using local-date parts so the assertion is
    // timezone-stable (addBusinessDays uses local getDay()/setDate()).
    const start = new Date(2026, 5, 1); // Mon 1 Jun 2026, local midnight
    expect(start.getDay()).toBe(1); // sanity: Monday
    const result = addBusinessDays(start, 10);
    // 10 business days over two full weeks = 14 calendar days, same weekday.
    expect(result.getDay()).toBe(1);
    const calendarDays = Math.round((result.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    expect(calendarDays).toBe(14);
  });
});

describe('SOPA due-date staleness guard (H27)', () => {
  it('returns null when the computed due date falls beyond the holiday-table coverage year', () => {
    // The per-state holiday tables only cover 2026–2027. A 2028 submission lands
    // in a year whose public holidays are not modelled, so any computed date
    // would be confidently wrong (too early). Callers must show no due date.
    const beyondCoverage = '2028-03-01T00:00:00.000Z';
    expect(calculateCertificationDueDate(beyondCoverage, 'NSW')).toBeNull();
    expect(calculatePaymentDueDate(beyondCoverage, 'NSW')).toBeNull();
  });

  it('returns null when a late-2027 submission pushes the due date into the uncovered next year', () => {
    // Realistic boundary: a mid-December 2027 claim whose 20-business-day WA
    // payment window crosses into January 2028, where the holiday table is empty.
    const lateInCoverage = '2027-12-15T00:00:00.000Z';
    expect(calculatePaymentDueDate(lateInCoverage, 'WA')).toBeNull();
  });

  it('still computes due dates that stay within the covered years', () => {
    // The upper edge of coverage that stays inside 2027 must keep working.
    const within = '2027-06-01T00:00:00.000Z';
    expect(calculateCertificationDueDate(within, 'NSW')).not.toBeNull();
    expect(calculatePaymentDueDate(within, 'NSW')).not.toBeNull();
  });
});

describe('due-date status helpers thread the project state', () => {
  // Submitted long enough ago that BOTH NSW and WA payment windows have closed,
  // so the comparison is deterministic regardless of the current date: NSW pays
  // in fewer business days, so an NSW claim is overdue by MORE days than the
  // same WA claim. If the helper ignored state (the bug), both would be equal.
  function makeClaim(overrides: Partial<Claim> = {}): Claim {
    return {
      id: 'claim-1',
      claimNumber: 1,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      status: 'submitted',
      totalClaimedAmount: 1000,
      certifiedAmount: null,
      paidAmount: null,
      submittedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
      disputeNotes: null,
      disputedAt: null,
      lotCount: 1,
      ...overrides,
    };
  }

  function overdueDays(text: string | undefined): number {
    // Payment uses "Overdue by N days"; payment-schedule response uses
    // "Payment schedule overdue by N days".
    const match = text?.match(/overdue by (\d+) days/i);
    return match ? Number(match[1]) : NaN;
  }

  it('reports an NSW claim overdue by more days than the same WA claim', () => {
    const nswStatus = getPaymentDueStatus(makeClaim({ projectState: 'NSW' }));
    const waStatus = getPaymentDueStatus(makeClaim({ projectState: 'WA' }));

    expect(nswStatus?.text).toMatch(/Overdue/);
    expect(waStatus?.text).toMatch(/Overdue/);
    // NSW window (15 business days) closes before WA's (20), so it is more overdue.
    expect(overdueDays(nswStatus?.text)).toBeGreaterThan(overdueDays(waStatus?.text));
  });

  it('treats a missing state like NSW (the historical fallback)', () => {
    const fallbackStatus = getPaymentDueStatus(makeClaim({ projectState: null }));
    const nswStatus = getPaymentDueStatus(makeClaim({ projectState: 'NSW' }));
    expect(fallbackStatus?.text).toBe(nswStatus?.text);
  });

  it('certification status also reads the project state', () => {
    const nswCert = getCertificationDueStatus(makeClaim({ projectState: 'NSW' }));
    const waCert = getCertificationDueStatus(makeClaim({ projectState: 'WA' }));
    // NSW certifies in 10 business days, WA in 15 -> NSW more overdue.
    expect(nswCert?.text).toMatch(/^Payment schedule overdue by \d+ days$/);
    expect(overdueDays(nswCert?.text)).toBeGreaterThan(overdueDays(waCert?.text));
  });

  it('does not show stale VIC due-status chips for post-reform submitted claims', () => {
    const submittedAt = '2026-04-15T00:00:00.000Z';

    expect(getCertificationDueStatus(makeClaim({ projectState: 'VIC', submittedAt }))).toBeNull();
    expect(getPaymentDueStatus(makeClaim({ projectState: 'VIC', submittedAt }))).toBeNull();
  });

  it('does not show payment due chips when no certified balance is outstanding', () => {
    const submittedAt = '2026-02-01T00:00:00.000Z';

    expect(
      getPaymentDueStatus(
        makeClaim({
          status: 'certified',
          submittedAt,
          certifiedAmount: 0,
          paidAmount: 0,
        }),
      ),
    ).toBeNull();
    expect(
      getPaymentDueStatus(
        makeClaim({
          status: 'certified',
          submittedAt,
          certifiedAmount: 1000,
          paidAmount: 1000,
        }),
      ),
    ).toBeNull();
  });
});
