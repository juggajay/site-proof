import path from 'path';
import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';
import { DOCUMENTS_BUCKET, getSupabaseStoragePath } from '../../lib/supabase.js';
import {
  isStoredDocumentUploadPath,
  normalizeStoredDocumentReference,
} from '../../lib/uploadPaths.js';

const CLAIM_DATE_INPUT_MAX_LENGTH = 64;
const CLAIM_ID_MAX_LENGTH = 120;
const CLAIM_PAYMENT_REFERENCE_MAX_LENGTH = 160;
const CLAIM_DISPUTE_NOTES_MAX_LENGTH = 5000;
const CLAIM_VARIATION_NOTES_MAX_LENGTH = 2000;
const CLAIM_PAYMENT_NOTES_MAX_LENGTH = 3000;
export const MAX_CERTIFICATION_DOCUMENT_ID_LENGTH = 120;
const MAX_CERTIFICATION_DOCUMENT_URL_LENGTH = 2048;
const MAX_CERTIFICATION_DOCUMENT_FILENAME_LENGTH = 180;
export const CLAIM_LOT_PERCENTAGE_REQUIRED_MESSAGE =
  'Each claimed lot must include percentageComplete';

function requiredTrimmedClaimString(fieldName: string, maxLength: number, requiredMessage: string) {
  return z
    .string()
    .trim()
    .min(1, requiredMessage)
    .max(maxLength, `${fieldName} must be ${maxLength} characters or less`);
}

function optionalTrimmedClaimString(fieldName: string, maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength, `${fieldName} must be ${maxLength} characters or less`)
    .optional();
}

export const createClaimSchema = z
  .object({
    periodStart: requiredTrimmedClaimString(
      'periodStart',
      CLAIM_DATE_INPUT_MAX_LENGTH,
      'Period start is required',
    ),
    periodEnd: requiredTrimmedClaimString(
      'periodEnd',
      CLAIM_DATE_INPUT_MAX_LENGTH,
      'Period end is required',
    ),
    lotIds: z
      .array(requiredTrimmedClaimString('lotId', CLAIM_ID_MAX_LENGTH, 'Lot ID is required'))
      .optional(),
    lots: z
      .array(
        z.object({
          lotId: requiredTrimmedClaimString('lotId', CLAIM_ID_MAX_LENGTH, 'Lot ID is required'),
          percentageComplete: z
            .number({
              required_error: CLAIM_LOT_PERCENTAGE_REQUIRED_MESSAGE,
              invalid_type_error: 'Percentage complete must be a number',
            })
            .finite('Percentage complete must be finite')
            .min(0, 'Percentage complete cannot be negative')
            .max(100, 'Percentage complete cannot exceed 100'),
        }),
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.lotIds && data.lotIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: CLAIM_LOT_PERCENTAGE_REQUIRED_MESSAGE,
        path: ['lotIds'],
      });
    }

    if (!data.lots || data.lots.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one lot is required',
        path: ['lots'],
      });
    }
  });

export const updateClaimSchema = z.object({
  status: z.enum(['draft', 'submitted', 'certified', 'disputed', 'paid']).optional(),
  certifiedAmount: z
    .number()
    .finite('Certified amount must be finite')
    .nonnegative('Certified amount cannot be negative')
    .optional(),
  paidAmount: z
    .number()
    .finite('Paid amount must be finite')
    .nonnegative('Paid amount cannot be negative')
    .optional(),
  paymentReference: optionalTrimmedClaimString(
    'paymentReference',
    CLAIM_PAYMENT_REFERENCE_MAX_LENGTH,
  ),
  disputeNotes: optionalTrimmedClaimString('disputeNotes', CLAIM_DISPUTE_NOTES_MAX_LENGTH),
});

