import { AppError } from '../../lib/AppError.js';

const GPS_COORDINATE_PATTERN = /^-?(?:\d+|\d+\.\d+|\.\d+)$/;
const ITP_COMPLETION_ROUTE_PARAM_MAX_LENGTH = 128;

export function parseCompletionRouteParam(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a single value`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest(`${field} is required`);
  }

  if (normalized.length > ITP_COMPLETION_ROUTE_PARAM_MAX_LENGTH) {
    throw AppError.badRequest(`${field} is too long`);
  }

  return normalized;
}

export function parseRequiredCompletionQueryString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} is required`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest(`${field} is required`);
  }

  return normalized;
}

export function parseOptionalGpsCoordinate(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? (() => {
            const normalized = value.trim();
            if (!normalized) return null;
            if (!GPS_COORDINATE_PATTERN.test(normalized)) {
              throw AppError.badRequest(`${field} must be a valid decimal coordinate`);
            }
            return Number(normalized);
          })()
        : Number.NaN;

  if (parsed === null) {
    return null;
  }

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw AppError.badRequest(`${field} must be between ${min} and ${max}`);
  }

  return parsed;
}
