// Data-retention policy logic (Feature #773), extracted from
// scripts/data-retention.ts so it can be shared by the manual CLI and the
// in-process retention worker (src/lib/dataRetentionWorker.ts). This module is
// intentionally pure: it takes a Prisma client and performs no logging or
// process side effects, so importing it never opens a database connection.
// `importBatchGc` (the abandoned-batch sweep) does reference the `prisma`
// singleton, but only as a default argument this module never takes — Prisma
// constructs lazily and connects on first query, so the no-connection-on-import
// property holds, and `dataRetention.test.ts` drives the whole module off a mock
// client to keep it honest.
import type { Prisma, PrismaClient } from '@prisma/client';

import { sweepAbandonedImportBatches } from '../routes/copilot/import/importBatchGc.js';

// Retention periods in days.
export const RETENTION_POLICIES = {
  // Construction records (7 years per Australian standards)
  projectRecords: 7 * 365, // 2555 days

  // Audit trails (7 years for compliance). REPORT-ONLY, and deliberately so:
  // nothing deletes an audit row. `RetentionPrismaClient` below omits
  // `auditLog` on purpose, so `applyRetentionPolicies` cannot reach the table
  // even by accident, and `chaseCore.ts:391` depends on that ("audit rows are
  // retention-exempt") to resolve a hold point's original requester after every
  // capability token for it has been purged. The single consumer of this number
  // is the operator report at `scripts/data-retention.ts:211`/`:224`/`:264`,
  // which COUNTS rows inside the window and never deletes.
  //
  // Wave E.0 §9.3 called this constant dead — a grep scoped to `backend/src`,
  // which the CLI sits outside. It is read; it just does not authorise a
  // deletion, and wiring it to one would destroy compliance evidence to fix a
  // privacy finding that `auditLog.ts`'s ninth redaction pattern already fixes.
  auditLogs: 7 * 365,

  // Session/auth data (short-lived)
  expiredSessions: 30,
  revokedAuthTokens: 1,
  passwordResetTokens: 1,
  emailVerificationTokens: 7,
  usedHoldPointReleaseTokens: 30,

  // Notifications
  readNotifications: 90,

  // Sync queue (processed items)
  processedSyncItems: 7,

  // Product/UX telemetry (privacy-conscious: short window, not a compliance record)
  productEvents: 180,

  // Wave E2.1 — external hold-point recipients' mail state. E.0 item 16 blocked
  // a suppression table until a recipient asked CIVOS directly to stop, and
  // required that when it shipped it shipped WITH a policy. This is the policy.
  //
  // Two years of inactivity, measured on `updatedAt`, and ONLY for rows that
  // record consent alone. An UNSUBSCRIBED row is never swept: deleting an
  // opt-out is how a company resumes emailing someone who told it to stop, and
  // "retained until the person asks us to forget them" is the honest policy for
  // a record whose only purpose is to withhold mail. Sweeping a consent-only
  // row is safe in the other direction — the gate fails closed, so the worst
  // case is a reminder not sent.
  holdPointMailConsent: 2 * 365,
};

export const DAYS_TO_MS = 24 * 60 * 60 * 1000;

export function buildExpiredDocumentSignedUrlTokenWhere(
  now: Date,
): Prisma.DocumentSignedUrlTokenWhereInput {
  return {
    expiresAt: { lt: now },
  };
}

export function buildExpiredOrOldUsedHoldPointReleaseTokenWhere(
  now: Date,
): Prisma.HoldPointReleaseTokenWhereInput {
  const usedCutoff = new Date(
    now.getTime() - RETENTION_POLICIES.usedHoldPointReleaseTokens * DAYS_TO_MS,
  );

  return {
    OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null, lt: usedCutoff } }],
  };
}

export function buildStaleHoldPointMailConsentWhere(
  now: Date,
): Prisma.HoldPointMailConsentWhereInput {
  const cutoff = new Date(now.getTime() - RETENTION_POLICIES.holdPointMailConsent * DAYS_TO_MS);

  return { unsubscribedAt: null, updatedAt: { lt: cutoff } };
}

