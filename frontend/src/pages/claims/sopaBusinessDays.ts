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
 * ✅ VERIFIED COVERAGE: 2026–2027, per-state gazetted public holidays.
 *
 * Sources (accessed 2026-06-11):
 *  - NSW:  https://www.nsw.gov.au/about-nsw/public-holidays
 *  - VIC:  https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026
 *          https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2027
 *  - QLD:  https://www.qld.gov.au/recreation/travel/holidays/public
 *  - WA:   https://www.wa.gov.au/service/employment/workplace-arrangements/public-holidays-western-australia
 *  - SA:   https://publicholidays.com.au/south-australia/ (mirrors SafeWork SA PDF)
 *          https://www.safework.sa.gov.au/__data/assets/pdf_file/0005/1237244/Public-Holidays-2025-2028.pdf
 *
 * ⚠️ ANNUAL REFRESH REQUIRED: These tables cover 2026 and 2027 only.
 *   They MUST be extended before 1 January 2028, or the staleness guard test
 *   will fail. Assign this as a recurring engineering chore each November.
 *
 * REGIONAL-HOLIDAY EXCLUSIONS:
 *   The following holidays are EXCLUDED because they apply to specific regions
 *   only, not the entire state:
 *   - QLD Royal Queensland Show (RNA Show): Brisbane metro area only.
 *   - WA King's Birthday (Karratha/Port Hedland): alternative date for those
 *     local government areas only; the state-wide date is used here.
 *   - SA Royal Adelaide Show: not a state-wide holiday (metropolitan Adelaide
 *     only; gazetted per-council). Not listed in SafeWork SA's statewide table.
 *   - VIC AFL Grand Final Friday: gazetted annually after the AFL fixture is
 *     released. 2026 date (Fri 25 Sep) is confirmed; 2027 (expected Fri 24 Sep)
 *     is still pending official gazetting as of 2026-06-11 and is therefore
 *     EXCLUDED until confirmed. Re-check before 2027 AFL season begins.
 *
 *   Direction-of-error note: excluding a regional or unconfirmed holiday means
 *   that a computed SOPA due date may land EARLIER than the true statutory date
 *   (i.e. the respondent gets slightly less time in computed output). It can
 *   never make the computed date LATER than the true date. This is the
 *   conservative direction for a claiming party.
 *
 * PART-DAY HOLIDAYS (SA):
 *   SA Christmas Eve (7pm–midnight, 24 Dec) and New Year's Eve (7pm–midnight,
 *   31 Dec) are part-day holidays. They are NOT counted as full non-working days
 *   for SOPA business-day purposes (a business day that starts before 7pm is
 *   still a business day). These dates are deliberately excluded from the table.
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
// State-specific and weekend-substitute holidays are encoded in STATE_PUBLIC_HOLIDAYS below.
const NATIONAL_PUBLIC_HOLIDAYS: readonly string[] = [
  // 2026
  '2026-01-01', // New Year's Day
  '2026-01-26', // Australia Day
  '2026-04-03', // Good Friday
  '2026-04-06', // Easter Monday
  '2026-04-25', // Anzac Day (Sat — substitute days are per-state below)
  '2026-12-25', // Christmas Day
  '2026-12-26', // Boxing Day / Proclamation Day (Sat — substitute days per-state below)
  // 2027
  '2027-01-01', // New Year's Day
  '2027-01-26', // Australia Day
  '2027-03-26', // Good Friday
  '2027-03-29', // Easter Monday
  '2027-04-25', // Anzac Day (Sun — substitute days are per-state below)
  '2027-12-25', // Christmas Day (Sat — substitute days per-state below)
  '2027-12-26', // Boxing Day / Proclamation Day (Sun — substitute days per-state below)
];

// ---------------------------------------------------------------------------
// Per-state public holiday tables (2026–2027).
// Each array starts from the national holidays then appends verified
// state-specific dates including: Easter Saturday, state-specific public
// holidays (Labour Day, King's Birthday, etc.) with their state-specific
// dates, and weekend-substitute/additional proclaimed days.
//
// Sources are listed in the file header. All dates verified against official
// state government sources as of 2026-06-11.
// ---------------------------------------------------------------------------

const NSW_HOLIDAYS_2026: readonly string[] = [
  // National (from above, re-stated for clarity)
  '2026-01-01', // New Year's Day
  '2026-01-26', // Australia Day
  '2026-04-03', // Good Friday
  '2026-04-04', // Easter Saturday
  '2026-04-05', // Easter Sunday
  '2026-04-06', // Easter Monday
  '2026-04-25', // Anzac Day (Sat)
  '2026-04-27', // Anzac Day — Additional Day (Mon, as Anzac Day is Sat)
  '2026-06-08', // King's Birthday (2nd Mon Jun)
  '2026-08-03', // Bank Holiday (1st Mon Aug — applies to banking/finance)
  '2026-10-05', // Labour Day (1st Mon Oct)
  '2026-12-25', // Christmas Day (Fri)
  '2026-12-26', // Boxing Day (Sat)
  '2026-12-28', // Boxing Day — Additional Day (Mon, as Boxing Day is Sat)
];

