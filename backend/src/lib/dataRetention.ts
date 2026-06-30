// Data-retention policy logic (Feature #773), extracted from
// scripts/data-retention.ts so it can be shared by the manual CLI and the
// in-process retention worker (src/lib/dataRetentionWorker.ts). This module is
// intentionally pure: it takes a Prisma client and performs no logging or
// process side effects, so importing it never opens a database connection.
import type { Prisma, PrismaClient } from '@prisma/client';

// Retention periods in days.
export const RETENTION_POLICIES = {
  // Construction records (7 years per Australian standards)
  projectRecords: 7 * 365, // 2555 days

  // Audit trails (7 years for compliance)
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

export interface RetentionApplyResult {
  passwordResetTokens: number;
  emailVerificationTokens: number;
  processedSyncItems: number;
  documentSignedUrlTokens: number;
  holdPointReleaseTokens: number;
  revokedAuthTokens: number;
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

  return {
    passwordResetTokens,
    emailVerificationTokens,
    processedSyncItems,
    documentSignedUrlTokens,
    holdPointReleaseTokens,
    revokedAuthTokens,
    totalDeleted:
      passwordResetTokens +
      emailVerificationTokens +
      processedSyncItems +
      documentSignedUrlTokens +
      holdPointReleaseTokens +
      revokedAuthTokens,
  };
}
