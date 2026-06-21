import { z } from 'zod';
import { AppError } from '../../lib/AppError.js';

// =============================================================================
// Docket request validation: shared Zod schemas, input limits/format
// constants, query/route-param parsers, and date parsing. Extracted verbatim
// from dockets.ts to keep validation contracts identical (behavior-preserving).
// =============================================================================

export const DOCKET_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'queried',
] as const;
export const DOCKET_SORT_FIELDS = new Set([
  'date',
  'status',
  'submittedAt',
  'approvedAt',
  'createdAt',
  'updatedAt',
]);
export const MAX_DOCKET_ID_LENGTH = 120;
export const MAX_DOCKET_DATE_LENGTH = 64;
export const MAX_DOCKET_NOTES_LENGTH = 5000;
export const MAX_DOCKET_REASON_LENGTH = 3000;
export const MAX_LOT_ALLOCATIONS_PER_ENTRY = 200;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const finiteNonNegativeNumber = (fieldName: string) =>
  z
    .number()
    .min(0, `${fieldName} cannot be negative`)
    .refine(Number.isFinite, `${fieldName} must be a finite number`);

export const dailyHoursNumber = (fieldName: string) =>
  z
    .number()
    .gt(0, `${fieldName} must be greater than 0`)
    .max(24, `${fieldName} must be 24 or less`)
    .refine(Number.isFinite, `${fieldName} must be a finite number`);

export const requiredDocketIdSchema = (fieldName: string) =>
  z
    .string()
    .trim()
    .min(1, `${fieldName} is required`)
    .max(MAX_DOCKET_ID_LENGTH, `${fieldName} is too long`);