const NSW_HOLIDAYS_2027: readonly string[] = [
  '2027-01-01', // New Year's Day
  '2027-01-26', // Australia Day
  '2027-03-26', // Good Friday
  '2027-03-27', // Easter Saturday
  '2027-03-28', // Easter Sunday
  '2027-03-29', // Easter Monday
  '2027-04-25', // Anzac Day (Sun)
  '2027-04-26', // Anzac Day — Additional Day (Mon, as Anzac Day is Sun)
  '2027-06-14', // King's Birthday (2nd Mon Jun)
  '2027-08-02', // Bank Holiday (1st Mon Aug)
  '2027-10-04', // Labour Day (1st Mon Oct)
  '2027-12-25', // Christmas Day (Sat)
  '2027-12-26', // Boxing Day (Sun)
  '2027-12-27', // Christmas — Additional Day (Mon, as Christmas Day is Sat)
  '2027-12-28', // Boxing Day — Additional Day (Tue, as Boxing Day is Sun)
];

const VIC_HOLIDAYS_2026: readonly string[] = [
  '2026-01-01', // New Year's Day
  '2026-01-26', // Australia Day
  '2026-03-09', // Labour Day (2nd Mon Mar)
  '2026-04-03', // Good Friday
  '2026-04-04', // Easter Saturday
  '2026-04-05', // Easter Sunday
  '2026-04-06', // Easter Monday
  '2026-04-25', // Anzac Day (Sat — no VIC substitute for Sat Anzac Day)
  '2026-06-08', // King's Birthday (2nd Mon Jun)
  '2026-09-25', // AFL Grand Final Friday (Fri 25 Sep 2026 — gazetted; see header note)
  '2026-11-03', // Melbourne Cup Day (1st Tue Nov)
  '2026-12-25', // Christmas Day (Fri)
  '2026-12-26', // Boxing Day (Sat)
  '2026-12-28', // Boxing Day — Holiday (Mon, as Boxing Day is Sat)
];

const VIC_HOLIDAYS_2027: readonly string[] = [
  '2027-01-01', // New Year's Day
  '2027-01-26', // Australia Day
  '2027-03-08', // Labour Day (2nd Mon Mar)
  '2027-03-26', // Good Friday
  '2027-03-27', // Easter Saturday
  '2027-03-28', // Easter Sunday
  '2027-03-29', // Easter Monday
  '2027-04-25', // Anzac Day (Sun — no VIC substitute for Sun Anzac Day)
  '2027-06-14', // King's Birthday (2nd Mon Jun)
  // AFL Grand Final Friday 2027: expected Fri 24 Sep but NOT YET GAZETTED as of
  // 2026-06-11 — deliberately excluded; update once the AFL fixture is released.
  '2027-11-02', // Melbourne Cup Day (1st Tue Nov)
  '2027-12-25', // Christmas Day (Sat)
  '2027-12-26', // Boxing Day (Sun)
  '2027-12-27', // Christmas — Holiday (Mon, as Christmas Day is Sat)
  '2027-12-28', // Boxing Day — Holiday (Tue, as Boxing Day is Sun)
];

const QLD_HOLIDAYS_2026: readonly string[] = [
  '2026-01-01', // New Year's Day
  '2026-01-26', // Australia Day
  '2026-04-03', // Good Friday
  '2026-04-04', // Day after Good Friday (Easter Saturday equivalent)
  '2026-04-05', // Easter Sunday
  '2026-04-06', // Easter Monday
  '2026-04-25', // Anzac Day (Sat — no QLD substitute for Sat Anzac Day)
  '2026-05-04', // Labour Day (1st Mon May)
  '2026-10-05', // King's Birthday (1st Mon Oct — QLD observes in October)
  // Royal Queensland Show (RNA Show): Brisbane area ONLY — deliberately excluded
  '2026-12-25', // Christmas Day (Fri)
  '2026-12-26', // Boxing Day (Sat)
  '2026-12-28', // Boxing Day — Holiday (Mon, as Boxing Day is Sat)
];

const QLD_HOLIDAYS_2027: readonly string[] = [
  '2027-01-01', // New Year's Day
  '2027-01-26', // Australia Day
  '2027-03-26', // Good Friday
  '2027-03-27', // Day after Good Friday
  '2027-03-28', // Easter Sunday
  '2027-03-29', // Easter Monday
  '2027-04-25', // Anzac Day (Mon)
  '2027-05-03', // Labour Day (1st Mon May)
  '2027-10-04', // King's Birthday (1st Mon Oct)
  '2027-12-25', // Christmas Day (Sat)
  '2027-12-26', // Boxing Day (Sun)
  '2027-12-27', // Christmas — Holiday (Mon, as Christmas Day is Sat)
  '2027-12-28', // Boxing Day — Holiday (Tue, as Boxing Day is Sun)
];

