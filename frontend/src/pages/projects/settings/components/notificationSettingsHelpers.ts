// Pure validation helpers for the project notification settings tab, moved
// out of NotificationsTab. EMAIL_PATTERN is shared by the witness point
// contact email check and the HP recipient flow.
import type { HpRecipient, WitnessPointNotificationTrigger } from '../types';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const NOTIFICATION_PREFERENCES = [
  {
    key: 'holdPointReleases' as const,
    label: 'Hold Point Releases',
    description: 'Notify when a hold point is released',
  },
  {
    key: 'ncrAssignments' as const,
    label: 'NCR Assignments',
    description: 'Notify when an NCR is assigned to you',
  },
  {
    key: 'testResults' as const,
    label: 'Test Results',
    description: 'Notify when test results are uploaded',
  },
  {
    key: 'dailyDiaryReminders' as const,
    label: 'Daily Diary Reminders',
    description: 'Remind to complete daily diary',
  },
] as const;

export const WITNESS_TRIGGER_OPTIONS: Array<{
  value: WitnessPointNotificationTrigger;
  label: string;
}> = [
  { value: 'previous_item', label: 'When previous checklist item is completed' },
  { value: '2_items_before', label: 'When 2 items before witness point is completed' },
  { value: 'same_day', label: 'Same day notification (at start of working day)' },
];

export const NOTICE_DAY_OPTIONS = [0, 1, 2, 3, 5] as const;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

/** Canonical form used for saving and duplicate checks: trimmed role, trimmed lowercased email. */
export function normalizeHpRecipient(recipient: HpRecipient): HpRecipient {
  return {
    role: recipient.role.trim(),
    email: recipient.email.trim().toLowerCase(),
  };
}

/**
 * Duplicate when the role matches exactly (case-sensitive) and the stored
 * email matches lowercased. The candidate is expected to be normalized via
 * normalizeHpRecipient first — deliberately the same check the tab has always
 * used.
 */
export function isDuplicateHpRecipient(recipients: HpRecipient[], candidate: HpRecipient): boolean {
  return recipients.some(
    (recipient) =>
      recipient.role === candidate.role && recipient.email.toLowerCase() === candidate.email,
  );
}
