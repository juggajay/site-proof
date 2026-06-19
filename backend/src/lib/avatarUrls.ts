import {
  buildSignedStorageFileUrl,
  createSignedStorageAccessToken,
  validateSignedStorageAccessToken,
} from './signedStorageUrls.js';
import { DOCUMENTS_BUCKET, getSupabaseStoragePath, isSupabaseConfigured } from './supabase.js';

const AVATAR_STORAGE_PREFIX = 'avatars';
const AVATAR_ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

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

export function createAvatarAccessToken(
  userId: string,
  storagePath: string,
  nowMs = Date.now(),
): string {
  return createSignedStorageAccessToken(userId, storagePath, AVATAR_ACCESS_TOKEN_TTL_MS, nowMs);
}

export function validateAvatarAccessToken(
  token: string | undefined,
  userId: string,
  storagePath: string,
  nowMs = Date.now(),
): boolean {
  return validateSignedStorageAccessToken(token, userId, storagePath, nowMs);
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

  return buildSignedStorageFileUrl(
    '/api/auth/avatar/file',
    userId,
    storagePath,
    AVATAR_ACCESS_TOKEN_TTL_MS,
  );
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
