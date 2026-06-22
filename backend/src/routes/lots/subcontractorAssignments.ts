/**
 * Lot subcontractor assignment routes.
 *
 * Moved verbatim from backend/src/routes/lots.ts as part of the route-handler
 * relocation phase (engineering-health Workstream 1). These five endpoints make
 * up the lot-level subcontractor assignment permission surface:
 *
 *   GET    /:id/subcontractors
 *   GET    /:id/subcontractors/mine
 *   POST   /:id/subcontractors
 *   PATCH  /:id/subcontractors/:assignmentId
 *   DELETE /:id/subcontractors/:assignmentId
 *
 * Auth: lots.ts mounts this router AFTER its route-wide `lotsRouter.use(requireAuth)`,
 * exactly like the diary/ and dockets/ child routers, so every route here is
 * already authenticated. Do NOT add a separate requireAuth here (it would run
 * authentication twice). routeAuthCoverage.test.ts treats the `lots/` prefix as
 * parent-protected for this reason.
 */

import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { activeSubcontractorCompanyWhere } from '../../lib/projectAccess.js';
import { parseLotRouteParam } from './requestParsing.js';
import {
  isSubcontractorUser,
  requireProjectRole,
  getProjectSubcontractorCompanyIds,
} from './access.js';
import {
  createSubcontractorAssignmentSchema,
  updateSubcontractorAssignmentSchema,
} from './validation.js';
import {
  buildLegacyLotAssignmentResponse,
  buildLotAssignmentDeletedResponse,
  buildLotAssignmentResponse,
  buildLotAssignmentsResponse,
} from './assignmentResponses.js';

export const lotSubcontractorAssignmentsRouter = Router();

