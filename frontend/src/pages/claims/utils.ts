/**
 * Utility functions for Claims-related pages and components.
 * Extracted from ClaimsPage.tsx for reusability.
 */

import type { Claim, CertificationDueStatus, PaymentDueStatus, ConformedLot } from './types';
import { SOPA_TIMEFRAMES } from './constants';
import { isSopaNonWorkingDay } from './sopaBusinessDays';
import { downloadCsv } from '@/lib/csv';
import { formatDateKey } from '@/lib/localDate';
import { parseOptionalNonNegativeDecimalInput } from '@/lib/numericInput';

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
 * Calculate certification due date based on SOPA response timeframes.
 * `state` is the project's jurisdiction (e.g. 'WA'). A missing/undefined state
 * defaults to NSW, but an *unrecognised* jurisdiction (e.g. 'NT', which has no
 * East-Coast payment-schedule mechanics) returns null rather than fabricating a
 * confident-but-wrong NSW date — callers should render "not available".
 */
export function calculateCertificationDueDate(
  submittedAt: string,
  state: string = 'NSW',
): string | null {
  const timeframe = SOPA_TIMEFRAMES[state];
  if (!timeframe) return null;
  const submissionDate = new Date(submittedAt);
  return addBusinessDays(submissionDate, timeframe.responseTime, state).toISOString();
}

/**
 * Calculate payment due date based on SOPA timeframes.
 * `state` is the project's jurisdiction (e.g. 'WA'). A missing/undefined state
 * defaults to NSW; an *unrecognised* jurisdiction returns null (see
 * calculateCertificationDueDate).
 */
export function calculatePaymentDueDate(submittedAt: string, state: string = 'NSW'): string | null {
  const timeframe = SOPA_TIMEFRAMES[state];
  if (!timeframe) return null;
  const submissionDate = new Date(submittedAt);
  return addBusinessDays(submissionDate, timeframe.paymentTime, state).toISOString();
}

/** Get certification due status - only for submitted claims awaiting certification */
export function getCertificationDueStatus(claim: Claim): CertificationDueStatus | null {
  // Only show certification due for submitted claims (not yet certified/paid)
  if (!claim.submittedAt || claim.status !== 'submitted') {
    return null;
  }

  // Use the project's jurisdiction so e.g. WA claims get WA timeframes.
  // null = jurisdiction without computable SOPA timeframes (e.g. NT) — show no
  // due-date chip rather than a wrong one.
  const dueDate = calculateCertificationDueDate(claim.submittedAt, claim.projectState ?? undefined);
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) {
    return {
      text: `Certification overdue by ${Math.abs(daysUntilDue)} days`,
      className: 'text-destructive font-semibold',
      isOverdue: true,
    };
  } else if (daysUntilDue <= 3) {
    return {
      text: `Certification due in ${daysUntilDue} days`,
      className: 'text-warning',
      isOverdue: false,
    };
  } else {
    return {
      text: `Cert due ${due.toLocaleDateString('en-AU')}`,
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

  // Use the project's jurisdiction so e.g. WA claims get WA timeframes.
  // null = jurisdiction without computable SOPA timeframes (e.g. NT).
  const dueDate = calculatePaymentDueDate(claim.submittedAt, claim.projectState ?? undefined);
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) {
    return { text: `Overdue by ${Math.abs(daysUntilDue)} days`, className: 'text-destructive' };
  } else if (daysUntilDue <= 3) {
    return { text: `Due in ${daysUntilDue} days`, className: 'text-warning' };
  } else {
    return { text: `Due ${due.toLocaleDateString('en-AU')}`, className: 'text-muted-foreground' };
  }
}

/** Calculate claim amount for a lot based on percent complete */
export function calculateLotClaimAmount(lot: ConformedLot): number {
  const percentComplete = parseClaimPercentageInput(lot.percentComplete);
  return (lot.budgetAmount ?? 0) * ((percentComplete ?? 0) / 100);
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

/** Export data as CSV file download */
export function exportChartDataToCSV(
  data: Record<string, unknown>[],
  filename: string,
  headers: string[],
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

  downloadCsv(`${filename}-${formatDateKey()}.csv`, [headers, ...rows]);
}
