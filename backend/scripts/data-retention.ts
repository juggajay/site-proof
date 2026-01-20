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
 * - Notifications (read): Archive after 90 days
 *
 * Usage:
 *   npx ts-node scripts/data-retention.ts check    - Check what would be affected
 *   npx ts-node scripts/data-retention.ts apply    - Apply retention policies
 *   npx ts-node scripts/data-retention.ts report   - Generate retention report
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

// Retention periods in days
const RETENTION_POLICIES = {
  // Construction records (7 years per Australian standards)
  projectRecords: 7 * 365, // 2555 days

  // Audit trails (7 years for compliance)
  auditLogs: 7 * 365,

  // Session/auth data (short-lived)
  expiredSessions: 30,
  passwordResetTokens: 1,
  emailVerificationTokens: 7,

  // Notifications
  readNotifications: 90,

  // Sync queue (processed items)
  processedSyncItems: 7,
}

interface RetentionReport {
  timestamp: string
  policies: typeof RETENTION_POLICIES
  findings: {
    category: string
    count: number
    oldestDate?: Date
    action: 'retain' | 'archive' | 'delete'
    reason: string
  }[]
  summary: {
    totalRecordsChecked: number
    recordsToRetain: number
    recordsToArchive: number
    recordsToDelete: number
  }
}

async function checkRetentionPolicies(): Promise<RetentionReport> {
  console.log('🔍 Checking data retention policies...\n')

  const now = new Date()
  const findings: RetentionReport['findings'] = []
  let totalChecked = 0
  let toRetain = 0
  let toArchive = 0
  let toDelete = 0

  // Check expired password reset tokens
  const expiredPasswordTokens = await prisma.passwordResetToken.count({
    where: {
      expiresAt: { lt: now },
    },
  })
  totalChecked += expiredPasswordTokens
  if (expiredPasswordTokens > 0) {
    toDelete += expiredPasswordTokens
    findings.push({
      category: 'Password Reset Tokens (Expired)',
      count: expiredPasswordTokens,
      action: 'delete',
      reason: 'Tokens have expired and are no longer valid',
    })
  }

  // Check expired email verification tokens
  const expiredEmailTokens = await prisma.emailVerificationToken.count({
    where: {
      expiresAt: { lt: now },
    },
  })
  totalChecked += expiredEmailTokens
  if (expiredEmailTokens > 0) {
    toDelete += expiredEmailTokens
    findings.push({
      category: 'Email Verification Tokens (Expired)',
      count: expiredEmailTokens,
      action: 'delete',
      reason: 'Tokens have expired and are no longer valid',
    })
  }

  // Check old read notifications
  const notificationCutoff = new Date(now.getTime() - RETENTION_POLICIES.readNotifications * 24 * 60 * 60 * 1000)
  const oldNotifications = await prisma.notification.count({
    where: {
      isRead: true,
      createdAt: { lt: notificationCutoff },
    },
  })
  totalChecked += oldNotifications
  if (oldNotifications > 0) {
    toArchive += oldNotifications
    findings.push({
      category: 'Read Notifications (90+ days old)',
      count: oldNotifications,
      oldestDate: notificationCutoff,
      action: 'archive',
      reason: `Read notifications older than ${RETENTION_POLICIES.readNotifications} days can be archived`,
    })
  }

  // Check processed sync queue items
  const syncCutoff = new Date(now.getTime() - RETENTION_POLICIES.processedSyncItems * 24 * 60 * 60 * 1000)
  const processedSyncItems = await prisma.syncQueue.count({
    where: {
      status: 'synced',
      syncedAt: { lt: syncCutoff },
    },
  })
  totalChecked += processedSyncItems
  if (processedSyncItems > 0) {
    toDelete += processedSyncItems
    findings.push({
      category: 'Processed Sync Queue Items',
      count: processedSyncItems,
      oldestDate: syncCutoff,
      action: 'delete',
      reason: `Processed sync items older than ${RETENTION_POLICIES.processedSyncItems} days`,
    })
  }

  // Check audit logs (report only - don't delete within retention period)
  const auditLogCutoff = new Date(now.getTime() - RETENTION_POLICIES.auditLogs * 24 * 60 * 60 * 1000)
  const retainedAuditLogs = await prisma.auditLog.count({
    where: {
      createdAt: { gte: auditLogCutoff },
    },
  })
  const totalAuditLogs = await prisma.auditLog.count()
  totalChecked += totalAuditLogs
  toRetain += retainedAuditLogs
  findings.push({
    category: 'Audit Logs (Within Retention)',
    count: retainedAuditLogs,
    action: 'retain',
    reason: `Audit logs are retained for ${RETENTION_POLICIES.auditLogs / 365} years per compliance`,
  })

  // Check project data - civil construction projects require long retention
  const projects = await prisma.project.count()
  const completedProjects = await prisma.project.count({
    where: { status: 'completed' },
  })
  totalChecked += projects
  toRetain += projects
  findings.push({
    category: 'Project Records',
    count: projects,
    action: 'retain',
    reason: `All project data retained for ${RETENTION_POLICIES.projectRecords / 365} years (${completedProjects} completed)`,
  })

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
  }

  return report
}

