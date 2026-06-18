import type { PrismaClient } from '@prisma/client';
import { logWarn } from '../../lib/serverLogger.js';

type TokenRecord = {
  id: string;
  token: string;
};

type UpgradeLegacyOneTimeTokenStorageOptions = {
  context: string;
  tokenRecord: TokenRecord;
  rawToken: string;
  hashOneTimeToken: (token: string) => string;
  updateToken: (tokenRecord: TokenRecord, hashedToken: string) => Promise<number>;
};

export async function upgradeLegacyOneTimeTokenStorage({
  context,
  tokenRecord,
  rawToken,
  hashOneTimeToken,
  updateToken,
}: UpgradeLegacyOneTimeTokenStorageOptions): Promise<void> {
  const hashedToken = hashOneTimeToken(rawToken);
  if (tokenRecord.token === hashedToken) {
    return;
  }

  try {
    await updateToken(tokenRecord, hashedToken);
  } catch (error) {
    logWarn(`[${context}] Failed to upgrade legacy plaintext token storage`, {
      tokenId: tokenRecord.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

type PasswordResetTokenPrismaClient = Pick<PrismaClient, 'passwordResetToken'>;
type EmailVerificationTokenPrismaClient = Pick<PrismaClient, 'emailVerificationToken'>;

export async function upgradeLegacyPasswordResetTokenStorage(
  prisma: PasswordResetTokenPrismaClient,
  context: string,
  tokenRecord: TokenRecord,
  rawToken: string,
  hashOneTimeToken: (token: string) => string,
): Promise<void> {
  await upgradeLegacyOneTimeTokenStorage({
    context,
    tokenRecord,
    rawToken,
    hashOneTimeToken,
    updateToken: async (record, hashedToken) => {
      const result = await prisma.passwordResetToken.updateMany({
        where: { id: record.id, token: record.token },
        data: { token: hashedToken },
      });
      return result.count;
    },
  });
}

export async function upgradeLegacyEmailVerificationTokenStorage(
  prisma: EmailVerificationTokenPrismaClient,
  tokenRecord: TokenRecord,
  rawToken: string,
  hashOneTimeToken: (token: string) => string,
): Promise<void> {
  await upgradeLegacyOneTimeTokenStorage({
    context: 'Email Verification',
    tokenRecord,
    rawToken,
    hashOneTimeToken,
    updateToken: async (record, hashedToken) => {
      const result = await prisma.emailVerificationToken.updateMany({
        where: { id: record.id, token: record.token },
        data: { token: hashedToken },
      });
      return result.count;
    },
  });
}
