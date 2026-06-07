// Feature #592 trigger - ITP template CRUD and management
import { Router, type Request, type Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  buildCrossProjectTemplatesResponse,
  buildEmptyCrossProjectTemplatesResponse,
  buildTemplateListResponse,
  buildTemplateResponse,
  buildTemplateUsageResponse,
} from './templateResponses.js';
import {
  cloneTemplateSchema,
  createTemplateSchema,
  parseOptionalTemplateBooleanQuery,
  parseRequiredTemplateQueryString,
  parseTemplateRouteId,
  updateTemplateSchema,
} from './templateValidation.js';
import {
  getReadableProjects,
  requireProjectTemplateAccess,
  requireTemplateProjectAccess,
} from './templateAccess.js';
import { assertTemplateItemsReplaceable } from './templateUsage.js';
import { templateLifecycleRouter } from './templateLifecycleRoutes.js';

export const templatesRouter = Router();

// Get ITP templates from other projects (for cross-project import - Feature #682)
templatesRouter.get(
  '/templates/cross-project',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const currentProjectId = parseRequiredTemplateQueryString(
      req.query.currentProjectId,
      'currentProjectId',
    );

    await requireProjectTemplateAccess(currentProjectId, user);

    // Get all projects the user has access to
    const userProjects = await getReadableProjects(user);

    // Get templates from other projects (not the current one and not global templates)
    const otherProjectIds = userProjects
      .filter((project) => project.id !== currentProjectId)
      .map((project) => project.id);

    if (otherProjectIds.length === 0) {
      return res.json(buildEmptyCrossProjectTemplatesResponse());
    }

    // Get templates from other projects
    const templates = await prisma.iTPTemplate.findMany({
      where: {
        projectId: { in: otherProjectIds },
        isActive: true,
      },
      include: {
        project: {
          select: { id: true, name: true, projectNumber: true },
        },
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group templates by project
    const projectsWithTemplates = userProjects
      .filter((project) => project.id !== currentProjectId)
      .map((project) => ({
        id: project.id,
        name: project.name,
        code: project.projectNumber,
        templates: templates
          .filter((t) => t.projectId === project.id)
          .map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            activityType: t.activityType,
            checklistItemCount: t.checklistItems.length,
            holdPointCount: t.checklistItems.filter((item) => item.pointType === 'hold_point')
              .length,
          })),
      }))
      .filter((p) => p.templates.length > 0);

    res.json(buildCrossProjectTemplatesResponse(projectsWithTemplates, templates.length));
  }),
);

// Get ITP templates for a project
templatesRouter.get(
  '/templates',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const projectId = parseRequiredTemplateQueryString(req.query.projectId, 'projectId');
    const includeGlobal =
      parseOptionalTemplateBooleanQuery(req.query.includeGlobal, 'includeGlobal') ?? false;

    await requireProjectTemplateAccess(projectId, user);

    // Get the project's specification set
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { specificationSet: true },
    });

    // Build the query - include project templates and optionally global templates matching spec
    const whereClause =
      includeGlobal && project?.specificationSet
        ? {
            OR: [
              { projectId },
              {
                projectId: null,
                stateSpec: project.specificationSet,
              },
            ],
          }
        : { projectId };

    const templates = await prisma.iTPTemplate.findMany({
      where: whereClause,
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to frontend-friendly format
    const transformedTemplates = templates.map((t) => ({
      ...t,
      isGlobalTemplate: t.projectId === null,
      isActive: t.isActive,
      stateSpec: t.stateSpec,
      checklistItems: t.checklistItems.map((item) => ({
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
    }));

    res.json(buildTemplateListResponse(transformedTemplates, project?.specificationSet || null));
  }),
);

// Get single ITP template
templatesRouter.get(
  '/templates/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const id = parseTemplateRouteId(req.params.id, 'id');

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
      await requireProjectTemplateAccess(template.projectId, user);
    }

    // Transform to frontend-friendly format
    const transformedTemplate = {
      ...template,
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

    res.json(buildTemplateResponse(transformedTemplate));
  }),
);

// Create ITP template
templatesRouter.post(
  '/templates',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const parseResult = createTemplateSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }
    const { projectId, name, description, activityType, checklistItems } = parseResult.data;

    await requireProjectTemplateAccess(projectId, user, true);

    const template = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name,
        description: description || null,
        activityType,
        checklistItems: {
          create: (checklistItems || []).map((item, index: number) => ({
            description: item.description,
            sequenceNumber: index + 1,
            pointType: item.pointType || (item.isHoldPoint ? 'hold_point' : 'standard'),
            responsibleParty: item.responsibleParty || item.category || 'contractor',
            evidenceRequired: item.evidenceRequired || 'none',
            acceptanceCriteria: item.acceptanceCriteria || null,
            testType: item.testType || null,
          })),
        },
      },
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' },
        },
      },
    });

    // Transform to frontend-friendly format
    const transformedTemplate = {
      ...template,
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

    res.status(201).json(buildTemplateResponse(transformedTemplate));
  }),
);

