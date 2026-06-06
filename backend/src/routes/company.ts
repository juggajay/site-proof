import { type Request, Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { TIER_PROJECT_LIMITS, TIER_USER_LIMITS } from '../lib/tierLimits.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { buildApiUrl, buildFrontendUrl } from '../lib/runtimeConfig.js';
import {
  assertUploadedImageFile,
  getSafeImageExtensionForMimeType,
} from '../lib/imageValidation.js';
import { ensureUploadSubdirectory, getUploadSubdirectoryPath } from '../lib/uploadPaths.js';
import { assertCanRemoveUserFromProjectAdminRoles } from '../lib/projectAdminInvariant.js';
import { logError, logWarn } from '../lib/serverLogger.js';
import { AuditAction, createAuditLog } from '../lib/auditLog.js';
import { sendCompanyMemberInvitationEmail } from '../lib/email.js';
import {
  DOCUMENTS_BUCKET,
  getSupabaseClient,
  getSupabasePublicUrl,
  getSupabaseStoragePath,
  isSupabaseConfigured,
} from '../lib/supabase.js';
import {
  buildCompanyCreatedResponse,
  buildCompanyLeftResponse,
  buildCompanyLogoUploadedResponse,
  buildCompanyMemberInvitedResponse,
  buildCompanyMembersResponse,
  buildCompanyOwnershipTransferredResponse,
  buildCompanyProfileResponse,
  buildCompanyUpdatedResponse,
} from './company/responses.js';
import {
  COMPANY_ABN_MAX_LENGTH,
  COMPANY_ADDRESS_MAX_LENGTH,
  COMPANY_LOGO_PATH_PREFIX,
  COMPANY_MEMBER_FULL_NAME_MAX_LENGTH,
  COMPANY_NAME_MAX_LENGTH,
  normalizeCompanyLogoUrl,
  normalizeCompanyMemberEmail,
  normalizeCompanyMemberRole,
  normalizeCompanyString,
} from './company/validation.js';

const COMPANY_LOGO_STORAGE_PREFIX = 'company-logos';

export const companyRouter = Router();

const COMPANY_MEMBER_INVITATION_EXPIRES_DAYS = 7;
const ONE_TIME_TOKEN_HASH_PREFIX = 'sha256:';
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

function requireBrowserSession(req: Request, action: string): void {
  if (req.apiKey) {
    throw AppError.forbidden(`${action} requires an authenticated browser session`);
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

function hashOneTimeToken(token: string): string {
  return `${ONE_TIME_TOKEN_HASH_PREFIX}${crypto.createHash('sha256').update(token).digest('hex')}`;
}

// POST /api/company - Create the current user's first company
companyRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    requireBrowserSession(req, 'Company creation');

    if (user.companyId) {
      throw AppError.badRequest('You already belong to a company');
    }

    if (isSubcontractorCompanyRole(user)) {
      throw AppError.forbidden(
        'Subcontractor portal users cannot create head contractor companies',
      );
    }

    const name = normalizeCompanyString(req.body.name, 'Company name', COMPANY_NAME_MAX_LENGTH, {
      required: true,
    });
    const abn = normalizeCompanyString(req.body.abn, 'Company ABN', COMPANY_ABN_MAX_LENGTH);
    const address = normalizeCompanyString(
      req.body.address,
      'Company address',
      COMPANY_ADDRESS_MAX_LENGTH,
    );

    const { company, updatedUser } = await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: user.userId },
        select: { companyId: true, roleInCompany: true },
      });

      if (!currentUser) {
        throw AppError.unauthorized('Invalid user session');
      }

      if (currentUser.companyId) {
        throw AppError.badRequest('You already belong to a company');
      }

      if (COMPANY_SUBCONTRACTOR_ROLES.has(currentUser.roleInCompany || '')) {
        throw AppError.forbidden(
          'Subcontractor portal accounts cannot create head contractor companies',
        );
      }

      const subcontractorLink = await tx.subcontractorUser.findFirst({
        where: {
          userId: user.userId,
          subcontractorCompany: {
            status: { not: 'removed' },
          },
        },
        select: { id: true },
      });

      if (subcontractorLink) {
        throw AppError.forbidden(
          'Subcontractor portal accounts cannot create head contractor companies',
        );
      }

      const company = await tx.company.create({
        data: {
          name: name!,
          abn: abn ?? null,
          address: address ?? null,
          subscriptionTier: 'basic',
        },
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

      const updatedUser = await tx.user.update({
        where: { id: user.userId },
        data: {
          companyId: company.id,
          roleInCompany: 'owner',
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          roleInCompany: true,
          companyId: true,
          avatarUrl: true,
          passwordHash: true,
        },
      });

      return { company, updatedUser };
    });

    await createAuditLog({
      userId: user.userId,
      entityType: 'company',
      entityId: company.id,
      action: AuditAction.COMPANY_CREATED,
      changes: {
        companyName: company.name,
      },
      req,
    });

    res.status(201).json(buildCompanyCreatedResponse(company, updatedUser));
  }),
);

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

    res.json(
      buildCompanyProfileResponse(company, {
        projectCount,
        projectLimit: serializeTierLimit(projectLimit),
        userCount,
        userLimit: serializeTierLimit(userLimit),
      }),
    );
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

    const companyId = user.companyId;
    const previousRole = user.roleInCompany || null;
    let removedProjectMembershipCount = 0;
    await prisma.$transaction(async (tx) => {
      await assertCanRemoveUserFromProjectAdminRoles(user.userId, {
        companyId,
        actionDescription: 'leave company',
        subjectDescription: 'you are',
        client: tx,
      });

      // Remove user from all project memberships for this company
      const companyProjects = await tx.project.findMany({
        where: { companyId },
        select: { id: true },
      });

      const projectIds = companyProjects.map((p) => p.id);

      // Delete project user records
      const removedProjectMemberships = await tx.projectUser.deleteMany({
        where: {
          userId: user.userId,
          projectId: { in: projectIds },
        },
      });
      removedProjectMembershipCount = removedProjectMemberships.count;

      // Remove company association from user using raw SQL to avoid Prisma quirks
      // Set role_in_company to 'member' (default) since it's NOT NULL
      await tx.$executeRaw`UPDATE users SET company_id = NULL, role_in_company = 'member' WHERE id = ${user.userId}`;
    });

    await createAuditLog({
      userId: user.userId,
      entityType: 'company',
      entityId: companyId,
      action: AuditAction.COMPANY_MEMBER_LEFT,
      changes: {
        memberUserId: user.userId,
        previousRole,
        removedProjectMembershipCount,
      },
      req,
    });

    res.json(buildCompanyLeftResponse(new Date()));
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

    // Owners/admins can view members for team management. Ownership transfer
    // remains owner-only in POST /transfer-ownership.
    if (!['owner', 'admin'].includes(user.roleInCompany || '')) {
      throw AppError.forbidden('Only company owners and admins can view company members');
    }

    const members = await prisma.user.findMany({
      where: { companyId: user.companyId },
      select: {
        id: true,
        email: true,
        fullName: true,
        roleInCompany: true,
        passwordHash: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { fullName: 'asc' },
    });

    res.json(buildCompanyMembersResponse(members));
  }),
);

