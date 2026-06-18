#!/usr/bin/env ts-node
/**
 * Feature #773: Data Retention Policy Management
 *
 * This script implements data retention policies for the SiteProof application.
 * Civil construction projects typically require 7+ years of record retention
 * for compliance with Australian regulations.
 *
 * Retention Policies:
 * - Active projects: No automatic deletion
 * - Archived projects: Retain for 7 years after completion
 * - Audit logs: Retain for 7 years
 * - Session tokens: Delete after 30 days
 * - Password reset tokens: Delete after 24 hours
 * - Notifications (read): Review after 90 days; retained until archive support exists
 *
 * Usage:
 *   npx ts-node scripts/data-retention.ts check    - Check what would be affected
 *   CONFIRM_RETENTION_APPLY=<host>/<database> npx ts-node scripts/data-retention.ts apply
 *                                                     - Apply retention policies
 *   npx ts-node scripts/data-retention.ts report   - Generate retention report
 */

import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireDatabaseTargetConfirmation } from './lib/database-target.js';

const prisma = new PrismaClient();

// Retention periods in days
export const RETENTION_POLICIES = {
  // Construction records (7 years per Australian standards)
  projectRecords: 7 * 365, // 2555 days

  // Audit trails (7 years for compliance)
  auditLogs: 7 * 365,

  // Session/auth data (short-lived)
  expiredSessions: 30,
  passwordResetTokens: 1,
  emailVerificationTokens: 7,
  usedHoldPointReleaseTokens: 30,

  // Notifications
  readNotifications: 90,

  // Sync queue (processed items)
  processedSyncItems: 7,
};

const DAYS_TO_MS = 24 * 60 * 60 * 1000;

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

interface RetentionReport {
  timestamp: string;
  policies: typeof RETENTION_POLICIES;
  findings: {
    category: string;
    count: number;
    oldestDate?: Date;
    action: 'retain' | 'archive' | 'delete';
    reason: string;
  }[];
  summary: {
    totalRecordsChecked: number;
    recordsToRetain: number;
    recordsToArchive: number;
    recordsToDelete: number;
  };
}

function requireRetentionApplyConfirmation(): void {
  requireDatabaseTargetConfirmation('CONFIRM_RETENTION_APPLY', 'retention apply');
}