// Clone ITP template
templatesRouter.post(
  '/templates/:id/clone',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const id = parseTemplateRouteId(req.params.id, 'id');
    const parseResult = cloneTemplateSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }
    const { projectId, name } = parseResult.data;

    // Get the source template with all checklist items
    const sourceTemplate = await prisma.iTPTemplate.findUnique({
      where: { id },
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' },
        },
      },
    });

    if (!sourceTemplate) {
      throw AppError.notFound('Template not found');
    }

    if (sourceTemplate.projectId) {
      await requireProjectTemplateAccess(sourceTemplate.projectId, user);
    }

    const targetProjectId = projectId || sourceTemplate.projectId;
    if (!targetProjectId) {
      throw AppError.badRequest('projectId is required when cloning a global template');
    }

    await requireProjectTemplateAccess(targetProjectId, user, true);

    // Create the cloned template
    const clonedTemplate = await prisma.iTPTemplate.create({
      data: {
        projectId: targetProjectId,
        name: name || `${sourceTemplate.name} (Copy)`,
        description: sourceTemplate.description,
        activityType: sourceTemplate.activityType,
        specificationReference: sourceTemplate.specificationReference,
        stateSpec: sourceTemplate.stateSpec,
        isActive: true,
        checklistItems: {
          create: sourceTemplate.checklistItems.map((item, index) => ({
            description: item.description,
            sequenceNumber: index + 1,
            pointType: item.pointType,
            responsibleParty: item.responsibleParty,
            evidenceRequired: item.evidenceRequired,
            acceptanceCriteria: item.acceptanceCriteria,
            testType: item.testType,
          })),
        },
      },
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' },
        },
      },
    });

    // Transform response
    const transformedTemplate = {
      ...clonedTemplate,
      isActive: clonedTemplate.isActive,
      checklistItems: clonedTemplate.checklistItems.map((item) => ({
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

    res.status(201).json(buildTemplateResponse(transformedTemplate));
  }),
);

// Update ITP template
templatesRouter.patch(
  '/templates/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const id = parseTemplateRouteId(req.params.id, 'id');
    const parseResult = updateTemplateSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }
    const { name, description, activityType, checklistItems, isActive } = parseResult.data;

    await requireTemplateProjectAccess(id, user, true);

    // Replacing checklist items deletes and re-creates them. Sign-off records reference
    // those items with onDelete: Restrict, so if any have been signed off the delete is
    // rejected and the whole transaction aborts with an opaque 500. Refuse up-front with a
    // clear 409 instead. Metadata-only edits (no checklistItems) are always allowed, even
    // for in-use templates.
    if (checklistItems !== undefined) {
      await assertTemplateItemsReplaceable(prisma, id);
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (activityType !== undefined) updateData.activityType = activityType;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (checklistItems !== undefined) {
      updateData.checklistItems = {
        create: checklistItems.map((item, index: number) => ({
          description: item.description,
          sequenceNumber: index + 1,
          pointType: item.pointType || 'standard',
          responsibleParty: item.responsibleParty || item.category || 'contractor',
          evidenceRequired: item.evidenceRequired || 'none',
          acceptanceCriteria: item.acceptanceCriteria || null,
          testType: item.testType || null,
        })),
      };
    }

    const template = await prisma.$transaction(async (tx) => {
      // Replace checklist items atomically so validation/database failures cannot leave a template empty.
      if (checklistItems !== undefined) {
        await tx.iTPChecklistItem.deleteMany({
          where: { templateId: id },
        });
      }

      return tx.iTPTemplate.update({
        where: { id },
        data: updateData,
        include: {
          checklistItems: {
            orderBy: { sequenceNumber: 'asc' },
          },
        },
      });
    });

    // Transform to frontend-friendly format
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

    res.json(buildTemplateResponse(transformedTemplate));
  }),
);

// Get lots using a template (for propagation feature)
templatesRouter.get(
  '/templates/:id/lots',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const id = parseTemplateRouteId(req.params.id, 'id');

    const template = await requireTemplateProjectAccess(id, user);
    if (!template.projectId) {
      throw AppError.forbidden('Global template lot usage requires a project-scoped template');
    }

    const instances = await prisma.iTPInstance.findMany({
      where: { templateId: id, lot: { projectId: template.projectId } },
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
    });

    // Filter to in-progress lots (not completed)
    const lotsUsingTemplate = instances
      .filter((inst) => inst.lot.status !== 'conformed')
      .map((inst) => ({
        instanceId: inst.id,
        lotId: inst.lot.id,
        lotNumber: inst.lot.lotNumber,
        description: inst.lot.description,
        status: inst.lot.status,
        hasSnapshot: !!inst.templateSnapshot,
      }));

    res.json(buildTemplateUsageResponse(lotsUsingTemplate));
  }),
);

templatesRouter.use(templateLifecycleRouter);