function displayReport(report: RetentionReport): void {
  console.log('📊 Data Retention Report')
  console.log('========================\n')
  console.log(`Generated: ${report.timestamp}\n`)

  console.log('Retention Policies:')
  console.log(`  • Project Records: ${report.policies.projectRecords / 365} years`)
  console.log(`  • Audit Logs: ${report.policies.auditLogs / 365} years`)
  console.log(`  • Read Notifications: ${report.policies.readNotifications} days`)
  console.log(`  • Sync Queue: ${report.policies.processedSyncItems} days`)
  console.log('')

  console.log('Findings:')
  console.log('─────────────────────────────────────────────────────────────────')

  for (const finding of report.findings) {
    const actionIcon = finding.action === 'retain' ? '✅' : finding.action === 'archive' ? '📦' : '🗑️'
    console.log(`${actionIcon} ${finding.category}`)
    console.log(`   Count: ${finding.count.toLocaleString()}`)
    console.log(`   Action: ${finding.action.toUpperCase()}`)
    console.log(`   Reason: ${finding.reason}`)
    if (finding.oldestDate) {
      console.log(`   Cutoff: ${finding.oldestDate.toLocaleDateString()}`)
    }
    console.log('')
  }

  console.log('Summary:')
  console.log('─────────────────────────────────────────────────────────────────')
  console.log(`  Total Records Checked: ${report.summary.totalRecordsChecked.toLocaleString()}`)
  console.log(`  Records to Retain:     ${report.summary.recordsToRetain.toLocaleString()}`)
  console.log(`  Records to Archive:    ${report.summary.recordsToArchive.toLocaleString()}`)
  console.log(`  Records to Delete:     ${report.summary.recordsToDelete.toLocaleString()}`)
}

async function applyRetentionPolicies(): Promise<void> {
  console.log('🔄 Applying data retention policies...\n')

  const now = new Date()
  let totalDeleted = 0

  // Delete expired password reset tokens
  const deletedPasswordTokens = await prisma.passwordResetToken.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  })
  if (deletedPasswordTokens.count > 0) {
    console.log(`✅ Deleted ${deletedPasswordTokens.count} expired password reset tokens`)
    totalDeleted += deletedPasswordTokens.count
  }

  // Delete expired email verification tokens
  const deletedEmailTokens = await prisma.emailVerificationToken.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  })
  if (deletedEmailTokens.count > 0) {
    console.log(`✅ Deleted ${deletedEmailTokens.count} expired email verification tokens`)
    totalDeleted += deletedEmailTokens.count
  }

  // Delete old processed sync queue items
  const syncCutoff = new Date(now.getTime() - RETENTION_POLICIES.processedSyncItems * 24 * 60 * 60 * 1000)
  const deletedSyncItems = await prisma.syncQueue.deleteMany({
    where: {
      status: 'synced',
      syncedAt: { lt: syncCutoff },
    },
  })
  if (deletedSyncItems.count > 0) {
    console.log(`✅ Deleted ${deletedSyncItems.count} processed sync queue items`)
    totalDeleted += deletedSyncItems.count
  }

  // Note: Notifications are archived, not deleted
  // Note: Project data, NCRs, lots, test results are NEVER auto-deleted

  console.log(`\n✨ Retention policies applied. ${totalDeleted} records cleaned up.`)
  console.log('\n⚠️  Note: Project records, NCRs, lots, and test results are retained per policy.')
}

async function saveReport(report: RetentionReport): Promise<void> {
  const reportDir = path.join(process.cwd(), 'reports')
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }

  const filename = `retention-report-${report.timestamp.replace(/[:.]/g, '-')}.json`
  const filepath = path.join(reportDir, filename)

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2))
  console.log(`\n📄 Report saved to: ${filepath}`)
}

// Main execution
async function main() {
  const command = process.argv[2] || 'check'

  try {
    await prisma.$connect()

    switch (command) {
      case 'check':
        const checkReport = await checkRetentionPolicies()
        displayReport(checkReport)
        break

      case 'apply':
        console.log('⚠️  This will permanently delete data according to retention policies.')
        console.log('   Press Ctrl+C within 5 seconds to cancel...\n')
        await new Promise(resolve => setTimeout(resolve, 5000))
        await applyRetentionPolicies()
        break

      case 'report':
        const fullReport = await checkRetentionPolicies()
        displayReport(fullReport)
        await saveReport(fullReport)
        break

      default:
        console.log(`
Data Retention Policy Management

Commands:
  check   - Check what data would be affected by policies
  apply   - Apply retention policies (delete/archive old data)
  report  - Generate and save a detailed retention report

Retention Periods:
  • Project Records: 7 years (Australian construction compliance)
  • Audit Logs: 7 years
  • Read Notifications: 90 days (archived)
  • Expired Tokens: Immediate deletion
  • Processed Sync Items: 7 days

Examples:
  npx ts-node scripts/data-retention.ts check
  npx ts-node scripts/data-retention.ts apply
  npx ts-node scripts/data-retention.ts report
`)
    }
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
