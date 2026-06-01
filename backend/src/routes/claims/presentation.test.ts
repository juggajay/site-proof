import { describe, expect, it } from 'vitest';
import {
  buildClaimCertifiedResponse,
  buildClaimPaymentRecordedResponse,
  mapClaimCertificationItem,
  mapClaimCreateItem,
  mapClaimListItem,
  mapClaimPaymentItem,
  mapClaimableLot,
} from './presentation.js';

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

describe('claim certification presentation', () => {
  const certifiedClaim = {
    id: 'claim-5',
    claimNumber: 12,
    claimPeriodStart: new Date('2026-06-01T10:00:00.000Z'),
    claimPeriodEnd: new Date('2026-06-30T10:00:00.000Z'),
    status: 'certified',
    totalClaimedAmount: '48000.25',
    certifiedAmount: '47000.10',
    certifiedAt: new Date('2026-07-02T03:04:05.000Z'),
    paidAmount: null,
    claimedLots: [{ id: 'lot-1' }, { id: 'lot-2' }],
  };

  it('preserves the certified-claim response item shape', () => {
    expect(
      mapClaimCertificationItem(certifiedClaim, 'Variation approved', 'certification-document-1'),
    ).toEqual({
      id: 'claim-5',
      claimNumber: 12,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      status: 'certified',
      totalClaimedAmount: 48000.25,
      certifiedAmount: 47000.1,
      certifiedAt: '2026-07-02T03:04:05.000Z',
      paidAmount: null,
      lotCount: 2,
      variationNotes: 'Variation approved',
      certificationDocumentId: 'certification-document-1',
    });
  });

  it('wraps the certified claim with previous status and success message', () => {
    expect(buildClaimCertifiedResponse(certifiedClaim, 'submitted', undefined, null)).toMatchObject(
      {
        previousStatus: 'submitted',
        message: 'Claim certified successfully',
        claim: {
          variationNotes: null,
          certificationDocumentId: null,
        },
      },
    );
  });
});

describe('claim payment presentation', () => {
  const paidClaim = {
    id: 'claim-5',
    claimNumber: 12,
    claimPeriodStart: new Date('2026-06-01T10:00:00.000Z'),
    claimPeriodEnd: new Date('2026-06-30T10:00:00.000Z'),
    status: 'partially_paid',
    totalClaimedAmount: '48000.25',
    certifiedAmount: '47000.10',
    paidAmount: '12000',
    paidAt: new Date('2026-07-05T04:05:06.000Z'),
    paymentReference: 'EFT-123',
    claimedLots: [{ id: 'lot-1' }, { id: 'lot-2' }],
  };

  it('preserves the paid-claim response item shape', () => {
    expect(mapClaimPaymentItem(paidClaim)).toEqual({
      id: 'claim-5',
      claimNumber: 12,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      status: 'partially_paid',
      totalClaimedAmount: 48000.25,
      certifiedAmount: 47000.1,
      paidAmount: 12000,
      paidAt: '2026-07-05T04:05:06.000Z',
      paymentReference: 'EFT-123',
      lotCount: 2,
    });
  });

  it('preserves partial-payment response wording and clamps displayed outstanding', () => {
    const history = [{ amount: 12000, date: '2026-07-05' }];

    expect(
      buildClaimPaymentRecordedResponse(
        paidClaim,
        { amount: 12000, date: '2026-07-05', reference: 'EFT-123' },
        35000.1,
        'certified',
        history,
      ),
    ).toMatchObject({
      payment: {
        amount: 12000,
        date: '2026-07-05',
        reference: 'EFT-123',
        notes: null,
      },
      outstanding: 35000.1,
      isFullyPaid: false,
      previousStatus: 'certified',
      paymentHistory: history,
      message: 'Partial payment recorded. Outstanding: $35000.10',
    });
  });

  it('preserves fully-paid response wording when outstanding is zero or below', () => {
    expect(
      buildClaimPaymentRecordedResponse(
        { ...paidClaim, status: 'paid', paidAmount: '47000.10' },
        { amount: 35000.1, date: '2026-07-06', notes: 'Final' },
        -0.01,
        'partially_paid',
        [],
      ),
    ).toMatchObject({
      payment: {
        amount: 35000.1,
        date: '2026-07-06',
        reference: null,
        notes: 'Final',
      },
      outstanding: 0,
      isFullyPaid: true,
      message: 'Claim fully paid',
    });
  });
});
