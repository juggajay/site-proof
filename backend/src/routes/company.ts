import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { TIER_PROJECT_LIMITS, TIER_USER_LIMITS } from '../lib/tierLimits.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { buildApiUrl } from '../lib/runtimeConfig.js';
import {
  assertUploadedImageFile,
  getSafeImageExtensionForMimeType,
} from '../lib/imageValidation.js';
import { ensureUploadSubdirectory, getUploadSubdirectoryPath } from '../lib/uploadPaths.js';
import { assertCanRemoveUserFromProjectAdminRoles } from '../lib/projectAdminInvariant.js';
import { logError, logWarn } from '../lib/serverLogger.js';
import {
  DOCUMENTS_BUCKET,
  getSupabaseClient,
  getSupabasePublicUrl,
  getSupabaseStoragePath,
  isSupabaseConfigured,
} from '../lib/supabase.js';

const COMPANY_LOGO_STORAGE_PREFIX = 'company-logos';

export const companyRouter = Router();

const COMPANY_NAME_MAX_LENGTH = 120;
const COMPANY_ABN_MAX_LENGTH = 32;
const COMPANY_ADDRESS_MAX_LENGTH = 300;
const COMPANY_LOGO_URL_MAX_LENGTH = 2048;
const COMPANY_LOGO_PATH_PREFIX = '/uploads/company-logos/';
const COMPANY_SUBCONTRACTOR_ROLES = new Set(['subcontractor', 'subcontractor_admin']);

const companyLogoUploadDir = getUploadSubdirectoryPath('company-logos');

// Company logo uploads use Supabase Storage (memory-buffered) in production and
// fall back to the local filesystem when Supabase is not configured. Path
// inside the `documents` bucket: `company-logos/<companyId>/<unique>.<ext>`.
const companyLogoDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadSubdirectory('company-logos'));
    } catch (error) {
      cb(
        error instanceof Error
          ? error
          : new Error('Failed to prepare company logo upload directory'),
        '',
      );
    }
  },
  filename: (req, file, cb) => {
    const companyId = req.user?.companyId || 'unknown';
    const ext = getSafeImageExtensionForMimeType(file.mimetype);
    if (!ext) {
      cb(new Error('Invalid file type'), '');
      return;
    }
    cb(null, `company-logo-${companyId}-${crypto.randomUUID()}${ext}`);
  },
});

const companyLogoMemoryStorage = multer.memoryStorage();

const companyLogoUpload = multer({
  storage: isSupabaseConfigured() ? companyLogoMemoryStorage : companyLogoDiskStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!getSafeImageExtensionForMimeType(file.mimetype)) {
      cb(new Error('Invalid file type'));
      return;
    }
    cb(null, true);
  },
});

// Apply authentication middleware to all routes
companyRouter.use(requireAuth);

function serializeTierLimit(limit: number): number | null {
  return Number.isFinite(limit) ? limit : null;
}

