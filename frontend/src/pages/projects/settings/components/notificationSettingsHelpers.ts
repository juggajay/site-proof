// Pure validation helpers for the project notification settings tab, moved
// out of NotificationsTab. EMAIL_PATTERN is shared by the witness point
// contact email check and the HP recipient flow.
import type { HpRecipient } from '../types';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
