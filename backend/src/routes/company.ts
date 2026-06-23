import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';
import { getProjectLimitForTier, getUserLimitForTier } from '../lib/tierLimits.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { buildApiUrl } from '../lib/runtimeConfig.js';
import { assertUploadedImageFile } from '../lib/imageValidation.js';
import { logWarn } from '../lib/serverLogger.js';
import { AuditAction, createAuditLog } from '../lib/auditLog.js';
import { DOCUMENTS_BUCKET, getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js';
import {
  buildCompanyCreatedResponse,
  buildCompanyLogoUploadedResponse,
  buildCompanyProfileResponse,
  buildCompanyUpdatedResponse,
} from './company/responses.js';
import {
  assertCompanyLogoUrlOwnedByCompany,
  cleanupUploadedLogo,
  cleanupStoredCompanyLogoUpload,
  companyLogoUpload,
  getCompanyLogoContentType,
  getCompanyLogoDisplayUrlCompanyId,
  getOwnedCompanyLogoStoragePath,
  removeStoredCompanyLogo,
  shouldRemovePreviousLogoOnPatch,
  toCompanyLogoStorageValue,
  uploadCompanyLogoToSupabase,
  validateCompanyLogoAccessToken,
} from './company/logoStorage.js';
import {
  COMPANY_ABN_MAX_LENGTH,
  COMPANY_ADDRESS_MAX_LENGTH,
  COMPANY_NAME_MAX_LENGTH,
  normalizeCompanyLogoUrl,
  normalizeCompanyString,
} from './company/validation.js';
import {
  COMPANY_SUBCONTRACTOR_ROLES,
  isSubcontractorCompanyRole,
  requireBrowserSession,
  requireCompanyAdmin,
} from './company/access.js';
import { companyMemberRoutes } from './company/memberRoutes.js';

export const companyRouter = Router();

type CompanySettingsUpdateData = {
  name?: string;
  abn?: string | null;
  address?: string | null;
  logoUrl?: string | null;
};

type CompanyLogoUpdateResolution = {
  previousLogoUrl: string | null;
  shouldCleanupPreviousLogo: boolean;
  logoUrl?: string | null;
};

// GET /api/company/logo/file/:companyId - Serve a signed Supabase-backed company logo URL.
//
// This endpoint is intentionally before route-wide auth: browser image tags do
// not send the app's bearer token, so access is controlled by the short-lived
// token that is tied to the company's currently stored logo object.
companyRouter.get(
  '/logo/file/:companyId',
  asyncHandler(async (req, res) => {
    const companyId = req.params.companyId;
    if (!companyId) {
      throw AppError.badRequest('companyId is required');
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { logoUrl: true },
    });

    const storagePath = getOwnedCompanyLogoStoragePath(company?.logoUrl, companyId);
    if (!storagePath || !isSupabaseConfigured()) {
      throw AppError.notFound('Company logo');
    }

    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    if (!validateCompanyLogoAccessToken(token, companyId, storagePath)) {
      throw AppError.unauthorized('Invalid or expired company logo URL');
    }

    const { data, error } = await getSupabaseClient()
      .storage.from(DOCUMENTS_BUCKET)
      .download(storagePath);

    if (error || !data) {
      logWarn('Supabase company logo download failed:', error);
      throw AppError.notFound('Company logo');
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Type', getCompanyLogoContentType(storagePath));
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }),
);

// Apply authentication middleware to all routes
companyRouter.use(requireAuth);

function serializeTierLimit(limit: number): number | null {
  return Number.isFinite(limit) ? limit : null;
}

function resolveRequestedCompanyLogoUrl(
  logoUrl: string | null,
  companyId: string,
  previousLogoUrl: string | null,
): string | null | undefined {
  const displayUrlCompanyId =
    typeof logoUrl === 'string' ? getCompanyLogoDisplayUrlCompanyId(logoUrl) : null;
  if (displayUrlCompanyId === null) {
    return logoUrl;
  }

  if (
    displayUrlCompanyId === companyId &&
    getOwnedCompanyLogoStoragePath(previousLogoUrl, companyId)
  ) {
    return undefined;
  }

  throw AppError.badRequest('Company logo must be uploaded before saving');
}

async function resolveCompanyLogoUpdate(
  companyId: string,
  requestedLogoUrl: string | null | undefined,
): Promise<CompanyLogoUpdateResolution> {
  if (requestedLogoUrl === undefined) {
    return { previousLogoUrl: null, shouldCleanupPreviousLogo: false };
  }

  const existing = await prisma.company.findUnique({
    where: { id: companyId },
    select: { logoUrl: true },
  });
  const previousLogoUrl = existing?.logoUrl ?? null;
  const logoUrl = resolveRequestedCompanyLogoUrl(requestedLogoUrl, companyId, previousLogoUrl);

  if (logoUrl === undefined) {
    return { previousLogoUrl, shouldCleanupPreviousLogo: false };
  }

  assertCompanyLogoUrlOwnedByCompany(logoUrl, companyId);
  return {
    previousLogoUrl,
    shouldCleanupPreviousLogo: shouldRemovePreviousLogoOnPatch(previousLogoUrl, logoUrl),
    logoUrl: toCompanyLogoStorageValue(logoUrl, companyId),
  };
}

// POST /api/company - Create the current user's first company
companyRouter.post(
  '/',
  requireEmailVerified,
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

    const projectLimit = getProjectLimitForTier(company.subscriptionTier);
    const userLimit = getUserLimitForTier(company.subscriptionTier);

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

companyRouter.use(companyMemberRoutes);

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
        logoUrl = uploaded.storageReference;
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
    const requestedLogoUrl = normalizeCompanyLogoUrl(req.body.logoUrl);

    const companyId = requireCompanyAdmin(user);

    const updateData: CompanySettingsUpdateData = {};

    if (name !== undefined) {
      if (name === null) {
        throw AppError.badRequest('Company name is required');
      }
      updateData.name = name;
    }
    if (abn !== undefined) updateData.abn = abn;
    if (address !== undefined) updateData.address = address;

    const logoUpdate = await resolveCompanyLogoUpdate(companyId, requestedLogoUrl);
    if (logoUpdate.logoUrl !== undefined) {
      updateData.logoUrl = logoUpdate.logoUrl;
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

    if (logoUpdate.shouldCleanupPreviousLogo && logoUpdate.previousLogoUrl) {
      try {
        await removeStoredCompanyLogo(logoUpdate.previousLogoUrl, companyId);
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
