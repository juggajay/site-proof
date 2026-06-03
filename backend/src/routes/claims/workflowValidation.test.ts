import { describe, expect, it } from 'vitest';

import {
  CLAIM_LOT_PERCENTAGE_REQUIRED_MESSAGE,
  assertCertifiedAmountWithinClaimTotal,
  assertGenericClaimStatusTransition,
  createClaimSchema,
  normalizeCertificationDocumentUrl,
  parseClaimDate,
  sanitizeCertificationDocumentFilename,
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
});
