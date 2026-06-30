import { Router, type Request } from 'express';

import { AppError } from '../../lib/AppError.js';
import { AuditAction, createAuditLog, writeAuditLogInTransaction } from '../../lib/auditLog.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { requireBrowserSession } from '../../middleware/browserSession.js';
import {
  buildSubcontractorDeletedResponse,
  buildSubcontractorStatusUpdatedResponse,
} from './adminResponses.js';

type AuthenticatedUser = NonNullable<Request['user']>;

export interface SubcontractorAdminRouterDependencies {
  normalizeIdParam(value: unknown, field?: string): string;
  requireSubcontractorProjectAccess(
    projectId: string,
    user: AuthenticatedUser,
    manage?: boolean,
    options?: { requireWritable?: boolean },
  ): Promise<unknown>;
}

export function createSubcontractorAdminRouter({
  normalizeIdParam,
  requireSubcontractorProjectAccess,
}: SubcontractorAdminRouterDependencies): Router {
  const router = Router();

  router.use(requireAuth);

  // PATCH /api/subcontractors/:id/status - Update subcontractor status (suspend/remove)
  // Only project managers, admins, or owners can suspend subcontractors
  router.patch(
    '/:id/status',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      requireBrowserSession(req, 'Subcontractor status update');
      const id = normalizeIdParam(req.params.id, 'Subcontractor ID');
      const { status } = req.body;

      // Validate status
      const validStatuses = ['pending_approval', 'approved', 'suspended', 'removed'];
      if (!status || !validStatuses.includes(status)) {
        throw AppError.badRequest(`Status must be one of: ${validStatuses.join(', ')}`);
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

      // Update the status
      const updatedSubcontractor = await prisma.subcontractorCompany.update({
        where: { id },
        data: {
          status,
          // If approving, record who approved
          ...(status === 'approved' && {
            approvedById: user.id,
            approvedAt: new Date(),
          }),
        },
        select: {
          id: true,
          companyName: true,
          status: true,
          approvedAt: true,
        },
      });

      // Audit log for subcontractor status change
      await createAuditLog({
        projectId: subcontractor.projectId,
        userId: user.id,
        entityType: 'subcontractor',
        entityId: id,
        action: AuditAction.SUBCONTRACTOR_STATUS_CHANGED,
        changes: {
          previousStatus: subcontractor.status,
          newStatus: status,
          companyName: subcontractor.companyName,
        },
        req,
      });

      res.json(buildSubcontractorStatusUpdatedResponse(updatedSubcontractor, status));
    }),
  );

  // DELETE /api/subcontractors/:id - Permanently delete a subcontractor and all associated records
  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      requireBrowserSession(req, 'Subcontractor deletion');
      const id = normalizeIdParam(req.params.id, 'Subcontractor ID');

      // Find the subcontractor company with counts
      const subcontractor = await prisma.subcontractorCompany.findUnique({
        where: { id },
        include: {
          project: true,
          employeeRoster: { select: { id: true } },
          plantRegister: { select: { id: true } },
          dailyDockets: { select: { id: true } },
          users: { select: { id: true } },
        },
      });

      if (!subcontractor) {
        throw AppError.notFound('Subcontractor company');
      }

      await requireSubcontractorProjectAccess(subcontractor.projectId, user, true, {
        requireWritable: true,
      });

      if (subcontractor.status !== 'removed') {
        throw AppError.conflict(
          'Subcontractor must be marked as removed before permanent deletion',
        );
      }

      const deletedCounts = {
        dockets: subcontractor.dailyDockets.length,
        employees: subcontractor.employeeRoster.length,
        plant: subcontractor.plantRegister.length,
      };

      await prisma.$transaction(async (tx) => {
        // Nullify foreign keys in Lot and NCR before deleting
        await tx.lot.updateMany({
          where: { assignedSubcontractorId: id, projectId: subcontractor.projectId },
          data: { assignedSubcontractorId: null },
        });

        await tx.nCR.updateMany({
          where: { responsibleSubcontractorId: id, projectId: subcontractor.projectId },
          data: { responsibleSubcontractorId: null },
        });

        // Delete the subcontractor company (Prisma cascade handles SubcontractorUser, EmployeeRoster, PlantRegister, DailyDocket)
        await tx.subcontractorCompany.delete({
          where: { id },
        });

        await writeAuditLogInTransaction(tx, {
          projectId: subcontractor.projectId,
          userId: user.id,
          entityType: 'subcontractor',
          entityId: id,
          action: AuditAction.SUBCONTRACTOR_PERMANENTLY_DELETED,
          changes: {
            companyName: subcontractor.companyName,
            deletedCounts,
            previousStatus: subcontractor.status,
          },
          req,
        });
      });

      res.json(buildSubcontractorDeletedResponse(subcontractor.companyName, deletedCounts));
    }),
  );

  return router;
}
