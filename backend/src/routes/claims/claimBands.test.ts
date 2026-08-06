import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';

import {
  BAND_UNAVAILABLE,
  CLAIM_HISTORY_STATUSES,
  amountToCents,
  buildClaimBands,
  buildClaimLineDerivation,
  buildItpProgress,
  foldPriorClaimedLots,
  priorClaimedLotsWhere,
  type ClaimBandLotRow,
} from './claimBands.js';

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

function lotRow(overrides: Partial<ClaimBandLotRow> = {}): ClaimBandLotRow {
  return {
    id: 'claimed-lot-1',
    amountClaimed: decimal('27300.00'),
    percentageComplete: decimal('65'),
    lot: {
      id: 'lot-1',
      lotNumber: 'LOT-001',
      description: 'Subgrade preparation',
      activityType: 'earthworks',
      chainageStart: decimal('120.5'),
      chainageEnd: decimal('340'),
      budgetAmount: decimal('42000.00'),
      itpInstance: null,
    },
    ...overrides,
  };
}

describe('CLAIM_HISTORY_STATUSES', () => {
  it('excludes draft and lists every post-submission claim status', () => {
    expect([...CLAIM_HISTORY_STATUSES]).toEqual([
      'submitted',
      'disputed',
      'certified',
      'partially_paid',
      'paid',
    ]);
    expect(CLAIM_HISTORY_STATUSES).not.toContain('draft');
  });
});

describe('priorClaimedLotsWhere', () => {
  it('restricts history to earlier claims of the same project in a history status', () => {
    const where = priorClaimedLotsWhere('project-1', 4, ['lot-1', 'lot-2']);

    expect(where).toEqual({
      lotId: { in: ['lot-1', 'lot-2'] },
      claim: {
        projectId: 'project-1',
        claimNumber: { lt: 4 },
        status: {
          in: ['submitted', 'disputed', 'certified', 'partially_paid', 'paid'],
        },
      },
    });
  });

  it('excludes drafts and later claims by construction', () => {
    const where = priorClaimedLotsWhere('project-1', 4, ['lot-1']);
    const statuses = (where.claim as { status: { in: string[] } }).status.in;
    const claimNumber = (where.claim as { claimNumber: { lt: number } }).claimNumber;

    // A draft claim can never match: 'draft' is not in the status whitelist.
    expect(statuses).not.toContain('draft');
    // Claim 4 and anything after it can never match: the filter is strictly <.
    expect(claimNumber).toEqual({ lt: 4 });
  });
});

describe('amountToCents — decimal safety', () => {
  it('rounds each stored amount to cents half-up, where naive float math is wrong', () => {
    // 1.005 is not representable in binary floating point; the nearest double is
    // slightly BELOW it, so Math.round(1.005 * 100) yields 100, not 101.
    expect(Math.round(1.005 * 100)).toBe(100);
    expect(amountToCents(decimal('1.005'))).toBe(101);
  });

  it('returns null for a missing amount rather than coercing it to zero', () => {
    expect(amountToCents(null)).toBeNull();
    expect(amountToCents(undefined)).toBeNull();
  });
});

describe('foldPriorClaimedLots', () => {
  it('sums prior amounts in integer cents where naive float summation would differ', () => {
    const amounts = ['100.005', '10.005', '1.005'];

    // Naive float aggregation (what the frontend must never do):
    const naiveFloatCents = Math.round(amounts.reduce((sum, v) => sum + Number(v), 0) * 100);
    expect(naiveFloatCents).toBe(11101);

    const folded = foldPriorClaimedLots(
      amounts.map((amount) => ({
        lotId: 'lot-1',
        amountClaimed: decimal(amount),
        percentageComplete: decimal('10'),
      })),
    );

    // Policy: each stored amount rounds to cents ONCE (half-up), then the cents
    // are summed as integers. 10001 + 1001 + 101.
    expect(folded.amount.cents).toBe(11103);
    expect(folded.amount.cents).not.toBe(naiveFloatCents);
    expect(folded.amount.percentage).toBe(30);
    expect(folded.claimCount).toBe(3);
  });

  it('marks the band unavailable when any prior line has no recorded amount', () => {
    const folded = foldPriorClaimedLots([
      { lotId: 'lot-1', amountClaimed: decimal('100.00'), percentageComplete: decimal('50') },
      { lotId: 'lot-1', amountClaimed: null, percentageComplete: decimal('10') },
    ]);

    expect(folded.amount.cents).toBeNull();
    expect(folded.amount.unavailableReason).toBe(BAND_UNAVAILABLE.priorLineHasNoAmount);
  });

  it('reports zero (not unavailable) when a lot has no claim history', () => {
    const folded = foldPriorClaimedLots([]);
    expect(folded.amount.cents).toBe(0);
    expect(folded.amount.unavailableReason).toBeNull();
    expect(folded.claimCount).toBe(0);
  });
});

