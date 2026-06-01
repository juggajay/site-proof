import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/AppError.js';
import {
  DEFAULT_NOTIFICATION_LIMIT,
  MAX_NOTIFICATION_FILTER_LENGTH,
  MAX_NOTIFICATION_LIMIT,
  MAX_NOTIFICATION_MESSAGE_LENGTH,
  MAX_NOTIFICATION_TITLE_LENGTH,
  appendQueryParams,
  parseNonNegativeInteger,
  parseNotificationPagination,
  parseNotificationRouteId,
  parseOptionalDate,
  parseOptionalString,
  parseRequiredString,
} from './validation.js';

/**
 * Characterizes the pure request-validation helpers extracted verbatim from
 * backend/src/routes/notifications.ts. These lock the exact behaviour the
 * notification route handlers depend on — trimming, length/format guards, the
 * UTC-midnight date handling, pagination clamping, and the precise
 * `AppError.badRequest` messages — so the extraction is provably
 * behaviour-preserving and future edits cannot silently change a contract.
 */

/** Capture a thrown AppError so we can assert on status/code/message. */
function captureAppError(fn: () => unknown): AppError {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected function to throw an AppError, but it did not throw');
}

describe('notification validation constants', () => {
  it('pins the limit and length constants', () => {
    expect(DEFAULT_NOTIFICATION_LIMIT).toBe(20);
    expect(MAX_NOTIFICATION_LIMIT).toBe(100);
    expect(MAX_NOTIFICATION_FILTER_LENGTH).toBe(120);
    expect(MAX_NOTIFICATION_TITLE_LENGTH).toBe(200);
    expect(MAX_NOTIFICATION_MESSAGE_LENGTH).toBe(2000);
  });
});

describe('parseOptionalString', () => {
  it('returns undefined for undefined, null, and empty string', () => {
    expect(parseOptionalString(undefined, 'field')).toBeUndefined();
    expect(parseOptionalString(null, 'field')).toBeUndefined();
    expect(parseOptionalString('', 'field')).toBeUndefined();
  });

  it('returns undefined for whitespace-only strings (trimmed to empty)', () => {
    expect(parseOptionalString('   ', 'field')).toBeUndefined();
  });

  it('trims surrounding whitespace from a valid value', () => {
    expect(parseOptionalString('  hello  ', 'field')).toBe('hello');
  });

  it('throws a typed AppError when the value is not a string', () => {
    const error = captureAppError(() => parseOptionalString(42, 'status'));
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('status must be a string');
  });

  it('defaults the max length to MAX_NOTIFICATION_FILTER_LENGTH (120)', () => {
    const atLimit = 'a'.repeat(MAX_NOTIFICATION_FILTER_LENGTH);
    expect(parseOptionalString(atLimit, 'field')).toBe(atLimit);

    const overLimit = 'a'.repeat(MAX_NOTIFICATION_FILTER_LENGTH + 1);
    const error = captureAppError(() => parseOptionalString(overLimit, 'field'));
    expect(error.message).toBe('field must be 120 characters or less');
  });

  it('honours an explicit max length', () => {
    expect(parseOptionalString('abc', 'field', 3)).toBe('abc');
    const error = captureAppError(() => parseOptionalString('abcd', 'field', 3));
    expect(error.message).toBe('field must be 3 characters or less');
  });
});

describe('parseRequiredString', () => {
  it('returns the trimmed value when present', () => {
    expect(parseRequiredString('  value  ', 'name', 50)).toBe('value');
  });

  it('throws "<field> is required" when missing or blank', () => {
    expect(captureAppError(() => parseRequiredString(undefined, 'name', 50)).message).toBe(
      'name is required',
    );
    expect(captureAppError(() => parseRequiredString('   ', 'name', 50)).message).toBe(
      'name is required',
    );
  });

  it('propagates the type error from parseOptionalString', () => {
    expect(captureAppError(() => parseRequiredString(5, 'name', 50)).message).toBe(
      'name must be a string',
    );
  });

  it('propagates the length error from parseOptionalString', () => {
    expect(captureAppError(() => parseRequiredString('toolong', 'name', 3)).message).toBe(
      'name must be 3 characters or less',
    );
  });
});

describe('parseNotificationRouteId', () => {
  it('returns the id and defaults the field name to "id"', () => {
    expect(parseNotificationRouteId('abc-123')).toBe('abc-123');
    expect(captureAppError(() => parseNotificationRouteId(undefined)).message).toBe(
      'id is required',
    );
  });

  it('uses a custom field name', () => {
    expect(captureAppError(() => parseNotificationRouteId('', 'alertId')).message).toBe(
      'alertId is required',
    );
  });

  it('enforces the filter-length cap (120)', () => {
    const overLimit = 'a'.repeat(MAX_NOTIFICATION_FILTER_LENGTH + 1);
    expect(captureAppError(() => parseNotificationRouteId(overLimit)).message).toBe(
      'id must be 120 characters or less',
    );
  });
});