// POST /api/company/members/invite - Invite or attach a user to the current company
companyRouter.post(
  '/members/invite',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    requireBrowserSession(req, 'Company member invitation');
    const companyId = requireCompanyAdmin(user);
    const email = normalizeCompanyMemberEmail(req.body.email);
    const roleInCompany = normalizeCompanyMemberRole(req.body.roleInCompany ?? req.body.role);
    const fullName = normalizeCompanyString(
      req.body.fullName,
      'Full name',
      COMPANY_MEMBER_FULL_NAME_MAX_LENGTH,
    );

    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupExpiresAt = new Date(
      Date.now() + COMPANY_MEMBER_INVITATION_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    );

    const { company, member, setupRequired } = await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: user.userId },
        select: { companyId: true, roleInCompany: true },
      });

      if (!currentUser?.companyId) {
        throw AppError.notFound('Company');
      }

      if (currentUser.companyId !== companyId) {
        throw AppError.forbidden('Invalid company session');
      }

      if (!['owner', 'admin'].includes(currentUser.roleInCompany || '')) {
        throw AppError.forbidden('Only company owners and admins can invite company members');
      }

      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true },
      });

      if (!company) {
        throw AppError.notFound('Company');
      }

      const existingUser = await tx.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          fullName: true,
          companyId: true,
          roleInCompany: true,
          passwordHash: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (existingUser?.companyId && existingUser.companyId !== companyId) {
        throw AppError.conflict('This user already belongs to another company');
      }

      if (
        existingUser &&
        (COMPANY_SUBCONTRACTOR_ROLES.has(existingUser.roleInCompany || '') ||
          (await tx.subcontractorUser.findFirst({
            where: {
              userId: existingUser.id,
              subcontractorCompany: { status: { not: 'removed' } },
            },
            select: { id: true },
          })))
      ) {
        throw AppError.forbidden(
          'Subcontractor portal accounts cannot be added as company members',
        );
      }

      if (existingUser?.roleInCompany === 'owner') {
        throw AppError.badRequest('Company owners are managed through ownership transfer');
      }

      const member = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              companyId,
              roleInCompany,
              emailVerified: true,
              emailVerifiedAt: existingUser.passwordHash ? existingUser.updatedAt : new Date(),
              ...(fullName !== undefined ? { fullName } : {}),
            },
            select: {
              id: true,
              email: true,
              fullName: true,
              roleInCompany: true,
              passwordHash: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        : await tx.user.create({
            data: {
              email,
              fullName: fullName ?? null,
              companyId,
              roleInCompany,
              emailVerified: true,
              emailVerifiedAt: new Date(),
            },
            select: {
              id: true,
              email: true,
              fullName: true,
              roleInCompany: true,
              passwordHash: true,
              createdAt: true,
              updatedAt: true,
            },
          });

      const setupRequired = !member.passwordHash;
      if (setupRequired) {
        await tx.passwordResetToken.updateMany({
          where: {
            userId: member.id,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        });

        await tx.passwordResetToken.create({
          data: {
            userId: member.id,
            token: hashOneTimeToken(setupToken),
            expiresAt: setupExpiresAt,
          },
        });
      }

      return { company, member, setupRequired };
    });

    await createAuditLog({
      userId: user.userId,
      entityType: 'user',
      entityId: member.id,
      action: AuditAction.USER_INVITED,
      changes: {
        invitedUserId: member.id,
        invitedUserEmail: member.email,
        roleInCompany,
        companyId,
        status: setupRequired ? 'pending' : 'active',
      },
      req,
    });

    if (setupRequired) {
      const setupUrl = buildFrontendUrl(`/reset-password?token=${setupToken}`);
      try {
        await sendCompanyMemberInvitationEmail({
          to: member.email,
          userName: member.fullName,
          companyName: company.name,
          inviterEmail: user.email,
          setupUrl,
          expiresInDays: COMPANY_MEMBER_INVITATION_EXPIRES_DAYS,
        });
      } catch (emailError) {
        logError('[Company Member Invite] Failed to send email:', emailError);
      }
    }

    res.status(201).json(
      buildCompanyMemberInvitedResponse(member, {
        expiresAt: setupRequired ? setupExpiresAt : null,
      }),
    );
  }),
);

