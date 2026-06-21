import fs from 'fs';
import path from 'path';

import { getOwnedAvatarStoragePath } from './avatarUrls.js';
import { buildApiUrl } from './runtimeConfig.js';
import { logError } from './serverLogger.js';
import { DOCUMENTS_BUCKET, getSupabaseClient, isSupabaseConfigured } from './supabase.js';
import { getUploadSubdirectoryPath } from './uploadPaths.js';

const AVATAR_PATH_PREFIX = '/uploads/avatars/';
const AVATAR_MIME_BY_EXTENSION = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
]);

const avatarUploadDir = getUploadSubdirectoryPath('avatars');

export async function deleteAvatarFromSupabase(fileUrl: string, userId: string): Promise<void> {
  const storagePath = getOwnedAvatarStoragePath(fileUrl, userId);
  if (!storagePath) return;

  const { error } = await getSupabaseClient().storage.from(DOCUMENTS_BUCKET).remove([storagePath]);

  if (error) {
    logError('Supabase avatar delete failed:', error);
  }
}

export async function removeStoredAvatar(
  avatarUrl: string | null | undefined,
  userId: string,
): Promise<void> {
  if (!avatarUrl) return;
  if (isSupabaseConfigured() && getOwnedAvatarStoragePath(avatarUrl, userId) !== null) {
    await deleteAvatarFromSupabase(avatarUrl, userId);
    return;
  }
  deleteLocalAvatarFile(avatarUrl, userId);
}

export function deleteLocalAvatarFile(avatarUrl: string | null | undefined, userId: string): void {
  if (!avatarUrl) return;

  let pathname: string;
  try {
    const baseUrl = buildApiUrl('/');
    const parsedUrl = new URL(avatarUrl, baseUrl);
    const isRelativeUploadUrl = avatarUrl.startsWith(AVATAR_PATH_PREFIX);
    if (!isRelativeUploadUrl && parsedUrl.origin !== new URL(baseUrl).origin) {
      return;
    }

    pathname = parsedUrl.pathname;
  } catch {
    return;
  }

  if (!pathname.startsWith(AVATAR_PATH_PREFIX)) {
    return;
  }

  const encodedFilename = pathname.split('/').pop();
  if (!encodedFilename) return;

  let filename: string;
  try {
    filename = decodeURIComponent(encodedFilename);
  } catch {
    return;
  }

  if (filename !== path.basename(filename) || filename.includes('/') || filename.includes('\\')) {
    return;
  }
  if (!filename.startsWith(`avatar-${userId}-`)) {
    return;
  }

  const uploadDir = path.resolve(avatarUploadDir);
  const avatarPath = path.resolve(uploadDir, filename);
  if (avatarPath.startsWith(`${uploadDir}${path.sep}`) && fs.existsSync(avatarPath)) {
    fs.unlinkSync(avatarPath);
  }
}

export function getAvatarContentType(storagePath: string): string {
  return AVATAR_MIME_BY_EXTENSION.get(path.extname(storagePath).toLowerCase()) || 'image/jpeg';
}