describe('parseNonNegativeInteger', () => {
  it('returns the default for undefined, null, and empty string', () => {
    expect(parseNonNegativeInteger(undefined, 'limit', 7)).toBe(7);
    expect(parseNonNegativeInteger(null, 'limit', 7)).toBe(7);
    expect(parseNonNegativeInteger('', 'limit', 7)).toBe(7);
  });

  it('parses a valid non-negative integer string', () => {
    expect(parseNonNegativeInteger('0', 'limit', 7)).toBe(0);
    expect(parseNonNegativeInteger('25', 'limit', 7)).toBe(25);
  });

  it('rejects non-string values', () => {
    expect(captureAppError(() => parseNonNegativeInteger(5, 'limit', 7)).message).toBe(
      'limit must be a non-negative integer',
    );
  });

  it('rejects non-digit strings (negatives, decimals, alphanumerics)', () => {
    for (const bad of ['-1', '1.5', 'abc', '12a', ' 12']) {
      expect(captureAppError(() => parseNonNegativeInteger(bad, 'limit', 7)).message).toBe(
        'limit must be a non-negative integer',
      );
    }
  });

  it('rejects digit strings that exceed the safe-integer range', () => {
    const huge = '9'.repeat(20);
    expect(captureAppError(() => parseNonNegativeInteger(huge, 'limit', 7)).message).toBe(
      'limit is too large',
    );
  });
});

describe('parseNotificationPagination', () => {
  it('returns the default limit and zero offset when query is empty', () => {
    expect(parseNotificationPagination({})).toEqual({
      limit: DEFAULT_NOTIFICATION_LIMIT,
      offset: 0,
    });
  });

  it('passes through valid limit and offset', () => {
    expect(parseNotificationPagination({ limit: '10', offset: '5' })).toEqual({
      limit: 10,
      offset: 5,
    });
  });

  it('clamps the limit to MAX_NOTIFICATION_LIMIT (100)', () => {
    expect(parseNotificationPagination({ limit: '500' })).toEqual({
      limit: MAX_NOTIFICATION_LIMIT,
      offset: 0,
    });
  });

  it('rejects a limit below 1', () => {
    expect(captureAppError(() => parseNotificationPagination({ limit: '0' })).message).toBe(
      'limit must be greater than 0',
    );
  });

  it('propagates integer-parse errors for offset', () => {
    expect(captureAppError(() => parseNotificationPagination({ offset: '-2' })).message).toBe(
      'offset must be a non-negative integer',
    );
  });
});

describe('parseOptionalDate', () => {
  it('returns undefined for undefined and empty string', () => {
    expect(parseOptionalDate(undefined, 'date')).toBeUndefined();
    expect(parseOptionalDate('', 'date')).toBeUndefined();
  });

  it('parses a valid YYYY-MM-DD date at UTC midnight', () => {
    const result = parseOptionalDate('2026-06-01', 'date');
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('accepts a valid leap-day', () => {
    expect(parseOptionalDate('2024-02-29', 'date')?.toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });

  it('rejects a malformed date string with a format error', () => {
    expect(captureAppError(() => parseOptionalDate('2026-6-1', 'date')).message).toBe(
      'date must be a date in YYYY-MM-DD format',
    );
  });

  it('rejects an out-of-range calendar date that does not round-trip', () => {
    expect(captureAppError(() => parseOptionalDate('2026-02-30', 'date')).message).toBe(
      'date must be a valid date',
    );
    expect(captureAppError(() => parseOptionalDate('2023-02-29', 'date')).message).toBe(
      'date must be a valid date',
    );
  });

  it('rejects an over-length value via the 10-character cap before format checking', () => {
    expect(captureAppError(() => parseOptionalDate('2026-06-001', 'date')).message).toBe(
      'date must be 10 characters or less',
    );
  });
});

describe('appendQueryParams', () => {
  it('returns the pathname unchanged when there are no params', () => {
    expect(appendQueryParams('/notifications')).toBe('/notifications');
    expect(appendQueryParams('/notifications', {})).toBe('/notifications');
  });

  it('appends provided params as a query string', () => {
    expect(appendQueryParams('/notifications', { status: 'active', type: 'overdue_ncr' })).toBe(
      '/notifications?status=active&type=overdue_ncr',
    );
  });

  it('skips params with undefined or empty-string values', () => {
    expect(appendQueryParams('/notifications', { status: 'active', type: undefined, q: '' })).toBe(
      '/notifications?status=active',
    );
  });

  it('URL-encodes param values', () => {
    expect(appendQueryParams('/notifications', { q: 'a b&c' })).toBe('/notifications?q=a+b%26c');
  });
});
