/**
 * Project timezone helpers (audit M84).
 *
 * SiteProof targets Australian civil contractors. Legally-significant instants
 * (hold-point releases) and "wall-clock" schedules (daily diary reminders) must
 * be interpreted and displayed in the PROJECT'S local timezone, derived from
 * the project's state — not the server's clock. Instants are always stored as
 * the true absolute UTC moment; these helpers only convert to/from a project's
 * local wall clock.
 */

export const DEFAULT_PROJECT_TIME_ZONE = 'Australia/Sydney';

// NSW/VIC/ACT/TAS share the Australia/Sydney offset (AEST/AEDT) per the product
// decision; WA, SA, QLD and NT have their own zones (QLD/WA observe no DST).
const STATE_TIME_ZONES: Record<string, string> = {
  WA: 'Australia/Perth',
  SA: 'Australia/Adelaide',
  NT: 'Australia/Darwin',
  QLD: 'Australia/Brisbane',
  NSW: 'Australia/Sydney',
  VIC: 'Australia/Sydney',
  ACT: 'Australia/Sydney',
  TAS: 'Australia/Sydney',
};

/**
 * IANA timezone for a project given its (free-text) state. Case/whitespace
 * insensitive; unknown or missing states fall back to {@link DEFAULT_PROJECT_TIME_ZONE}.
 */
export function projectTimeZoneFromState(state: string | null | undefined): string {
  if (!state) {
    return DEFAULT_PROJECT_TIME_ZONE;
  }
  return STATE_TIME_ZONES[state.trim().toUpperCase()] ?? DEFAULT_PROJECT_TIME_ZONE;
}

/**
 * The offset (ms) between a UTC instant and the same wall clock shown in
 * `timeZone` — i.e. how far `timeZone`'s local time is ahead of UTC at that
 * instant (DST-aware via Intl).
 */
function zoneOffsetMs(utcMillis: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMillis));

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  let hour = get('hour');
  if (hour === 24) hour = 0; // some engines emit '24' for midnight
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );
  return asUtc - utcMillis;
}

/**
 * Convert a wall-clock time expressed in `timeZone` to the absolute UTC instant.
 * `month` is 1-indexed. DST-correct for all instants except the ~1hr/year
 * ambiguous transition windows, where it resolves to a single deterministic
 * instant (acceptable for release timestamps).
 */
export function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timeZone: string,
): Date {
  // First treat the wall clock as if it were UTC, then subtract the zone's
  // offset at that instant to land on the true UTC moment.
  const utcGuess = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const offset = zoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess - offset);
}

export function zonedStartOfDayToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  return zonedWallClockToUtc(year, month, day, 0, 0, timeZone);
}

export function zonedEndOfDayToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDayStart = zonedStartOfDayToUtc(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate(),
    timeZone,
  );
  return new Date(nextDayStart.getTime() - 1);
}

/**
 * The calendar date (1-indexed month) shown by `date` in `timeZone`. Useful for
 * resolving "today" in a project's local zone.
 */
export function zonedDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  return { year: get('year'), month: get('month'), day: get('day') };
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function zonedDateString(date: Date, timeZone: string): string {
  const parts = zonedDateParts(date, timeZone);
  return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
}

export function zonedMonthString(date: Date, timeZone: string): string {
  const parts = zonedDateParts(date, timeZone);
  return `${parts.year}-${padDatePart(parts.month)}`;
}
