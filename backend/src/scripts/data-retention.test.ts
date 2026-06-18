import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const prismaMock = {
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
  passwordResetToken: {
    count: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  emailVerificationToken: {
    count: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  notification: { count: vi.fn().mockResolvedValue(0) },
  syncQueue: {
    count: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  auditLog: { count: vi.fn().mockResolvedValue(0) },
  project: { count: vi.fn().mockResolvedValue(0) },
  documentSignedUrlToken: {
    count: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  holdPointReleaseToken: {
    count: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(function PrismaClient() {
    return prismaMock;
  }),
}));

async function importDataRetentionScript() {
  const scriptUrl = pathToFileURL(join(process.cwd(), 'scripts', 'data-retention.ts')).href;
  return import(/* @vite-ignore */ scriptUrl);
}

describe('data retention reporting', () => {
  it('does not report read notifications as archived before an archive path exists', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'data-retention.ts'), 'utf8');

    expect(source).not.toContain('toArchive += oldNotifications');
    expect(source).not.toContain(
      'Read notifications older than ${RETENTION_POLICIES.readNotifications} days can be archived',
    );
    expect(source).toContain('toRetain += oldNotifications');
    expect(source).toContain(
      'Read notifications older than ${RETENTION_POLICIES.readNotifications} days are retained until notification archiving is implemented',
    );
  });

  it('requires an explicit database confirmation before applying deletes', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'data-retention.ts'), 'utf8');
    const helperSource = readFileSync(
      join(process.cwd(), 'scripts', 'lib', 'database-target.ts'),
      'utf8',
    );

    expect(source).toContain('CONFIRM_RETENTION_APPLY');
    expect(source).toContain('requireRetentionApplyConfirmation');
    expect(helperSource).toContain('Refusing ${actionDescription}');
    expect(helperSource).toContain('database host/name');
  });

  it('builds document signed-link cleanup from expiry only', async () => {
    const { buildExpiredDocumentSignedUrlTokenWhere } = await importDataRetentionScript();
    const now = new Date('2026-06-13T00:00:00.000Z');

    expect(buildExpiredDocumentSignedUrlTokenWhere(now)).toEqual({
      expiresAt: { lt: now },
    });
  });

  it('builds hold-point release-token cleanup for expired or old used tokens only', async () => {
    const { buildExpiredOrOldUsedHoldPointReleaseTokenWhere, RETENTION_POLICIES } =
      await importDataRetentionScript();
    const now = new Date('2026-06-13T00:00:00.000Z');
    const usedCutoff = new Date(
      now.getTime() - RETENTION_POLICIES.usedHoldPointReleaseTokens * 24 * 60 * 60 * 1000,
    );

    expect(buildExpiredOrOldUsedHoldPointReleaseTokenWhere(now)).toEqual({
      OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null, lt: usedCutoff } }],
    });
  });
});