async function checkRetentionPolicies(): Promise<RetentionReport> {
  console.log('🔍 Checking data retention policies...\n');

  const now = new Date();
  const findings: RetentionReport['findings'] = [];
  let totalChecked = 0;
  let toRetain = 0;
  const toArchive = 0;
  let toDelete = 0;

  // Check expired password reset tokens
  const expiredPasswordTokens = await prisma.passwordResetToken.count({
    where: {
      expiresAt: { lt: now },
    },
  });
  totalChecked += expiredPasswordTokens;
  if (expiredPasswordTokens > 0) {
    toDelete += expiredPasswordTokens;
    findings.push({
      category: 'Password Reset Tokens (Expired)',
      count: expiredPasswordTokens,
      action: 'delete',
      reason: 'Tokens have expired and are no longer valid',
    });
  }

  // Check expired email verification tokens
  const expiredEmailTokens = await prisma.emailVerificationToken.count({
    where: {
      expiresAt: { lt: now },
    },
  });
  totalChecked += expiredEmailTokens;
  if (expiredEmailTokens > 0) {
    toDelete += expiredEmailTokens;
    findings.push({
      category: 'Email Verification Tokens (Expired)',
      count: expiredEmailTokens,
      action: 'delete',
      reason: 'Tokens have expired and are no longer valid',
    });
  }

  // Check old read notifications. The Notification schema currently has no archive field/table, so
  // these must be reported as retained rather than as a promised archive action.
  const notificationCutoff = new Date(
    now.getTime() - RETENTION_POLICIES.readNotifications * DAYS_TO_MS,
  );
  const oldNotifications = await prisma.notification.count({
    where: {
      isRead: true,
      createdAt: { lt: notificationCutoff },
    },
  });
  totalChecked += oldNotifications;
  if (oldNotifications > 0) {
    toRetain += oldNotifications;
    findings.push({
      category: 'Read Notifications (90+ days old)',
      count: oldNotifications,
      oldestDate: notificationCutoff,
      action: 'retain',
      reason: `Read notifications older than ${RETENTION_POLICIES.readNotifications} days are retained until notification archiving is implemented`,
    });
  }

  // Check processed sync queue items
  const syncCutoff = new Date(now.getTime() - RETENTION_POLICIES.processedSyncItems * DAYS_TO_MS);
  const processedSyncItems = await prisma.syncQueue.count({
    where: {
      status: 'synced',
      syncedAt: { lt: syncCutoff },
    },
  });
  totalChecked += processedSyncItems;
  if (processedSyncItems > 0) {
    toDelete += processedSyncItems;
    findings.push({
      category: 'Processed Sync Queue Items',
      count: processedSyncItems,
      oldestDate: syncCutoff,
      action: 'delete',
      reason: `Processed sync items older than ${RETENTION_POLICIES.processedSyncItems} days`,
    });
  }

  // Check expired bearer-link document tokens
  const expiredDocumentSignedUrlTokens = await prisma.documentSignedUrlToken.count({
    where: buildExpiredDocumentSignedUrlTokenWhere(now),
  });
  totalChecked += expiredDocumentSignedUrlTokens;
  if (expiredDocumentSignedUrlTokens > 0) {
    toDelete += expiredDocumentSignedUrlTokens;
    findings.push({
      category: 'Document Signed URL Tokens (Expired)',
      count: expiredDocumentSignedUrlTokens,
      action: 'delete',
      reason: 'Signed document-link bearer tokens have expired and are no longer valid',
    });
  }

  // Check expired or old used hold-point release tokens
  const usedHoldPointTokenCutoff = new Date(
    now.getTime() - RETENTION_POLICIES.usedHoldPointReleaseTokens * DAYS_TO_MS,
  );
  const expiredOrOldUsedHoldPointReleaseTokens = await prisma.holdPointReleaseToken.count({
    where: buildExpiredOrOldUsedHoldPointReleaseTokenWhere(now),
  });
  totalChecked += expiredOrOldUsedHoldPointReleaseTokens;
  if (expiredOrOldUsedHoldPointReleaseTokens > 0) {
    toDelete += expiredOrOldUsedHoldPointReleaseTokens;
    findings.push({
      category: 'Hold Point Release Tokens (Expired or Used)',
      count: expiredOrOldUsedHoldPointReleaseTokens,
      oldestDate: usedHoldPointTokenCutoff,
      action: 'delete',
      reason: `Expired release-link bearer tokens and used release tokens older than ${RETENTION_POLICIES.usedHoldPointReleaseTokens} days`,
    });
  }

  // Check audit logs (report only - don't delete within retention period)
  const auditLogCutoff = new Date(now.getTime() - RETENTION_POLICIES.auditLogs * DAYS_TO_MS);
  const retainedAuditLogs = await prisma.auditLog.count({
    where: {
      createdAt: { gte: auditLogCutoff },
    },
  });
  const totalAuditLogs = await prisma.auditLog.count();
  totalChecked += totalAuditLogs;
  toRetain += retainedAuditLogs;
  findings.push({
    category: 'Audit Logs (Within Retention)',
    count: retainedAuditLogs,
    action: 'retain',
    reason: `Audit logs are retained for ${RETENTION_POLICIES.auditLogs / 365} years per compliance`,
  });

  // Check project data - civil construction projects require long retention
  const projects = await prisma.project.count();
  const completedProjects = await prisma.project.count({
    where: { status: 'completed' },
  });
  totalChecked += projects;
  toRetain += projects;
  findings.push({
    category: 'Project Records',
    count: projects,
    action: 'retain',
    reason: `All project data retained for ${RETENTION_POLICIES.projectRecords / 365} years (${completedProjects} completed)`,
  });

  // Generate report
  const report: RetentionReport = {
    timestamp: now.toISOString(),
    policies: RETENTION_POLICIES,
    findings,
    summary: {
      totalRecordsChecked: totalChecked,
      recordsToRetain: toRetain,
      recordsToArchive: toArchive,
      recordsToDelete: toDelete,
    },
  };

  return report;
}

function displayReport(report: RetentionReport): void {
  console.log('📊 Data Retention Report');
  console.log('========================\n');
  console.log(`Generated: ${report.timestamp}\n`);

  console.log('Retention Policies:');
  console.log(`  • Project Records: ${report.policies.projectRecords / 365} years`);
  console.log(`  • Audit Logs: ${report.policies.auditLogs / 365} years`);
  console.log(
    `  • Read Notifications: ${report.policies.readNotifications} days (retained pending archive support)`,
  );
  console.log(`  • Sync Queue: ${report.policies.processedSyncItems} days`);
  console.log('  • Document Signed URL Tokens: expired tokens deleted');
  console.log(
    `  • Hold Point Release Tokens: expired tokens and used tokens older than ${report.policies.usedHoldPointReleaseTokens} days deleted`,
  );
  console.log('');

  console.log('Findings:');
  console.log('─────────────────────────────────────────────────────────────────');

  for (const finding of report.findings) {
    const actionIcon =
      finding.action === 'retain' ? '✅' : finding.action === 'archive' ? '📦' : '🗑️';
    console.log(`${actionIcon} ${finding.category}`);
    console.log(`   Count: ${finding.count.toLocaleString()}`);
    console.log(`   Action: ${finding.action.toUpperCase()}`);
    console.log(`   Reason: ${finding.reason}`);
    if (finding.oldestDate) {
      console.log(`   Cutoff: ${finding.oldestDate.toLocaleDateString()}`);
    }
    console.log('');
  }

  console.log('Summary:');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`  Total Records Checked: ${report.summary.totalRecordsChecked.toLocaleString()}`);
  console.log(`  Records to Retain:     ${report.summary.recordsToRetain.toLocaleString()}`);
  console.log(`  Records to Archive:    ${report.summary.recordsToArchive.toLocaleString()}`);
  console.log(`  Records to Delete:     ${report.summary.recordsToDelete.toLocaleString()}`);
}