// POST /api/company/transfer-ownership - Transfer company ownership to another user
companyRouter.post(
  '/transfer-ownership',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    requireBrowserSession(req, 'Ownership transfer');

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

    await createAuditLog({
      userId: user.userId,
      entityType: 'company',
      entityId: user.companyId,
      action: AuditAction.COMPANY_OWNERSHIP_TRANSFERRED,
      changes: {
        previousOwnerId: user.userId,
        newOwnerId,
        previousOwnerRole: { from: 'owner', to: 'admin' },
        newOwnerRole: { from: newOwner.roleInCompany, to: 'owner' },
      },
      req,
    });

    res.json(buildCompanyOwnershipTransferredResponse(newOwner, new Date()));
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

    await createAuditLog({
      userId: user.userId,
      entityType: 'company',
      entityId: companyId,
      action: AuditAction.COMPANY_LOGO_UPDATED,
      changes: { changedFields: ['logoUrl'] },
      req,
    });

    if (currentCompany.logoUrl) {
      try {
        await removeStoredCompanyLogo(currentCompany.logoUrl, companyId);
      } catch (error) {
        logWarn('Failed to delete old company logo:', error);
      }
    }

    res.status(201).json(buildCompanyLogoUploadedResponse(logoUrl, updatedCompany));
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

    const changedFields = Object.keys(updateData);
    if (changedFields.length > 0) {
      await createAuditLog({
        userId: user.userId,
        entityType: 'company',
        entityId: companyId,
        action: AuditAction.COMPANY_UPDATED,
        changes: { changedFields },
        req,
      });
    }

    res.json(buildCompanyUpdatedResponse(updatedCompany));
  }),
);
