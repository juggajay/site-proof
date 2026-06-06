import crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { logError } from '../../lib/serverLogger.js';
import { hashOAuthCallbackCode, hashOAuthState } from './helpers.js';

const OAUTH_STATE_EXPIRY_MS = 10 * 60 * 1000;
const OAUTH_CALLBACK_CODE_EXPIRY_MS = 2 * 60 * 1000;
const OAUTH_STATE_CLEANUP_MS = 5 * 60 * 1000;

export async function createOAuthState(redirectUri?: string): Promise<string> {
  const state = crypto.randomBytes(32).toString('hex');

  await prisma.oauthState.create({
    data: {
      stateHash: hashOAuthState(state),
      redirectUri: redirectUri || null,
      expiresAt: new Date(Date.now() + OAUTH_STATE_EXPIRY_MS),
    },
  });

  return state;
}

export async function verifyOAuthState(
  state: string,
): Promise<{ valid: boolean; redirectUri?: string }> {
  await cleanupExpiredStates();

  const record = await prisma.oauthState.findUnique({
    where: { stateHash: hashOAuthState(state) },
  });

  if (!record) {
    return { valid: false };
  }

  if (record.expiresAt < new Date()) {
    await prisma.oauthState.delete({ where: { id: record.id } });
    return { valid: false };
  }

  await prisma.oauthState.delete({ where: { id: record.id } });

  return {
    valid: true,
    redirectUri: record.redirectUri || undefined,
  };
}

export async function createOAuthCallbackCode(userId: string, provider: string): Promise<string> {
  const code = crypto.randomBytes(32).toString('hex');

  await prisma.oauthCallbackCode.create({
    data: {
      codeHash: hashOAuthCallbackCode(code),
      userId,
      provider,
      expiresAt: new Date(Date.now() + OAUTH_CALLBACK_CODE_EXPIRY_MS),
    },
  });

  return code;
}

export async function consumeOAuthCallbackCode(
  code: string,
): Promise<{ userId: string; provider: string } | null> {
  await cleanupExpiredStates();

  const rows = await prisma.$queryRaw<Array<{ user_id: string; provider: string }>>`
    DELETE FROM "oauth_callback_codes"
    WHERE "code_hash" = ${hashOAuthCallbackCode(code)}
      AND "expires_at" > (now() AT TIME ZONE 'UTC')
    RETURNING "user_id", "provider";
  `;

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    provider: row.provider,
  };
}

async function cleanupExpiredStates(): Promise<void> {
  const now = new Date();
  await Promise.all([
    prisma.oauthState.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    prisma.oauthCallbackCode.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
  ]);
}

setInterval(() => {
  cleanupExpiredStates().catch((err) => {
    logError('[OAuth] Failed to cleanup expired states:', err);
  });
}, OAUTH_STATE_CLEANUP_MS).unref?.();