async function applyRetentionPolicies(): Promise<void> {
  console.log('🔄 Applying data retention policies...\n');

  const now = new Date();
  let totalDeleted = 0;

  // Delete expired password reset tokens
  const deletedPasswordTokens = await prisma.passwordResetToken.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });
  if (deletedPasswordTokens.count > 0) {
    console.log(`✅ Deleted ${deletedPasswordTokens.count} expired password reset tokens`);
    totalDeleted += deletedPasswordTokens.count;
  }

  // Delete expired email verification tokens
  const deletedEmailTokens = await prisma.emailVerificationToken.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });
  if (deletedEmailTokens.count > 0) {
    console.log(`✅ Deleted ${deletedEmailTokens.count} expired email verification tokens`);
    totalDeleted += deletedEmailTokens.count;
  }

  // Delete old processed sync queue items
  const syncCutoff = new Date(now.getTime() - RETENTION_POLICIES.processedSyncItems * DAYS_TO_MS);
  const deletedSyncItems = await prisma.syncQueue.deleteMany({
    where: {
      status: 'synced',
      syncedAt: { lt: syncCutoff },
    },
  });
  if (deletedSyncItems.count > 0) {
    console.log(`✅ Deleted ${deletedSyncItems.count} processed sync queue items`);
    totalDeleted += deletedSyncItems.count;
  }

  // Delete expired bearer-link document tokens
  const deletedDocumentSignedUrlTokens = await prisma.documentSignedUrlToken.deleteMany({
    where: buildExpiredDocumentSignedUrlTokenWhere(now),
  });
  if (deletedDocumentSignedUrlTokens.count > 0) {
    console.log(
      `✅ Deleted ${deletedDocumentSignedUrlTokens.count} expired document signed-link tokens`,
    );
    totalDeleted += deletedDocumentSignedUrlTokens.count;
  }

  // Delete expired release-link tokens and old used release-link tokens
  const deletedHoldPointReleaseTokens = await prisma.holdPointReleaseToken.deleteMany({
    where: buildExpiredOrOldUsedHoldPointReleaseTokenWhere(now),
  });
  if (deletedHoldPointReleaseTokens.count > 0) {
    console.log(
      `✅ Deleted ${deletedHoldPointReleaseTokens.count} expired or old used hold point release-link tokens`,
    );
    totalDeleted += deletedHoldPointReleaseTokens.count;
  }

  // Note: Notifications are retained until a real archive field/table exists
  // Note: Project data, NCRs, lots, test results are NEVER auto-deleted

  console.log(`\n✨ Retention policies applied. ${totalDeleted} records cleaned up.`);
  console.log(
    '\n⚠️  Note: Project records, notifications, NCRs, lots, and test results are retained per policy.',
  );
}

async function saveReport(report: RetentionReport): Promise<void> {
  const reportDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const filename = `retention-report-${report.timestamp.replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(reportDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${filepath}`);
}

// Main execution
async function main() {
  const command = process.argv[2] || 'check';

  try {
    if (command === 'apply') {
      requireRetentionApplyConfirmation();
    }

    await prisma.$connect();

    switch (command) {
      case 'check': {
        const checkReport = await checkRetentionPolicies();
        displayReport(checkReport);
        break;
      }

      case 'apply':
        console.log('⚠️  This will permanently delete data according to retention policies.');
        console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await applyRetentionPolicies();
        break;

      case 'report': {
        const fullReport = await checkRetentionPolicies();
        displayReport(fullReport);
        await saveReport(fullReport);
        break;
      }

      default:
        console.log(`
Data Retention Policy Management

Commands:
  check   - Check what data would be affected by policies
  apply   - Apply retention policies (delete eligible old data)
  report  - Generate and save a detailed retention report

Retention Periods:
  • Project Records: 7 years (Australian construction compliance)
  • Audit Logs: 7 years
  • Read Notifications: 90 days (retained pending archive support)
  • Expired Tokens: Immediate deletion
  • Used Hold Point Release Tokens: ${RETENTION_POLICIES.usedHoldPointReleaseTokens} days
  • Processed Sync Items: 7 days

Examples:
  npx ts-node scripts/data-retention.ts check
  CONFIRM_RETENTION_APPLY=<host>/<database> npx ts-node scripts/data-retention.ts apply
  npx ts-node scripts/data-retention.ts report
`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const currentModulePath = fileURLToPath(import.meta.url);
const invokedScriptPath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedScriptPath === currentModulePath) {
  main();
}