// GET /api/lots/:id/subcontractors - List all subcontractor assignments for a lot
lotSubcontractorAssignmentsRouter.get(
  '/:id/subcontractors',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    const lot = await prisma.lot.findUnique({
      where: { id },
      select: { id: true, projectId: true },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireProjectRole(
      lot.projectId,
      user,
      ['owner', 'admin', 'project_manager', 'site_manager'],
      'You do not have permission to view subcontractor assignments',
    );

    const assignments = await prisma.lotSubcontractorAssignment.findMany({
      where: { lotId: id, status: 'active' },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json(buildLotAssignmentsResponse(assignments));
  }),
);

// GET /api/lots/:id/subcontractors/mine - Get the current subcontractor user's assignment for a lot
lotSubcontractorAssignmentsRouter.get(
  '/:id/subcontractors/mine',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    const lot = await prisma.lot.findUnique({
      where: { id },
      select: { id: true, projectId: true },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    if (!isSubcontractorUser(user)) {
      throw AppError.forbidden('Subcontractor access required');
    }

    const subcontractorCompanyIds = await getProjectSubcontractorCompanyIds(user.id, lot.projectId);
    if (subcontractorCompanyIds.length === 0) {
      throw AppError.forbidden('You do not have access to this lot');
    }

    const assignment = await prisma.lotSubcontractorAssignment.findFirst({
      where: {
        lotId: id,
        projectId: lot.projectId,
        subcontractorCompanyId: { in: subcontractorCompanyIds },
        status: 'active',
      },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
      },
    });

    if (assignment) {
      return res.json(buildLotAssignmentResponse(assignment));
    }

    const legacyLot = await prisma.lot.findFirst({
      where: {
        id,
        projectId: lot.projectId,
        assignedSubcontractorId: { in: subcontractorCompanyIds },
      },
      select: { id: true, assignedSubcontractorId: true },
    });

    if (!legacyLot) {
      throw AppError.notFound('Assignment');
    }

    res.json(
      buildLegacyLotAssignmentResponse(id, lot.projectId, legacyLot.assignedSubcontractorId!),
    );
  }),
);

// POST /api/lots/:id/subcontractors - Assign a subcontractor to a lot
lotSubcontractorAssignmentsRouter.post(
  '/:id/subcontractors',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const validation = createSubcontractorAssignmentSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { subcontractorCompanyId, canCompleteITP, itpRequiresVerification } = validation.data;

    // Get the lot to verify access and get projectId
    const lot = await prisma.lot.findUnique({
      where: { id },
      select: { id: true, projectId: true, lotNumber: true, status: true },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    if (lot.status === 'conformed' || lot.status === 'claimed') {
      throw AppError.badRequest(`Cannot assign subcontractors to a ${lot.status} lot`);
    }

    await requireProjectRole(
      lot.projectId,
      user,
      ['owner', 'admin', 'project_manager', 'site_manager'],
      'You do not have permission to assign subcontractors',
      { requireWritable: true },
    );

    // Verify subcontractor exists and belongs to this project
    const subcontractor = await prisma.subcontractorCompany.findFirst({
      where: activeSubcontractorCompanyWhere({
        id: subcontractorCompanyId,
        projectId: lot.projectId,
      }),
    });

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor not found for this project');
    }

    // Check for existing assignment. Removed assignments are reactivated to satisfy the unique lot/subcontractor constraint.
    const existingAssignment = await prisma.lotSubcontractorAssignment.findUnique({
      where: {
        lotId_subcontractorCompanyId: {
          lotId: id,
          subcontractorCompanyId,
        },
      },
    });

    if (existingAssignment?.status === 'active') {
      throw AppError.conflict('This subcontractor is already assigned to this lot');
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const upsertedAssignment = existingAssignment
        ? await tx.lotSubcontractorAssignment.update({
            where: { id: existingAssignment.id },
            data: {
              projectId: lot.projectId,
              canCompleteITP: canCompleteITP ?? false,
              itpRequiresVerification: itpRequiresVerification ?? true,
              assignedById: user.id,
              assignedAt: new Date(),
              status: 'active',
            },
            include: {
              subcontractorCompany: {
                select: { id: true, companyName: true },
              },
            },
          })
        : await tx.lotSubcontractorAssignment.create({
            data: {
              lotId: id,
              projectId: lot.projectId,
              subcontractorCompanyId,
              canCompleteITP: canCompleteITP ?? false,
              itpRequiresVerification: itpRequiresVerification ?? true,
              assignedById: user.id,
              status: 'active',
            },
            include: {
              subcontractorCompany: {
                select: { id: true, companyName: true },
              },
            },
          });

      await tx.lot.update({
        where: { id },
        data: {
          assignedSubcontractorId: subcontractorCompanyId,
          updatedAt: new Date(),
        },
      });

      return upsertedAssignment;
    });

    await createAuditLog({
      projectId: lot.projectId,
      userId: user.id,
      entityType: 'lot_subcontractor_assignment',
      entityId: assignment.id,
      action: AuditAction.LOT_SUBCONTRACTOR_ASSIGNED,
      changes: {
        lotId: id,
        lotNumber: lot.lotNumber,
        subcontractorCompanyId,
        subcontractorCompanyName: subcontractor.companyName,
        status: { from: existingAssignment?.status ?? null, to: assignment.status },
        canCompleteITP: assignment.canCompleteITP,
        itpRequiresVerification: assignment.itpRequiresVerification,
      },
      req,
    });

    res.status(201).json(buildLotAssignmentResponse(assignment));
  }),
);

