export const DEFAULT_APP_TIME_ZONE = 'Australia/Sydney';

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function getDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Could not format local date key');
  }

  return { year, month, day };
}

export function formatDateKey(
  date: Date = new Date(),
  timeZone: string = DEFAULT_APP_TIME_ZONE,
): string {
  const { year, month, day } = getDateParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string): { year: number; month: number; day: number } | null {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) {
    return null;
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
    return null;
  }

  return { year, month, day };
}

export function dateKeyToUtcDayNumber(value: string): number | null {
  const parsed = parseDateKey(value);
  if (!parsed) {
    return null;
  }

  return Math.floor(Date.UTC(parsed.year, parsed.month - 1, parsed.day) / DAY_MS);
}

export function formatDateInputValue(
  value: Date | string | null | undefined,
  timeZone: string = DEFAULT_APP_TIME_ZONE,
): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const parsedDateKey = parseDateKey(value);
    if (parsedDateKey) {
      return value;
    }

    const parsedDate = new Date(value);
    return Number.isFinite(parsedDate.getTime()) ? formatDateKey(parsedDate, timeZone) : null;
  }

  return Number.isFinite(value.getTime()) ? formatDateKey(value, timeZone) : null;
}

export function getCalendarDaysSince(
  value: Date | string | null | undefined,
  now: Date | string = new Date(),
  timeZone: string = DEFAULT_APP_TIME_ZONE,
): number {
  const startKey = formatDateInputValue(value, timeZone);
  const endKey = formatDateInputValue(now, timeZone);

  if (!startKey || !endKey) {
    return 0;
  }

  const startDay = dateKeyToUtcDayNumber(startKey);
  const endDay = dateKeyToUtcDayNumber(endKey);

  if (startDay === null || endDay === null) {
    return 0;
  }

  return endDay - startDay;
}