function cleanupUploadedLogo(file?: Express.Multer.File): void {
  if (file?.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

function buildCompanyLogoStorageFilename(companyId: string, mimetype: string): string | null {
  const ext = getSafeImageExtensionForMimeType(mimetype);
  if (!ext) return null;
  return `company-logo-${companyId}-${crypto.randomUUID()}${ext}`;
}

function getCompanyLogoStoragePrefix(companyId: string): string {
  return `${COMPANY_LOGO_STORAGE_PREFIX}/${companyId}/`;
}

async function uploadCompanyLogoToSupabase(
  file: Express.Multer.File,
  companyId: string,
): Promise<{ url: string; storagePath: string }> {
  const filename = buildCompanyLogoStorageFilename(companyId, file.mimetype);
  if (!filename) {
    throw AppError.badRequest('Invalid file type');
  }
  const storagePath = `${getCompanyLogoStoragePrefix(companyId)}${filename}`;

  const { error } = await getSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    logError('Supabase company logo upload failed:', error);
    throw AppError.internal('Failed to upload company logo');
  }

  return {
    url: getSupabasePublicUrl(DOCUMENTS_BUCKET, storagePath),
    storagePath,
  };
}

function getOwnedCompanyLogoStoragePath(fileUrl: string, companyId: string): string | null {
  return getSupabaseStoragePath(fileUrl, {
    bucket: DOCUMENTS_BUCKET,
    expectedPrefix: getCompanyLogoStoragePrefix(companyId),
  });
}

function assertCompanyLogoUrlOwnedByCompany(
  logoUrl: string | null | undefined,
  companyId: string,
): void {
  if (!logoUrl || !isSupabaseConfigured()) return;

  const anyDocumentsStoragePath = getSupabaseStoragePath(logoUrl, DOCUMENTS_BUCKET);
  if (anyDocumentsStoragePath !== null && !getOwnedCompanyLogoStoragePath(logoUrl, companyId)) {
    throw AppError.badRequest('Company logo URL must reference an uploaded company logo');
  }
}

async function deleteCompanyLogoFromSupabase(fileUrl: string, companyId: string): Promise<void> {
  const storagePath = getOwnedCompanyLogoStoragePath(fileUrl, companyId);
  if (!storagePath) return;

  const { error } = await getSupabaseClient().storage.from(DOCUMENTS_BUCKET).remove([storagePath]);

  if (error) {
    logError('Supabase company logo delete failed:', error);
  }
}

async function cleanupStoredCompanyLogoUpload(
  fileUrl: string | null,
  file: Express.Multer.File,
  companyId: string,
): Promise<void> {
  if (fileUrl && isSupabaseConfigured() && getOwnedCompanyLogoStoragePath(fileUrl, companyId)) {
    await deleteCompanyLogoFromSupabase(fileUrl, companyId);
    return;
  }
  cleanupUploadedLogo(file);
}

async function removeStoredCompanyLogo(
  logoUrl: string | null | undefined,
  companyId: string,
): Promise<void> {
  if (!logoUrl) return;
  if (isSupabaseConfigured() && getOwnedCompanyLogoStoragePath(logoUrl, companyId) !== null) {
    await deleteCompanyLogoFromSupabase(logoUrl, companyId);
    return;
  }
  deleteLocalCompanyLogo(logoUrl, companyId);
}

// Decide whether a PATCH that changed `logoUrl` should trigger best-effort
// cleanup of the previously-stored object. Raw string comparison alone is
// unsafe because two URLs can point at the same Supabase object while
// differing only in a query string (cache-buster, signed-URL variant, etc.)
// — deleting on string-difference would yank the still-active file.
//
// When both URLs resolve inside the configured Supabase documents bucket we
// compare their storage paths. Otherwise we fall back to raw URL comparison,
// which is the right call for local `/uploads/...` paths and external URLs.
function shouldRemovePreviousLogoOnPatch(
  previousLogoUrl: string | null,
  newLogoUrl: string | null,
): boolean {
  if (!previousLogoUrl) return false;

  const previousStoragePath = getSupabaseStoragePath(previousLogoUrl, DOCUMENTS_BUCKET);
  const newStoragePath = newLogoUrl ? getSupabaseStoragePath(newLogoUrl, DOCUMENTS_BUCKET) : null;

  if (previousStoragePath !== null && newStoragePath !== null) {
    return previousStoragePath !== newStoragePath;
  }

  return previousLogoUrl !== newLogoUrl;
}

function deleteLocalCompanyLogo(logoUrl: string | null | undefined, companyId: string): void {
  if (!logoUrl) return;

  let pathname: string;
  try {
    const baseUrl = buildApiUrl('/');
    const parsedUrl = new URL(logoUrl, baseUrl);
    const isRelativeUploadUrl = logoUrl.startsWith(COMPANY_LOGO_PATH_PREFIX);
    if (!isRelativeUploadUrl && parsedUrl.origin !== new URL(baseUrl).origin) {
      return;
    }

    pathname = parsedUrl.pathname;
  } catch {
    return;
  }

  if (!pathname.startsWith(COMPANY_LOGO_PATH_PREFIX)) {
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

  if (!filename.startsWith(`company-logo-${companyId}-`)) {
    return;
  }

  const uploadDir = path.resolve(companyLogoUploadDir);
  const logoPath = path.resolve(uploadDir, filename);
  if (logoPath.startsWith(`${uploadDir}${path.sep}`) && fs.existsSync(logoPath)) {
    fs.unlinkSync(logoPath);
  }
}

function requireCompanyAdmin(user: NonNullable<Express.Request['user']>): string {
  if (!user.companyId) {
    throw AppError.notFound('Company');
  }

  const allowedRoles = ['owner', 'admin'];
  if (!allowedRoles.includes(user.roleInCompany || '')) {
    throw AppError.forbidden('Only company owners and admins can update company settings');
  }

  return user.companyId;
}

function isSubcontractorCompanyRole(user: NonNullable<Express.Request['user']>): boolean {
  return COMPANY_SUBCONTRACTOR_ROLES.has(user.roleInCompany || '');
}

function normalizeCompanyString(
  value: unknown,
  fieldName: string,
  maxLength: number,
  options: { required?: boolean } = {},
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    if (options.required) {
      throw AppError.badRequest(`${fieldName} is required`);
    }
    return null;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    if (options.required) {
      throw AppError.badRequest(`${fieldName} is required`);
    }
    return null;
  }

  if (normalized.length > maxLength) {
    throw AppError.badRequest(`${fieldName} must be ${maxLength} characters or fewer`);
  }

  return normalized;
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function normalizeCompanyLogoUrl(value: unknown): string | null | undefined {
  const normalized = normalizeCompanyString(value, 'Company logo URL', COMPANY_LOGO_URL_MAX_LENGTH);
  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  if (hasControlCharacter(normalized) || normalized.includes('\\')) {
    throw AppError.badRequest('Company logo URL is invalid');
  }

  if (normalized.toLowerCase().startsWith('data:')) {
    throw AppError.badRequest('Company logo must be uploaded before saving');
  }

  if (normalized.startsWith('/')) {
    const parsed = new URL(normalized, 'http://localhost');
    if (!parsed.pathname.startsWith(COMPANY_LOGO_PATH_PREFIX) || parsed.pathname.includes('..')) {
      throw AppError.badRequest('Company logo URL must reference an uploaded company logo');
    }
    return normalized;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw AppError.badRequest('Company logo URL is invalid');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw AppError.badRequest('Company logo URL must use http or https');
  }

  if (parsed.username || parsed.password) {
    throw AppError.badRequest('Company logo URL must not include credentials');
  }

  return normalized;
}

// GET /api/company - Get the current user's company
companyRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    if (!user.companyId) {
      throw AppError.notFound('Company');
    }

    if (isSubcontractorCompanyRole(user)) {
      throw AppError.forbidden('Subcontractor users must use the subcontractor company profile');
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: {
        id: true,
        name: true,
        abn: true,
        address: true,
        logoUrl: true,
        subscriptionTier: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!company) {
      throw AppError.notFound('Company');
    }

    // Get project count for this company
    const projectCount = await prisma.project.count({
      where: { companyId: user.companyId },
    });

    // Get user count for this company
    const userCount = await prisma.user.count({
      where: { companyId: user.companyId },
    });

    const tier = company.subscriptionTier || 'basic';
    const projectLimit = TIER_PROJECT_LIMITS[tier] || TIER_PROJECT_LIMITS.basic;
    const userLimit = TIER_USER_LIMITS[tier] || TIER_USER_LIMITS.basic;

    res.json({
      company: {
        ...company,
        projectCount,
        projectLimit: serializeTierLimit(projectLimit),
        userCount,
        userLimit: serializeTierLimit(userLimit),
      },
    });
  }),
);

