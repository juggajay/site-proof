/**
 * Data contract and request helpers for the Settings page's email notification
 * preferences section, extracted from SettingsPage.tsx so the page can consume a
 * focused, independently testable module (and a TanStack Query hook in
 * useEmailPreferences.ts). The types, defaults, copy, field names, API paths,
 * and request payload shape are unchanged from the original inline implementation.
 */

import { apiFetch } from '@/lib/api';

export type NotificationTiming = 'immediate' | 'digest';

export type EmailPreferences = {
  enabled: boolean;
  mentions: boolean;
  mentionsTiming: NotificationTiming;
  ncrAssigned: boolean;
  ncrAssignedTiming: NotificationTiming;
  ncrStatusChange: boolean;
  ncrStatusChangeTiming: NotificationTiming;
  holdPointReminder: boolean;
  holdPointReminderTiming: NotificationTiming;
  holdPointRelease: boolean;
  holdPointReleaseTiming: NotificationTiming;
  commentReply: boolean;
  commentReplyTiming: NotificationTiming;
  scheduledReports: boolean;
  scheduledReportsTiming: NotificationTiming;
  dailyDigest: boolean;
  diaryReminder: boolean;
  diaryReminderTiming: NotificationTiming;
};

export type EmailPreferenceBooleanKey =
  | 'mentions'
  | 'ncrAssigned'
  | 'ncrStatusChange'
  | 'holdPointReminder'
  | 'holdPointRelease'
  | 'commentReply'
  | 'scheduledReports'
  | 'dailyDigest'
  | 'diaryReminder';

export type EmailPreferenceTimingKey =
  | 'mentionsTiming'
  | 'ncrAssignedTiming'
  | 'ncrStatusChangeTiming'
  | 'holdPointReminderTiming'
  | 'holdPointReleaseTiming'
  | 'commentReplyTiming'
  | 'scheduledReportsTiming'
  | 'diaryReminderTiming';

export type EmailPreferenceToggleKey = 'enabled' | EmailPreferenceBooleanKey;

export const EMAIL_PREFERENCES_PATH = '/api/notifications/email-preferences';
export const SEND_TEST_EMAIL_PATH = '/api/notifications/send-test-email';

export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  enabled: true,
  mentions: true,
  mentionsTiming: 'immediate',
  ncrAssigned: true,
  ncrAssignedTiming: 'immediate',
  ncrStatusChange: true,
  ncrStatusChangeTiming: 'immediate',
  holdPointReminder: true,
  holdPointReminderTiming: 'immediate',
  holdPointRelease: true,
  holdPointReleaseTiming: 'immediate',
  commentReply: true,
  commentReplyTiming: 'immediate',
  scheduledReports: true,
  scheduledReportsTiming: 'immediate',
  dailyDigest: false,
  diaryReminder: true,
  diaryReminderTiming: 'immediate',
};

export interface EmailNotificationItem {
  key: EmailPreferenceBooleanKey;
  timingKey: EmailPreferenceTimingKey | null;
  label: string;
  description: string;
  supportsTiming: boolean;
}

export const emailNotificationItems: EmailNotificationItem[] = [
  {
    key: 'mentions',
    timingKey: 'mentionsTiming',
    label: 'Mentions',
    description: 'When someone @mentions you in a comment',
    supportsTiming: true,
  },
  {
    key: 'ncrAssigned',
    timingKey: 'ncrAssignedTiming',
    label: 'NCR Assigned',
    description: 'When you are assigned to an NCR',
    supportsTiming: true,
  },
  {
    key: 'ncrStatusChange',
    timingKey: 'ncrStatusChangeTiming',
    label: 'NCR Status Changes',
    description: "When an NCR you're involved with changes status",
    supportsTiming: true,
  },
  {
    key: 'holdPointReminder',
    timingKey: 'holdPointReminderTiming',
    label: 'Hold Point Reminders',
    description: 'Reminders for upcoming hold points',
    supportsTiming: true,
  },
  {
    key: 'holdPointRelease',
    timingKey: 'holdPointReleaseTiming',
    label: 'Hold Point Released',
    description: 'When a hold point is released',
    supportsTiming: true,
  },
  {
    key: 'commentReply',
    timingKey: 'commentReplyTiming',
    label: 'Comment Replies',
    description: 'When someone replies to your comment',
    supportsTiming: true,
  },
  {
    key: 'scheduledReports',
    timingKey: 'scheduledReportsTiming',
    label: 'Scheduled Reports',
    description: 'Delivery of scheduled report emails',
    supportsTiming: true,
  },
  {
    key: 'dailyDigest',
    timingKey: null,
    label: 'Daily Digest',
    description: 'Receive digest emails at your preferred time',
    supportsTiming: false,
  },
  {
    key: 'diaryReminder',
    timingKey: 'diaryReminderTiming',
    label: 'Daily Diary Reminders',
    description: 'Reminders when a daily diary has not been completed',
    supportsTiming: true,
  },
];

/**
 * Layers a (possibly partial) server response over the documented defaults so the
 * UI always has every field defined, even when the backend omits newer keys.
 */
export function normalizeEmailPreferences(
  preferences: Partial<EmailPreferences> | null | undefined,
): EmailPreferences {
  return {
    ...DEFAULT_EMAIL_PREFERENCES,
    ...(preferences || {}),
  };
}

/** Returns a new preference set with a single boolean flag flipped. */
export function applyEmailPreferenceToggle(
  preferences: EmailPreferences,
  key: EmailPreferenceToggleKey,
): EmailPreferences {
  return { ...preferences, [key]: !preferences[key] };
}

/** Returns a new preference set with a single notification's timing changed. */
export function applyEmailPreferenceTiming(
  preferences: EmailPreferences,
  timingKey: EmailPreferenceTimingKey,
  timing: NotificationTiming,
): EmailPreferences {
  return { ...preferences, [timingKey]: timing };
}

export interface SaveEmailPreferencesBody {
  preferences: EmailPreferences;
}

/** Shapes the PUT payload sent when saving preferences. */
export function buildSaveEmailPreferencesBody(
  preferences: EmailPreferences,
): SaveEmailPreferencesBody {
  return { preferences };
}

export interface SendTestEmailResult {
  sentTo: string;
}

/** Fetches the current user's email notification preferences. */
export async function fetchEmailPreferences(): Promise<EmailPreferences> {
  const data = await apiFetch<{ preferences: EmailPreferences }>(EMAIL_PREFERENCES_PATH);
  return normalizeEmailPreferences(data.preferences);
}

/** Persists the supplied preferences and returns the normalized server result. */
export async function saveEmailPreferences(
  preferences: EmailPreferences,
): Promise<EmailPreferences> {
  const data = await apiFetch<{ preferences: EmailPreferences; message?: string }>(
    EMAIL_PREFERENCES_PATH,
    {
      method: 'PUT',
      body: JSON.stringify(buildSaveEmailPreferencesBody(preferences)),
    },
  );
  return normalizeEmailPreferences(data.preferences);
}

/** Sends a test notification email to the current user. */
export async function sendTestEmail(): Promise<SendTestEmailResult> {
  return apiFetch<SendTestEmailResult>(SEND_TEST_EMAIL_PATH, {
    method: 'POST',
  });
}
