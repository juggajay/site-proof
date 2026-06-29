import {
  DEFAULT_PROJECT_TIME_ZONE,
  zonedDateParts,
  zonedWallClockToUtc,
} from '../projectTimeZone.js';

export const SCHEDULED_REPORT_TYPES = ['lot-status', 'ncr', 'test', 'diary'] as const;
export const SCHEDULED_REPORT_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
export const MAX_SCHEDULED_REPORTS_PER_PROJECT = 25;
export const MAX_SCHEDULED_REPORT_RECIPIENTS = 50;
export const MAX_SCHEDULED_REPORT_RECIPIENTS_INPUT_LENGTH = MAX_SCHEDULED_REPORT_RECIPIENTS * 260;

export type ScheduledReportType = (typeof SCHEDULED_REPORT_TYPES)[number];
export type ScheduledReportFrequency = (typeof SCHEDULED_REPORT_FREQUENCIES)[number];

export type ScheduledReportForDelivery = {
  id: string;
  projectId: string;
  reportType: string;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  recipients: string;
  nextRunAt: Date | null;
  failureCount: number;
  project: {
    name: string;
    companyId?: string | null;
    state?: string | null;
    company?: {
      subscriptionTier: string | null;
    };
  };
};

export function isScheduledReportType(value: string): value is ScheduledReportType {
  return SCHEDULED_REPORT_TYPES.includes(value as ScheduledReportType);
}

export function isScheduledReportFrequency(value: string): value is ScheduledReportFrequency {
  return SCHEDULED_REPORT_FREQUENCIES.includes(value as ScheduledReportFrequency);
}

export function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function dayCountInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function parseTimeOfDayParts(timeOfDay: string): { hours: number; minutes: number } {
  const [hours = 9, minutes = 0] = timeOfDay.split(':').map(Number);
  return { hours, minutes };
}

function localDayOfWeek(parts: { year: number; month: number; day: number }): number {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function addLocalDays(
  parts: { year: number; month: number; day: number },
  days: number,
): { year: number; month: number; day: number } {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function nextLocalMonth(parts: { year: number; month: number }): { year: number; month: number } {
  const shifted = new Date(Date.UTC(parts.year, parts.month, 1));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
  };
}

function zonedDateAtTime(
  parts: { year: number; month: number; day: number },
  timeOfDay: string,
  timeZone: string,
): Date {
  const { hours, minutes } = parseTimeOfDayParts(timeOfDay);
  return zonedWallClockToUtc(parts.year, parts.month, parts.day, hours, minutes, timeZone);
}

function monthlyZonedDateAtTime(
  year: number,
  month: number,
  dayOfMonth: number,
  timeOfDay: string,
  timeZone: string,
): Date {
  const clampedDay = Math.min(dayOfMonth, dayCountInMonth(year, month - 1));
  return zonedDateAtTime({ year, month, day: clampedDay }, timeOfDay, timeZone);
}

export function calculateNextScheduledReportRunAt(
  frequency: ScheduledReportFrequency,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  timeOfDay: string,
  from = new Date(),
  timeZone = DEFAULT_PROJECT_TIME_ZONE,
): Date {
  const localToday = zonedDateParts(from, timeZone);

  switch (frequency) {
    case 'daily': {
      let nextRun = zonedDateAtTime(localToday, timeOfDay, timeZone);
      if (nextRun <= from) {
        nextRun = zonedDateAtTime(addLocalDays(localToday, 1), timeOfDay, timeZone);
      }
      return nextRun;
    }

    case 'weekly': {
      const targetDay = dayOfWeek ?? 1;
      const currentDay = localDayOfWeek(localToday);
      let daysUntil = targetDay - currentDay;
      let nextRun = zonedDateAtTime(addLocalDays(localToday, daysUntil), timeOfDay, timeZone);
      if (daysUntil < 0 || (daysUntil === 0 && nextRun <= from)) {
        daysUntil += 7;
        nextRun = zonedDateAtTime(addLocalDays(localToday, daysUntil), timeOfDay, timeZone);
      }
      return nextRun;
    }

    case 'monthly': {
      const targetDay = dayOfMonth ?? 1;
      const nextRun = monthlyZonedDateAtTime(
        localToday.year,
        localToday.month,
        targetDay,
        timeOfDay,
        timeZone,
      );
      if (nextRun > from) {
        return nextRun;
      }

      const nextMonth = nextLocalMonth(localToday);
      return monthlyZonedDateAtTime(
        nextMonth.year,
        nextMonth.month,
        targetDay,
        timeOfDay,
        timeZone,
      );
    }
  }
}

export function parseRecipients(recipients: string): string[] {
  return Array.from(
    new Set(
      recipients
        .split(/[,;\n]/)
        .map((recipient) => recipient.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function validateScheduledReportRecipients(recipients: string[]): void {
  if (recipients.length === 0) {
    throw new Error('Scheduled report has no recipients');
  }

  if (recipients.length > MAX_SCHEDULED_REPORT_RECIPIENTS) {
    throw new Error(
      `Scheduled report cannot include more than ${MAX_SCHEDULED_REPORT_RECIPIENTS} recipients`,
    );
  }

  const invalidRecipient = recipients.find(
    (recipient) => recipient.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient),
  );
  if (invalidRecipient) {
    throw new Error('Scheduled report recipients must contain valid email addresses');
  }
}
