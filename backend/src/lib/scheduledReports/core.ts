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
  project: {
    name: string;
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

function dateAtTime(base: Date, timeOfDay: string): Date {
  const [hours = 9, minutes = 0] = timeOfDay.split(':').map(Number);
  const date = new Date(base);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function monthlyDateAtTime(base: Date, dayOfMonth: number, timeOfDay: string): Date {
  const [hours = 9, minutes = 0] = timeOfDay.split(':').map(Number);
  const date = new Date(base);
  const clampedDay = Math.min(dayOfMonth, dayCountInMonth(date.getFullYear(), date.getMonth()));
  date.setDate(clampedDay);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function calculateNextScheduledReportRunAt(
  frequency: ScheduledReportFrequency,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  timeOfDay: string,
  from = new Date(),
): Date {
  switch (frequency) {
    case 'daily': {
      const nextRun = dateAtTime(from, timeOfDay);
      if (nextRun <= from) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      return nextRun;
    }

    case 'weekly': {
      const targetDay = dayOfWeek ?? 1;
      const nextRun = dateAtTime(from, timeOfDay);
      const currentDay = nextRun.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil < 0 || (daysUntil === 0 && nextRun <= from)) {
        daysUntil += 7;
      }
      nextRun.setDate(nextRun.getDate() + daysUntil);
      return nextRun;
    }

    case 'monthly': {
      const targetDay = dayOfMonth ?? 1;
      const nextRun = monthlyDateAtTime(from, targetDay, timeOfDay);
      if (nextRun > from) {
        return nextRun;
      }

      const nextMonth = new Date(from);
      nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
      return monthlyDateAtTime(nextMonth, targetDay, timeOfDay);
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
