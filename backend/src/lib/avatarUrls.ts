import crypto from 'crypto';

import { buildBackendUrl } from './runtimeConfig.js';
import { DOCUMENTS_BUCKET, getSupabaseStoragePath, isSupabaseConfigured } from './supabase.js';

const AVATAR_STORAGE_PREFIX = 'avatars';
const AVATAR_ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const AVATAR_ACCESS_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export function getAvatarStoragePrefix(userId: string): string {
  return `${AVATAR_STORAGE_PREFIX}/${userId}/`;
}

export function getOwnedAvatarStoragePath(
  avatarUrl: string | null | undefined,
  userId: string,
): string | null {
  if (!avatarUrl) return null;

  return getSupabaseStoragePath(avatarUrl, {
    bucket: DOCUMENTS_BUCKET,
    expectedPrefix: getAvatarStoragePrefix(userId),
  });
}

function hashAvatarStoragePath(storagePath: string): string {
  return crypto.createHash('sha256').update(storagePath).digest('hex');
}

function signAvatarAccessToken(userId: string, storagePath: string, expiresAtMs: number): string {
  const pathHash = hashAvatarStoragePath(storagePath);
  return crypto
    .createHmac('sha256', AVATAR_ACCESS_SECRET)
    .update(`${userId}.${pathHash}.${expiresAtMs}`)
    .digest('hex');
}

export function createAvatarAccessToken(
  userId: string,
  storagePath: string,
  nowMs = Date.now(),
): string {
  const expiresAtMs = nowMs + AVATAR_ACCESS_TOKEN_TTL_MS;
  const signature = signAvatarAccessToken(userId, storagePath, expiresAtMs);
  return `${expiresAtMs}.${signature}`;
}

export function validateAvatarAccessToken(
  token: string | undefined,
  userId: string,
  storagePath: string,
  nowMs = Date.now(),
): boolean {
  if (!token) return false;

  const [expiresAtRaw, signature, ...extra] = token.split('.');
  if (extra.length > 0 || !expiresAtRaw || !signature || !/^\d+$/.test(expiresAtRaw)) {
    return false;
  }

  const expiresAtMs = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs < nowMs) {
    return false;
  }

  const expected = signAvatarAccessToken(userId, storagePath, expiresAtMs);
  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function buildAvatarDisplayUrl(
  userId: string,
  avatarUrl: string | null | undefined,
): string | null {
  if (!avatarUrl) return null;

  const storagePath = getOwnedAvatarStoragePath(avatarUrl, userId);
  if (!storagePath || !isSupabaseConfigured()) {
    return avatarUrl;
  }

  const query = new URLSearchParams({ token: createAvatarAccessToken(userId, storagePath) });
  return buildBackendUrl(`/api/auth/avatar/file/${encodeURIComponent(userId)}?${query}`);
}

export function serializeUserAvatar<TUser extends { id: string; avatarUrl?: string | null }>(
  user: TUser,
): TUser {
  if (!Object.prototype.hasOwnProperty.call(user, 'avatarUrl')) {
    return user;
  }

  return {
    ...user,
    avatarUrl: buildAvatarDisplayUrl(user.id, user.avatarUrl),
  };
}
