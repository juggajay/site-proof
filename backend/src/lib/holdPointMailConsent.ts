/**
 * Wave E2.1 — the consent gate for automated hold-point chase mail.
 *
 * Jay's decision, 2026-07-31, recorded in his own name: an automated reminder
 * may only go to a recipient who has opened a CIVOS hold-point link at least
 * once, and every reminder carries an unsubscribe line. This module is that
 * rule. It states no legal conclusion and none may be read into it — E.0 §7.3
 * forbids any CIVOS document from doing so.
 *
 * Three reads, one write:
 *
 *  - `recordHoldPointLinkOpen` — best-effort, first-open-only, called from the
 *    public release page and the batch review room.
 *  - `hasOpenedHoldPointLink` — the gate. Fails CLOSED: no proof, no email.
 *  - `isHoldPointMailUnsubscribed` — honoured GLOBALLY, across every project.
 *
 * Why the durable row exists (this is the part a successor will want to undo):
 * `openedAt` on the token alone CANNOT carry consent. A release token lives 48
 * hours (`SECURE_LINK_EXPIRY_HOURS`) and the retention worker deletes it on the
 * next daily sweep once expired (`buildExpiredOrOldUsedHoldPointReleaseTokenWhere`
 * in `dataRetention.ts`), while `revokeSupersededChaseReleaseTokens` deletes
 * unused ones sooner still. A reminder is due days later, by which time the row
 * that proved consent is gone and the gate would deny everyone forever. So the
 * proof is copied to a row with its own lifetime. The token columns are still
 * read, because they are the only proof that exists for HISTORICAL rows on the
 * day this ships — no backfill.
 *
 * E.0 item 16 blocked a suppression table and named the flip condition:
 * "a recipient asking CIVOS directly to stop, rather than bouncing — then a
 * table becomes necessary, and it ships WITH a retention policy in the same PR."
 * The unsubscribe link is that request; the policy is
 * `RETENTION_POLICIES.holdPointMailConsent`.
 */

import crypto from 'crypto';

import { normalizeRecipientEmail } from './emailSuppression.js';
import { prisma } from './prisma.js';
import { logError, logInfo } from './serverLogger.js';

/**
 * Records that a public hold-point link was opened. Best-effort and
 * FIRST-OPEN-ONLY: a page the recipient refreshes twenty times must not churn
 * the row, and a write that fails must not break a page whose whole job is to
 * show a superintendent the evidence they were asked to review.
 *
 * `stampOpenedAt` is the caller's own token/batch row update, passed in so this
 * module does not need to know which of the two tables it is looking at.
 */
export async function recordHoldPointLinkOpen(input: {
  projectId: string;
  recipientEmail: string;
  stampOpenedAt: () => Promise<unknown>;
}): Promise<void> {
  const email = normalizeRecipientEmail(input.recipientEmail);
  if (!email) return;

  try {
    await input.stampOpenedAt();
    await prisma.holdPointMailConsent.upsert({
      where: { projectId_email: { projectId: input.projectId, email } },
      // An existing row keeps its FIRST open. `update: {}` still bumps
      // `updatedAt` (Prisma `@updatedAt`), which is deliberate: the retention
      // sweep below measures inactivity, not age.
      update: {},
      create: { projectId: input.projectId, email, firstOpenedAt: new Date() },
    });
  } catch (error) {
    // Never the address itself — spec §7.5, `[E-B7]`.
    logError('[HP Mail Consent] Failed to record link open', error);
  }
}

/**
 * The gate. True only with positive proof that this address has engaged with a
 * CIVOS hold-point link on THIS project.
 *
 * `usedAt` counts because a used token was necessarily opened first, and it is
 * the only signal historical rows carry. The `openedAt` arms cover links opened
 * but not yet acted on, in the window before the retention sweep removes them.
 */
