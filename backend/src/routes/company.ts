import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { TIER_PROJECT_LIMITS, TIER_USER_LIMITS } from '../lib/tierLimits.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { buildApiUrl } from '../lib/runtimeConfig.js';
import { assertUploadedImageFile } from '../lib/imageValidation.js';
import { logWarn } from '../lib/serverLogger.js';
import { AuditAction, createAuditLog } from '../lib/auditLog.js';
import { isSupabaseConfigured } from '../lib/supabase.js';
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
  removeStoredCompanyLogo,
  shouldRemovePreviousLogoOnPatch,
  uploadCompanyLogoToSupabase,
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

// Apply authentication middleware to all routes
companyRouter.use(requireAuth);

function serializeTierLimit(limit: number): number | null {
  return Number.isFinite(limit) ? limit : null;
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