// POST /api/company/leave - Leave the current company
companyRouter.post(
  '/leave',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    if (!user.companyId) {
      throw AppError.badRequest('You are not a member of any company');
    }

    // Don't allow owners to leave (they must transfer ownership or delete company)
    if (user.roleInCompany === 'owner') {
      throw AppError.forbidden(
        'Company owners cannot leave. Please transfer ownership first or delete the company.',
      );
    }

    await assertCanRemoveUserFromProjectAdminRoles(user.userId, {
      companyId: user.companyId,
      actionDescription: 'leave company',
      subjectDescription: 'you are',
    });

    // Remove user from all project memberships for this company
    const companyProjects = await prisma.project.findMany({
      where: { companyId: user.companyId },
      select: { id: true },
    });

    const projectIds = companyProjects.map((p) => p.id);

    // Delete project user records
    await prisma.projectUser.deleteMany({
      where: {
        userId: user.userId,
        projectId: { in: projectIds },
      },
    });

    // Remove company association from user using raw SQL to avoid Prisma quirks
    // Set role_in_company to 'member' (default) since it's NOT NULL
    await prisma.$executeRaw`UPDATE users SET company_id = NULL, role_in_company = 'member' WHERE id = ${user.userId}`;

    res.json({
      message: 'Successfully left the company',
      leftAt: new Date().toISOString(),
    });
  }),
);

