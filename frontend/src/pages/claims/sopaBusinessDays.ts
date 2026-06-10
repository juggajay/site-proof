/**
 * Per-state "business day" calendar for SOPA due-date maths.
 *
 * Source: docs/research/11-sopa-verification-2026-06.md §2.2.
 *
 * A SOPA "business day" excludes weekends, the relevant state's public
 * holidays, and a statutory end-of-year ("Christmas") window that differs by
 * state. This module supplies the per-state non-working-day data; the day
 * counting lives in `addBusinessDays` (utils.ts), which stays weekends-only
 * when no state is supplied (backwards compatible).
 *
 * ⚠️ VERIFICATION REQUIRED before these dates are relied on for statutory
 * deadlines:
 *  - STATE_PUBLIC_HOLIDAYS currently lists only the date-certain NATIONAL
 *    holidays (the ones observed on the same calendar date in every state).
 *    State-specific holidays (King's Birthday, Labour Day, Melbourne Cup, WA
 *    Day, regional show days) and weekend-substitute days are NOT yet encoded,
 *    so a date computed across one of those will be up to ~1 business day early.
 *    Completing and verifying each state's list against its official
 *    public-holiday source is a tracked follow-up, and the tables must be
 *    refreshed annually (they cover the current + next calendar year only).
 */

/** Inclusive end-of-year exclusion window. Months are 1-based; the window may
 *  wrap the year boundary (e.g. 22 Dec → 10 Jan). */
export interface SopaChristmasWindow {
  fromMonth: number;
  fromDay: number;
  toMonth: number;
  toDay: number;
}

// Statutory "Christmas"/end-of-year exclusion windows, by state (§2.2).
// NSW + SA: 27–31 Dec. QLD + post-reform VIC + WA: 22 Dec – 10 Jan (WA verified
// from s4(1) of the WA 2021 Act). TAS/ACT have no statutory window.
export const SOPA_CHRISTMAS_WINDOWS: Record<string, SopaChristmasWindow | undefined> = {
  NSW: { fromMonth: 12, fromDay: 27, toMonth: 12, toDay: 31 },
  SA: { fromMonth: 12, fromDay: 27, toMonth: 12, toDay: 31 },
  QLD: { fromMonth: 12, fromDay: 22, toMonth: 1, toDay: 10 },
  VIC: { fromMonth: 12, fromDay: 22, toMonth: 1, toDay: 10 },
  WA: { fromMonth: 12, fromDay: 22, toMonth: 1, toDay: 10 },
};

// Date-certain NATIONAL public holidays (same calendar date in every state),
// current + next calendar year. Easter dates are the gazetted 2026/2027 values.
// ⚠️ State-specific and weekend-substitute holidays are deliberately NOT here
// yet — see the file header. Append verified per-state dates in
// STATE_PUBLIC_HOLIDAYS below, not here.
const NATIONAL_PUBLIC_HOLIDAYS: readonly string[] = [
  // 2026
  '2026-01-01', // New Year's Day
  '2026-01-26', // Australia Day
  '2026-04-03', // Good Friday
  '2026-04-06', // Easter Monday
  '2026-04-25', // Anzac Day (Sat)
  '2026-12-25', // Christmas Day
  '2026-12-26', // Boxing Day (Sat)
  // 2027
  '2027-01-01', // New Year's Day
  '2027-01-26', // Australia Day
  '2027-03-26', // Good Friday
  '2027-03-29', // Easter Monday
  '2027-04-25', // Anzac Day (Sun)
  '2027-12-25', // Christmas Day (Sat)
  '2027-12-26', // Boxing Day (Sun)
];

// Per-state public-holiday tables. Each is national-only for now; append that
// state's verified state-specific dates (King's Birthday, Labour Day, etc.) to
// its array once confirmed against the official source.
export const STATE_PUBLIC_HOLIDAYS: Record<string, readonly string[]> = {
  NSW: NATIONAL_PUBLIC_HOLIDAYS,
  VIC: NATIONAL_PUBLIC_HOLIDAYS,
  QLD: NATIONAL_PUBLIC_HOLIDAYS,
  WA: NATIONAL_PUBLIC_HOLIDAYS,
  SA: NATIONAL_PUBLIC_HOLIDAYS,
  TAS: NATIONAL_PUBLIC_HOLIDAYS,
  ACT: NATIONAL_PUBLIC_HOLIDAYS,
};

/** True if (month,day) falls inside a possibly year-wrapping window. */
function inChristmasWindow(month: number, day: number, w: SopaChristmasWindow): boolean {
  const afterStart = month > w.fromMonth || (month === w.fromMonth && day >= w.fromDay);
  const beforeEnd = month < w.toMonth || (month === w.toMonth && day <= w.toDay);
  // Same-year window (e.g. 27–31 Dec): must satisfy both bounds.
  // Year-wrapping window (e.g. 22 Dec → 10 Jan): satisfy either side.
  return w.fromMonth <= w.toMonth ? afterStart && beforeEnd : afterStart || beforeEnd;
}

/** Local YYYY-MM-DD key. Uses local date parts to stay consistent with
 *  addBusinessDays, which advances the date with local getDate()/setDate(). */
function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Is `date` a non-working day for SOPA business-day counting?
 * - No `state` → weekends only (the original weekends-only behaviour).
 * - With `state` → weekends + that state's listed public holidays + its
 *   statutory Christmas window. An unrecognised state is treated as weekends
 *   only (the caller decides whether a due date applies at all).
 */
export function isSopaNonWorkingDay(date: Date, state?: string): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return true; // Sat/Sun
  if (!state) return false;

  if (STATE_PUBLIC_HOLIDAYS[state]?.includes(toLocalDateKey(date))) return true;

  const window = SOPA_CHRISTMAS_WINDOWS[state];
  if (window && inChristmasWindow(date.getMonth() + 1, date.getDate(), window)) return true;

  return false;
}
