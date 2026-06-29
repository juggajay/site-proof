import { Router, type Request } from 'express';

import { AppError } from '../../lib/AppError.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { isStandaloneSubcontractorPortalIdentity } from '../../lib/projectAccess.js';
import { requireBrowserSession } from '../../middleware/browserSession.js';
import {
  buildSubcontractorPortalAccessResponse,
  buildSubcontractorPortalAccessUpdatedResponse,
} from './adminResponses.js';

type AuthenticatedUser = NonNullable<Request['user']>;
type PortalAccessSettings = Record<string, boolean>;

export interface SubcontractorPortalAccessRouterDependencies {
  defaultPortalAccess: PortalAccessSettings;
  normalizeIdParam(value: unknown, field?: string): string;
  assertSubcontractorPortalActive(company: { status: string }): void;
  requireSubcontractorProjectAccess(
    projectId: string,
    user: AuthenticatedUser,
    manage?: boolean,
    options?: { requireWritable?: boolean },
  ): Promise<unknown>;
}

async function hasLinkedSubcontractorAccess(
  subcontractorCompanyId: string,
  user: AuthenticatedUser,
): Promise<boolean> {
  if (!isStandaloneSubcontractorPortalIdentity(user)) {
    return false;
  }

  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: { subcontractorCompanyId, userId: user.id },
    select: { id: true },
  });

  return Boolean(subcontractorUser);
}

export function createSubcontractorPortalAccessRouter({
  defaultPortalAccess,
  normalizeIdParam,
  assertSubcontractorPortalActive,
  requireSubcontractorProjectAccess,
}: SubcontractorPortalAccessRouterDependencies): Router {
  const router = Router();

  // PATCH /api/subcontractors/:id/portal-access - Update portal access settings
  router.patch(
    '/:id/portal-access',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      requireBrowserSession(req, 'Subcontractor portal access update');
      const id = normalizeIdParam(req.params.id, 'Subcontractor ID');
      const { portalAccess } = req.body;

      // Validate portal access object
      if (!portalAccess || typeof portalAccess !== 'object' || Array.isArray(portalAccess)) {
        throw AppError.badRequest('portalAccess object is required');
      }

      // Validate the structure - ensure all keys are valid booleans
      const validKeys = ['lots', 'itps', 'holdPoints', 'testResults', 'ncrs', 'documents'];
      for (const key of Object.keys(portalAccess)) {
        if (!validKeys.includes(key)) {
          throw AppError.badRequest(`Invalid portal access setting: ${key}`);
        }
      }
      for (const key of validKeys) {
        if (portalAccess[key] !== undefined && typeof portalAccess[key] !== 'boolean') {
          throw AppError.badRequest(`Invalid value for ${key} - must be a boolean`);
        }
      }

      // Find the subcontractor company
      const subcontractor = await prisma.subcontractorCompany.findUnique({
        where: { id },
        include: { project: true },
      });

      if (!subcontractor) {
        throw AppError.notFound('Subcontractor company');
      }

      await requireSubcontractorProjectAccess(subcontractor.projectId, user, true, {
        requireWritable: true,
      });

      // Merge with defaults to ensure all keys exist
      const mergedAccess = {
        ...defaultPortalAccess,
        ...portalAccess,
      };

      // Update the portal access
      const updatedSubcontractor = await prisma.subcontractorCompany.update({
        where: { id },
        data: {
          portalAccess: mergedAccess,
        },
        select: {
          id: true,
          companyName: true,
          portalAccess: true,
        },
      });

      // Audit log for portal access update
      await createAuditLog({
        projectId: subcontractor.projectId,
        userId: user.id,
        entityType: 'subcontractor',
        entityId: id,
        action: AuditAction.SUBCONTRACTOR_PORTAL_ACCESS_CHANGED,
        changes: { portalAccess: mergedAccess, companyName: subcontractor.companyName },
        req,
      });

      res.json(buildSubcontractorPortalAccessUpdatedResponse(updatedSubcontractor.portalAccess));
    }),
  );

  // GET /api/subcontractors/:id/portal-access - Get portal access settings
  router.get(
    '/:id/portal-access',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const id = normalizeIdParam(req.params.id, 'Subcontractor ID');

      const subcontractor = await prisma.subcontractorCompany.findUnique({
        where: { id },
        select: {
          id: true,
          companyName: true,
          projectId: true,
          status: true,
          portalAccess: true,
        },
      });

      if (!subcontractor) {
        throw AppError.notFound('Subcontractor company');
      }

      const hasPortalUserAccess = await hasLinkedSubcontractorAccess(id, user);
      if (!hasPortalUserAccess) {
        await requireSubcontractorProjectAccess(subcontractor.projectId, user);
      } else {
        assertSubcontractorPortalActive(subcontractor);
      }

      // Return stored access or defaults
      const portalAccess = subcontractor.portalAccess || defaultPortalAccess;

      res.json(buildSubcontractorPortalAccessResponse(portalAccess));
    }),
  );

  return router;
}
