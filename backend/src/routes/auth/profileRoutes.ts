import { Router, type Request, type RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AuditAction } from '../../lib/auditLog.js';
import {
  assertUploadedImageFile,
  getSafeImageExtensionForMimeType,
} from '../../lib/imageValidation.js';
import { buildApiUrl } from '../../lib/runtimeConfig.js';
import { logError, logWarn } from '../../lib/serverLogger.js';
import {
  DOCUMENTS_BUCKET,
  getSupabaseClient,
  getSupabasePublicUrl,
  getSupabaseStoragePath,
  isSupabaseConfigured,
} from '../../lib/supabase.js';
import { ensureUploadSubdirectory, getUploadSubdirectoryPath } from '../../lib/uploadPaths.js';

type ProfilePrismaClient = Pick<PrismaClient, 'user'>;

type NormalizeProfileText = (
  value: unknown,
  fieldName: string,
  maxLength: number,
) => string | null | undefined;

type CreateProfileRouterDependencies = {
  prisma: ProfilePrismaClient;
  requireJwtAuth: RequestHandler;
  normalizeProfileText: NormalizeProfileText;
  auditUserAuthEvent: (
    req: Request,
    userId: string,
    action: string,
    changes: Record<string, unknown>,
  ) => Promise<void>;
  profileFullNameMaxLength: number;
};

const AVATAR_STORAGE_PREFIX = 'avatars';
const avatarUploadDir = getUploadSubdirectoryPath('avatars');
const AVATAR_PATH_PREFIX = '/uploads/avatars/';
const PROFILE_PHONE_MAX_LENGTH = 40;
const PROFILE_PHONE_PATTERN = /^[0-9+().\-\s]*$/;

// Avatar uploads use Supabase Storage (memory-buffered) in production and fall
// back to the local filesystem when Supabase is not configured. Path inside
// the `documents` bucket: `avatars/<userId>/<unique>.<ext>`.
const avatarDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadSubdirectory('avatars'));
    } catch (error) {
      cb(
        error instanceof Error ? error : new Error('Failed to prepare avatar upload directory'),
        '',
      );
    }
  },
  filename: (req, file, cb) => {
    const userId = req.user?.userId || 'unknown';
    const ext = getSafeImageExtensionForMimeType(file.mimetype);
    if (!ext) {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'), '');
      return;
    }
    cb(null, `avatar-${userId}-${crypto.randomUUID()}${ext}`);
  },
});

const avatarMemoryStorage = multer.memoryStorage();

const avatarUpload = multer({
  storage: isSupabaseConfigured() ? avatarMemoryStorage : avatarDiskStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    if (getSafeImageExtensionForMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'));
    }
  },
});

