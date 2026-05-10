import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  activeSubcontractorCompanyWhere,
  isSubcontractorPortalRole,
} from '../lib/projectAccess.js';

export const lotAssignmentsRouter = Router();

// Roles that can manage lot assignments
const ASSIGNMENT_MANAGERS = ['owner', 'admin', 'project_manager', 'site_manager'];
const terminalLotStatuses = ['conformed', 'claimed'];
const LOT_ASSIGNMENT_ROUTE_PARAM_MAX_LENGTH = 120;

const assignmentBodySchema = z.object({
  subcontractorCompanyId: z.string().trim().min(1, 'subcontractorCompanyId is required').max(120),
  canCompleteITP: z.boolean().optional(),
  itpRequiresVerification: z.boolean().optional(),
});

const updateAssignmentBodySchema = z.object({
  canCompleteITP: z.boolean().optional(),
  itpRequiresVerification: z.boolean().optional(),
});

type AuthenticatedUser = NonNullable<Express.Request['user']>;

function parseLotAssignmentRouteParam(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a single value`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest(`${field} is required`);
  }

  if (normalized.length > LOT_ASSIGNMENT_ROUTE_PARAM_MAX_LENGTH) {
    throw AppError.badRequest(`${field} is too long`);
  }

  return normalized;
}

function isCompanyAdmin(user: AuthenticatedUser): boolean {
  return user.roleInCompany === 'admin' || user.roleInCompany === 'owner';
}

async function getEffectiveProjectRole(
  projectId: string,
  user: AuthenticatedUser,
): Promise<string | null> {
  const isSubcontractor = isSubcontractorPortalRole(user.roleInCompany);
  const [project, projectUser] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    }),
    isSubcontractor
      ? null
      : prisma.projectUser.findFirst({
          where: { projectId, userId: user.id, status: 'active' },
          select: { role: true },
        }),
  ]);

  if (!project) {
    throw AppError.notFound('Project');
  }

  if (!isSubcontractor && isCompanyAdmin(user) && project.companyId === user.companyId) {
    return user.roleInCompany;
  }

  if (projectUser) {
    return projectUser.role;
  }

  return null;
}

async function requireAssignmentManagerAccess(
  projectId: string,
  user: AuthenticatedUser,
): Promise<void> {
  const role = await getEffectiveProjectRole(projectId, user);
  if (!role || !ASSIGNMENT_MANAGERS.includes(role)) {
    throw AppError.forbidden('You do not have permission to manage subcontractor assignments');
  }
}

// POST /api/lots/:lotId/subcontractors - Assign subcontractor to lot
lotAssignmentsRouter.post(
  '/:lotId/subcontractors',
  requireAuth,
  asyncHandler(async (req, res) => {
    const lotId = parseLotAssignmentRouteParam(req.params.lotId, 'lotId');
    const user = req.user!;

    const validation = assignmentBodySchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const {
      subcontractorCompanyId,
      canCompleteITP = false,
      itpRequiresVerification = true,
    } = validation.data;

    // Get lot with project info
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      select: { id: true, projectId: true, status: true },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    if (terminalLotStatuses.includes(lot.status)) {
      throw AppError.badRequest(`Cannot assign subcontractors to a ${lot.status} lot`);
    }

    await requireAssignmentManagerAccess(lot.projectId, user);

    // Verify subcontractor belongs to this project
    const subcontractorCompany = await prisma.subcontractorCompany.findFirst({
      where: {
        id: subcontractorCompanyId,
        projectId: lot.projectId,
        status: 'approved',
      },
    });

    if (!subcontractorCompany) {
      throw AppError.badRequest('Subcontractor not found or not approved for this project');
    }

    // Check for existing assignment
    const existing = await prisma.lotSubcontractorAssignment.findUnique({
      where: {
        lotId_subcontractorCompanyId: { lotId, subcontractorCompanyId },
      },
    });

    if (existing && existing.status === 'active') {
      throw AppError.conflict('Subcontractor already assigned to this lot');
    }

    // Create or reactivate assignment and keep the legacy primary assignment aligned.
    const assignment = await prisma.$transaction(async (tx) => {
      const upsertedAssignment = existing
        ? await tx.lotSubcontractorAssignment.update({
            where: { id: existing.id },
            data: {
              status: 'active',
              canCompleteITP,
              itpRequiresVerification,
              assignedById: user.id,
              assignedAt: new Date(),
            },
            include: {
              subcontractorCompany: { select: { id: true, companyName: true } },
            },
          })
        : await tx.lotSubcontractorAssignment.create({
            data: {
              lotId,
              subcontractorCompanyId,
              projectId: lot.projectId,
              canCompleteITP,
              itpRequiresVerification,
              assignedById: user.id,
            },
            include: {
              subcontractorCompany: { select: { id: true, companyName: true } },
            },
          });

      await tx.lot.update({
        where: { id: lotId },
        data: {
          assignedSubcontractorId: subcontractorCompanyId,
          updatedAt: new Date(),
        },
      });

      return upsertedAssignment;
    });

    res.status(201).json(assignment);
  }),
);

// GET /api/lots/:lotId/subcontractors - List assignments for a lot
lotAssignmentsRouter.get(
  '/:lotId/subcontractors',
  requireAuth,
  asyncHandler(async (req, res) => {
    const lotId = parseLotAssignmentRouteParam(req.params.lotId, 'lotId');
    const user = req.user!;

    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      select: { id: true, projectId: true },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    // If user is a subcontractor, only return their own assignment
    if (user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin') {
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: {
          userId: user.id,
          subcontractorCompany: activeSubcontractorCompanyWhere({ projectId: lot.projectId }),
        },
      });

      if (subcontractorUser) {
        const filtered = await prisma.lotSubcontractorAssignment.findMany({
          where: {
            lotId,
            subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
            status: 'active',
          },
          include: {
            subcontractorCompany: {
              select: {
                id: true,
                companyName: true,
                primaryContactName: true,
                primaryContactEmail: true,
              },
            },
            assignedBy: {
              select: { id: true, fullName: true },
            },
          },
          orderBy: { assignedAt: 'desc' },
        });
        return res.json(filtered);
      }
      return res.json([]);
    }

    await requireAssignmentManagerAccess(lot.projectId, user);

    const assignments = await prisma.lotSubcontractorAssignment.findMany({
      where: {
        lotId,
        status: 'active',
      },
      include: {
        subcontractorCompany: {
          select: {
            id: true,
            companyName: true,
            primaryContactName: true,
            primaryContactEmail: true,
          },
        },
        assignedBy: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json(assignments);
  }),
);

// GET /api/lots/:lotId/subcontractors/mine - Get current user's assignment
lotAssignmentsRouter.get(
  '/:lotId/subcontractors/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const lotId = parseLotAssignmentRouteParam(req.params.lotId, 'lotId');
    const user = req.user!;

    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      select: { id: true, projectId: true },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    // Find user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: {
        userId: user.id,
        subcontractorCompany: activeSubcontractorCompanyWhere({ projectId: lot.projectId }),
      },
    });

    if (!subcontractorUser) {
      throw AppError.notFound('Not a subcontractor');
    }

    const assignment = await prisma.lotSubcontractorAssignment.findFirst({
      where: {
        lotId,
        subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
        status: 'active',
      },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
      },
    });

    if (!assignment) {
      throw AppError.notFound('No assignment found for this lot');
    }

    res.json(assignment);
  }),
);

// PATCH /api/lots/:lotId/subcontractors/:assignmentId - Update assignment permissions
lotAssignmentsRouter.patch(
  '/:lotId/subcontractors/:assignmentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const lotId = parseLotAssignmentRouteParam(req.params.lotId, 'lotId');
    const assignmentId = parseLotAssignmentRouteParam(req.params.assignmentId, 'assignmentId');
    const validation = updateAssignmentBodySchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { canCompleteITP, itpRequiresVerification } = validation.data;

    const assignment = await prisma.lotSubcontractorAssignment.findFirst({
      where: { id: assignmentId, lotId },
    });

    if (!assignment) {
      throw AppError.notFound('Assignment');
    }

    await requireAssignmentManagerAccess(assignment.projectId, req.user!);

    const updated = await prisma.lotSubcontractorAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(canCompleteITP !== undefined ? { canCompleteITP } : {}),
        ...(itpRequiresVerification !== undefined ? { itpRequiresVerification } : {}),
      },
      include: {
        subcontractorCompany: { select: { id: true, companyName: true } },
      },
    });

    res.json(updated);
  }),
);

// DELETE /api/lots/:lotId/subcontractors/:assignmentId - Remove assignment (soft delete)
lotAssignmentsRouter.delete(
  '/:lotId/subcontractors/:assignmentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const lotId = parseLotAssignmentRouteParam(req.params.lotId, 'lotId');
    const assignmentId = parseLotAssignmentRouteParam(req.params.assignmentId, 'assignmentId');

    const [assignment, lot] = await Promise.all([
      prisma.lotSubcontractorAssignment.findFirst({
        where: { id: assignmentId, lotId },
      }),
      prisma.lot.findUnique({
        where: { id: lotId },
        select: { assignedSubcontractorId: true },
      }),
    ]);

    if (!assignment) {
      throw AppError.notFound('Assignment');
    }

    await requireAssignmentManagerAccess(assignment.projectId, req.user!);

    await prisma.$transaction(async (tx) => {
      await tx.lotSubcontractorAssignment.update({
        where: { id: assignmentId },
        data: { status: 'removed' },
      });

      if (lot?.assignedSubcontractorId === assignment.subcontractorCompanyId) {
        const replacementAssignment = await tx.lotSubcontractorAssignment.findFirst({
          where: {
            lotId,
            status: 'active',
            id: { not: assignmentId },
          },
          orderBy: { assignedAt: 'desc' },
          select: { subcontractorCompanyId: true },
        });

        await tx.lot.update({
          where: { id: lotId },
          data: {
            assignedSubcontractorId: replacementAssignment?.subcontractorCompanyId ?? null,
            updatedAt: new Date(),
          },
        });
      }
    });

    res.json({ success: true });
  }),
);
