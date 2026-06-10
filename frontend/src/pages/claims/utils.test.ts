import { describe, expect, it } from 'vitest';
import {
  addBusinessDays,
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
import type { Claim, ConformedLot } from './types';

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
    expect(calculateLotClaimAmount(makeLot({ budgetAmount: null, percentComplete: '30' }))).toBe(0);
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
  // deterministic. addBusinessDays skips Sat/Sun only.
  const submittedAt = '2026-06-01T00:00:00.000Z';

  it('uses NSW timeframes (10 cert / 15 payment business days) for NSW projects', () => {
    expect(calculateCertificationDueDate(submittedAt, 'NSW')).toBe(
      addBusinessDays(new Date(submittedAt), 10).toISOString(),
    );
    expect(calculatePaymentDueDate(submittedAt, 'NSW')).toBe(
      addBusinessDays(new Date(submittedAt), 15).toISOString(),
    );
  });

  it('uses WA timeframes (15 cert / 20 payment business days) for WA projects', () => {
    expect(calculateCertificationDueDate(submittedAt, 'WA')).toBe(
      addBusinessDays(new Date(submittedAt), 15).toISOString(),
    );
    expect(calculatePaymentDueDate(submittedAt, 'WA')).toBe(
      addBusinessDays(new Date(submittedAt), 20).toISOString(),
    );
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
    expect(calculateCertificationDueDate(submittedAt, 'QLD')).toBe(
      addBusinessDays(new Date(submittedAt), 15).toISOString(),
    );
    expect(calculatePaymentDueDate(submittedAt, 'QLD')).toBe(
      addBusinessDays(new Date(submittedAt), 10).toISOString(),
    );
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
    // Payment uses "Overdue by N days"; certification uses
    // "Certification overdue by N days".
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
    expect(overdueDays(nswCert?.text)).toBeGreaterThan(overdueDays(waCert?.text));
  });
});
