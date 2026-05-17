import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('backup retention cleanup', () => {
  function runCleanupWithRetention(retentionDays: string) {
    const backupDir = mkdtempSync(join(tmpdir(), 'siteproof-backup-retention-'));
    const backupPath = join(backupDir, 'siteproof-old.dump');
    const checksumPath = `${backupPath}.sha256`;
    writeFileSync(backupPath, 'backup-bytes');
    writeFileSync(checksumPath, 'checksum  siteproof-old.dump\n');

    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    utimesSync(backupPath, oldDate, oldDate);
    utimesSync(checksumPath, oldDate, oldDate);

    const result = spawnSync(
      process.execPath,
      [
        join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        'scripts/backup.ts',
        'cleanup',
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          BACKUP_DIR: backupDir,
          BACKUP_RETENTION_DAYS: retentionDays,
        },
        encoding: 'utf8',
      },
    );

    return { backupDir, backupPath, checksumPath, result };
  }

  it.each(['abc', '-1', '0'])(
    'fails closed and preserves backups when BACKUP_RETENTION_DAYS=%s',
    (retentionDays) => {
      const { backupDir, backupPath, checksumPath, result } =
        runCleanupWithRetention(retentionDays);

      try {
        expect(result.status).toBe(1);
        expect(result.stderr + result.stdout).toContain('BACKUP_RETENTION_DAYS');
        expect(() => writeFileSync(backupPath, 'still-present', { flag: 'wx' })).toThrow();
        expect(() => writeFileSync(checksumPath, 'still-present', { flag: 'wx' })).toThrow();
      } finally {
        rmSync(backupDir, { recursive: true, force: true });
      }
    },
  );
});
