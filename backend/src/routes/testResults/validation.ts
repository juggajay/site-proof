import { AppError } from '../../lib/AppError.js';

/**
 * Pure test-result input validation, extracted verbatim from
 * backend/src/routes/testResults.ts (Slice 1 of the testResults refactor map).
 *
 * These are side-effect-free string/number/date normalizers, the length and
 * pattern constants they rely on, and the allowed-value lists for pass/fail and
 * request-form formats. They throw the exact same AppError.badRequest errors the
 * route file threw inline, so HTTP status (400 VALIDATION_ERROR) and the message
 * strings the integration suite asserts are unchanged. No DB, auth, or HTML
 * concerns live here — the route handlers still own all of that.
 */

export const MAX_UPLOAD_PROJECT_ID_LENGTH = 120;
export const MAX_TEST_ID_LENGTH = 120;
export const MAX_TEST_TYPE_LENGTH = 160;
export const MAX_TEST_REQUEST_NUMBER_LENGTH = 120;
export const MAX_TEST_TEXT_LENGTH = 240;
export const MAX_SAMPLE_LOCATION_LENGTH = 500;
export const MAX_RESULT_UNIT_LENGTH = 80;
export const MAX_REJECTION_REASON_LENGTH = 3000;
export const MAX_DATE_INPUT_LENGTH = 32;
export const MAX_SEARCH_LENGTH = 200;
export const DATE_ONLY_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export const DECIMAL_NUMBER_PATTERN = /^[+-]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;
export const PASS_FAIL_VALUES = ['pass', 'fail', 'pending'] as const;
export const REQUEST_FORM_FORMATS = ['html', 'json'] as const;

export function normalizeOptionalString(
  value: unknown,
  fieldName: string,
  maxLength = MAX_TEST_TEXT_LENGTH,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

export function normalizeRequiredString(
  value: unknown,
  fieldName: string,
  maxLength = MAX_TEST_TEXT_LENGTH,
): string {
  const normalized = normalizeOptionalString(value, fieldName, maxLength);
  if (!normalized) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  return normalized;
}

export function parseTestResultRouteParam(
  value: unknown,
  fieldName: string,
  maxLength = MAX_TEST_ID_LENGTH,
): string {
  return normalizeRequiredString(value, fieldName, maxLength);
}

export function toNullableString(
  value: unknown,
  fieldName = 'value',
  maxLength = MAX_TEST_TEXT_LENGTH,
): string | null {
  return normalizeOptionalString(value, fieldName, maxLength) ?? null;
}

export function normalizeOptionalQueryString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string | undefined {
  const normalized = normalizeOptionalString(value, fieldName, maxLength);
  if (normalized === null) {
    throw AppError.badRequest(`${fieldName} query parameter must not be empty`);
  }
  return normalized;
}

export function parseRequestFormFormat(value: unknown): (typeof REQUEST_FORM_FORMATS)[number] {
  if (value === undefined) {
    return 'html';
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest('format query parameter must be a single value');
  }

  const normalized = value.trim();
  if (!REQUEST_FORM_FORMATS.includes(normalized as (typeof REQUEST_FORM_FORMATS)[number])) {
    throw AppError.badRequest(`format must be one of: ${REQUEST_FORM_FORMATS.join(', ')}`);
  }

  return normalized as (typeof REQUEST_FORM_FORMATS)[number];
}

export function parseStrictDateOnlyMatch(dateOnly: RegExpExecArray): Date | null {
  const year = Number(dateOnly[1]);
  const month = Number(dateOnly[2]);
  const day = Number(dateOnly[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function toNullableDate(value: unknown, fieldName = 'date'): Date | null {
  const normalized = normalizeOptionalString(value, fieldName, MAX_DATE_INPUT_LENGTH);
  if (!normalized) {
    return null;
  }

  const dateOnly = DATE_ONLY_INPUT_PATTERN.exec(normalized);
  if (!dateOnly) {
    throw AppError.badRequest(`${fieldName} must be a date in YYYY-MM-DD format`);
  }

  const date = parseStrictDateOnlyMatch(dateOnly);
  if (!date) {
    throw AppError.badRequest(`${fieldName} must be a valid date`);
  }

  return date;
}

export function toNullableFloat(value: unknown, fieldName = 'value'): number | null {
  const normalized = normalizeOptionalString(value, fieldName, MAX_RESULT_UNIT_LENGTH);
  if (!normalized) {
    return null;
  }

  if (!DECIMAL_NUMBER_PATTERN.test(normalized)) {
    throw AppError.badRequest(`${fieldName} must be a valid number`);
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw AppError.badRequest(`${fieldName} must be a valid number`);
  }

  return parsed;
}

export function normalizePassFail(
  value: unknown,
  defaultValue?: (typeof PASS_FAIL_VALUES)[number],
): (typeof PASS_FAIL_VALUES)[number] | undefined {
  const normalized = normalizeOptionalString(value, 'passFail', 20);
  if (!normalized) {
    return defaultValue;
  }

  const candidate = normalized.toLowerCase();
  if (!PASS_FAIL_VALUES.includes(candidate as (typeof PASS_FAIL_VALUES)[number])) {
    throw AppError.badRequest('passFail must be pass, fail, or pending');
  }

  return candidate as (typeof PASS_FAIL_VALUES)[number];
}
