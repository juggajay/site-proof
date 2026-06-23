import { AppError } from '../../lib/AppError.js';
import { zonedDateParts, zonedWallClockToUtc } from '../../lib/projectTimeZone.js';
import { DATE_COMPONENT_RE, DATE_ONLY_RE } from './validation.js';

// =============================================================================
// Hold point date/time parsing helpers. Extracted verbatim from holdpoints.ts to
// preserve exact parse + calendar-validity behavior (UTC date-only handling,
// local-time release date/time, and AppError messages).
// =============================================================================

export function parseScheduledDateInput(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  assertValidDateComponent(value, 'scheduledDate must be a valid date');

  const dateOnlyMatch = DATE_ONLY_RE.exec(value);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw AppError.badRequest('scheduledDate must be a valid date');
    }

    return date;
  }

  const parsedDate = new Date(value);
  if (!Number.isFinite(parsedDate.getTime())) {
    throw AppError.badRequest('scheduledDate must be a valid date');
  }

  return parsedDate;
}

/**
 * Parse a hold-point release date/time into the true absolute instant (M84).
 *
 * Wall-clock inputs (a `YYYY-MM-DD` date, optionally with `HH:mm`) are
 * interpreted in the PROJECT'S timezone, not the server's, so the stored
 * instant is correct regardless of where the API runs. Full ISO date-time
 * strings carry their own offset and are passed through unchanged.
 */
export function parseReleaseDateTimeInput(
  releaseDate: string | null | undefined,
  releaseTime: string | null | undefined,
  timeZone: string,
): Date {
  if (!releaseDate) {
    if (!releaseTime) {
      return new Date();
    }
    const [hours, minutes] = releaseTime.split(':').map(Number);
    // "Today" in the project's timezone at the supplied wall-clock time.
    const today = zonedDateParts(new Date(), timeZone);
    return zonedWallClockToUtc(today.year, today.month, today.day, hours, minutes, timeZone);
  }

  assertValidDateComponent(releaseDate, 'releaseDate must be a valid date');

  const dateOnlyMatch = DATE_ONLY_RE.exec(releaseDate);
  if (!dateOnlyMatch) {
    const parsedDate = new Date(releaseDate);
    if (!Number.isFinite(parsedDate.getTime())) {
      throw AppError.badRequest('releaseDate must be a valid date');
    }

    return parsedDate;
  }

  const year = Number(dateOnlyMatch[1]);
  const month = Number(dateOnlyMatch[2]);
  const day = Number(dateOnlyMatch[3]);
  const [hours, minutes] = releaseTime ? releaseTime.split(':').map(Number) : [0, 0];

  return zonedWallClockToUtc(year, month, day, hours, minutes, timeZone);
}

export function parseRequiredDateTimeInput(value: string, fieldName: string): Date {
  assertValidDateComponent(value, `${fieldName} must be a valid date and time`);

  const parsedDate = new Date(value);
  if (!Number.isFinite(parsedDate.getTime())) {
    throw AppError.badRequest(`${fieldName} must be a valid date and time`);
  }

  return parsedDate;
}

export function assertValidDateComponent(value: string, errorMessage: string): void {
  const match = DATE_COMPONENT_RE.exec(value);
  if (!match) {
    return;
  }

  const [, year, month, day] = match;
  const dateComponent = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    dateComponent.getUTCFullYear() !== Number(year) ||
    dateComponent.getUTCMonth() !== Number(month) - 1 ||
    dateComponent.getUTCDate() !== Number(day)
  ) {
    throw AppError.badRequest(errorMessage);
  }
}