export async function hasOpenedHoldPointLink(
  projectId: string,
  recipientEmail: string,
): Promise<boolean> {
  const email = normalizeRecipientEmail(recipientEmail);
  if (!email) return false;

  const consent = await prisma.holdPointMailConsent.findUnique({
    where: { projectId_email: { projectId, email } },
    select: { firstOpenedAt: true },
  });
  if (consent?.firstOpenedAt) return true;

  // Prisma has no case-insensitive equality that uses an index here, and
  // `recipientEmail` is stored with first-seen casing (E.0 item 12a), so the
  // comparison is `mode: 'insensitive'` on a project-scoped candidate set.
  const openedToken = await prisma.holdPointReleaseToken.findFirst({
    where: {
      recipientEmail: { equals: email, mode: 'insensitive' },
      OR: [{ openedAt: { not: null } }, { usedAt: { not: null } }],
      holdPoint: { lot: { projectId } },
    },
    select: { id: true },
  });
  if (openedToken) return true;

  const openedBatch = await prisma.holdPointReleaseBatch.findFirst({
    where: {
      recipientEmail: { equals: email, mode: 'insensitive' },
      openedAt: { not: null },
      lot: { projectId },
    },
    select: { id: true },
  });
  return openedBatch !== null;
}

/**
 * An unsubscribe is a person saying stop, not a per-project preference, so one
 * click stops CIVOS hold-point reminders to that address everywhere.
 */
export async function isHoldPointMailUnsubscribed(recipientEmail: string): Promise<boolean> {
  const email = normalizeRecipientEmail(recipientEmail);
  if (!email) return false;

  const row = await prisma.holdPointMailConsent.findFirst({
    where: { email, unsubscribedAt: { not: null } },
    select: { id: true },
  });
  return row !== null;
}

/** Idempotent: a second unsubscribe keeps the FIRST timestamp. */
export async function recordHoldPointMailUnsubscribe(
  projectId: string,
  recipientEmail: string,
): Promise<void> {
  const email = normalizeRecipientEmail(recipientEmail);
  if (!email) return;

  const existing = await prisma.holdPointMailConsent.findUnique({
    where: { projectId_email: { projectId, email } },
    select: { id: true, unsubscribedAt: true },
  });

  if (existing?.unsubscribedAt) return;

  if (existing) {
    await prisma.holdPointMailConsent.update({
      where: { id: existing.id },
      data: { unsubscribedAt: new Date() },
    });
  } else {
    await prisma.holdPointMailConsent.create({
      data: { projectId, email, unsubscribedAt: new Date() },
    });
  }

  // Never the address itself — spec §7.5, `[E-B7]`.
  logInfo('[HP Mail Consent] Recipient unsubscribed from hold-point reminders', { projectId });
}

// ---------------------------------------------------------------------------
// The unsubscribe link's token.
//
// An HMAC over `projectId:email`, not a stored row: it is stable across every
// digest, needs no minting step and no extra column, and cannot be derived from
// the address alone. Same construction and same secret fallback as
// `signedStorageUrls.ts`, which is this codebase's existing unauthenticated-
// token pattern.
//
// ponytail: no expiry. An unsubscribe link that stops working is worse than one
// that does not, and the only capability it grants is "stop emailing me".
// ---------------------------------------------------------------------------

const UNSUBSCRIBE_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function signUnsubscribe(projectId: string, email: string): string {
  return crypto
    .createHmac('sha256', UNSUBSCRIBE_SECRET)
    .update(`hp-unsubscribe.${projectId}.${email}`)
    .digest('hex');
}

/** `<projectId>.<base64url email>.<hmac>` — self-describing, no lookup table. */
export function createHoldPointUnsubscribeToken(projectId: string, recipientEmail: string): string {
  const email = normalizeRecipientEmail(recipientEmail);
  const encodedEmail = Buffer.from(email, 'utf8').toString('base64url');
  return `${projectId}.${encodedEmail}.${signUnsubscribe(projectId, email)}`;
}

export function parseHoldPointUnsubscribeToken(
  token: string,
): { projectId: string; email: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [projectId, encodedEmail, signature] = parts as [string, string, string];
  if (!projectId || !encodedEmail || !signature) return null;

  let email: string;
  try {
    email = normalizeRecipientEmail(Buffer.from(encodedEmail, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!email) return null;

  const expected = signUnsubscribe(projectId, email);
  const provided = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (provided.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(provided, expectedBuffer)) return null;

  return { projectId, email };
}
