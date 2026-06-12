import { describe, expect, it } from 'vitest';

import {
  CLAIM_LOT_PERCENTAGE_REQUIRED_MESSAGE,
  assertCertifiedAmountWithinClaimTotal,
  assertClaimIncrementWithinRemaining,
  assertGenericClaimStatusTransition,
  createClaimSchema,
  isLotFullyClaimed,
  normalizeCertificationDocumentUrl,
  parseClaimDate,
  remainingClaimablePercentage,
  roundClaimAmountToCents,
  sanitizeCertificationDocumentFilename,
  serializeDisputeNotesForStatusTransition,
  sumClaimedPercentages,
} from './workflowValidation.js';

describe('claims workflow validation', () => {
  it('keeps legacy lotIds rejected until callers provide lot percentages', () => {
    const result = createClaimSchema.safeParse({
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      lotIds: ['lot-1'],
    });

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: CLAIM_LOT_PERCENTAGE_REQUIRED_MESSAGE,
          path: ['lotIds'],
        }),
      ]),
    );
  });

  it('accepts claim lots only when each lot includes a finite percentage', () => {
    const result = createClaimSchema.safeParse({
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      lots: [{ lotId: 'lot-1', percentageComplete: 75 }],
    });

    expect(result.success).toBe(true);
    expect(result.success ? result.data.lots?.[0] : undefined).toEqual({
      lotId: 'lot-1',
      percentageComplete: 75,
    });
  });

  it('parses ISO date-only inputs and rejects invalid calendar dates', () => {
    expect(parseClaimDate('2026-06-01', 'periodStart').toISOString()).toBe(
      '2026-06-01T00:00:00.000Z',
    );

    expect(() => parseClaimDate('2026-02-30', 'periodStart')).toThrow('Invalid periodStart date');
  });

  it('preserves the generic claim status transition gate', () => {
    expect(() => assertGenericClaimStatusTransition('draft', 'submitted')).not.toThrow();
    expect(() => assertGenericClaimStatusTransition('draft', 'paid')).toThrow(
      'Cannot change claim status from draft to paid',
    );
  });

  it('preserves certified amount tolerance against the claim total', () => {
    expect(() => assertCertifiedAmountWithinClaimTotal(100, '100')).not.toThrow();
    expect(() => assertCertifiedAmountWithinClaimTotal(101, '100')).toThrow(
      'Certified amount cannot exceed the claimed amount',
    );
  });

  it('normalizes certification document URLs and filenames without trusting external paths', () => {
    expect(normalizeCertificationDocumentUrl('uploads/documents/cert.pdf')).toBe(
      'uploads/documents/cert.pdf',
    );
    expect(() => normalizeCertificationDocumentUrl('https://example.com/cert.pdf')).toThrow(
      'certificationDocumentUrl must reference an uploaded document file',
    );

    expect(sanitizeCertificationDocumentFilename('../bad:<name>.pdf', 42)).toBe('bad__name_.pdf');
    expect(sanitizeCertificationDocumentFilename('', 42)).toBe('certification-claim-42.pdf');
  });

  it('preserves certification metadata when serializing a certified claim dispute', () => {
    const serialized = serializeDisputeNotesForStatusTransition(
      JSON.stringify({
        variationNotes: 'Approved before later dispute',
        certificationDocumentId: 'document-1',
        certifiedBy: 'user-1',
      }),
      'Certified quantity now disputed',
    );

    expect(JSON.parse(serialized || '{}')).toEqual({
      variationNotes: 'Approved before later dispute',
      certificationDocumentId: 'document-1',
      certifiedBy: 'user-1',
      disputeNotes: 'Certified quantity now disputed',
    });
  });
});

describe('cumulative claim math', () => {
  it('sums prior claimed percentages from claim line items', () => {
    expect(
      sumClaimedPercentages([
        { percentageComplete: 50 },
        { percentageComplete: '20.5' },
        { percentageComplete: null },
      ]),
    ).toBe(70.5);
    expect(sumClaimedPercentages([])).toBe(0);
  });

  it('reports remaining claimable percentage without going negative', () => {
    expect(remainingClaimablePercentage(0)).toBe(100);
    expect(remainingClaimablePercentage(60)).toBe(40);
    expect(remainingClaimablePercentage(100)).toBe(0);
    expect(remainingClaimablePercentage(120)).toBe(0);
  });

  it('treats a lot as fully claimed only at (or fractionally below) 100%', () => {
    expect(isLotFullyClaimed(99.9)).toBe(false);
    expect(isLotFullyClaimed(100)).toBe(true);
    expect(isLotFullyClaimed(99.99999)).toBe(true); // within epsilon of 100
    expect(isLotFullyClaimed(50)).toBe(false);
  });

  it('rounds claim line amounts to whole cents', () => {
    expect(roundClaimAmountToCents((10000 * 33.33) / 100)).toBe(3333);
    expect(roundClaimAmountToCents(5050.005)).toBe(5050.01);
    expect(roundClaimAmountToCents(0.1 + 0.2)).toBe(0.3);
  });

  it('rejects an increment that would exceed 100% cumulative', () => {
    expect(() => assertClaimIncrementWithinRemaining(0, 100, 'LOT-1')).not.toThrow();
    expect(() => assertClaimIncrementWithinRemaining(70, 30, 'LOT-1')).not.toThrow();
    expect(() => assertClaimIncrementWithinRemaining(70, 31, 'LOT-1')).toThrow(
      /already been claimed/,
    );

    try {
      assertClaimIncrementWithinRemaining(70, 40, 'LOT-7');
      throw new Error('expected over-claim to throw');
    } catch (error) {
      const details = (error as { details?: Record<string, unknown> }).details;
      expect(details?.code).toBe('OVER_CLAIM');
      expect(details?.remaining).toBe(30);
    }
  });

  it('allows tiny floating-point drift at the 100% boundary', () => {
    expect(() => assertClaimIncrementWithinRemaining(33.33 * 2, 33.34, 'LOT-1')).not.toThrow();
  });
});
