import type { NotificationEmailPreference as NotificationEmailPreferenceRecord } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/**
 * Notification email-preference helpers, extracted verbatim from
 * backend/src/routes/notifications.ts as a slice of the notifications route
 * split (engineering-health Workstream 1).
 *
 * Covers the per-user email-preference model: the default preference values, the
 * timing/boolean normalizers that coerce arbitrary stored/submitted input back to
 * the typed shape, and the Prisma read/upsert wrappers. Behaviour — the exact
 * defaults, the invalid-timing fallback, boolean normalization, the upsert shape,
 * and the returned preference object — is preserved exactly as it was inline in
 * the route file. The pure helpers are unit-tested in emailPreferences.test.ts;
 * the Prisma-backed get/save remain covered by the route/integration tests.
 */

// Notification timing options
export type NotificationTiming = 'immediate' | 'digest';

// Default notification preferences with timing options
export const DEFAULT_EMAIL_PREFERENCES = {
  enabled: true,
  mentions: true,
  mentionsTiming: 'immediate' as NotificationTiming,
  ncrAssigned: true,
  ncrAssignedTiming: 'immediate' as NotificationTiming,
  ncrStatusChange: true,
  ncrStatusChangeTiming: 'immediate' as NotificationTiming,
  holdPointReminder: true,
  holdPointReminderTiming: 'immediate' as NotificationTiming,
  holdPointRelease: true,
  holdPointReleaseTiming: 'immediate' as NotificationTiming, // HP release - always immediate by default
  commentReply: true,
  commentReplyTiming: 'immediate' as NotificationTiming,
  scheduledReports: true,
  scheduledReportsTiming: 'immediate' as NotificationTiming,
  dailyDigest: false, // Master toggle for daily digest feature
  diaryReminder: true, // Feature #934: Daily diary reminder notification
  diaryReminderTiming: 'immediate' as NotificationTiming,
};

export type EmailPreferences = typeof DEFAULT_EMAIL_PREFERENCES;

// Helper to validate timing preference
export function validateTiming(
  value: unknown,
  defaultValue: NotificationTiming,
): NotificationTiming {
  if (value === 'immediate' || value === 'digest') {
    return value;
  }
  return defaultValue;
}

export function normalizeBoolean(value: unknown, defaultValue: boolean): boolean {
  return typeof value === 'boolean' ? value : defaultValue;
}

export function normalizeEmailPreferences(preferences: unknown): EmailPreferences {
  const input =
    preferences && typeof preferences === 'object' ? (preferences as Record<string, unknown>) : {};

  return {
    enabled: normalizeBoolean(input.enabled, DEFAULT_EMAIL_PREFERENCES.enabled),
    mentions: normalizeBoolean(input.mentions, DEFAULT_EMAIL_PREFERENCES.mentions),
    mentionsTiming: validateTiming(input.mentionsTiming, DEFAULT_EMAIL_PREFERENCES.mentionsTiming),
    ncrAssigned: normalizeBoolean(input.ncrAssigned, DEFAULT_EMAIL_PREFERENCES.ncrAssigned),
    ncrAssignedTiming: validateTiming(
      input.ncrAssignedTiming,
      DEFAULT_EMAIL_PREFERENCES.ncrAssignedTiming,
    ),
    ncrStatusChange: normalizeBoolean(
      input.ncrStatusChange,
      DEFAULT_EMAIL_PREFERENCES.ncrStatusChange,
    ),
    ncrStatusChangeTiming: validateTiming(
      input.ncrStatusChangeTiming,
      DEFAULT_EMAIL_PREFERENCES.ncrStatusChangeTiming,
    ),
    holdPointReminder: normalizeBoolean(
      input.holdPointReminder,
      DEFAULT_EMAIL_PREFERENCES.holdPointReminder,
    ),
    holdPointReminderTiming: validateTiming(
      input.holdPointReminderTiming,
      DEFAULT_EMAIL_PREFERENCES.holdPointReminderTiming,
    ),
    holdPointRelease: normalizeBoolean(
      input.holdPointRelease,
      DEFAULT_EMAIL_PREFERENCES.holdPointRelease,
    ),
    holdPointReleaseTiming: validateTiming(
      input.holdPointReleaseTiming,
      DEFAULT_EMAIL_PREFERENCES.holdPointReleaseTiming,
    ),
    commentReply: normalizeBoolean(input.commentReply, DEFAULT_EMAIL_PREFERENCES.commentReply),
    commentReplyTiming: validateTiming(
      input.commentReplyTiming,
      DEFAULT_EMAIL_PREFERENCES.commentReplyTiming,
    ),
    scheduledReports: normalizeBoolean(
      input.scheduledReports,
      DEFAULT_EMAIL_PREFERENCES.scheduledReports,
    ),
    scheduledReportsTiming: validateTiming(
      input.scheduledReportsTiming,
      DEFAULT_EMAIL_PREFERENCES.scheduledReportsTiming,
    ),
    dailyDigest: normalizeBoolean(input.dailyDigest, DEFAULT_EMAIL_PREFERENCES.dailyDigest),
    diaryReminder: normalizeBoolean(input.diaryReminder, DEFAULT_EMAIL_PREFERENCES.diaryReminder),
    diaryReminderTiming: validateTiming(
      input.diaryReminderTiming,
      DEFAULT_EMAIL_PREFERENCES.diaryReminderTiming,
    ),
  };
}

export function toEmailPreferences(
  record: NotificationEmailPreferenceRecord | null,
): EmailPreferences {
  if (!record) {
    return { ...DEFAULT_EMAIL_PREFERENCES };
  }

  return normalizeEmailPreferences(record);
}

export async function getEmailPreferences(userId: string): Promise<EmailPreferences> {
  const preferences = await prisma.notificationEmailPreference.findUnique({
    where: { userId },
  });
  return toEmailPreferences(preferences);
}

export async function saveEmailPreferences(
  userId: string,
  preferences: EmailPreferences,
): Promise<EmailPreferences> {
  const saved = await prisma.notificationEmailPreference.upsert({
    where: { userId },
    update: preferences,
    create: {
      userId,
      ...preferences,
    },
  });

  return toEmailPreferences(saved);
}