export interface RetentionApplyResult {
  passwordResetTokens: number;
  emailVerificationTokens: number;
  processedSyncItems: number;
  documentSignedUrlTokens: number;
  holdPointReleaseTokens: number;
  revokedAuthTokens: number;
  productEvents: number;
  /** Wave E2.1 — consent-only rows past their inactivity window. */
  holdPointMailConsents: number;
  /**
   * Wave B `[WBR2-3]` §3.1.2. Reported SEPARATELY and deliberately outside
   * `totalDeleted`: an abandoned batch is CANCELLED, not deleted — the row and
   * its source Document survive, only the reproducible parse artefacts are
   * nulled. Folding it into a "records cleaned up" total would report deletions
   * that did not happen.
   */
  abandonedImportBatches: number;
  totalDeleted: number;
}

type RetentionPrismaClient = Pick<
  PrismaClient,
  | 'passwordResetToken'
  | 'emailVerificationToken'
  | 'syncQueue'
  | 'documentSignedUrlToken'
  | 'holdPointReleaseToken'
  | 'revokedAuthToken'
  | 'productEvent'
  | 'importBatch'
  | 'holdPointMailConsent'
>;

/**
 * Delete short-lived records that are past their retention window: expired
 * password-reset / email-verification / document-signed-link tokens, processed
 * sync-queue rows, and expired-or-old-used hold-point release (capability)
 * tokens. Project, audit, NCR, lot and test data are never auto-deleted.
 *
 * Idempotent: deleting already-deleted rows is a no-op, so it is safe to run on
 * every replica.
 */
export async function applyRetentionPolicies(
  client: RetentionPrismaClient,
): Promise<RetentionApplyResult> {
  const now = new Date();

  const passwordResetTokens = (
    await client.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } })
  ).count;

  const emailVerificationTokens = (
    await client.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: now } } })
  ).count;

  const syncCutoff = new Date(now.getTime() - RETENTION_POLICIES.processedSyncItems * DAYS_TO_MS);
  const processedSyncItems = (
    await client.syncQueue.deleteMany({ where: { status: 'synced', syncedAt: { lt: syncCutoff } } })
  ).count;

  const documentSignedUrlTokens = (
    await client.documentSignedUrlToken.deleteMany({
      where: buildExpiredDocumentSignedUrlTokenWhere(now),
    })
  ).count;

  const holdPointReleaseTokens = (
    await client.holdPointReleaseToken.deleteMany({
      where: buildExpiredOrOldUsedHoldPointReleaseTokenWhere(now),
    })
  ).count;

  const revokedAuthTokens = (
    await client.revokedAuthToken.deleteMany({ where: { expiresAt: { lt: now } } })
  ).count;

  const productEventsCutoff = new Date(
    now.getTime() - RETENTION_POLICIES.productEvents * DAYS_TO_MS,
  );
  const productEvents = (
    await client.productEvent.deleteMany({ where: { createdAt: { lt: productEventsCutoff } } })
  ).count;

  const holdPointMailConsents = (
    await client.holdPointMailConsent.deleteMany({
      where: buildStaleHoldPointMailConsentWhere(now),
    })
  ).count;

  // Wave B `[WBR2-3]` §3.1.2 — the abandoned-import-batch sweep. It shipped with
  // its own index and its own tests and NO invoker (external review §4b), which
  // made the retention claim in its own header false. This is that invoker: the
  // policy module is the one place both the live worker and the operator CLI
  // funnel through, so wiring it here reaches both.
  const abandonedImportBatches = await sweepAbandonedImportBatches(now, client);

  return {
    passwordResetTokens,
    emailVerificationTokens,
    processedSyncItems,
    documentSignedUrlTokens,
    holdPointReleaseTokens,
    revokedAuthTokens,
    productEvents,
    holdPointMailConsents,
    abandonedImportBatches,
    totalDeleted:
      passwordResetTokens +
      emailVerificationTokens +
      processedSyncItems +
      documentSignedUrlTokens +
      holdPointReleaseTokens +
      revokedAuthTokens +
      productEvents +
      holdPointMailConsents,
  };
}