export const optionalNullableTextSchema = (fieldName: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${fieldName} must be ${maxLength} characters or less`)
    .nullable()
    .optional();

export const optionalTimeSchema = z
  .string()
  .trim()
  .max(5, 'Time must be in HH:mm format')
  .regex(TIME_PATTERN, 'Time must be in HH:mm format')
  .optional();
export const requiredTimeSchema = (fieldName: string) =>
  z
    .string({
      required_error: `${fieldName} is required`,
      invalid_type_error: `${fieldName} is required`,
    })
    .trim()
    .min(1, `${fieldName} is required`)
    .max(5, 'Time must be in HH:mm format')
    .regex(TIME_PATTERN, 'Time must be in HH:mm format');
export const optionalDateStringSchema = z
  .string()
  .trim()
  .max(MAX_DOCKET_DATE_LENGTH, `Date must be ${MAX_DOCKET_DATE_LENGTH} characters or less`)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Date must be valid')
  .optional();

// Zod schemas for request body validation
export const createDocketSchema = z.object({
  projectId: requiredDocketIdSchema('projectId'),
  date: optionalDateStringSchema,
  labourHours: finiteNonNegativeNumber('Labour total').optional(),
  plantHours: finiteNonNegativeNumber('Plant total').optional(),
  notes: z
    .string()
    .trim()
    .max(MAX_DOCKET_NOTES_LENGTH, `Notes must be ${MAX_DOCKET_NOTES_LENGTH} characters or less`)
    .optional(),
});

export const updateDocketSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(MAX_DOCKET_NOTES_LENGTH, `Notes must be ${MAX_DOCKET_NOTES_LENGTH} characters or less`)
    .nullable()
    .optional(),
});

export const approveDocketSchema = z.object({
  foremanNotes: optionalNullableTextSchema('Foreman notes', MAX_DOCKET_REASON_LENGTH),
  adjustmentReason: optionalNullableTextSchema('Adjustment reason', MAX_DOCKET_REASON_LENGTH),
  adjustedLabourHours: finiteNonNegativeNumber('Adjusted labour total').optional(),
  adjustedPlantHours: finiteNonNegativeNumber('Adjusted plant total').optional(),
});

export const rejectDocketSchema = z.object({
  reason: z
    .string({
      required_error: 'Rejection reason is required',
      invalid_type_error: 'Rejection reason is required',
    })
    .trim()
    .min(1, 'Rejection reason is required')
    .max(MAX_DOCKET_REASON_LENGTH, `Reason must be ${MAX_DOCKET_REASON_LENGTH} characters or less`),
});

export const queryDocketSchema = z.object({
  questions: z
    .string()
    .trim()
    .min(1, 'Questions/issues are required')
    .max(
      MAX_DOCKET_REASON_LENGTH,
      `Questions/issues must be ${MAX_DOCKET_REASON_LENGTH} characters or less`,
    ),
});

export const respondDocketSchema = z.object({
  response: z
    .string()
    .trim()
    .min(1, 'Response is required')
    .max(
      MAX_DOCKET_REASON_LENGTH,
      `Response must be ${MAX_DOCKET_REASON_LENGTH} characters or less`,
    ),
});

export const lotAllocationSchema = z.object({
  lotId: requiredDocketIdSchema('lotId'),
  hours: dailyHoursNumber('Lot allocation hours'),
});

export const addLabourEntrySchema = z.object({
  employeeId: requiredDocketIdSchema('employeeId'),
  startTime: requiredTimeSchema('Start time'),
  finishTime: requiredTimeSchema('Finish time'),
  lotAllocations: z
    .array(lotAllocationSchema)
    .max(
      MAX_LOT_ALLOCATIONS_PER_ENTRY,
      `Cannot allocate more than ${MAX_LOT_ALLOCATIONS_PER_ENTRY} lots to one entry`,
    )
    .optional(),
});

export const updateLabourEntrySchema = z.object({
  startTime: optionalTimeSchema,
  finishTime: optionalTimeSchema,
  lotAllocations: z
    .array(lotAllocationSchema)
    .max(
      MAX_LOT_ALLOCATIONS_PER_ENTRY,
      `Cannot allocate more than ${MAX_LOT_ALLOCATIONS_PER_ENTRY} lots to one entry`,
    )
    .optional(),
});

export const addPlantEntrySchema = z.object({
  plantId: requiredDocketIdSchema('plantId'),
  hoursOperated: dailyHoursNumber('Hours operated'),
  wetOrDry: z.enum(['wet', 'dry']).optional(),
});

export const updatePlantEntrySchema = z.object({
  hoursOperated: dailyHoursNumber('Hours operated').optional(),
  wetOrDry: z.enum(['wet', 'dry']).optional(),
});

export function parseRequiredQueryString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw AppError.badRequest(`${fieldName} query parameter is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_DOCKET_ID_LENGTH) {
    throw AppError.badRequest(`${fieldName} query parameter is too long`);
  }
  return trimmed;
}

export function parseDocketRouteParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > MAX_DOCKET_ID_LENGTH) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

export function parseOptionalDocketStatus(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'string' ||
    !DOCKET_STATUSES.includes(value.trim() as (typeof DOCKET_STATUSES)[number])
  ) {
    throw AppError.badRequest('Invalid docket status');
  }
  return value.trim();
}

export const DATE_COMPONENT_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;

export function assertValidDateComponent(value: string, errorMessage: string) {
  const match = DATE_COMPONENT_INPUT_PATTERN.exec(value);
  if (!match) {
    throw AppError.badRequest(errorMessage);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw AppError.badRequest(errorMessage);
  }
}

export function parseDocketDate(date?: unknown): Date {
  if (date === undefined || date === null || date === '') {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  if (typeof date !== 'string') {
    throw AppError.badRequest('Date must be valid');
  }

  const trimmed = date.trim();
  if (!trimmed) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  const match = DATE_COMPONENT_INPUT_PATTERN.exec(trimmed);
  assertValidDateComponent(trimmed, 'Date must be valid');
  return new Date(Date.UTC(Number(match![1]), Number(match![2]) - 1, Number(match![3])));
}
