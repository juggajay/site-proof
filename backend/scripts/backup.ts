#!/usr/bin/env ts-node
/**
 * Feature #772: Database Backup and Verification
 *
 * This script provides database backup capabilities:
 * - Create backups with timestamps
 * - Verify backup integrity
 * - Restore from backup
 * - Clean up old backups
 *
 * Usage:
 *   npx ts-node scripts/backup.ts create     - Create a new backup
 *   npx ts-node scripts/backup.ts verify     - Verify latest backup
 *   npx ts-node scripts/backup.ts restore    - Restore from latest backup
 *   npx ts-node scripts/backup.ts list       - List available backups
 *   npx ts-node scripts/backup.ts cleanup    - Remove backups older than 30 days
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const DB_PATH = path.join(process.cwd(), 'prisma', 'dev.db')
const BACKUP_DIR = path.join(process.cwd(), 'backups')
const MAX_BACKUP_AGE_DAYS = 30

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

// Generate checksum for a file
function generateChecksum(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(fileBuffer).digest('hex')
}

// Create a new backup
async function createBackup(): Promise<string> {
  console.log('📦 Creating database backup...\n')

  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ Database file not found:', DB_PATH)
    process.exit(1)
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFileName = `backup-${timestamp}.db`
  const backupPath = path.join(BACKUP_DIR, backupFileName)
  const checksumPath = `${backupPath}.sha256`

  try {
    // Copy database file
    fs.copyFileSync(DB_PATH, backupPath)
    console.log(`✅ Backup created: ${backupFileName}`)

    // Generate and save checksum
    const checksum = generateChecksum(backupPath)
    fs.writeFileSync(checksumPath, checksum)
    console.log(`✅ Checksum saved: ${checksum.substring(0, 16)}...`)

    // Get file size
    const stats = fs.statSync(backupPath)
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
    console.log(`📊 Backup size: ${sizeMB} MB`)

    // Verify immediately
    const verified = verifyBackup(backupPath)
    if (verified) {
      console.log('\n✨ Backup verified successfully!')
    } else {
      console.error('\n⚠️  Backup verification failed!')
      process.exit(1)
    }

    return backupPath
  } catch (error) {
    console.error('❌ Backup failed:', error)
    process.exit(1)
  }
}

// Verify a backup file
function verifyBackup(backupPath?: string): boolean {
  console.log('🔍 Verifying backup...\n')

  // If no path provided, find latest backup
  if (!backupPath) {
    const backups = listBackups()
    if (backups.length === 0) {
      console.log('❌ No backups found')
      return false
    }
    backupPath = backups[0].path
  }

  const checksumPath = `${backupPath}.sha256`

  if (!fs.existsSync(backupPath)) {
    console.error('❌ Backup file not found:', backupPath)
    return false
  }

  if (!fs.existsSync(checksumPath)) {
    console.error('❌ Checksum file not found:', checksumPath)
    return false
  }

  const storedChecksum = fs.readFileSync(checksumPath, 'utf-8').trim()
  const currentChecksum = generateChecksum(backupPath)

  console.log(`📄 Backup: ${path.basename(backupPath)}`)
  console.log(`📝 Stored checksum:  ${storedChecksum.substring(0, 32)}...`)
  console.log(`📝 Current checksum: ${currentChecksum.substring(0, 32)}...`)

  if (storedChecksum === currentChecksum) {
    console.log('\n✅ Checksum verified - backup is intact')
    return true
  } else {
    console.error('\n❌ Checksum mismatch - backup may be corrupted!')
    return false
  }
}

// Restore from backup
async function restoreBackup(backupPath?: string): Promise<void> {
  console.log('🔄 Restoring from backup...\n')

  // If no path provided, find latest backup
  if (!backupPath) {
    const backups = listBackups()
    if (backups.length === 0) {
      console.error('❌ No backups found')
      process.exit(1)
    }
    backupPath = backups[0].path
  }

  // Verify before restoring
  if (!verifyBackup(backupPath)) {
    console.error('\n❌ Backup verification failed. Aborting restore.')
    process.exit(1)
  }

  console.log('\n⚠️  WARNING: This will overwrite the current database!')
  console.log('   Press Ctrl+C within 5 seconds to cancel...\n')

  await new Promise(resolve => setTimeout(resolve, 5000))

  try {
    // Create a backup of current database first
    if (fs.existsSync(DB_PATH)) {
      const preRestoreBackup = `${DB_PATH}.pre-restore-${Date.now()}`
      fs.copyFileSync(DB_PATH, preRestoreBackup)
      console.log(`📦 Current database backed up to: ${path.basename(preRestoreBackup)}`)
    }

    // Restore
    fs.copyFileSync(backupPath, DB_PATH)
    console.log(`\n✅ Database restored from: ${path.basename(backupPath)}`)
    console.log('\n⚠️  Please restart the application to use the restored database.')
  } catch (error) {
    console.error('❌ Restore failed:', error)
    process.exit(1)
  }
}

// List available backups
interface BackupInfo {
  path: string
  name: string
  date: Date
  size: number
  hasChecksum: boolean
}

function listBackups(): BackupInfo[] {
  const files = fs.readdirSync(BACKUP_DIR)
  const backups: BackupInfo[] = []

  for (const file of files) {
    if (file.endsWith('.db') && file.startsWith('backup-')) {
      const filePath = path.join(BACKUP_DIR, file)
      const stats = fs.statSync(filePath)
      const checksumExists = fs.existsSync(`${filePath}.sha256`)

      backups.push({
        path: filePath,
        name: file,
        date: stats.mtime,
        size: stats.size,
        hasChecksum: checksumExists,
      })
    }
  }

  // Sort by date, newest first
  backups.sort((a, b) => b.date.getTime() - a.date.getTime())
  return backups
}

function displayBackupList(): void {
  console.log('📋 Available Backups\n')

  const backups = listBackups()

  if (backups.length === 0) {
    console.log('No backups found in:', BACKUP_DIR)
    return
  }

  console.log('┌─────────────────────────────────────────┬────────────┬──────────┬───────────┐')
  console.log('│ Backup Name                             │ Date       │ Size     │ Verified  │')
  console.log('├─────────────────────────────────────────┼────────────┼──────────┼───────────┤')

  for (const backup of backups) {
    const name = backup.name.substring(0, 39).padEnd(39)
    const date = backup.date.toLocaleDateString().padEnd(10)
    const size = `${(backup.size / 1024 / 1024).toFixed(1)} MB`.padEnd(8)
    const verified = backup.hasChecksum ? '✅' : '❌'

    console.log(`│ ${name} │ ${date} │ ${size} │     ${verified}    │`)
  }

  console.log('└─────────────────────────────────────────┴────────────┴──────────┴───────────┘')
  console.log(`\nTotal: ${backups.length} backups`)
}

// Clean up old backups
function cleanupOldBackups(): void {
  console.log(`🧹 Cleaning up backups older than ${MAX_BACKUP_AGE_DAYS} days...\n`)

  const backups = listBackups()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - MAX_BACKUP_AGE_DAYS)

  let deletedCount = 0

  for (const backup of backups) {
    if (backup.date < cutoffDate) {
      // Delete backup file
      fs.unlinkSync(backup.path)
      console.log(`🗑️  Deleted: ${backup.name}`)

      // Delete checksum file if exists
      const checksumPath = `${backup.path}.sha256`
      if (fs.existsSync(checksumPath)) {
        fs.unlinkSync(checksumPath)
      }

      deletedCount++
    }
  }

  if (deletedCount === 0) {
    console.log('No old backups to clean up.')
  } else {
    console.log(`\n✅ Deleted ${deletedCount} old backup(s).`)
  }
}

// Parse command line arguments
const command = process.argv[2] || 'list'

switch (command) {
  case 'create':
    createBackup()
    break
  case 'verify':
    verifyBackup()
    break
  case 'restore':
    restoreBackup()
    break
  case 'list':
    displayBackupList()
    break
  case 'cleanup':
    cleanupOldBackups()
    break
  default:
    console.log(`
Database Backup Management

Commands:
  create   - Create a new backup with checksum
  verify   - Verify the latest backup integrity
  restore  - Restore from the latest backup
  list     - List all available backups
  cleanup  - Remove backups older than 30 days

Examples:
  npx ts-node scripts/backup.ts create
  npx ts-node scripts/backup.ts verify
  npx ts-node scripts/backup.ts restore
  npx ts-node scripts/backup.ts list
  npx ts-node scripts/backup.ts cleanup

Backup location: ${BACKUP_DIR}
`)
}
