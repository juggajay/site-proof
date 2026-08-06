/**
 * Utility functions for Claims-related pages and components.
 * Extracted from ClaimsPage.tsx for reusability.
 */

import type { Claim, CertificationDueStatus, PaymentDueStatus, ConformedLot } from './types';
import { SOPA_TIMEFRAMES } from './constants';
import {
  isSopaNonWorkingDay,
  SOPA_HOLIDAY_COVERAGE_THROUGH_YEAR,
  toLocalDateKey,
} from './sopaBusinessDays';
import { downloadBrandedCsv, type CsvBrandingContext } from '@/lib/csv';
import {
  DEFAULT_APP_TIME_ZONE,
  formatDateInputValue,
  formatDateKey,
  getCalendarDaysSince,
  parseDateKey,
} from '@/lib/localDate';
import { parseOptionalNonNegativeDecimalInput } from '@/lib/numericInput';

const VIC_SOPA_REFORM_EFFECTIVE_DATE = '2026-04-15';

/**
 * M4 — a SOPA deadline is a statutory calendar DATE in the project's
 * jurisdiction, never an instant in the viewer's browser. Everything in this
 * file therefore speaks `YYYY-MM-DD` keys resolved in the project timezone: the
 * submission anchor, the computed due dates, the countdown, and the printed
 * chip. A Perth viewer and a Sydney viewer read one date and one number.
 *
 * ponytail: the app-wide constant IS the project timezone — there is no
 * per-project (or per-state) timezone column; `schema.prisma` carries `state`
 * for the jurisdiction's business-day rules only. Swap this one constant for a
 * project field the day one lands; nothing else here needs to change.
 */
const SOPA_TIME_ZONE = DEFAULT_APP_TIME_ZONE;

/** Format a number as AUD currency, or return '-' for null */
export function formatCurrency(amount: number | null): string {
  if (amount === null) return '-';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format integer CENTS from the API as AUD. Dividing an integer by 100 is exact
 * at any amount this product will ever hold, and — unlike `formatCurrency` —
 * nothing is summed on the way in: the server already did every addition on
 * Prisma Decimal. Never add cents from two cells and pass the result here; ask
 * the server for the total instead.
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Add N business days to a date.
 * Without `state`, "business day" means weekends-only (the original behaviour).
 * With `state`, it also skips that jurisdiction's public holidays and statutory
 * Christmas window per the SOPA "business day" definition (see sopaBusinessDays).
 */
export function addBusinessDays(startDate: Date, days: number, state?: string): Date {
  const currentDate = new Date(startDate);
  let businessDays = days;

  while (businessDays > 0) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (!isSopaNonWorkingDay(currentDate, state)) {
      businessDays--;
    }
  }

  return currentDate;
}

/**
 * Staleness guard: the per-state SOPA holiday tables only cover up to and
 * including SOPA_HOLIDAY_COVERAGE_THROUGH_YEAR. If a computed due date lands in a
 * later year, that year's public holidays are not modelled, so the business-day
 * count would be wrong (too few non-working days → a confidently-too-early date).
 * In that case callers should show no due date rather than a wrong one. Because
 * the due date is the latest date in the counted span, checking its year alone
 * detects any span that reached an uncovered year.
 */
function isBeyondSopaHolidayCoverage(dueDateKey: string): boolean {
  return Number(dueDateKey.slice(0, 4)) > SOPA_HOLIDAY_COVERAGE_THROUGH_YEAR;
}

/**
 * The calendar date a claim was submitted, IN THE PROJECT TIMEZONE. This is the
 * anchor for every SOPA computation, and the date the VIC reform cutover is
 * compared against.
 *
 * It used to be read two different wrong ways in the same function: the UTC
 * date prefix of the ISO string for the reform gate, and the viewer's local
 * calendar date for the business-day walk. A claim submitted 15 Apr 2026
 * 01:00 Sydney is `2026-04-14T15:00Z`, so the prefix said 14 Apr (pre-reform)
 * for a claim that was legally lodged on the 15th.
 */
function getSubmittedDateKey(submittedAt: string): string | null {
  return formatDateInputValue(submittedAt, SOPA_TIME_ZONE);
}

/**
 * The business-day walk moves LOCAL date parts (`addBusinessDays` /
 * `isSopaNonWorkingDay`), so it is seeded with the local midnight of the
 * project-timezone calendar date. From there the walk is pure calendar
 * arithmetic and lands on the same date in every viewer's browser.
 */
function sopaAnchorDate(submittedAt: string): Date | null {
  const key = getSubmittedDateKey(submittedAt);
  const parts = key ? parseDateKey(key) : null;
  return parts ? new Date(parts.year, parts.month - 1, parts.day) : null;
}

