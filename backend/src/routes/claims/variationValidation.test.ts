import { describe, expect, it } from 'vitest';

import {
  assertVariationStatusTransition,
  attachVariationEvidenceSchema,
  createVariationSchema,
  updateVariationSchema,
} from './variationValidation.js';

describe('variation validation schemas', () => {
  it('accepts a minimal create payload and trims optional text fields', () => {
    const result = createVariationSchema.safeParse({
      title: '  Extra excavation  ',
      description: '  Rock encountered at Ch120  ',
      clientReference: '  SI-42  ',
      approvedAmount: 1200.5,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        title: 'Extra excavation',
        description: 'Rock encountered at Ch120',
        clientReference: 'SI-42',
        approvedAmount: 1200.5,
      });
    }
  });

  it('rejects empty titles, long client references, non-positive amounts, and sub-cent amounts', () => {
    expect(createVariationSchema.safeParse({ title: '' }).success).toBe(false);
    expect(
      createVariationSchema.safeParse({
        title: 'Variation',
        clientReference: 'x'.repeat(201),
      }).success,
    ).toBe(false);
    expect(
      createVariationSchema.safeParse({
        title: 'Variation',
        approvedAmount: 0,
      }).success,
    ).toBe(false);
    expect(
      createVariationSchema.safeParse({
        title: 'Variation',
        approvedAmount: 10.123,
      }).success,
    ).toBe(false);
  });

  it('accepts field edits, status transitions, and evidence attachment payloads', () => {
    expect(
      updateVariationSchema.safeParse({
        title: 'Revised title',
        lotId: null,
        approvedAmount: 345.67,
      }).success,
    ).toBe(true);
    expect(updateVariationSchema.safeParse({ status: 'submitted' }).success).toBe(true);
    expect(
      updateVariationSchema.safeParse({
        status: 'rejected',
        rejectionReason: 'Client rejected the rate',
      }).success,
    ).toBe(true);
    expect(
      attachVariationEvidenceSchema.safeParse({
        documentId: '1a3d1a47-0c27-4e2a-87b4-0d86fd63ef2b',
        evidenceType: 'site_instruction',
      }).success,
    ).toBe(true);
  });

  it('rejects unknown statuses and invalid evidence payloads', () => {
    expect(updateVariationSchema.safeParse({ status: 'paid' }).success).toBe(false);
    expect(
      attachVariationEvidenceSchema.safeParse({
        documentId: 'not-a-uuid',
        evidenceType: '',
      }).success,
    ).toBe(false);
  });
});

describe('assertVariationStatusTransition', () => {
  it.each([
    ['proposed', 'submitted'],
    ['submitted', 'approved'],
    ['submitted', 'rejected'],
    ['rejected', 'submitted'],
  ])('allows %s -> %s', (currentStatus, nextStatus) => {
    expect(() =>
      assertVariationStatusTransition(currentStatus, nextStatus, {
        approvedAmount: nextStatus === 'approved' ? 100 : undefined,
      }),
    ).not.toThrow();
  });

  it.each([
    ['proposed', 'approved'],
    ['proposed', 'rejected'],
    ['submitted', 'claimed'],
    ['approved', 'submitted'],
    ['rejected', 'approved'],
  ])('rejects illegal %s -> %s transitions', (currentStatus, nextStatus) => {
    expect(() =>
      assertVariationStatusTransition(currentStatus, nextStatus, {
        approvedAmount: 100,
      }),
    ).toThrow(/Cannot change variation status/);
  });

  it('requires a positive approved amount when approving', () => {
    expect(() =>
      assertVariationStatusTransition('submitted', 'approved', {
        approvedAmount: undefined,
      }),
    ).toThrow(/approved amount/i);
    expect(() =>
      assertVariationStatusTransition('submitted', 'approved', {
        approvedAmount: 0,
      }),
    ).toThrow(/approved amount/i);
  });

  it('treats claimed variations as immutable', () => {
    expect(() =>
      assertVariationStatusTransition('claimed', 'approved', {
        approvedAmount: 100,
      }),
    ).toThrow(/claimed variation/i);
    expect(() =>
      assertVariationStatusTransition('approved', undefined, {
        isClaimed: true,
      }),
    ).toThrow(/claimed variation/i);
  });
});
