import { z } from 'zod';

export const MAX_SCHEDULE_RECIPIENTS = 50;
export const DEFAULT_MAX_SCHEDULED_REPORTS = 25;

const recipientEmailSchema = z.string().trim().email().max(254);

export function parseRecipientList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((email) => email.trim())
    .filter(Boolean);
}

export function normalizeRecipientList(value: string): string[] {
  return Array.from(new Set(parseRecipientList(value).map((email) => email.toLowerCase())));
}

export function getRecipientValidationError(value: string): string | null {
  const recipients = parseRecipientList(value);

  if (recipients.length === 0) {
    return 'At least one recipient is required';
  }

  if (normalizeRecipientList(value).length > MAX_SCHEDULE_RECIPIENTS) {
    return `Use ${MAX_SCHEDULE_RECIPIENTS} or fewer recipients`;
  }

  if (recipients.some((email) => !recipientEmailSchema.safeParse(email).success)) {
    return 'Enter valid email addresses';
  }

  return null;
}

export const scheduleFormSchema = z.object({
  reportType: z.enum(['lot-status', 'ncr', 'test', 'diary']),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  dayOfWeek: z.number().int().min(0).max(6),
  dayOfMonth: z.number().int().min(1).max(31),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid time'),
  recipients: z.string().superRefine((value, ctx) => {
    const error = getRecipientValidationError(value);
    if (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error,
      });
    }
  }),
});

export type ScheduleFormData = z.infer<typeof scheduleFormSchema>;

export interface ScheduledReport {
  id: string;
  reportType: string;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  recipients: string;
  isActive: boolean;
  nextRunAt: string | null;
  lastSentAt: string | null;
  failureCount?: number;
  lastFailureAt?: string | null;
  lastFailureReason?: string | null;
  latestRun?: ScheduledReportLatestRun | null;
}

export interface ScheduledReportLatestRun {
  id: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  digestCount: number;
  suppressedCount: number;
  errorReason?: string | null;
  generatedAt: string;
  completedAt?: string | null;
  retryableFailedCount?: number;
  nextRetryAt?: string | null;
}

export function getScheduleStatusLabel(schedule: ScheduledReport): string {
  const failureCount = schedule.failureCount ?? 0;
  if (failureCount > 0 && !schedule.isActive) return 'Paused after failures';
  if (failureCount > 0) return 'Retrying';
  return schedule.isActive ? 'Active' : 'Paused';
}

export function getScheduleStatusClassName(schedule: ScheduledReport): string {
  const failureCount = schedule.failureCount ?? 0;
  if (failureCount > 0) return 'bg-warning/10 text-warning';
  return schedule.isActive ? 'bg-foreground/10 text-foreground' : 'bg-muted text-muted-foreground';
}

export function getScheduleFailureMessage(schedule: ScheduledReport): string | null {
  const failureCount = schedule.failureCount ?? 0;
  const reason = schedule.lastFailureReason?.trim();
  if (failureCount === 0 || !reason) return null;

  const attemptLabel = `${failureCount} failed delivery attempt${failureCount === 1 ? '' : 's'}`;
  if (!schedule.isActive) {
    return `Paused after ${attemptLabel}. Last error: ${reason}`;
  }

  return `Last delivery failed after ${attemptLabel}; the next retry is scheduled. Error: ${reason}`;
}

function formatRecipientCount(count: number): string {
  return `${count} recipient${count === 1 ? '' : 's'}`;
}

export function getScheduleLatestRunMessage(schedule: ScheduledReport): string | null {
  const run = schedule.latestRun;
  if (!run) return null;

  const totalRecipients = Math.max(0, run.recipientCount);
  const sentRecipients = Math.max(0, run.sentCount);
  const failedRecipients = Math.max(0, run.failedCount);
  const suppressedRecipients = Math.max(0, run.suppressedCount);
  const digestRecipients = Math.max(0, run.digestCount);
  const digestLabel = digestRecipients > 0 ? `, ${digestRecipients} queued for digest` : '';
  const suppressedLabel =
    suppressedRecipients > 0 ? `, ${suppressedRecipients} suppressed by preferences/access` : '';
  const reason = run.errorReason?.trim();
  const reasonLabel = reason ? ` Error: ${reason}` : '';

  switch (run.status) {
    case 'processing':
      return `Latest run is sending to ${formatRecipientCount(totalRecipients)}.`;
    case 'sent':
      return `Latest run sent to ${formatRecipientCount(sentRecipients)}${digestLabel}${suppressedLabel}.`;
    case 'partial_failed':
      return `Latest run sent to ${sentRecipients} of ${totalRecipients} recipients; ${failedRecipients} failed${digestLabel}${suppressedLabel}.${reasonLabel}`;
    case 'failed':
      return `Latest run failed for ${formatRecipientCount(
        failedRecipients || totalRecipients,
      )}.${reasonLabel}`;
    case 'cancelled':
      return 'Latest run was cancelled after the schedule changed.';
    default:
      return `Latest run status: ${run.status}.`;
  }
}

export function getScheduleLatestRunClassName(schedule: ScheduledReport): string {
  const status = schedule.latestRun?.status;
  if (status === 'failed' || status === 'partial_failed') {
    return 'text-warning';
  }
  if (status === 'processing') {
    return 'text-muted-foreground';
  }
  return 'text-muted-foreground';
}

export function formatNextRun(dateStr: string | null, timeZone?: string): string {
  if (!dateStr) return 'Not scheduled';
  const date = new Date(dateStr);
  return date.toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  });
}

export function getFrequencyLabel(schedule: ScheduledReport): string {
  switch (schedule.frequency) {
    case 'daily':
      return `Daily at ${schedule.timeOfDay}`;
    case 'weekly': {
      const day = DAYS_OF_WEEK.find((d) => d.value === schedule.dayOfWeek)?.label || 'Monday';
      return `Weekly on ${day} at ${schedule.timeOfDay}`;
    }
    case 'monthly':
      return `Monthly on day ${schedule.dayOfMonth} at ${schedule.timeOfDay}`;
    default:
      return schedule.frequency;
  }
}

export const REPORT_TYPES = [
  { value: 'lot-status', label: 'Lot Status Report' },
  { value: 'ncr', label: 'NCR Report' },
  { value: 'test', label: 'Test Results Report' },
  { value: 'diary', label: 'Daily Diary Report' },
];

export const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];
