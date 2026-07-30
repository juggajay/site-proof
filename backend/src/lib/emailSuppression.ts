/**
 * Wave E2 — recipient suppression, in process, with no store.
 *
 * E.0 threat-model item 16 rules this: **provider read first, NO CIVOS
 * suppression table.** A table would hold an external individual's email address
 * for a NEGATIVE reason, indefinitely, in a codebase whose one indefinite store
 * (`AuditLog`) already has no deletion path. The ruling's own words for the
 * minimum honest implementation: "a suppression check at send time plus an
 * audited skip".
 *
 * The pinned Resend SDK (v2) exposes `apiKeys`, `audiences`, `batch`,
 * `contacts`, `domains`, `emails` and `headers` — there is NO suppressions
 * endpoint to read. So the provider's answer is taken where the provider
 * actually gives one: the send response. A hard bounce / complaint / invalid
 * recipient marks the normalized address, and every later send to it is skipped
 * and audited.
 *
 * ponytail: an in-process Set, per worker process, cleared on restart. That is
 * deliberate — it stores nothing durably and therefore raises no retention
 * question, which is exactly why item 16 preferred it to a table. The upgrade
 * path named by item 16 clause 4 is a short-TTL cache over a provider
 * suppressions read, if and when the SDK exposes one; a TABLE stays blocked
 * until the item's flip condition (a recipient asking CIVOS directly to stop)
 * is met, and then it ships WITH a retention policy in the same PR.
 *
 * **Wave E2.1: that flip condition has been met and the durable arm now exists,
 * elsewhere.** The unsubscribe link on every chase digest IS a recipient asking
 * CIVOS directly to stop, and an opt-out that a Railway redeploy erases is not
 * an opt-out. It lives in `holdPointMailConsent.ts` with the retention policy
 * item 16 demanded (`RETENTION_POLICIES.holdPointMailConsent`), and NOT here,
 * because this module stays what item 16 wanted it to be: the provider's
 * bounce/complaint truth, in memory, synchronous, storing nothing.
 */

import { logInfo } from './serverLogger.js';

const suppressed = new Set<string>();

/** Provider signals that mean "do not send here again", not "retry later". */
const SUPPRESSION_ERROR_PATTERN =
  /bounce|complaint|complained|suppress|unsubscrib|invalid[_ -]?(to|recipient)|does not exist|mailbox.*(unavailable|not found)/i;

export function normalizeRecipientEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isEmailSuppressed(email: string): boolean {
  return suppressed.has(normalizeRecipientEmail(email));
}

export function recordEmailSuppression(email: string, reason: string): void {
  const key = normalizeRecipientEmail(email);
  if (!key || suppressed.has(key)) return;
  suppressed.add(key);
  // Never log the address itself — spec §7.5 and `[E-B7]`.
  logInfo('[Email Suppression] Recipient suppressed for future automated sends', { reason });
}

/**
 * Classify a failed send. Returns true when the failure is a delivery DECISION
 * (so the address is suppressed and the attempt is consumed) rather than a
 * transport problem (retryable, attempt refunded).
 */
export function isSuppressionFailure(error: string | undefined, errorCode?: string): boolean {
  return SUPPRESSION_ERROR_PATTERN.test(`${errorCode ?? ''} ${error ?? ''}`);
}

/** Test-only reset; the set is process-local and never persisted. */
export function resetEmailSuppressionForTests(): void {
  suppressed.clear();
}
