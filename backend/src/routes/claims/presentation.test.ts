import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildClaimCertificationView,
  buildClaimCertifiedResponse,
  buildClaimCreatedResponse,
  buildClaimDeletedResponse,
  buildClaimDetailResponse,
  buildClaimEvidencePackageResponse,
  buildClaimEvidenceReviewResponse,
  buildClaimReadinessResponse,
  buildClaimableLotsResponse,
  buildClaimsListResponse,
  buildClaimPaymentRecordedResponse,
  mapClaimCertificationItem,
  mapClaimCreateItem,
  mapClaimListItem,
  mapClaimPaymentItem,
  mapClaimReadinessItem,
  mapClaimableLot,
  parseClaimCertificationMetadata,
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
  it('preserves list item date and amount formatting and carries the project state', () => {
    expect(
      mapClaimListItem(
        {
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
        },
        'WA',
      ),
    ).toEqual({
      id: 'claim-1',
      claimNumber: 7,
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      status: 'certified',
      totalClaimedAmount: 48000.25,
      certifiedAmount: 47000.1,
      certifiedAt: null,
      paidAmount: 1000,
      submittedAt: '2026-06-01',
      // A plain-string disputeNotes is not certification metadata, so the
      // raw field is preserved and `certification` stays null.
      disputeNotes: 'Variation pending',
      disputedAt: '2026-06-02',
      lotCount: 3,
      projectState: 'WA',
      certification: null,
    });
  });

  it('emits the certifiedAt timestamp and parsed certification metadata when present', () => {
    const result = mapClaimListItem(
      {
        id: 'claim-cert',
        claimNumber: 11,
        claimPeriodStart: new Date('2026-05-01T10:00:00.000Z'),
        claimPeriodEnd: new Date('2026-05-31T10:00:00.000Z'),
        status: 'certified',
        totalClaimedAmount: '48000.25',
        certifiedAmount: '47000.10',
        certifiedAt: new Date('2026-06-03T04:05:06.000Z'),
        paidAmount: null,
        submittedAt: new Date('2026-06-01T12:00:00.000Z'),
        disputeNotes: JSON.stringify({
          variationNotes: 'Variation approved',
          certificationDocumentId: 'doc-9',
          certifiedBy: 'user-7',
        }),
        disputedAt: null,
        _count: { claimedLots: 2 },
      },
      'NSW',
      new Map([['user-7', 'Jane Principal']]),
    );

    expect(result.certifiedAt).toBe('2026-06-03T04:05:06.000Z');
    expect(result.disputeNotes).toBeNull();
    expect(result.certification).toEqual({
      certifiedByName: 'Jane Principal',
      variationNotes: 'Variation approved',
      certificationDocumentId: 'doc-9',
    });
  });

  it('does not expose payment metadata JSON as dispute notes', () => {
    const result = mapClaimListItem({
      id: 'claim-paid-json',
      claimNumber: 13,
      claimPeriodStart: new Date('2026-05-01T10:00:00.000Z'),
      claimPeriodEnd: new Date('2026-05-31T10:00:00.000Z'),
      status: 'paid',
      totalClaimedAmount: '1000',
      certifiedAmount: '1000',
      certifiedAt: new Date('2026-06-03T04:05:06.000Z'),
      paidAmount: '1000',
      submittedAt: new Date('2026-06-01T12:00:00.000Z'),
      disputeNotes: JSON.stringify({
        paymentHistory: [{ amount: 1000, recordedBy: 'user-internal-id' }],
        lastPaymentNotes: 'Internal payment note',
      }),
      disputedAt: null,
      _count: { claimedLots: 1 },
    });

    expect(result.disputeNotes).toBeNull();
    expect(result.certification).toBeNull();
  });

  it('shows the embedded dispute reason while retaining parsed certification metadata', () => {
    const result = mapClaimListItem(
      {
        id: 'claim-disputed-cert',
        claimNumber: 12,
        claimPeriodStart: new Date('2026-05-01T10:00:00.000Z'),
        claimPeriodEnd: new Date('2026-05-31T10:00:00.000Z'),
        status: 'disputed',
        totalClaimedAmount: '48000.25',
        certifiedAmount: '47000.10',
        certifiedAt: new Date('2026-06-03T04:05:06.000Z'),
        paidAmount: null,
        submittedAt: new Date('2026-06-01T12:00:00.000Z'),
        disputeNotes: JSON.stringify({
          variationNotes: 'Approved before later dispute',
          certificationDocumentId: 'doc-10',
          certifiedBy: 'user-8',
          disputeNotes: 'Certified quantity now disputed',
        }),
        disputedAt: new Date('2026-06-04T00:00:00.000Z'),
        _count: { claimedLots: 2 },
      },
      'NSW',
      new Map([['user-8', 'Alex Principal']]),
    );

    expect(result.disputeNotes).toBe('Certified quantity now disputed');
    expect(result.certification).toEqual({
      certifiedByName: 'Alex Principal',
      variationNotes: 'Approved before later dispute',
      certificationDocumentId: 'doc-10',
    });
  });

  it('defaults projectState to null when the project state is unknown', () => {
    expect(
      mapClaimListItem({
        id: 'claim-9',
        claimNumber: 1,
        claimPeriodStart: new Date('2026-05-01T10:00:00.000Z'),
        claimPeriodEnd: new Date('2026-05-31T10:00:00.000Z'),
        status: 'submitted',
        totalClaimedAmount: '100',
        certifiedAmount: null,
        paidAmount: null,
        submittedAt: new Date('2026-06-01T12:00:00.000Z'),
        disputeNotes: null,
        disputedAt: null,
        _count: { claimedLots: 1 },
      }).projectState,
    ).toBeNull();
  });

  it('preserves zero-value optional commercial fields', () => {
    const result = mapClaimListItem({
      id: 'claim-2',
      claimNumber: 8,
      claimPeriodStart: new Date('2026-05-01T10:00:00.000Z'),
      claimPeriodEnd: new Date('2026-05-31T10:00:00.000Z'),
      status: 'draft',
      totalClaimedAmount: null,
      certifiedAmount: 0,
      paidAmount: 0,
      submittedAt: null,
      disputeNotes: '',
      disputedAt: null,
      _count: { claimedLots: 0 },
    });

    expect(result).toMatchObject({
      totalClaimedAmount: 0,
      certifiedAmount: 0,
      paidAmount: 0,
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

describe('mapClaimCertificationItem', () => {
  it('preserves a nil-certified claim as zero certified and zero paid', () => {
    const result = mapClaimCertificationItem(
      {
        id: 'claim-nil',
        claimNumber: 14,
        claimPeriodStart: new Date('2026-05-01T10:00:00.000Z'),
        claimPeriodEnd: new Date('2026-05-31T10:00:00.000Z'),
        status: 'paid',
        totalClaimedAmount: '1000',
        certifiedAmount: 0,
        certifiedAt: new Date('2026-06-03T04:05:06.000Z'),
        paidAmount: 0,
        claimedLots: [],
      },
      'Nil certification',
      null,
    );

    expect(result).toMatchObject({
      status: 'paid',
      certifiedAmount: 0,
      paidAmount: 0,
    });
  });
});

describe('mapClaimReadinessItem', () => {
  it('preserves the claim-readiness lot response shape', () => {
    const claim = {
      canClaim: true,
      blockers: [],
      support: [{ label: 'Budget set' }],
    };

    expect(
      mapClaimReadinessItem(
        { activityType: 'Earthworks' },
        {
          lotId: 'lot-1',
          lotNumber: 'EW-001',
          claim,
        },
      ),
    ).toEqual({
      lotId: 'lot-1',
      lotNumber: 'EW-001',
      activityType: 'Earthworks',
      claim,
    });
  });

  it('passes through blocker-heavy readiness summaries without rewriting them', () => {
    const claim = {
      canClaim: false,
      blockers: [{ severity: 'blocker', message: 'Lot is not conformed' }],
      warnings: [{ severity: 'warning', message: 'Unreleased hold point' }],
    };

    expect(
      mapClaimReadinessItem(
        { activityType: 'Drainage' },
        {
          lotId: 'lot-2',
          lotNumber: 'DR-002',
          claim,
        },
      ).claim,
    ).toBe(claim);
  });
});

describe('claim collection response helpers', () => {
  it('wraps claimable lots, readiness lots, and claim lists under their existing keys', () => {
    const lots = [{ id: 'lot-1' }];
    const readinessLots = [{ lotId: 'lot-1' }];
    const claims = [{ id: 'claim-1' }];

    expect(buildClaimableLotsResponse(lots)).toEqual({ lots });
    expect(buildClaimReadinessResponse(readinessLots)).toEqual({ lots: readinessLots });
    expect(buildClaimsListResponse(claims)).toEqual({ claims });
  });

  it('wraps claim detail and delete responses without changing contracts', () => {
    const claim = { id: 'claim-2', status: 'draft' };

    expect(buildClaimDetailResponse(claim)).toEqual({ claim });
    expect(buildClaimCreatedResponse(claim)).toEqual({ claim });
    expect(buildClaimDeletedResponse()).toEqual({ success: true });
  });

  it('passes claim evidence packages through without wrapping or rewriting them', () => {
    const evidencePackage = {
      claimId: 'claim-1',
      lots: [{ lotId: 'lot-1', evidenceScore: 80 }],
      generatedAt: '2026-06-01T00:00:00.000Z',
    };

    expect(buildClaimEvidencePackageResponse(evidencePackage)).toBe(evidencePackage);
  });

  it('builds claim evidence reviews through the shared readiness helper', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T02:03:04.000Z'));

    expect(
      buildClaimEvidenceReviewResponse({
        id: 'claim-3',
        claimNumber: 9,
        totalClaimedAmount: '2500.50',
        claimedLots: [],
      }),
    ).toEqual({
      claimId: 'claim-3',
      claimNumber: 9,
      analyzedAt: '2026-06-01T02:03:04.000Z',
      summary: {
        totalLots: 0,
        readyCount: 0,
        reviewCount: 0,
        blockedCount: 0,
        totalClaimAmount: 2500.5,
        recommendedAmount: 0,
      },
      lots: [],
      overallSuggestions: [],
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
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

describe('parseClaimCertificationMetadata', () => {
  it('parses the certification JSON stored in disputeNotes', () => {
    expect(
      parseClaimCertificationMetadata(
        JSON.stringify({
          variationNotes: 'Approved with variation',
          certificationDocumentId: 'doc-1',
          certifiedBy: 'user-1',
        }),
      ),
    ).toEqual({
      certifiedById: 'user-1',
      variationNotes: 'Approved with variation',
      certificationDocumentId: 'doc-1',
    });
  });

  it('still parses certification keys after the payment workflow merges paymentHistory', () => {
    expect(
      parseClaimCertificationMetadata(
        JSON.stringify({
          variationNotes: 'Approved',
          certificationDocumentId: 'doc-2',
          certifiedBy: 'user-2',
          paymentHistory: [{ amount: 100, date: '2026-07-01' }],
          lastPaymentNotes: 'Part payment',
        }),
      ),
    ).toEqual({
      certifiedById: 'user-2',
      variationNotes: 'Approved',
      certificationDocumentId: 'doc-2',
    });
  });

  it('returns null for plain-string disputeNotes (the disputed-claim path)', () => {
    expect(parseClaimCertificationMetadata('Documentation incomplete')).toBeNull();
  });

  it('returns null for empty, null, and malformed values', () => {
    expect(parseClaimCertificationMetadata(null)).toBeNull();
    expect(parseClaimCertificationMetadata('')).toBeNull();
    expect(parseClaimCertificationMetadata('{not valid json')).toBeNull();
  });

  it('returns null for JSON without any certification keys', () => {
    expect(
      parseClaimCertificationMetadata(
        JSON.stringify({ paymentHistory: [{ amount: 100, date: '2026-07-01' }] }),
      ),
    ).toBeNull();
  });

  it('nulls non-string certification fields without discarding the others', () => {
    expect(
      parseClaimCertificationMetadata(
        JSON.stringify({ variationNotes: 'Notes', certificationDocumentId: 42, certifiedBy: null }),
      ),
    ).toEqual({
      certifiedById: null,
      variationNotes: 'Notes',
      certificationDocumentId: null,
    });
  });
});

describe('buildClaimCertificationView', () => {
  it('resolves the certifier name from the lookup map', () => {
    expect(
      buildClaimCertificationView(
        JSON.stringify({
          variationNotes: 'Approved',
          certificationDocumentId: 'doc-3',
          certifiedBy: 'user-3',
        }),
        new Map([['user-3', 'Jordan Principal']]),
      ),
    ).toEqual({
      certifiedByName: 'Jordan Principal',
      variationNotes: 'Approved',
      certificationDocumentId: 'doc-3',
    });
  });

  it('leaves the certifier name null when it is not in the lookup map', () => {
    expect(
      buildClaimCertificationView(
        JSON.stringify({ certifiedBy: 'user-missing', variationNotes: 'Approved' }),
      ),
    ).toEqual({
      certifiedByName: null,
      variationNotes: 'Approved',
      certificationDocumentId: null,
    });
  });

  it('returns null when there is no certification metadata', () => {
    expect(buildClaimCertificationView('Documentation incomplete')).toBeNull();
    expect(buildClaimCertificationView(null)).toBeNull();
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
