import { AppError } from '../../lib/AppError.js';

/**
 * Notification request-validation helpers, extracted verbatim from
 * backend/src/routes/notifications.ts as the first slice of the notifications
 * route split (engineering-health Workstream 1).
 *
 * These are pure, synchronous input parsers used by the notification route
 * handlers to validate query/body fields. They depend only on `AppError` and the
 * notification length/limit constants below — no Express, Prisma, or DB access —
 * so they are unit-testable in isolation. Behaviour (including the exact
 * `AppError.badRequest` messages and the UTC date handling) is preserved exactly
 * as it was inline in the route file.
 */

export const DEFAULT_NOTIFICATION_LIMIT = 20;
export const MAX_NOTIFICATION_LIMIT = 100;
export const MAX_NOTIFICATION_FILTER_LENGTH = 120;
export const MAX_NOTIFICATION_TITLE_LENGTH = 200;
export const MAX_NOTIFICATION_MESSAGE_LENGTH = 2000;

export function parseOptionalString(
  value: unknown,
  fieldName: string,
  maxLength = MAX_NOTIFICATION_FILTER_LENGTH,
): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} must be ${maxLength} characters or less`);
  }

  return trimmed;
}

export function parseRequiredString(value: unknown, fieldName: string, maxLength: number): string {
  const parsed = parseOptionalString(value, fieldName, maxLength);
  if (!parsed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  return parsed;
}

export function parseNotificationRouteId(value: unknown, fieldName = 'id'): string {
  return parseRequiredString(value, fieldName, MAX_NOTIFICATION_FILTER_LENGTH);
}

export function parseNonNegativeInteger(
  value: unknown,
  fieldName: string,
  defaultValue: number,
): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw AppError.badRequest(`${fieldName} must be a non-negative integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw AppError.badRequest(`${fieldName} is too large`);
  }

  return parsed;
}

export function parseNotificationPagination(query: Record<string, unknown>): {
  limit: number;
  offset: number;
} {
  const rawLimit = parseNonNegativeInteger(query.limit, 'limit', DEFAULT_NOTIFICATION_LIMIT);
  if (rawLimit < 1) {
    throw AppError.badRequest('limit must be greater than 0');
  }

  return {
    limit: Math.min(rawLimit, MAX_NOTIFICATION_LIMIT),
    offset: parseNonNegativeInteger(query.offset, 'offset', 0),
  };
}

export function parseOptionalDate(value: unknown, fieldName: string): Date | undefined {
  const rawValue = parseOptionalString(value, fieldName, 10);
  if (!rawValue) {
    return undefined;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawValue);
  if (!match) {
    throw AppError.badRequest(`${fieldName} must be a date in YYYY-MM-DD format`);
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
    throw AppError.badRequest(`${fieldName} must be a valid date`);
  }

  parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
}

export function appendQueryParams(
  pathname: string,
  params?: Record<string, string | undefined>,
): string {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}