function cleanupUploadedAvatar(file?: Express.Multer.File): void {
  if (file?.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

function buildAvatarStorageFilename(userId: string, mimetype: string): string | null {
  const ext = getSafeImageExtensionForMimeType(mimetype);
  if (!ext) return null;
  return `avatar-${userId}-${crypto.randomUUID()}${ext}`;
}

function getAvatarStoragePrefix(userId: string): string {
  return `${AVATAR_STORAGE_PREFIX}/${userId}/`;
}

function getOwnedAvatarStoragePath(fileUrl: string, userId: string): string | null {
  return getSupabaseStoragePath(fileUrl, {
    bucket: DOCUMENTS_BUCKET,
    expectedPrefix: getAvatarStoragePrefix(userId),
  });
}

async function uploadAvatarToSupabase(
  file: Express.Multer.File,
  userId: string,
): Promise<{ url: string; storagePath: string }> {
  const filename = buildAvatarStorageFilename(userId, file.mimetype);
  if (!filename) {
    throw AppError.badRequest('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.');
  }
  const storagePath = `${AVATAR_STORAGE_PREFIX}/${userId}/${filename}`;

  const { error } = await getSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    logError('Supabase avatar upload failed:', error);
    throw AppError.internal('Failed to upload avatar');
  }

  return {
    url: getSupabasePublicUrl(DOCUMENTS_BUCKET, storagePath),
    storagePath,
  };
}

async function deleteAvatarFromSupabase(fileUrl: string, userId: string): Promise<void> {
  const storagePath = getOwnedAvatarStoragePath(fileUrl, userId);
  if (!storagePath) return;

  const { error } = await getSupabaseClient().storage.from(DOCUMENTS_BUCKET).remove([storagePath]);

  if (error) {
    logError('Supabase avatar delete failed:', error);
  }
}

async function cleanupStoredAvatarUpload(
  fileUrl: string | null,
  file: Express.Multer.File,
  userId: string,
): Promise<void> {
  if (fileUrl && isSupabaseConfigured() && getOwnedAvatarStoragePath(fileUrl, userId)) {
    await deleteAvatarFromSupabase(fileUrl, userId);
    return;
  }
  cleanupUploadedAvatar(file);
}

async function removeStoredAvatar(
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

function deleteLocalAvatarFile(avatarUrl: string | null | undefined, userId: string): void {
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

export function createProfileRouter({
  prisma,
  requireJwtAuth,
  normalizeProfileText,
  auditUserAuthEvent,
  profileFullNameMaxLength,
}: CreateProfileRouterDependencies) {
  const profileRouter = Router();

  function normalizeProfilePhone(value: unknown): string | null | undefined {
    const normalized = normalizeProfileText(value, 'Phone', PROFILE_PHONE_MAX_LENGTH);

    if (typeof normalized === 'string' && !PROFILE_PHONE_PATTERN.test(normalized)) {
      throw AppError.badRequest('Phone may only contain numbers, spaces, and +().- characters');
    }

    return normalized;
  }

  // PATCH /api/auth/profile - Update user profile
  profileRouter.patch(
    '/profile',
    requireJwtAuth,
    asyncHandler(async (req, res) => {
      const userData = req.user!;
      const fullName = normalizeProfileText(
        req.body.fullName,
        'Full name',
        profileFullNameMaxLength,
      );
      const phone = normalizeProfilePhone(req.body.phone);
      const changedFields = [
        ...(fullName !== undefined ? ['fullName'] : []),
        ...(phone !== undefined ? ['phone'] : []),
      ];

      // Update user profile
      const updatedUser = await prisma.user.update({
        where: { id: userData.id },
        data: {
          fullName: fullName !== undefined ? fullName : undefined,
          phone: phone !== undefined ? phone : undefined,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          roleInCompany: true,
          companyId: true,
          company: {
            select: {
              name: true,
            },
          },
        },
      });

      if (changedFields.length > 0) {
        await auditUserAuthEvent(req, userData.id, AuditAction.USER_PROFILE_UPDATED, {
          changedFields,
        });
      }

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          name: updatedUser.fullName,
          phone: updatedUser.phone,
          role: updatedUser.roleInCompany,
          companyId: updatedUser.companyId,
          companyName: updatedUser.company?.name || null,
        },
      });
    }),
  );

  // POST /api/auth/avatar - Upload user avatar (Feature #690)
  profileRouter.post(
    '/avatar',
    requireJwtAuth,
    avatarUpload.single('avatar'),
    asyncHandler(async (req, res) => {
      const userData = req.user!;
      if (!req.file) {
        throw AppError.badRequest('No file uploaded');
      }
      const uploadedFile = req.file;

      try {
        assertUploadedImageFile(uploadedFile);
      } catch (error) {
        cleanupUploadedAvatar(uploadedFile);
        throw error;
      }

      // Get the old avatar to delete it later
      const oldUser = await prisma.user.findUnique({
        where: { id: userData.id },
        select: { avatarUrl: true },
      });

      let avatarUrl: string;
      try {
        if (isSupabaseConfigured() && uploadedFile.buffer) {
          const uploaded = await uploadAvatarToSupabase(uploadedFile, userData.id);
          avatarUrl = uploaded.url;
        } else {
          avatarUrl = buildApiUrl(`/uploads/avatars/${uploadedFile.filename}`);
        }
      } catch (error) {
        cleanupUploadedAvatar(uploadedFile);
        throw error;
      }

      let updatedUser;
      try {
        updatedUser = await prisma.user.update({
          where: { id: userData.id },
          data: { avatarUrl },
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
            phone: true,
            roleInCompany: true,
            companyId: true,
          },
        });
      } catch (error) {
        await cleanupStoredAvatarUpload(avatarUrl, uploadedFile, userData.id);
        throw error;
      }

      await auditUserAuthEvent(req, userData.id, AuditAction.USER_AVATAR_UPDATED, {
        changedFields: ['avatarUrl'],
      });

      // Delete old avatar file if it exists (best-effort; never blocks the response)
      if (oldUser?.avatarUrl) {
        try {
          await removeStoredAvatar(oldUser.avatarUrl, userData.id);
        } catch (err) {
          logWarn('Failed to delete old avatar:', err);
        }
      }

      res.json({
        message: 'Avatar uploaded successfully',
        avatarUrl: updatedUser.avatarUrl,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          name: updatedUser.fullName,
          avatarUrl: updatedUser.avatarUrl,
          phone: updatedUser.phone,
          role: updatedUser.roleInCompany,
          companyId: updatedUser.companyId,
        },
      });
    }),
  );

  // DELETE /api/auth/avatar - Remove user avatar
  profileRouter.delete(
    '/avatar',
    requireJwtAuth,
    asyncHandler(async (req, res) => {
      const userData = req.user!;
      // Get the current avatar URL to delete the file
      const user = await prisma.user.findUnique({
        where: { id: userData.id },
        select: { avatarUrl: true },
      });

      // Update user to remove avatar URL
      await prisma.user.update({
        where: { id: userData.id },
        data: { avatarUrl: null },
      });

      if (user?.avatarUrl) {
        await auditUserAuthEvent(req, userData.id, AuditAction.USER_AVATAR_REMOVED, {
          changedFields: ['avatarUrl'],
        });
      }

      if (user?.avatarUrl) {
        try {
          await removeStoredAvatar(user.avatarUrl, userData.id);
        } catch (err) {
          logWarn('Failed to delete avatar file:', err);
        }
      }

      res.json({ message: 'Avatar removed successfully' });
    }),
  );

  return profileRouter;
}
