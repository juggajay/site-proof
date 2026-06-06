import { Router, type Request, type Response } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import {
  buildTemplateArchivedResponse,
  buildTemplateDeletedResponse,
  buildTemplatePropagatedResponse,
  buildTemplateRestoredResponse,
} from './templateResponses.js';
import {
  parseOptionalTemplateBooleanQuery,
  parseTemplateRouteId,
  propagateTemplateSchema,
} from './templateValidation.js';
import { requireProjectTemplateAccess, requireTemplateProjectAccess } from './templateAccess.js';

export const templateLifecycleRouter = Router();

// Delete ITP template with usage validation (Feature #575)
templateLifecycleRouter.delete(
  '/templates/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const id = parseTemplateRouteId(req.params.id, 'id');
    const force = parseOptionalTemplateBooleanQuery(req.query.force, 'force') === true;

    // Check if template exists
    const template = await prisma.iTPTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: { itpInstances: true },
        },
      },
    });

    if (!template) {
      throw AppError.notFound('Template not found');
    }

    if (template.projectId) {
      await requireProjectTemplateAccess(template.projectId, user, true);
    } else {
      throw AppError.forbidden('Global templates cannot be modified from this endpoint');
    }

    // Check if template is in use by any lots
    const instanceCount = template._count.itpInstances;

    if (instanceCount > 0) {
      // Get the lots using this template for the warning message
      const instances = await prisma.iTPInstance.findMany({
        where: { templateId: id },
        include: {
          lot: {
            select: {
              id: true,
              lotNumber: true,
              description: true,
              status: true,
            },
          },
        },
        take: 5, // Limit to first 5 for the warning
      });

      const lotsInUse = instances.map((inst) => ({
        id: inst.lot.id,
        lotNumber: inst.lot.lotNumber,
        description: inst.lot.description,
        status: inst.lot.status,
      }));

      if (force) {
        throw AppError.conflict(
          `This template is assigned to ${instanceCount} lot(s) and cannot be force deleted because assigned ITP instances require the template record. Archive it instead.`,
          { usageCount: instanceCount, lotsInUse, canArchive: true, canForceDelete: false },
        );
      }

      throw AppError.conflict(
        `This template is assigned to ${instanceCount} lot(s). Archive it instead, or remove the assigned ITP instances before deleting the template.`,
        { usageCount: instanceCount, lotsInUse, canArchive: true, canForceDelete: false },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.iTPChecklistItem.deleteMany({
        where: { templateId: id },
      });

      await tx.iTPTemplate.delete({
        where: { id },
      });
    });

    res.json(buildTemplateDeletedResponse());
  }),
);

// Archive ITP template (soft delete alternative) (Feature #575)
templateLifecycleRouter.post(
  '/templates/:id/archive',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const id = parseTemplateRouteId(req.params.id, 'id');

    await requireTemplateProjectAccess(id, user, true);

    const template = await prisma.iTPTemplate.update({
      where: { id },
      data: { isActive: false },
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' },
        },
      },
    });

    // Transform response
    const transformedTemplate = {
      ...template,
      isActive: template.isActive,
      checklistItems: template.checklistItems.map((item) => ({
        id: item.id,
        description: item.description,
        category: item.responsibleParty || 'general',
        responsibleParty: item.responsibleParty || 'contractor',
        isHoldPoint: item.pointType === 'hold_point',
        pointType: item.pointType || 'standard',
        evidenceRequired: item.evidenceRequired || 'none',
        order: item.sequenceNumber,
        acceptanceCriteria: item.acceptanceCriteria,
      })),
    };

    res.json(buildTemplateArchivedResponse(transformedTemplate));
  }),
);

// Restore archived ITP template (Feature #575)
templateLifecycleRouter.post(
  '/templates/:id/restore',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const id = parseTemplateRouteId(req.params.id, 'id');

    await requireTemplateProjectAccess(id, user, true);

    const template = await prisma.iTPTemplate.update({
      where: { id },
      data: { isActive: true },
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' },
        },
      },
    });

    // Transform response
    const transformedTemplate = {
      ...template,
      isActive: template.isActive,
      checklistItems: template.checklistItems.map((item) => ({
        id: item.id,
        description: item.description,
        category: item.responsibleParty || 'general',
        responsibleParty: item.responsibleParty || 'contractor',
        isHoldPoint: item.pointType === 'hold_point',
        pointType: item.pointType || 'standard',
        evidenceRequired: item.evidenceRequired || 'none',
        order: item.sequenceNumber,
        acceptanceCriteria: item.acceptanceCriteria,
      })),
    };

    res.json(buildTemplateRestoredResponse(transformedTemplate));
  }),
);

// Propagate template changes to selected lots
templateLifecycleRouter.post(
  '/templates/:id/propagate',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const id = parseTemplateRouteId(req.params.id, 'id');
    const parseResult = propagateTemplateSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }
    const { instanceIds } = parseResult.data;
    const uniqueInstanceIds = [...new Set(instanceIds)];

    // Get the current template state
    const template = await prisma.iTPTemplate.findUnique({
      where: { id },
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' },
        },
      },
    });

    if (!template) {
      throw AppError.notFound('Template not found');
    }

    if (template.projectId) {
      await requireProjectTemplateAccess(template.projectId, user, true);
    } else {
      throw AppError.forbidden('Global templates cannot be modified from this endpoint');
    }

    // Create new snapshot
    const newSnapshot = {
      id: template.id,
      name: template.name,
      description: template.description,
      activityType: template.activityType,
      checklistItems: template.checklistItems.map((item) => ({
        id: item.id,
        description: item.description,
        sequenceNumber: item.sequenceNumber,
        pointType: item.pointType,
        responsibleParty: item.responsibleParty,
        evidenceRequired: item.evidenceRequired,
        acceptanceCriteria: item.acceptanceCriteria,
        testType: item.testType,
      })),
    };

    const matchingInstances = await prisma.iTPInstance.findMany({
      where: {
        id: { in: uniqueInstanceIds },
        templateId: id,
      },
      select: { id: true },
    });

    if (matchingInstances.length !== uniqueInstanceIds.length) {
      const matchingIds = new Set(matchingInstances.map((instance) => instance.id));
      const missingInstanceIds = uniqueInstanceIds.filter(
        (instanceId) => !matchingIds.has(instanceId),
      );
      throw AppError.badRequest('All selected ITP instances must exist and use this template', {
        missingInstanceIds,
      });
    }

    // Update snapshots for selected instances
    const updateResult = await prisma.iTPInstance.updateMany({
      where: {
        id: { in: uniqueInstanceIds },
        templateId: id,
      },
      data: {
        templateSnapshot: JSON.stringify(newSnapshot),
      },
    });

    res.json(buildTemplatePropagatedResponse(updateResult.count));
  }),
);