// GET /api/company/members - Get all members of the current user's company
companyRouter.get(
  '/members',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    if (!user.companyId) {
      throw AppError.notFound('Company');
    }

    // Only owners can view members for transfer purposes
    if (user.roleInCompany !== 'owner') {
      throw AppError.forbidden('Only company owners can view members for ownership transfer');
    }

    const members = await prisma.user.findMany({
      where: { companyId: user.companyId },
      select: {
        id: true,
        email: true,
        fullName: true,
        roleInCompany: true,
      },
      orderBy: { fullName: 'asc' },
    });

    res.json({ members });
  }),
);

// POST /api/company/transfer-ownership - Transfer company ownership to another user
companyRouter.post(
  '/transfer-ownership',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const newOwnerId = normalizeCompanyString(req.body.newOwnerId, 'New owner ID', 128, {
      required: true,
    });

    if (!newOwnerId) {
      throw AppError.badRequest('New owner ID is required');
    }

    if (!user.companyId) {
      throw AppError.notFound('Company');
    }

    // Only owners can transfer ownership
    if (user.roleInCompany !== 'owner') {
      throw AppError.forbidden('Only the company owner can transfer ownership');
    }

    // Cannot transfer to yourself
    if (newOwnerId === user.userId) {
      throw AppError.badRequest('Cannot transfer ownership to yourself');
    }

    // Verify new owner is a member of the same company
    const newOwner = await prisma.user.findFirst({
      where: {
        id: newOwnerId,
        companyId: user.companyId,
      },
    });

    if (!newOwner) {
      throw AppError.notFound('User in your company');
    }

    // Transfer ownership: update both users in a transaction
    await prisma.$transaction([
      // Set new owner
      prisma.$executeRaw`UPDATE users SET role_in_company = 'owner' WHERE id = ${newOwnerId}`,
      // Demote current owner to admin
      prisma.$executeRaw`UPDATE users SET role_in_company = 'admin' WHERE id = ${user.userId}`,
    ]);

    res.json({
      message: 'Ownership transferred successfully',
      newOwner: {
        id: newOwner.id,
        email: newOwner.email,
        fullName: newOwner.fullName,
      },
      transferredAt: new Date().toISOString(),
    });
  }),
);