export const certifyClaimSchema = z.object({
  certifiedAmount: z
    .number()
    .finite('Certified amount must be finite')
    .nonnegative('Certified amount cannot be negative'),
  certificationDate: optionalTrimmedClaimString('certificationDate', CLAIM_DATE_INPUT_MAX_LENGTH),
  variationNotes: optionalTrimmedClaimString('variationNotes', CLAIM_VARIATION_NOTES_MAX_LENGTH),
  certificationDocumentId: optionalTrimmedClaimString(
    'certificationDocumentId',
    MAX_CERTIFICATION_DOCUMENT_ID_LENGTH,
  ),
  certificationDocumentUrl: optionalTrimmedClaimString(
    'certificationDocumentUrl',
    MAX_CERTIFICATION_DOCUMENT_URL_LENGTH,
  ),
  certificationDocumentFilename: optionalTrimmedClaimString(
    'certificationDocumentFilename',
    MAX_CERTIFICATION_DOCUMENT_FILENAME_LENGTH,
  ),
});

export const recordPaymentSchema = z.object({
  paidAmount: z
    .number()
    .finite('Payment amount must be finite')
    .positive('Payment amount must be greater than zero'),
  paymentDate: optionalTrimmedClaimString('paymentDate', CLAIM_DATE_INPUT_MAX_LENGTH),
  paymentReference: optionalTrimmedClaimString(
    'paymentReference',
    CLAIM_PAYMENT_REFERENCE_MAX_LENGTH,
  ),
  paymentNotes: optionalTrimmedClaimString('paymentNotes', CLAIM_PAYMENT_NOTES_MAX_LENGTH),
});

export const CLAIM_AMOUNT_EPSILON = 0.000001;

// A lot is considered fully claimed once its cumulative claimed percentage
// (summed across every non-deleted claim it appears on) reaches 100%.
export const LOT_FULLY_CLAIMED_PERCENTAGE = 100;

// Cumulative percentages are summed across claims, so we tolerate a tiny
// floating-point drift when checking the 0-100 boundary (e.g. 33.33 * 3).
export const CLAIM_PERCENTAGE_EPSILON = 0.0001;

/** Round a money value to whole cents so claim line totals stay exact. */
export function roundClaimAmountToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Sum a lot's already-claimed percentage from its existing claim line items.
 * Deleting/voiding a draft claim cascades its ClaimedLot rows, so any rows that
 * remain are the authoritative record of what has already been claimed.
 */