describe('buildClaimLineDerivation', () => {
  it('reports percent-of-budget only when that arithmetic reproduces the stored amount', () => {
    const derivation = buildClaimLineDerivation({
      amountClaimed: decimal('27300.00'),
      percentageComplete: decimal('65'),
      lotBudgetAmount: decimal('42000.00'),
    });

    expect(derivation).toEqual({
      basis: 'percent_of_lot_budget',
      percentage: 65,
      lotBudgetCents: 4200000,
    });
  });

  it('degrades to recorded-amount when the lot budget no longer reproduces the figure', () => {
    // The lot budget was edited after the claim was raised.
    const derivation = buildClaimLineDerivation({
      amountClaimed: decimal('27300.00'),
      percentageComplete: decimal('65'),
      lotBudgetAmount: decimal('50000.00'),
    });

    expect(derivation.basis).toBe('recorded_amount');
  });

  it('degrades to recorded-amount when the lot has no budget', () => {
    expect(
      buildClaimLineDerivation({
        amountClaimed: decimal('100.00'),
        percentageComplete: decimal('50'),
        lotBudgetAmount: null,
      }).basis,
    ).toBe('recorded_amount');
  });
});

describe('buildItpProgress', () => {
  it('counts done and N/A items but not rejected or unverified ones', () => {
    expect(
      buildItpProgress({
        completions: [
          { status: 'completed', verificationStatus: 'verified' },
          { status: 'not_applicable', verificationStatus: 'none' },
          { status: 'completed', verificationStatus: 'rejected' },
          { status: 'completed', verificationStatus: 'pending_verification' },
          { status: 'pending', verificationStatus: 'none' },
        ],
        template: { _count: { checklistItems: 20 } },
      }),
    ).toEqual({ completed: 2, total: 20 });
  });

  it('is null when the lot has no ITP', () => {
    expect(buildItpProgress(null)).toBeNull();
  });
});

describe('buildClaimBands', () => {
  it('derives the three bands and reconciles previously + this = to date', () => {
    const bands = buildClaimBands({
      claimedLots: [lotRow()],
      priorRows: [
        { lotId: 'lot-1', amountClaimed: decimal('8400.00'), percentageComplete: decimal('20') },
      ],
      priorClaimCount: 1,
      claim: { totalClaimedAmount: null, certifiedAmount: null, paidAmount: null },
    });

    const [line] = bands.lines;
    expect(line.previouslyClaimed.cents).toBe(840000);
    expect(line.thisClaim.cents).toBe(2730000);
    expect(line.claimedToDate.cents).toBe(840000 + 2730000);
    expect(line.claimedToDate.percentage).toBe(85);
    expect(line.priorClaimCount).toBe(1);
    expect(bands.priorClaimCount).toBe(1);
    expect(bands.lineTotals.claimedToDate.cents).toBe(3570000);
  });

  it('renders a legacy line with a null amount as unavailable, never as $0', () => {
    const bands = buildClaimBands({
      claimedLots: [lotRow({ amountClaimed: null, percentageComplete: null })],
      priorRows: [],
      priorClaimCount: 0,
      claim: { totalClaimedAmount: null, certifiedAmount: null, paidAmount: null },
    });

    const [line] = bands.lines;
    expect(line.thisClaim.cents).toBeNull();
    expect(line.thisClaim.unavailableReason).toBe(BAND_UNAVAILABLE.thisLineHasNoAmount);
    // Claimed to date depends on a missing figure, so it is not derived either.
    expect(line.claimedToDate.cents).toBeNull();
    expect(line.claimedToDate.unavailableReason).toBe(BAND_UNAVAILABLE.dependsOnMissingAmount);
    // And the column total refuses to silently skip the row.
    expect(bands.lineTotals.thisClaim.cents).toBeNull();
    expect(line.derivation.basis).toBe('recorded_amount');
  });

  it('produces no lot lines and no fabricated totals for a variation-only claim', () => {
    const bands = buildClaimBands({
      claimedLots: [],
      priorRows: [],
      priorClaimCount: 0,
      claim: { totalClaimedAmount: null, certifiedAmount: null, paidAmount: null },
    });

    expect(bands.lines).toEqual([]);
    // The lot-line subtotal is a true zero: there are no lot lines. It is NOT
    // presented as the claim total, which also carries variation value.
    expect(bands.lineTotals.thisClaim.cents).toBe(0);
    expect(bands.lineTotals.claimedToDate.cents).toBe(0);
    expect(bands.priorClaimCount).toBe(0);
  });

  it('never emits a per-line certified figure', () => {
    const bands = buildClaimBands({
      claimedLots: [lotRow()],
      priorRows: [],
      priorClaimCount: 0,
      claim: { totalClaimedAmount: null, certifiedAmount: null, paidAmount: null },
    });

    expect(Object.keys(bands.lines[0])).not.toContain('certified');
    expect(Object.keys(bands.lineTotals)).toEqual([
      'previouslyClaimed',
      'thisClaim',
      'claimedToDate',
    ]);
  });
});
