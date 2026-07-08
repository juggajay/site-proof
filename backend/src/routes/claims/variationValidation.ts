import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';

const VARIATION_TITLE_MAX_LENGTH = 200;
const VARIATION_DESCRIPTION_MAX_LENGTH = 5000;
const VARIATION_CLIENT_REFERENCE_MAX_LENGTH = 200;
const VARIATION_REJECTION_REASON_MAX_LENGTH = 2000;
const VARIATION_EVIDENCE_TYPE_MAX_LENGTH = 80;
const VARIATION_AMOUNT_EPSILON = 0.000001;

export const VARIATION_STATUSES = [
  'proposed',
  'submitted',
  'approved',
  'rejected',
  'claimed',
] as const;

const VARIATION_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  proposed: ['submitted'],
  submitted: ['approved', 'rejected'],
  rejected: ['submitted'],
};

function requiredTrimmedVariationString(
  fieldName: string,
  maxLength: number,
  requiredMessage: string,
) {
  return z
    .string({ invalid_type_error: `${fieldName} must be text` })
    .trim()
    .min(1, requiredMessage)
    .max(maxLength, `${fieldName} must be ${maxLength} characters or less`);
}

function optionalTrimmedVariationString(fieldName: string, maxLength: number) {
  return z
    .string({ invalid_type_error: `${fieldName} must be text` })
    .trim()
    .max(maxLength, `${fieldName} must be ${maxLength} characters or less`)
    .optional();
}

function nullableTrimmedVariationString(fieldName: string, maxLength: number) {
  return z
    .string({ invalid_type_error: `${fieldName} must be text` })
    .trim()
    .max(maxLength, `${fieldName} must be ${maxLength} characters or less`)
    .nullable()
    .optional();
}

export function isVariationAmountCents(value: number): boolean {
  return Math.abs(Math.round(value * 100) - value * 100) < VARIATION_AMOUNT_EPSILON;
}

const positiveCentsAmountSchema = z
  .number({ invalid_type_error: 'Approved amount must be a number' })
  .finite('Approved amount must be finite')
  .positive('Approved amount must be greater than zero')
  .refine(isVariationAmountCents, 'Approved amount cannot have more than 2 decimal places');

export const createVariationSchema = z.object({
  title: requiredTrimmedVariationString('title', VARIATION_TITLE_MAX_LENGTH, 'Title is required'),
  description: optionalTrimmedVariationString('description', VARIATION_DESCRIPTION_MAX_LENGTH),
  clientReference: optionalTrimmedVariationString(
    'clientReference',
    VARIATION_CLIENT_REFERENCE_MAX_LENGTH,
  ),
  lotId: z.string().uuid('lotId must be a valid ID').optional(),
  approvedAmount: positiveCentsAmountSchema.optional(),
});

export const updateVariationSchema = z.object({
  title: optionalTrimmedVariationString('title', VARIATION_TITLE_MAX_LENGTH),
  description: nullableTrimmedVariationString('description', VARIATION_DESCRIPTION_MAX_LENGTH),
  clientReference: nullableTrimmedVariationString(
    'clientReference',
    VARIATION_CLIENT_REFERENCE_MAX_LENGTH,
  ),
  lotId: z.string().uuid('lotId must be a valid ID').nullable().optional(),
  approvedAmount: positiveCentsAmountSchema.nullable().optional(),
  status: z.enum(VARIATION_STATUSES).optional(),
  rejectionReason: nullableTrimmedVariationString(
    'rejectionReason',
    VARIATION_REJECTION_REASON_MAX_LENGTH,
  ),
});

export const attachVariationEvidenceSchema = z.object({
  documentId: z.string().uuid('documentId must be a valid ID'),
  evidenceType: requiredTrimmedVariationString(
    'evidenceType',
    VARIATION_EVIDENCE_TYPE_MAX_LENGTH,
    'evidenceType is required',
  ),
});

export function assertVariationStatusTransition(
  currentStatus: string,
  nextStatus: string | undefined,
  options: { isClaimed?: boolean; approvedAmount?: unknown } = {},
): void {
  if (options.isClaimed || currentStatus === 'claimed') {
    throw AppError.conflict('Cannot update a claimed variation', {
      code: 'VARIATION_CLAIMED',
    });
  }

  if (!nextStatus || nextStatus === currentStatus) {
    return;
  }

  const allowedStatuses = VARIATION_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedStatuses.includes(nextStatus)) {
    throw AppError.badRequest(
      `Cannot change variation status from ${currentStatus} to ${nextStatus}`,
    );
  }

  if (nextStatus === 'approved') {
    const approvedAmount = Number(options.approvedAmount ?? 0);
    if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
      throw AppError.badRequest('A positive approved amount is required to approve a variation', {
        code: 'VARIATION_APPROVAL_AMOUNT_REQUIRED',
      });
    }
  }
}