export function sumClaimedPercentages(rows: Array<{ percentageComplete: unknown }>): number {
  return rows.reduce((sum, row) => {
    const value = Number(row.percentageComplete);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

/** Percentage still available to claim on a lot (never below zero). */
export function remainingClaimablePercentage(priorCumulative: number): number {
  return Math.max(0, LOT_FULLY_CLAIMED_PERCENTAGE - priorCumulative);
}

/** True once a lot's cumulative claimed percentage has reached 100%. */
export function isLotFullyClaimed(cumulativePercentage: number): boolean {
  return cumulativePercentage >= LOT_FULLY_CLAIMED_PERCENTAGE - CLAIM_PERCENTAGE_EPSILON;
}

/**
 * Reject an increment that would push a lot's cumulative claimed percentage
 * past 100%. `increment` is THIS claim's percentage (not cumulative-to-date).
 */
export function assertClaimIncrementWithinRemaining(
  priorCumulative: number,
  increment: number,
  lotNumber: string,
): void {
  if (priorCumulative + increment - LOT_FULLY_CLAIMED_PERCENTAGE > CLAIM_PERCENTAGE_EPSILON) {
    const remaining = remainingClaimablePercentage(priorCumulative);
    throw AppError.badRequest(
      `Lot ${lotNumber} has already been claimed up to ${priorCumulative}%. ` +
        `You can only claim up to a further ${Number(remaining.toFixed(2))}% this claim.`,
      {
        code: 'OVER_CLAIM',
        lotNumber,
        priorCumulative,
        increment,
        remaining,
      },
    );
  }
}

const CLAIM_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const GENERIC_CLAIM_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ['submitted'],
  submitted: ['certified', 'disputed'],
  disputed: ['certified'],
  certified: ['paid', 'disputed'],
};

export const CLAIM_NUMBER_RETRY_LIMIT = 5;

type RequestedClaimLot = {
  lotId: string;
  percentageComplete: number;
};

export function getRequestedClaimLots(
  data: z.infer<typeof createClaimSchema>,
): RequestedClaimLot[] {
  return (data.lots || []).map((lot) => ({
    lotId: lot.lotId,
    percentageComplete: lot.percentageComplete,
  }));
}

export function getRequestedClaimPercentage(
  percentageByLotId: Map<string, number>,
  lotId: string,
): number {
  const percentageComplete = percentageByLotId.get(lotId);
  if (percentageComplete === undefined) {
    throw AppError.badRequest(CLAIM_LOT_PERCENTAGE_REQUIRED_MESSAGE);
  }
  return percentageComplete;
}

export function assertGenericClaimStatusTransition(
  currentStatus: string,
  nextStatus: string | undefined,
) {
  if (!nextStatus || nextStatus === currentStatus) {
    return;
  }

  const allowedStatuses = GENERIC_CLAIM_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedStatuses.includes(nextStatus)) {
    throw AppError.badRequest(`Cannot change claim status from ${currentStatus} to ${nextStatus}`);
  }
}

function parseClaimNotesRecord(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function hasCertificationMetadata(record: Record<string, unknown>): boolean {
  return (
    'certifiedBy' in record || 'variationNotes' in record || 'certificationDocumentId' in record
  );
}

export function serializeDisputeNotesForStatusTransition(
  existingDisputeNotes: string | null | undefined,
  disputeNotes: string | null | undefined,
): string | null {
  const nextDisputeNotes = disputeNotes?.trim() || null;
  const existingNotes = parseClaimNotesRecord(existingDisputeNotes);

  if (!existingNotes || !hasCertificationMetadata(existingNotes)) {
    return nextDisputeNotes;
  }

  return JSON.stringify({
    ...existingNotes,
    disputeNotes: nextDisputeNotes,
  });
}

function getClaimAmountValue(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function assertCertifiedAmountWithinClaimTotal(
  certifiedAmount: number,
  totalClaimedAmount: unknown,
) {
  const claimedTotal = getClaimAmountValue(totalClaimedAmount);
  if (certifiedAmount - claimedTotal > CLAIM_AMOUNT_EPSILON) {
    throw AppError.badRequest('Certified amount cannot exceed the claimed amount');
  }
}

export function parseClaimDate(value: string | undefined, field: string): Date {
  if (!value) {
    throw AppError.badRequest(`${field} is required`);
  }

  const match = CLAIM_DATE_PATTERN.exec(value.trim());
  if (!match) {
    throw AppError.badRequest(`Invalid ${field} date`);
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw AppError.badRequest(`Invalid ${field} date`);
  }

  return date;
}

export function parseOptionalClaimDate(value: string | undefined, field: string): Date | undefined {
  return value ? parseClaimDate(value, field) : undefined;
}

export function normalizeOptionalCertificationString(
  value: string | undefined,
  field: string,
  maxLength: number,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (normalized.length > maxLength) {
    throw AppError.badRequest(`${field} is too long`);
  }

  return normalized;
}

export function normalizeCertificationDocumentUrl(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalCertificationString(
    value,
    'certificationDocumentUrl',
    MAX_CERTIFICATION_DOCUMENT_URL_LENGTH,
  );

  if (!normalized) {
    return undefined;
  }

  if (
    !isStoredDocumentUploadPath(normalized) &&
    !getSupabaseStoragePath(normalized, DOCUMENTS_BUCKET)
  ) {
    throw AppError.badRequest('certificationDocumentUrl must reference an uploaded document file');
  }

  return normalizeStoredDocumentReference(normalized);
}

export function sanitizeCertificationDocumentFilename(
  filename: string | undefined,
  claimNumber: number,
): string {
  const fallback = `certification-claim-${claimNumber}.pdf`;
  const source =
    normalizeOptionalCertificationString(
      filename,
      'certificationDocumentFilename',
      MAX_CERTIFICATION_DOCUMENT_FILENAME_LENGTH,
    ) || fallback;
  const basename = path.basename(source.replace(/\\/g, '/'));
  const sanitized = basename
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 || '<>:"/\\|?*'.includes(char) ? '_' : char;
    })
    .join('')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, MAX_CERTIFICATION_DOCUMENT_FILENAME_LENGTH);

  return sanitized || fallback;
}
