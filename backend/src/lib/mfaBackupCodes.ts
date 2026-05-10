import crypto from 'crypto';
import { prisma } from './prisma.js';

const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_BYTES = 5;
const BACKUP_CODE_PATTERN = /^[A-F0-9]{10}$/;

function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

function hashBackupCode(userId: string, code: string): string {
  const key =
    process.env.MFA_BACKUP_CODE_SECRET ||
    process.env.JWT_SECRET ||
    process.env.ENCRYPTION_KEY ||
    'dev-mfa-backup-code-secret';

  return crypto
    .createHmac('sha256', key)
    .update(`${userId}:${normalizeBackupCode(code)}`)
    .digest('hex');
}

export function generateMfaBackupCodes(): string[] {
  const codes = new Set<string>();

  while (codes.size < BACKUP_CODE_COUNT) {
    codes.add(crypto.randomBytes(BACKUP_CODE_BYTES).toString('hex').toUpperCase());
  }

  return [...codes];
}

export async function enableMfaAndReplaceBackupCodes(
  userId: string,
  backupCodes: string[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
    await tx.mfaBackupCode.deleteMany({ where: { userId } });
    await tx.mfaBackupCode.createMany({
      data: backupCodes.map((code) => ({
        id: crypto.randomUUID(),
        userId,
        codeHash: hashBackupCode(userId, code),
      })),
    });
  });
}

export async function deleteMfaBackupCodes(userId: string): Promise<void> {
  await prisma.mfaBackupCode.deleteMany({ where: { userId } });
}

export async function disableMfaAndDeleteBackupCodes(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });
    await tx.mfaBackupCode.deleteMany({ where: { userId } });
  });
}

export async function verifyAndConsumeMfaBackupCode(
  userId: string,
  code: string,
): Promise<boolean> {
  const normalizedCode = normalizeBackupCode(code);
  if (!BACKUP_CODE_PATTERN.test(normalizedCode)) {
    return false;
  }

  const updated = await prisma.mfaBackupCode.updateMany({
    where: {
      userId,
      codeHash: hashBackupCode(userId, normalizedCode),
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  return updated.count > 0;
}
