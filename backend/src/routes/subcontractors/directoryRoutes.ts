import { Router, type Request } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { buildSubcontractorDirectoryResponse } from './invitationResponses.js';

type AuthenticatedUser = NonNullable<Request['user']>;

export interface SubcontractorDirectoryRouterDependencies {
  isHeadContractorRole(user: AuthenticatedUser): boolean;
}

export function createSubcontractorDirectoryRouter({
  isHeadContractorRole,
}: SubcontractorDirectoryRouterDependencies): Router {
  const router = Router();

  // GET /api/subcontractors/directory - Get global subcontractors for the user's organization
  // This allows selecting existing subcontractors when inviting to a new project
  router.get(
    '/directory',
    asyncHandler(async (req, res) => {
      const user = req.user!;

      // User must belong to a company
      if (!user.companyId) {
        throw AppError.badRequest(
          'User must belong to an organization to access the subcontractor directory',
        );
      }

      if (!isHeadContractorRole(user)) {
        throw AppError.forbidden(
          'Only head contractor users can access the subcontractor directory',
        );
      }

      // Get all global subcontractors for this organization
      const globalSubcontractors = await prisma.globalSubcontractor.findMany({
        where: {
          organizationId: user.companyId,
          status: 'active',
        },
        orderBy: { companyName: 'asc' },
      });

      res.json(buildSubcontractorDirectoryResponse(globalSubcontractors));
    }),
  );

  return router;
}
