export type NotificationTiming = 'immediate' | 'digest';

export type NotificationTypeWithTiming =
  | 'mentions'
  | 'ncrAssigned'
  | 'ncrStatusChange'
  | 'holdPointReminder'
  | 'holdPointRelease'
  | 'commentReply'
  | 'scheduledReports'
  | 'diaryReminder';

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

export function validateTiming(value: unknown, fallback: NotificationTiming): NotificationTiming {
  return value === 'immediate' || value === 'digest' ? value : fallback;
}

export function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeEmailPreferences(value: unknown): EmailPreferences {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

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

export function isNotificationTypeEnabled(
  preferences: EmailPreferences,
  notificationType: NotificationTypeWithTiming,
): boolean {
  switch (notificationType) {
    case 'mentions':
      return preferences.mentions;
    case 'ncrAssigned':
      return preferences.ncrAssigned;
    case 'ncrStatusChange':
      return preferences.ncrStatusChange;
    case 'holdPointReminder':
      return preferences.holdPointReminder;
    case 'holdPointRelease':
      return preferences.holdPointRelease;
    case 'commentReply':
      return preferences.commentReply;
    case 'scheduledReports':
      return preferences.scheduledReports;
    case 'diaryReminder':
      return preferences.diaryReminder;
  }
}

export function getNotificationTiming(
  preferences: EmailPreferences,
  notificationType: NotificationTypeWithTiming,
): NotificationTiming {
  switch (notificationType) {
    case 'mentions':
      return preferences.mentionsTiming;
    case 'ncrAssigned':
      return preferences.ncrAssignedTiming;
    case 'ncrStatusChange':
      return preferences.ncrStatusChangeTiming;
    case 'holdPointReminder':
      return preferences.holdPointReminderTiming;
    case 'holdPointRelease':
      return preferences.holdPointReleaseTiming;
    case 'commentReply':
      return preferences.commentReplyTiming;
    case 'scheduledReports':
      return preferences.scheduledReportsTiming;
    case 'diaryReminder':
      return preferences.diaryReminderTiming;
  }
}