const WA_HOLIDAYS_2026: readonly string[] = [
  '2026-01-01', // New Year's Day
  '2026-01-26', // Australia Day
  '2026-03-02', // Labour Day (1st Mon Mar)
  '2026-04-03', // Good Friday
  '2026-04-05', // Easter Sunday
  '2026-04-06', // Easter Monday
  '2026-04-25', // Anzac Day (Sat)
  '2026-04-27', // Anzac Day — Holiday (Mon, as Anzac Day is Sat)
  '2026-06-01', // Western Australia Day (1st Mon Jun)
  '2026-09-28', // King's Birthday (last Mon Sep — WA observes in September)
  '2026-12-25', // Christmas Day (Fri)
  '2026-12-26', // Boxing Day (Sat)
  '2026-12-28', // Boxing Day — Holiday (Mon, as Boxing Day is Sat)
];

const WA_HOLIDAYS_2027: readonly string[] = [
  '2027-01-01', // New Year's Day
  '2027-01-26', // Australia Day
  '2027-03-01', // Labour Day (1st Mon Mar)
  '2027-03-26', // Good Friday
  '2027-03-28', // Easter Sunday
  '2027-03-29', // Easter Monday
  '2027-04-25', // Anzac Day (Sun)
  '2027-04-26', // Anzac Day — Holiday (Mon, as Anzac Day is Sun)
  '2027-06-07', // Western Australia Day (1st Mon Jun)
  '2027-09-27', // King's Birthday (last Mon Sep)
  '2027-12-25', // Christmas Day (Sat)
  '2027-12-26', // Boxing Day (Sun)
  '2027-12-27', // Christmas — Holiday (Mon, as Christmas Day is Sat)
  '2027-12-28', // Boxing Day — Holiday (Tue, as Boxing Day is Sun)
];

// SA notes: Christmas Eve (24 Dec, 7pm–midnight) and New Year's Eve (31 Dec,
// 7pm–midnight) are PART-DAY holidays and excluded (see header). Proclamation
// Day is SA's equivalent of Boxing Day (26 Dec), observed 28 Dec when the 26th
// is a Saturday. Source: publicholidays.com.au/south-australia/ + SafeWork SA.
const SA_HOLIDAYS_2026: readonly string[] = [
  '2026-01-01', // New Year's Day
  '2026-01-26', // Australia Day
  '2026-03-09', // Adelaide Cup Day (2nd Mon Mar)
  '2026-04-03', // Good Friday
  '2026-04-04', // Day following Good Friday (Easter Saturday equivalent)
  '2026-04-05', // Easter Sunday
  '2026-04-06', // Easter Monday
  '2026-04-25', // Anzac Day (Sat — no SA substitute for Sat Anzac Day)
  '2026-06-08', // King's Birthday (2nd Mon Jun)
  '2026-10-05', // Labour Day (1st Mon Oct)
  '2026-12-25', // Christmas Day (Fri)
  '2026-12-26', // Proclamation Day (Sat)
  '2026-12-28', // Proclamation Day — Holiday (Mon, as Proclamation Day is Sat)
  // Royal Adelaide Show: metropolitan Adelaide ONLY — excluded (see header)
];

const SA_HOLIDAYS_2027: readonly string[] = [
  '2027-01-01', // New Year's Day
  '2027-01-26', // Australia Day
  '2027-03-08', // Adelaide Cup Day (2nd Mon Mar)
  '2027-03-26', // Good Friday
  '2027-03-27', // Day following Good Friday
  '2027-03-28', // Easter Sunday
  '2027-03-29', // Easter Monday
  '2027-04-25', // Anzac Day (Sun — no SA substitute for Sun Anzac Day)
  '2027-06-14', // King's Birthday (2nd Mon Jun)
  '2027-10-04', // Labour Day (1st Mon Oct)
  '2027-12-25', // Christmas Day (Sat)
  '2027-12-26', // Proclamation Day (Sun)
  '2027-12-27', // Christmas — Additional Holiday (Mon, as Christmas is Sat)
  '2027-12-28', // Proclamation Day — Additional Holiday (Tue, as Proclamation Day is Sun)
];

// Per-state public-holiday tables (2026 + 2027 combined, deduped).
export const STATE_PUBLIC_HOLIDAYS: Record<string, readonly string[]> = {
  NSW: [...new Set([...NSW_HOLIDAYS_2026, ...NSW_HOLIDAYS_2027])].sort(),
  VIC: [...new Set([...VIC_HOLIDAYS_2026, ...VIC_HOLIDAYS_2027])].sort(),
  QLD: [...new Set([...QLD_HOLIDAYS_2026, ...QLD_HOLIDAYS_2027])].sort(),
  WA: [...new Set([...WA_HOLIDAYS_2026, ...WA_HOLIDAYS_2027])].sort(),
  SA: [...new Set([...SA_HOLIDAYS_2026, ...SA_HOLIDAYS_2027])].sort(),
  // TAS/ACT: intentionally use national-only for backwards compatibility;
  // these states are excluded from SOPA_TIMEFRAMES (see constants.ts).
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

/**
 * The last calendar year covered by the holiday tables. Tests should assert
 * that today.getFullYear() <= SOPA_HOLIDAY_COVERAGE_THROUGH_YEAR so that
 * staleness is caught before the tables expire.
 */
export const SOPA_HOLIDAY_COVERAGE_THROUGH_YEAR = 2027;