// PATCH /api/lots/:id/subcontractors/:assignmentId - Update assignment permissions
lotSubcontractorAssignmentsRouter.patch(
  '/:id/subcontractors/:assignmentId',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const assignmentId = parseLotRouteParam(req.params.assignmentId, 'assignmentId');
    const user = req.user!;

    // Validate request body
    const validation = updateSubcontractorAssignmentSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { canCompleteITP, itpRequiresVerification } = validation.data;

    // Get the lot to verify access
    const lot = await prisma.lot.findUnique({
      where: { id },
      select: { id: true, projectId: true, lotNumber: true, assignedSubcontractorId: true },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireProjectRole(
      lot.projectId,
      user,
      ['owner', 'admin', 'project_manager', 'site_manager'],
      'You do not have permission to manage subcontractor assignments',
      { requireWritable: true },
    );

    // Verify assignment exists and belongs to this lot
    const assignment = await prisma.lotSubcontractorAssignment.findFirst({
      where: { id: assignmentId, lotId: id },
      select: {
        id: true,
        subcontractorCompanyId: true,
        canCompleteITP: true,
        itpRequiresVerification: true,
      },
    });

    if (!assignment) {
      throw AppError.notFound('Assignment');
    }

    // Update the assignment
    const updated = await prisma.lotSubcontractorAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(canCompleteITP !== undefined && { canCompleteITP }),
        ...(itpRequiresVerification !== undefined && { itpRequiresVerification }),
      },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
      },
    });

    await createAuditLog({
      projectId: lot.projectId,
      userId: user.id,
      entityType: 'lot_subcontractor_assignment',
      entityId: updated.id,
      action: AuditAction.LOT_SUBCONTRACTOR_ASSIGNMENT_UPDATED,
      changes: {
        lotId: id,
        lotNumber: lot.lotNumber,
        subcontractorCompanyId: assignment.subcontractorCompanyId,
        subcontractorCompanyName: updated.subcontractorCompany.companyName,
        canCompleteITP: { from: assignment.canCompleteITP, to: updated.canCompleteITP },
        itpRequiresVerification: {
          from: assignment.itpRequiresVerification,
          to: updated.itpRequiresVerification,
        },
      },
      req,
    });

    res.json(buildLotAssignmentResponse(updated));
  }),
);

// DELETE /api/lots/:id/subcontractors/:assignmentId - Remove assignment
lotSubcontractorAssignmentsRouter.delete(
  '/:id/subcontractors/:assignmentId',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const assignmentId = parseLotRouteParam(req.params.assignmentId, 'assignmentId');
    const user = req.user!;

    // Get the lot to verify access
    const lot = await prisma.lot.findUnique({
      where: { id },
      select: { id: true, projectId: true, lotNumber: true, assignedSubcontractorId: true },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireProjectRole(
      lot.projectId,
      user,
      ['owner', 'admin', 'project_manager', 'site_manager'],
      'You do not have permission to manage subcontractor assignments',
      { requireWritable: true },
    );

    // Verify assignment exists and belongs to this lot
    const assignment = await prisma.lotSubcontractorAssignment.findFirst({
      where: { id: assignmentId, lotId: id },
      select: {
        id: true,
        subcontractorCompanyId: true,
        status: true,
        subcontractorCompany: { select: { companyName: true } },
      },
    });

    if (!assignment) {
      throw AppError.notFound('Assignment');
    }

    // Soft delete by setting status to 'removed' and keep the legacy primary assignment aligned.
    await prisma.$transaction(async (tx) => {
      await tx.lotSubcontractorAssignment.update({
        where: { id: assignmentId },
        data: { status: 'removed' },
      });

      if (lot.assignedSubcontractorId === assignment.subcontractorCompanyId) {
        const replacementAssignment = await tx.lotSubcontractorAssignment.findFirst({
          where: {
            lotId: id,
            status: 'active',
            id: { not: assignmentId },
          },
          orderBy: { assignedAt: 'desc' },
          select: { subcontractorCompanyId: true },
        });

        await tx.lot.update({
          where: { id },
          data: {
            assignedSubcontractorId: replacementAssignment?.subcontractorCompanyId ?? null,
            updatedAt: new Date(),
          },
        });
      }
    });

    await createAuditLog({
      projectId: lot.projectId,
      userId: user.id,
      entityType: 'lot_subcontractor_assignment',
      entityId: assignment.id,
      action: AuditAction.LOT_SUBCONTRACTOR_ASSIGNMENT_REMOVED,
      changes: {
        lotId: id,
        lotNumber: lot.lotNumber,
        subcontractorCompanyId: assignment.subcontractorCompanyId,
        subcontractorCompanyName: assignment.subcontractorCompany.companyName,
        status: { from: assignment.status, to: 'removed' },
      },
      req,
    });

    res.json(buildLotAssignmentDeletedResponse());
  }),
);
