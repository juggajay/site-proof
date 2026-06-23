import { describe, expect, it } from 'vitest';

import { AppError } from '../../lib/AppError.js';
import {
  assertValidDateComponent,
  parseReleaseDateTimeInput,
  parseRequiredDateTimeInput,
  parseScheduledDateInput,
} from './dateParsing.js';

// Characterization tests for the hold-point date/time parsing helpers extracted
// from holdpoints.ts. These freeze the *current* behavior exactly; they are not
// a redesign. UTC-constructed results are asserted via toISOString(); the
// release date-only branch is built with local Date components, so it is read
// back with local getters to stay timezone-stable.

function expectBadRequest(fn: () => unknown, message: string): void {
  expect(fn).toThrow(AppError);
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(400);
    expect((err as AppError).message).toBe(message);
  }
}

describe('assertValidDateComponent', () => {
  it('passes a valid calendar date without throwing', () => {
    expect(() => assertValidDateComponent('2026-01-15', 'bad date')).not.toThrow();
  });

  it('rejects an impossible calendar date with the supplied message', () => {
    expectBadRequest(
      () => assertValidDateComponent('2026-02-30', 'scheduledDate must be a valid date'),
      'scheduledDate must be a valid date',
    );
  });

  it('rejects an out-of-range month with the supplied message', () => {
    expectBadRequest(
      () => assertValidDateComponent('2026-13-01', 'releaseDate must be a valid date'),
      'releaseDate must be a valid date',
    );
  });

  it('validates the date component of a date-time string', () => {
    expect(() => assertValidDateComponent('2026-03-15T10:30:00Z', 'bad')).not.toThrow();
    expectBadRequest(() => assertValidDateComponent('2026-02-30T10:30:00Z', 'bad'), 'bad');
  });

  it('ignores strings that do not start with a YYYY-MM-DD component (regex gate)', () => {
    // Inputs that do not match DATE_COMPONENT_RE are not validated and never throw.
    expect(() => assertValidDateComponent('not-a-date', 'bad')).not.toThrow();
    expect(() => assertValidDateComponent('15/03/2026', 'bad')).not.toThrow();
  });
});

describe('parseScheduledDateInput', () => {
  it('returns null for falsy input', () => {
    expect(parseScheduledDateInput(null)).toBeNull();
    expect(parseScheduledDateInput(undefined)).toBeNull();
    expect(parseScheduledDateInput('')).toBeNull();
  });

  it('parses a valid YYYY-MM-DD date as UTC midnight', () => {
    const result = parseScheduledDateInput('2026-03-15');
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });

  it('throws for an impossible calendar date', () => {
    expectBadRequest(
      () => parseScheduledDateInput('2026-02-30'),
      'scheduledDate must be a valid date',
    );
  });

  it('preserves the ISO date-time fallback for non-date-only input', () => {
    const result = parseScheduledDateInput('2026-03-15T10:30:00Z');
    expect(result?.toISOString()).toBe('2026-03-15T10:30:00.000Z');
  });

  it('throws for an unparseable non-date-only string', () => {
    expectBadRequest(
      () => parseScheduledDateInput('not-a-date'),
      'scheduledDate must be a valid date',
    );
  });
});

describe('parseReleaseDateTimeInput (M84: project-timezone aware)', () => {
  function timeOfDayInZone(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  it('interprets a date-only value plus a time in the project timezone (Brisbane, UTC+10)', () => {
    // 14:30 in Brisbane is 04:30 UTC, deterministic regardless of the server clock.
    const result = parseReleaseDateTimeInput('2026-03-15', '14:30', 'Australia/Brisbane');
    expect(result.toISOString()).toBe('2026-03-15T04:30:00.000Z');
  });

  it('applies the project zone DST offset (Sydney AEDT vs Perth)', () => {
    expect(parseReleaseDateTimeInput('2026-01-15', '12:00', 'Australia/Sydney').toISOString()).toBe(
      '2026-01-15T01:00:00.000Z',
    );
    expect(parseReleaseDateTimeInput('2026-01-15', '12:00', 'Australia/Perth').toISOString()).toBe(
      '2026-01-15T04:00:00.000Z',
    );
  });

  it('defaults to midnight in the project timezone when a date-only value has no time', () => {
    // Midnight in Brisbane (UTC+10) is 14:00 the previous day in UTC.
    const result = parseReleaseDateTimeInput('2026-03-15', null, 'Australia/Brisbane');
    expect(result.toISOString()).toBe('2026-03-14T14:00:00.000Z');
  });

  it('throws for an impossible calendar release date', () => {
    expectBadRequest(
      () => parseReleaseDateTimeInput('2026-02-30', '10:00', 'Australia/Sydney'),
      'releaseDate must be a valid date',
    );
  });

  it('preserves the ISO date-time fallback when the value is not date-only', () => {
    const result = parseReleaseDateTimeInput('2026-03-15T10:30:00Z', null, 'Australia/Brisbane');
    expect(result.toISOString()).toBe('2026-03-15T10:30:00.000Z');
  });

  it('throws for an unparseable non-date-only release date', () => {
    expectBadRequest(
      () => parseReleaseDateTimeInput('garbage-date', null, 'Australia/Sydney'),
      'releaseDate must be a valid date',
    );
  });

  it('uses the current day in the project timezone when only a time is given', () => {
    const result = parseReleaseDateTimeInput(null, '09:15', 'Australia/Brisbane');
    // The instant reads as 09:15 on the project's wall clock.
    expect(timeOfDayInZone(result, 'Australia/Brisbane')).toBe('09:15');
  });

  it('returns the current instant when neither date nor time is given', () => {
    const before = Date.now();
    const result = parseReleaseDateTimeInput(null, null, 'Australia/Sydney');
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });
});

describe('parseRequiredDateTimeInput', () => {
  it('parses a valid ISO date-time', () => {
    const result = parseRequiredDateTimeInput('2026-03-15T10:30:00Z', 'requestedDateTime');
    expect(result.toISOString()).toBe('2026-03-15T10:30:00.000Z');
  });

  it('throws the field-specific message for unparseable input', () => {
    expectBadRequest(
      () => parseRequiredDateTimeInput('not-a-date', 'requestedDateTime'),
      'requestedDateTime must be a valid date and time',
    );
  });

  it('throws the field-specific message for an impossible calendar date', () => {
    expectBadRequest(
      () => parseRequiredDateTimeInput('2026-02-30', 'requestedDateTime'),
      'requestedDateTime must be a valid date and time',
    );
  });
});
