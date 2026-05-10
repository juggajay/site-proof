#!/usr/bin/env tsx
/**
 * PostgreSQL backup helper.
 *
 * Requires the PostgreSQL client tools (`pg_dump` and `pg_restore`) on PATH.
 * Backups are written in PostgreSQL custom format with a SHA-256 checksum.
 *
 * Usage:
 *   tsx scripts/backup.ts create
 *   tsx scripts/backup.ts verify <backup-file>
 *   tsx scripts/backup.ts list
 *   tsx scripts/backup.ts cleanup
 *   CONFIRM_RESTORE=<backup-file-name> tsx scripts/backup.ts restore <backup-file>
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';

const BACKUP_DIR = resolve(process.env.BACKUP_DIR || join(process.cwd(), 'backups'));
const MAX_BACKUP_AGE_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 30);

type BackupInfo = {
  path: string;
  name: string;
  date: Date;
  size: number;
  hasChecksum: boolean;
};

function ensureBackupDir(): void {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for database backup and restore operations.');
  }

  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string.');
  }

  return databaseUrl;
}

function assertInsideBackupDir(filePath: string): string {
  const resolvedPath = resolve(BACKUP_DIR, filePath);
  const relativePath = relative(BACKUP_DIR, resolvedPath);

  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error(`Refusing to access backup path outside ${BACKUP_DIR}: ${filePath}`);
  }

  return resolvedPath;
}

function runCommand(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    if ('code' in result.error && result.error.code === 'ENOENT') {
      throw new Error(`${command} was not found on PATH. Install PostgreSQL client tools.`);
    }

    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`);
  }
}

function checksum(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function writeChecksum(filePath: string): void {
  writeFileSync(`${filePath}.sha256`, `${checksum(filePath)}  ${basename(filePath)}\n`);
}

function verifyChecksum(filePath: string): boolean {
  const checksumPath = `${filePath}.sha256`;
  if (!existsSync(filePath) || !existsSync(checksumPath)) {
    return false;
  }

  const expected = readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
  return expected === checksum(filePath);
}

function listBackups(): BackupInfo[] {
  if (!existsSync(BACKUP_DIR)) {
    return [];
  }

  return readdirSync(BACKUP_DIR)
    .filter((file) => file.endsWith('.dump'))
    .map((file) => {
      const filePath = join(BACKUP_DIR, file);
      const stats = statSync(filePath);

      return {
        path: filePath,
        name: file,
        date: stats.mtime,
        size: stats.size,
        hasChecksum: existsSync(`${filePath}.sha256`),
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

function createBackup(): void {
  ensureBackupDir();
  const databaseUrl = requireDatabaseUrl();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUP_DIR, `siteproof-${timestamp}.dump`);

  runCommand('pg_dump', [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--file',
    backupPath,
    databaseUrl,
  ]);
  writeChecksum(backupPath);
  verifyBackup(backupPath);

  const sizeMb = (statSync(backupPath).size / 1024 / 1024).toFixed(2);
  console.log(`Backup created: ${backupPath} (${sizeMb} MB)`);
}

function verifyBackup(filePathInput?: string): void {
  const backupPath = filePathInput ? assertInsideBackupDir(filePathInput) : listBackups()[0]?.path;

  if (!backupPath) {
    throw new Error('No backups found.');
  }

  if (!verifyChecksum(backupPath)) {
    throw new Error(`Checksum verification failed for ${backupPath}`);
  }

  runCommand('pg_restore', ['--list', backupPath]);
  console.log(`Backup verified: ${backupPath}`);
}

function restoreBackup(filePathInput?: string): void {
  const databaseUrl = requireDatabaseUrl();
  if (!filePathInput) {
    throw new Error('Restore requires an explicit backup file path.');
  }

  const backupPath = assertInsideBackupDir(filePathInput);
  const confirmation = process.env.CONFIRM_RESTORE?.trim();
  if (confirmation !== basename(backupPath)) {
    throw new Error(
      `Refusing restore. Set CONFIRM_RESTORE=${basename(backupPath)} to confirm this destructive operation.`,
    );
  }

  verifyBackup(backupPath);
  runCommand('pg_restore', [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    '--dbname',
    databaseUrl,
    backupPath,
  ]);
  console.log(`Database restored from: ${backupPath}`);
}

function displayBackups(): void {
  const backups = listBackups();

  if (backups.length === 0) {
    console.log(`No backups found in ${BACKUP_DIR}`);
    return;
  }

  for (const backup of backups) {
    const sizeMb = (backup.size / 1024 / 1024).toFixed(2);
    const checksumStatus = backup.hasChecksum ? 'checksum' : 'missing-checksum';
    console.log(`${backup.name}\t${backup.date.toISOString()}\t${sizeMb} MB\t${checksumStatus}`);
  }
}

function cleanupOldBackups(): void {
  const cutoff = Date.now() - MAX_BACKUP_AGE_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;

  for (const backup of listBackups()) {
    if (backup.date.getTime() >= cutoff) {
      continue;
    }

    unlinkSync(backup.path);
    if (existsSync(`${backup.path}.sha256`)) {
      unlinkSync(`${backup.path}.sha256`);
    }
    deleted += 1;
  }

  console.log(`Deleted ${deleted} backup(s) older than ${MAX_BACKUP_AGE_DAYS} days.`);
}

function printHelp(): void {
  console.log(`
PostgreSQL Backup Management

Commands:
  create                 Create a new pg_dump custom-format backup
  verify <backup-file>   Verify checksum and pg_restore readability
  restore <backup-file>  Restore a backup, requiring CONFIRM_RESTORE
  list                   List available backups
  cleanup                Remove backups older than BACKUP_RETENTION_DAYS

Environment:
  DATABASE_URL           Required for create and restore
  BACKUP_DIR             Optional backup directory, defaults to ./backups
  BACKUP_RETENTION_DAYS  Optional cleanup retention, defaults to 30
`);
}

try {
  const command = process.argv[2] || 'list';
  const filePath = process.argv[3];

  switch (command) {
    case 'create':
      createBackup();
      break;
    case 'verify':
      verifyBackup(filePath);
      break;
    case 'restore':
      restoreBackup(filePath);
      break;
    case 'list':
      displayBackups();
      break;
    case 'cleanup':
      cleanupOldBackups();
      break;
    default:
      printHelp();
      process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