// POST /api/company/logo - Upload and store a company logo file
companyRouter.post(
  '/logo',
  companyLogoUpload.single('logo'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const uploadedFile = req.file;

    let companyId: string;
    try {
      companyId = requireCompanyAdmin(user);

      if (!uploadedFile) {
        throw AppError.badRequest('No logo uploaded');
      }

      assertUploadedImageFile(uploadedFile);
    } catch (error) {
      cleanupUploadedLogo(uploadedFile);
      throw error;
    }

    const currentCompany = await prisma.company.findUnique({
      where: { id: companyId },
      select: { logoUrl: true },
    });

    if (!currentCompany) {
      cleanupUploadedLogo(uploadedFile);
      throw AppError.notFound('Company');
    }

    let logoUrl: string;
    try {
      if (isSupabaseConfigured() && uploadedFile!.buffer) {
        const uploaded = await uploadCompanyLogoToSupabase(uploadedFile!, companyId);
        logoUrl = uploaded.url;
      } else {
        logoUrl = buildApiUrl(`/uploads/company-logos/${uploadedFile!.filename}`);
      }
    } catch (error) {
      cleanupUploadedLogo(uploadedFile);
      throw error;
    }

    let updatedCompany;
    try {
      updatedCompany = await prisma.company.update({
        where: { id: companyId },
        data: { logoUrl },
        select: {
          id: true,
          name: true,
          abn: true,
          address: true,
          logoUrl: true,
          subscriptionTier: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      await cleanupStoredCompanyLogoUpload(logoUrl, uploadedFile!, companyId);
      throw error;
    }

    if (currentCompany.logoUrl) {
      try {
        await removeStoredCompanyLogo(currentCompany.logoUrl, companyId);
      } catch (error) {
        logWarn('Failed to delete old company logo:', error);
      }
    }

    res.status(201).json({
      logoUrl,
      company: updatedCompany,
    });
  }),
);

// PATCH /api/company - Update the current user's company
companyRouter.patch(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const name = normalizeCompanyString(req.body.name, 'Company name', COMPANY_NAME_MAX_LENGTH, {
      required: req.body.name !== undefined,
    });
    const abn = normalizeCompanyString(req.body.abn, 'ABN', COMPANY_ABN_MAX_LENGTH);
    const address = normalizeCompanyString(req.body.address, 'Address', COMPANY_ADDRESS_MAX_LENGTH);
    const logoUrl = normalizeCompanyLogoUrl(req.body.logoUrl);

    const companyId = requireCompanyAdmin(user);
    assertCompanyLogoUrlOwnedByCompany(logoUrl, companyId);

    // Build update data
    const updateData: {
      name?: string;
      abn?: string | null;
      address?: string | null;
      logoUrl?: string | null;
    } = {};

    if (name !== undefined) {
      if (name === null) {
        throw AppError.badRequest('Company name is required');
      }
      updateData.name = name;
    }
    if (abn !== undefined) updateData.abn = abn;
    if (address !== undefined) updateData.address = address;
    if (logoUrl !== undefined) {
      updateData.logoUrl = logoUrl;
    }

    // When logoUrl is being changed (replaced or cleared) we want to
    // best-effort remove the previous storage object after the DB update
    // succeeds. POST /api/company/logo already does this for the upload
    // path; PATCH was the remaining gap. The DB row is the source of
    // truth — Supabase cleanup never blocks or fails the response.
    let previousLogoUrl: string | null = null;
    let shouldCleanupPreviousLogo = false;
    if (logoUrl !== undefined) {
      const existing = await prisma.company.findUnique({
        where: { id: companyId },
        select: { logoUrl: true },
      });
      previousLogoUrl = existing?.logoUrl ?? null;
      shouldCleanupPreviousLogo = shouldRemovePreviousLogoOnPatch(previousLogoUrl, logoUrl);
    }

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: updateData,
      select: {
        id: true,
        name: true,
        abn: true,
        address: true,
        logoUrl: true,
        subscriptionTier: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (shouldCleanupPreviousLogo && previousLogoUrl) {
      try {
        await removeStoredCompanyLogo(previousLogoUrl, companyId);
      } catch (error) {
        logWarn('Failed to delete previous company logo after PATCH:', error);
      }
    }

    res.json({
      message: 'Company settings updated successfully',
      company: updatedCompany,
    });
  }),
);
