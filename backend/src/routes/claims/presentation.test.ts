import { describe, expect, it } from 'vitest';
import { mapClaimCreateItem, mapClaimListItem, mapClaimableLot } from './presentation.js';

describe('mapClaimableLot', () => {
  it('preserves the claimable-lot response shape', () => {
    expect(
      mapClaimableLot({
        id: 'lot-1',
        lotNumber: 'LOT-001',
        activityType: 'Earthworks',
        budgetAmount: '1250.50',
      }),
    ).toEqual({
      id: 'lot-1',
      lotNumber: 'LOT-001',
      activity: 'Earthworks',
      budgetAmount: 1250.5,
    });
  });

  it('falls back missing lot budgets to zero', () => {
    expect(
      mapClaimableLot({
        id: 'lot-2',
        lotNumber: 'LOT-002',
        activityType: 'Drainage',
        budgetAmount: null,
      }).budgetAmount,
    ).toBe(0);
  });
});

describe('mapClaimListItem', () => {
  it('preserves list item date and amount formatting', () => {
    expect(
      mapClaimListItem({
        id: 'claim-1',
        claimNumber: 7,
        claimPeriodStart: new Date('2026-05-01T10:00:00.000Z'),
        claimPeriodEnd: new Date('2026-05-31T10:00:00.000Z'),
        status: 'certified',
        totalClaimedAmount: '48000.25',
        certifiedAmount: '47000.10',
        paidAmount: '1000',
        submittedAt: new Date('2026-06-01T12:00:00.000Z'),
        disputeNotes: 'Variation pending',
        disputedAt: new Date('2026-06-02T12:00:00.000Z'),
        _count: { claimedLots: 3 },
      }),
    ).toEqual({
      id: 'claim-1',
      claimNumber: 7,
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      status: 'certified',
      totalClaimedAmount: 48000.25,
      certifiedAmount: 47000.1,
      paidAmount: 1000,
      submittedAt: '2026-06-01',
      disputeNotes: 'Variation pending',
      disputedAt: '2026-06-02',
      lotCount: 3,
    });
  });

  it('preserves nullish optional commercial fields', () => {
    const result = mapClaimListItem({
      id: 'claim-2',
      claimNumber: 8,
      claimPeriodStart: new Date('2026-05-01T10:00:00.000Z'),
      claimPeriodEnd: new Date('2026-05-31T10:00:00.000Z'),
      status: 'draft',
      totalClaimedAmount: null,
      certifiedAmount: 0,
      paidAmount: null,
      submittedAt: null,
      disputeNotes: '',
      disputedAt: null,
      _count: { claimedLots: 0 },
    });

    expect(result).toMatchObject({
      totalClaimedAmount: 0,
      certifiedAmount: null,
      paidAmount: null,
      submittedAt: null,
      disputeNotes: null,
      disputedAt: null,
      lotCount: 0,
    });
  });
});

describe('mapClaimCreateItem', () => {
  it('preserves the claim-created response shape expected by the frontend', () => {
    expect(
      mapClaimCreateItem({
        id: 'claim-3',
        claimNumber: 9,
        claimPeriodStart: new Date('2026-06-01T12:00:00.000Z'),
        claimPeriodEnd: new Date('2026-06-30T12:00:00.000Z'),
        status: 'draft',
        totalClaimedAmount: '250000.40',
        _count: { claimedLots: 2 },
      }),
    ).toEqual({
      id: 'claim-3',
      claimNumber: 9,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      status: 'draft',
      totalClaimedAmount: 250000.4,
      certifiedAmount: null,
      paidAmount: null,
      submittedAt: null,
      lotCount: 2,
    });
  });

  it('falls back nullish created-claim totals to zero', () => {
    expect(
      mapClaimCreateItem({
        id: 'claim-4',
        claimNumber: 10,
        claimPeriodStart: new Date('2026-06-01T12:00:00.000Z'),
        claimPeriodEnd: new Date('2026-06-30T12:00:00.000Z'),
        status: 'draft',
        totalClaimedAmount: null,
        _count: { claimedLots: 0 },
      }).totalClaimedAmount,
    ).toBe(0);
  });
});