/** Compute a SOPA due date as a `YYYY-MM-DD` key, or null when not computable. */
function sopaDueDateKey(submittedAt: string, state: string, businessDays: number): string | null {
  const anchor = sopaAnchorDate(submittedAt);
  if (!anchor) return null;
  const dueDateKey = toLocalDateKey(addBusinessDays(anchor, businessDays, state));
  return isBeyondSopaHolidayCoverage(dueDateKey) ? null : dueDateKey;
}

/**
 * A `YYYY-MM-DD` key as the en-AU short date. Deliberately string arithmetic
 * rather than `new Date(key).toLocaleDateString()`: a bare date string parses
 * as UTC midnight, which renders as the PREVIOUS day for any viewer west of
 * Greenwich. A statutory date has no timezone to render in.
 */
export function formatSopaDate(dateKey: string): string {
  const parts = parseDateKey(dateKey);
  if (!parts) return dateKey;
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month).padStart(2, '0');
  return `${day}/${month}/${parts.year}`;
}

/**
 * Normalise anything that claims to be a due date — a server ISO instant
 * (`claim.paymentDueDate`) or one of our own computed keys — to a
 * project-timezone calendar date key, so both print the same day.
 */
export function toSopaDateKey(value: string | null | undefined): string | null {
  return formatDateInputValue(value, SOPA_TIME_ZONE);
}

function getSopaTimeframeForClaim(
  submittedAt: string,
  state: string,
): (typeof SOPA_TIMEFRAMES)[string] | null {
  const timeframe = SOPA_TIMEFRAMES[state];
  if (!timeframe) return null;

  // VIC reforms commenced on 15 Apr 2026. Until the post-reform workflow is
  // lawyer-signed, do not show stale pre-reform due-date chips for new VIC
  // claims. This is safer than confidently displaying the wrong statutory date.
  if (state === 'VIC') {
    const submittedDateKey = getSubmittedDateKey(submittedAt);
    if (submittedDateKey && submittedDateKey >= VIC_SOPA_REFORM_EFFECTIVE_DATE) {
      return null;
    }
  }

  return timeframe;
}

/**
 * Calculate payment-schedule response due date based on SOPA response timeframes.
 * Returns a `YYYY-MM-DD` calendar date in the project timezone (M4), NOT an
 * instant — a statutory deadline is a date, and an instant would render as a
 * different day depending on where the laptop is.
 * `state` is the project's jurisdiction (e.g. 'WA'). A missing/undefined state
 * defaults to NSW, but an *unrecognised* jurisdiction (e.g. 'NT', which has no
 * East-Coast payment-schedule mechanics) returns null rather than fabricating a
 * confident-but-wrong NSW date — callers should render "not available".
 */
export function calculateCertificationDueDate(
  submittedAt: string,
  state: string = 'NSW',
): string | null {
  const timeframe = getSopaTimeframeForClaim(submittedAt, state);
  if (!timeframe) return null;
  return sopaDueDateKey(submittedAt, state, timeframe.responseTime);
}

/**
 * Calculate payment due date based on SOPA timeframes. Returns a `YYYY-MM-DD`
 * calendar date in the project timezone (see calculateCertificationDueDate).
 * `state` is the project's jurisdiction (e.g. 'WA'). A missing/undefined state
 * defaults to NSW; an *unrecognised* jurisdiction returns null (see
 * calculateCertificationDueDate).
 */
export function calculatePaymentDueDate(submittedAt: string, state: string = 'NSW'): string | null {
  const timeframe = getSopaTimeframeForClaim(submittedAt, state);
  if (!timeframe) return null;
  return sopaDueDateKey(submittedAt, state, timeframe.paymentTime);
}

/**
 * Whole calendar days from today until `dueDateKey`, both resolved in the
 * PROJECT timezone so a SOPA countdown reads the same all day (M41: no
 * off-by-one between morning and evening) and the same in every viewer's
 * browser (M4: no off-by-one between Perth and Sydney). Positive = days
 * remaining, 0 = due today, negative = overdue.
 */
export function calendarDaysUntil(dueDateKey: string, now: Date = new Date()): number {
  // The shared helper is (start, end) — read forwards, "calendar days from today
  // to the due date" IS the countdown, so no negation (and no `-0`) is needed.
  return getCalendarDaysSince(now, dueDateKey, SOPA_TIME_ZONE);
}

/** Get payment-schedule response due status - only for submitted claims awaiting response */
export function getCertificationDueStatus(claim: Claim): CertificationDueStatus | null {
  // Only show payment-schedule due for submitted claims (not yet certified/paid)
  if (!claim.submittedAt || claim.status !== 'submitted') {
    return null;
  }

  // Use the project's jurisdiction so e.g. WA claims get WA timeframes.
  // null = jurisdiction without computable SOPA timeframes (e.g. NT) — show no
  // due-date chip rather than a wrong one.
  const dueDate = calculateCertificationDueDate(claim.submittedAt, claim.projectState ?? undefined);
  if (!dueDate) return null;
  const daysUntilDue = calendarDaysUntil(dueDate);

  if (daysUntilDue < 0) {
    return {
      text: `Payment schedule overdue by ${Math.abs(daysUntilDue)} days`,
      className: 'text-destructive font-semibold',
      isOverdue: true,
    };
  } else if (daysUntilDue <= 3) {
    return {
      text: `Payment schedule due in ${daysUntilDue} days`,
      className: 'text-warning',
      isOverdue: false,
    };
  } else {
    return {
      text: `Schedule due ${formatSopaDate(dueDate)}`,
      className: 'text-muted-foreground',
      isOverdue: false,
    };
  }
}

