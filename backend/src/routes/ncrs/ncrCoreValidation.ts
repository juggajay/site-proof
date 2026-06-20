import { type Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../lib/AppError.js';

export const NCR_ID_MAX_LENGTH = 120;
export const NCR_DESCRIPTION_MAX_LENGTH = 5000;
export const NCR_CATEGORY_MAX_LENGTH = 120;
export const NCR_SPECIFICATION_REFERENCE_MAX_LENGTH = 300;
export const NCR_COMMENT_MAX_LENGTH = 5000;
export const NCR_DATE_INPUT_MAX_LENGTH = 64;

const NCR_NUMBER_PATTERN = /^NCR-(\d+)$/;
const MAX_NCR_QUERY_LENGTH = 200;
const DATE_COMPONENT_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;
const NCR_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'raisedAt',
  'dueDate',
  'ncrNumber',
  'status',
  'severity',
  'category',
]);
const NCR_STATUS_FILTERS = new Set([
  'open',
  'investigating',
  'rectification',
  'verification',
  'closed',
  'closed_concession',
]);
const NCR_SEVERITY_FILTERS = new Set(['minor', 'major']);

function requiredTrimmedNcrString(fieldName: string, maxLength: number, requiredMessage: string) {
  return z
    .string({
      required_error: requiredMessage,
      invalid_type_error: requiredMessage,
    })
    .trim()
    .min(1, requiredMessage)
    .max(maxLength, `${fieldName} must be ${maxLength} characters or less`);
}

function optionalTrimmedNcrString(fieldName: string, maxLength: number) {
  return z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z
      .string({ invalid_type_error: `${fieldName} must be text` })
      .max(maxLength, `${fieldName} must be ${maxLength} characters or less`)
      .optional(),
  );
}

function nullableOptionalTrimmedNcrString(fieldName: string, maxLength: number) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return value;
      }

      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z
      .string({ invalid_type_error: `${fieldName} must be text` })
      .max(maxLength, `${fieldName} must be ${maxLength} characters or less`)
      .nullable()
      .optional(),
  );
}

export const MUTUALLY_EXCLUSIVE_RESPONSIBLE_PARTY_MESSAGE =
  'An NCR can be assigned to a user or a subcontractor, not both';

export const createNcrSchema = z
  .object({
    projectId: requiredTrimmedNcrString('Project ID', NCR_ID_MAX_LENGTH, 'Project ID is required'),
    description: requiredTrimmedNcrString(
      'Description',
      NCR_DESCRIPTION_MAX_LENGTH,
      'Description is required',
    ),
    specificationReference: optionalTrimmedNcrString(
      'Specification reference',
      NCR_SPECIFICATION_REFERENCE_MAX_LENGTH,
    ),
    category: requiredTrimmedNcrString('Category', NCR_CATEGORY_MAX_LENGTH, 'Category is required'),
    severity: z.enum(['minor', 'major']).optional(),
    responsibleUserId: optionalTrimmedNcrString('Responsible user ID', NCR_ID_MAX_LENGTH),
    responsibleSubcontractorId: optionalTrimmedNcrString(
      'Responsible subcontractor ID',
      NCR_ID_MAX_LENGTH,
    ),
    linkedTestResultId: optionalTrimmedNcrString('Linked test result ID', NCR_ID_MAX_LENGTH),
    dueDate: optionalTrimmedNcrString('dueDate', NCR_DATE_INPUT_MAX_LENGTH),
    lotIds: z
      .array(requiredTrimmedNcrString('Lot ID', NCR_ID_MAX_LENGTH, 'Lot ID is required'))
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.responsibleUserId && data.responsibleSubcontractorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MUTUALLY_EXCLUSIVE_RESPONSIBLE_PARTY_MESSAGE,
        path: ['responsibleSubcontractorId'],
      });
    }
  });

export const updateNcrSchema = z
  .object({
    responsibleUserId: nullableOptionalTrimmedNcrString('Responsible user ID', NCR_ID_MAX_LENGTH),
    responsibleSubcontractorId: nullableOptionalTrimmedNcrString(
      'Responsible subcontractor ID',
      NCR_ID_MAX_LENGTH,
    ),
    comments: optionalTrimmedNcrString('Comments', NCR_COMMENT_MAX_LENGTH),
  })
  .superRefine((data, ctx) => {
    if (data.responsibleUserId && data.responsibleSubcontractorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MUTUALLY_EXCLUSIVE_RESPONSIBLE_PARTY_MESSAGE,
        path: ['responsibleSubcontractorId'],
      });
    }
  });

function normalizeUniqueTargetField(value: string) {
  return value.replace(/_/g, '').toLowerCase();
}

export function isUniqueConstraintOn(error: unknown, fields: string[]) {
  const candidate = error as { code?: unknown; meta?: { target?: unknown } };
  if (candidate?.code !== 'P2002') {
    return false;
  }

  const target = candidate.meta?.target;
  if (!Array.isArray(target)) {
    return false;
  }

  const normalizedTarget = target
    .filter((field): field is string => typeof field === 'string')
    .map(normalizeUniqueTargetField);
  return fields.every((field) => normalizedTarget.includes(normalizeUniqueTargetField(field)));
}

export function getNextNcrNumber(existingNcrNumbers: Array<{ ncrNumber: string }>) {
  const highestSequence = existingNcrNumbers.reduce((highest, ncr) => {
    const match = NCR_NUMBER_PATTERN.exec(ncr.ncrNumber);
    if (!match) {
      return highest;
    }

    return Math.max(highest, Number(match[1]));
  }, 0);

  return `NCR-${String(highestSequence + 1).padStart(4, '0')}`;
}

export function getOptionalQueryString(
  query: Record<string, unknown>,
  key: string,
  maxLength = MAX_NCR_QUERY_LENGTH,
): string | undefined {
  const value = query[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${key} query parameter must be a single value`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${key} query parameter must not be empty`);
  }
  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${key} query parameter must be ${maxLength} characters or less`);
  }
  return trimmed;
}

function assertValidDateComponent(value: string, errorMessage: string) {
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

export function parseOptionalNcrDueDate(value?: string): Date | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  assertValidDateComponent(trimmed, 'dueDate must be a valid date');
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw AppError.badRequest('dueDate must be a valid date');
  }

  return parsed;
}

export function parseNcrSortBy(
  sortBy?: string,
): keyof Prisma.NCROrderByWithRelationInput | undefined {
  if (!sortBy) {
    return undefined;
  }

  if (!NCR_SORT_FIELDS.has(sortBy)) {
    throw AppError.badRequest(`sortBy must be one of: ${[...NCR_SORT_FIELDS].join(', ')}`);
  }

  return sortBy as keyof Prisma.NCROrderByWithRelationInput;
}

export function parseNcrStatusFilter(status?: string): string | undefined {
  if (!status) {
    return undefined;
  }

  if (!NCR_STATUS_FILTERS.has(status)) {
    throw AppError.badRequest(`status must be one of: ${[...NCR_STATUS_FILTERS].join(', ')}`);
  }

  return status;
}

export function parseNcrSeverityFilter(severity?: string): string | undefined {
  if (!severity) {
    return undefined;
  }

  if (!NCR_SEVERITY_FILTERS.has(severity)) {
    throw AppError.badRequest(`severity must be one of: ${[...NCR_SEVERITY_FILTERS].join(', ')}`);
  }

  return severity;
}
