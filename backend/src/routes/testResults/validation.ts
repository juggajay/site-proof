import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';
import { parseOptionalGpsCoordinate } from '../itp/completionValidation.js';

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

// ---------------------------------------------------------------------------
// Wave C3 Phase B1 — the sample point (spec §5.2, §5.3, §9.1)
// ---------------------------------------------------------------------------

/** Provenance of a captured sample point. Mirrors the DB CHECK constraint. */
export const SAMPLE_LOCATION_SOURCES = ['gps', 'map_pick'] as const;

/**
 * The four columns that describe WHERE a sample was taken, as one list.
 *
 * One list, three readers: the write path, `NON_SUBSTANTIVE_EDIT_FIELDS`, and
 * the audit pre-image. `hasSubstantiveEdit` iterates `Object.keys(updateData)`,
 * so naming only "the coordinate" in prose would leave three of the four keys
 * un-verifying a verified row [C3R-A8].
 */
export const SAMPLE_LOCATION_FIELDS = [
  'sampleLatitude',
  'sampleLongitude',
  'sampleLocationSource',
  'sampleLocationAccuracyM',
] as const;

/**
 * Route-level sanity bound on a GPS accuracy radius, in metres. The DB column is
 * deliberately unconstrained (spec §7) — a zero or absent accuracy is a fact
 * worth recording rather than rejecting — but a non-numeric or absurd value at
 * the trust boundary should be a 400, not a stored number nobody can read.
 * ponytail: one bound, no `> 0` rule; tighten when a real value proves nonsense.
 */
export const MAX_SAMPLE_ACCURACY_M = 100_000;

const sampleLocationSourceSchema = z.enum(SAMPLE_LOCATION_SOURCES);

export type SampleLocationInput = {
  sampleLatitude?: number | null;
  sampleLongitude?: number | null;
  sampleLocationSource?: (typeof SAMPLE_LOCATION_SOURCES)[number] | null;
  sampleLocationAccuracyM?: number | null;
};

function parseSampleLocationSource(
  value: unknown,
): (typeof SAMPLE_LOCATION_SOURCES)[number] | null {
  if (value === null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  const parsed = sampleLocationSourceSchema.safeParse(value);
  if (!parsed.success) {
    throw AppError.badRequest(
      `sampleLocationSource must be one of: ${SAMPLE_LOCATION_SOURCES.join(', ')}`,
    );
  }

  return parsed.data;
}

/**
 * The stored row a PATCH is being merged onto. Only nullness matters here, so
 * the values stay `unknown` — Prisma hands back `Decimal | null` for the two
 * coordinates and this module has no reason to care which.
 */
export type StoredSampleLocation = {
  sampleLatitude: unknown;
  sampleLongitude: unknown;
  sampleLocationSource: unknown;
};

function mergedSampleValue(
  parsed: SampleLocationInput,
  existing: StoredSampleLocation | undefined,
  key: keyof StoredSampleLocation,
): unknown {
  return (key in parsed ? parsed[key] : existing?.[key]) ?? null;
}

/**
 * Wave C3 Phase B1. Validate the four sample-point keys off a request body.
 *
 * Only keys PRESENT in the body appear in the result, so a PATCH that never
 * mentions a location cannot clear one, and an explicit `null` on all four
 * (the "Clear" action) nulls them together — which the pair constraints
 * require to happen together anyway.
 *
 * The DB CHECK constraints (§5.3) remain the enforcement of record — prose
 * rules do not survive the next route that forgets them. Review M1: they are
 * also MIRRORED here, which is what the migration's own comment always claimed.
 * Without the mirror, `{sampleLatitude, sampleLongitude}` with no provenance —
 * the obvious API-client mistake — reached Postgres, came back a 23514 the
 * error handler has no mapping for, and was served as a 500 (plus a Sentry
 * page) instead of the 400 it is.
 *
 * The constraints bind the ROW, not the body, so `existing` supplies the stored
 * side of a PATCH: clearing only the provenance of a located row violates the
 * source pair rule even though the body mentions one key. Callers that create a
 * row pass nothing — every absent key is NULL.
 *
 * `sampleLocationAccuracyM` is deliberately absent from the coherence rules: it
 * carries no CHECK constraint, and mirroring means mirroring, not tightening.
 */
export function parseSampleLocationInput(
  body: Record<string, unknown>,
  existing?: StoredSampleLocation,
): SampleLocationInput {
  const parsed: SampleLocationInput = {};

  if (body.sampleLatitude !== undefined) {
    parsed.sampleLatitude = parseOptionalGpsCoordinate(
      body.sampleLatitude,
      'sampleLatitude',
      -90,
      90,
    );
  }
  if (body.sampleLongitude !== undefined) {
    parsed.sampleLongitude = parseOptionalGpsCoordinate(
      body.sampleLongitude,
      'sampleLongitude',
      -180,
      180,
    );
  }
  if (body.sampleLocationSource !== undefined) {
    parsed.sampleLocationSource = parseSampleLocationSource(body.sampleLocationSource);
  }
  if (body.sampleLocationAccuracyM !== undefined) {
    // ponytail: `parseOptionalGpsCoordinate` is a range-checked optional decimal
    // parser that accepts numbers AND strings. Reused rather than cloned; the
    // only cost is its "decimal coordinate" wording on a malformed string.
    parsed.sampleLocationAccuracyM = parseOptionalGpsCoordinate(
      body.sampleLocationAccuracyM,
      'sampleLocationAccuracyM',
      0,
      MAX_SAMPLE_ACCURACY_M,
    );
  }

  // Mirrors `test_results_sample_point_pair_check`: half a coordinate is not a
  // location.
  const latitude = mergedSampleValue(parsed, existing, 'sampleLatitude');
  const longitude = mergedSampleValue(parsed, existing, 'sampleLongitude');
  if ((latitude === null) !== (longitude === null)) {
    throw AppError.badRequest(
      'sampleLatitude and sampleLongitude must be supplied together, and cleared together.',
    );
  }

  // Mirrors `test_results_sample_location_source_pair_check`: provenance without
  // a coordinate is noise; a coordinate without provenance is unattributable
  // evidence. Neither may exist alone.
  const source = mergedSampleValue(parsed, existing, 'sampleLocationSource');
  if ((source === null) !== (latitude === null)) {
    throw AppError.badRequest(
      `A sample point needs both a coordinate pair and its provenance: send sampleLocationSource (${SAMPLE_LOCATION_SOURCES.join(
        ' or ',
      )}) with the coordinates, or clear all three together.`,
    );
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