/** Get payment due status for claims that have been submitted */
export function getPaymentDueStatus(claim: Claim): PaymentDueStatus | null {
  if (!claim.submittedAt || claim.status === 'draft' || claim.status === 'paid') {
    return null;
  }

  if (claim.status !== 'submitted') {
    const certifiedAmount = claim.certifiedAmount ?? 0;
    const paidAmount = claim.paidAmount ?? 0;
    if (certifiedAmount <= 0 || certifiedAmount - paidAmount <= 0.000001) {
      return null;
    }
  }

  // Use the project's jurisdiction so e.g. WA claims get WA timeframes.
  // null = jurisdiction without computable SOPA timeframes (e.g. NT).
  const dueDate = calculatePaymentDueDate(claim.submittedAt, claim.projectState ?? undefined);
  if (!dueDate) return null;
  const daysUntilDue = calendarDaysUntil(dueDate);

  if (daysUntilDue < 0) {
    return { text: `Overdue by ${Math.abs(daysUntilDue)} days`, className: 'text-destructive' };
  } else if (daysUntilDue <= 3) {
    return { text: `Due in ${daysUntilDue} days`, className: 'text-warning' };
  } else {
    return {
      text: `Due ${formatSopaDate(dueDate)}`,
      className: 'text-muted-foreground',
    };
  }
}

/**
 * Claim amount for a lot based on percent complete, or null when the lot has no
 * budget set. A null-budget lot is still claimable (budget is informational), so
 * it is COUNTED in lot counts but carries no value — the same counted/excluded/
 * stated rule the claim-readiness summary applies (see ClaimBlockedValuePanel).
 * Callers must exclude nulls from sums rather than coerce them to $0, which
 * prints a confident dollar figure for a lot nobody priced.
 */
export function calculateLotClaimAmount(lot: ConformedLot): number | null {
  if (lot.budgetAmount == null) return null;
  const percentComplete = parseClaimPercentageInput(lot.percentComplete);
  return lot.budgetAmount * ((percentComplete ?? 0) / 100);
}

export function parseClaimPercentageInput(value: string): number | null {
  if (!value.trim()) return null;

  const parsed = parseOptionalNonNegativeDecimalInput(value);
  if (parsed === null || parsed > 100) return null;
  return parsed;
}

export function getClaimPercentageError(value: string): string | null {
  if (!value.trim()) return 'Percent complete is required.';

  return parseClaimPercentageInput(value) === null
    ? 'Percent complete must be a decimal between 0 and 100.'
    : null;
}

/**
 * Validate the claim period before submitting. Mirrors the backend rule in
 * backend/src/routes/claims/workflowValidation.ts so the user gets an inline
 * error instead of a server round-trip. Date inputs produce YYYY-MM-DD
 * strings, so lexicographic comparison is chronological.
 */
export function getClaimPeriodError(periodStart: string, periodEnd: string): string | null {
  if (!periodStart.trim() || !periodEnd.trim()) {
    return 'Period start and period end are required.';
  }
  if (periodEnd < periodStart) {
    return 'Period end must be on or after period start.';
  }
  return null;
}

/**
 * Validate a lot's claim increment, accounting for what has already been
 * claimed on prior claims. `remainingPercentage` is the cap for this claim.
 */
export function getClaimIncrementError(value: string, remainingPercentage: number): string | null {
  const baseError = getClaimPercentageError(value);
  if (baseError) return baseError;

  const parsed = parseClaimPercentageInput(value);
  if (parsed !== null && parsed - remainingPercentage > 0.0001) {
    const cap = Number(remainingPercentage.toFixed(2));
    return `Only ${cap}% of this lot is left to claim.`;
  }
  return null;
}

/** Export data as CSV file download with the shared branding preamble */
export function exportChartDataToCSV(
  data: Record<string, unknown>[],
  filename: string,
  headers: string[],
  registerName: string,
  branding: CsvBrandingContext | null | undefined,
): void {
  const rows = data.map((row) =>
    headers.map((header) => {
      // Convert header to camelCase key
      const key = header.toLowerCase().replace(/ /g, '');
      const value = row[key] ?? row[header.toLowerCase()];
      return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? value
        : '';
    }),
  );

  downloadBrandedCsv(`${filename}-${formatDateKey()}.csv`, registerName, branding, [
    headers,
    ...rows,
  ]);
}
