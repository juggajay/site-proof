// Feature #592 trigger - ITP template CRUD and management
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { isSubcontractorPortalRole } from '../../lib/projectAccess.js';

// ============== Zod Schemas ==============

const MAX_TEMPLATE_NAME_LENGTH = 160;
const MAX_TEMPLATE_DESCRIPTION_LENGTH = 1000;
const MAX_CHECKLIST_ITEM_DESCRIPTION_LENGTH = 1000;
const MAX_SHORT_TEXT_LENGTH = 120;
const MAX_CHECKLIST_ITEMS = 500;
const MAX_PROPAGATE_INSTANCES = 500;
const MAX_TEMPLATE_ID_LENGTH = 128;

const requiredText = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .max(maxLength, `${field} must be ${maxLength} characters or less`);

const optionalText = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${field} must be ${maxLength} characters or less`)
    .optional()
    .nullable();

// Checklist item schema (used in template creation/update)
const checklistItemSchema = z.object({
  description: requiredText('description', MAX_CHECKLIST_ITEM_DESCRIPTION_LENGTH),
  pointType: requiredText('pointType', MAX_SHORT_TEXT_LENGTH).optional(),
  isHoldPoint: z.boolean().optional(),
  category: requiredText('category', MAX_SHORT_TEXT_LENGTH).optional(),
  responsibleParty: requiredText('responsibleParty', MAX_SHORT_TEXT_LENGTH).optional(),
  evidenceRequired: requiredText('evidenceRequired', MAX_SHORT_TEXT_LENGTH).optional(),
  acceptanceCriteria: optionalText('acceptanceCriteria', MAX_TEMPLATE_DESCRIPTION_LENGTH),
  testType: optionalText('testType', MAX_SHORT_TEXT_LENGTH),
});

// POST /templates - Create ITP template
const createTemplateSchema = z.object({
  projectId: z.string().max(MAX_TEMPLATE_ID_LENGTH, 'projectId is too long').uuid(),
  name: requiredText('name', MAX_TEMPLATE_NAME_LENGTH),
  description: optionalText('description', MAX_TEMPLATE_DESCRIPTION_LENGTH),
  activityType: requiredText('activityType', MAX_SHORT_TEXT_LENGTH),
  checklistItems: z
    .array(checklistItemSchema)
    .max(MAX_CHECKLIST_ITEMS, `Cannot add more than ${MAX_CHECKLIST_ITEMS} checklist items`)
    .optional(),
});

// POST /templates/:id/clone - Clone template
const cloneTemplateSchema = z.object({
  projectId: z.string().max(MAX_TEMPLATE_ID_LENGTH, 'projectId is too long').uuid().optional(),
  name: requiredText('name', MAX_TEMPLATE_NAME_LENGTH).optional(),
});

// PATCH /templates/:id - Update template
const updateTemplateSchema = z.object({
  name: requiredText('name', MAX_TEMPLATE_NAME_LENGTH).optional(),
  description: optionalText('description', MAX_TEMPLATE_DESCRIPTION_LENGTH),
  activityType: requiredText('activityType', MAX_SHORT_TEXT_LENGTH).optional(),
  checklistItems: z
    .array(checklistItemSchema)
    .max(MAX_CHECKLIST_ITEMS, `Cannot add more than ${MAX_CHECKLIST_ITEMS} checklist items`)
    .optional(),
  isActive: z.boolean().optional(),
});

// POST /templates/:id/propagate - Propagate template changes
const propagateTemplateSchema = z.object({
  instanceIds: z
    .array(z.string().max(MAX_TEMPLATE_ID_LENGTH, 'instanceId is too long').uuid())
    .min(1, 'instanceIds array is required')
    .max(
      MAX_PROPAGATE_INSTANCES,
      `Cannot update more than ${MAX_PROPAGATE_INSTANCES} instances at once`,
    )
    .superRefine((instanceIds, ctx) => {
      const seen = new Set<string>();
      instanceIds.forEach((instanceId, index) => {
        if (seen.has(instanceId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Duplicate instanceIds are not allowed',
            path: [index],
          });
          return;
        }
        seen.add(instanceId);
      });
    }),
});

export const templatesRouter = Router();

type AuthenticatedUser = NonNullable<Request['user']>;

const TEMPLATE_MANAGER_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
];

function isCompanyAdmin(user: AuthenticatedUser): boolean {
  return user.roleInCompany === 'admin' || user.roleInCompany === 'owner';
}

async function requireProjectTemplateAccess(
  projectId: string,
  user: AuthenticatedUser,
  manage = false,
) {
  const isSubcontractor = isSubcontractorPortalRole(user.roleInCompany);
  const [project, projectUser] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, companyId: true, name: true, projectNumber: true },
    }),
    isSubcontractor
      ? null
      : prisma.projectUser.findFirst({
          where: { projectId, userId: user.id, status: 'active' },
          select: { id: true, role: true },
        }),
  ]);

  if (!project) {
    throw AppError.notFound('Project');
  }

  const hasCompanyAdminAccess =
    !isSubcontractor && isCompanyAdmin(user) && project.companyId === user.companyId;
  const hasProjectAccess = Boolean(projectUser) || hasCompanyAdminAccess;

  if (!hasProjectAccess) {
    throw AppError.forbidden('Access denied to this project');
  }

  if (manage) {
    const canManage =
      hasCompanyAdminAccess || TEMPLATE_MANAGER_ROLES.includes(projectUser?.role || '');
    if (!canManage) {
      throw AppError.forbidden(
        'Only project managers or quality managers can manage ITP templates',
      );
    }
  }

  return { project, projectUser };
}

async function getReadableProjects(user: AuthenticatedUser) {
  if (isSubcontractorPortalRole(user.roleInCompany)) {
    return [];
  }

  const userProjects = await prisma.projectUser.findMany({
    where: { userId: user.id, status: 'active' },
    include: {
      project: {
        select: { id: true, name: true, projectNumber: true },
      },
    },
  });

  const projectsById = new Map(userProjects.map((pu) => [pu.project.id, pu.project]));

  if (isCompanyAdmin(user) && user.companyId) {
    const companyProjects = await prisma.project.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true, projectNumber: true },
    });

    for (const project of companyProjects) {
      projectsById.set(project.id, project);
    }
  }

  return Array.from(projectsById.values());
}

async function requireTemplateProjectAccess(
  templateId: string,
  user: AuthenticatedUser,
  manage = false,
) {
  const template = await prisma.iTPTemplate.findUnique({
    where: { id: templateId },
    select: { projectId: true },
  });

  if (!template) {
    throw AppError.notFound('Template not found');
  }

  if (!template.projectId) {
    if (manage) {
      throw AppError.forbidden('Global templates cannot be modified from this endpoint');
    }
    return template;
  }

  await requireProjectTemplateAccess(template.projectId, user, manage);
  return template;
}

function parseRequiredTemplateQueryString(
  value: unknown,
  field: string,
  maxLength = MAX_TEMPLATE_ID_LENGTH,
): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} query parameter must be a single value`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest(`${field} is required`);
  }

  if (normalized.length > maxLength) {
    throw AppError.badRequest(`${field} is too long`);
  }

  return normalized;
}

function parseTemplateRouteId(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a single value`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest(`${field} is required`);
  }

  if (normalized.length > MAX_TEMPLATE_ID_LENGTH) {
    throw AppError.badRequest(`${field} is too long`);
  }

  return normalized;
}

function parseOptionalTemplateBooleanQuery(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} query parameter must be a single value`);
  }

  const normalized = value.trim();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw AppError.badRequest(`${field} must be true or false`);
}

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
      return res.json({ projects: [], templates: [] });
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

    res.json({
      projects: projectsWithTemplates,
      totalTemplates: templates.length,
    });
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

    res.json({
      templates: transformedTemplates,
      projectSpecificationSet: project?.specificationSet || null,
    });
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

    res.json({ template: transformedTemplate });
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

    res.status(201).json({ template: transformedTemplate });
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

    res.status(201).json({ template: transformedTemplate });
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

    res.json({ template: transformedTemplate });
  }),
);

// Get lots using a template (for propagation feature)
templatesRouter.get(
  '/templates/:id/lots',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const id = parseTemplateRouteId(req.params.id, 'id');

    await requireTemplateProjectAccess(id, user);

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

    res.json({ lots: lotsUsingTemplate, total: lotsUsingTemplate.length });
  }),
);

// Delete ITP template with usage validation (Feature #575)
templatesRouter.delete(
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

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  }),
);

// Archive ITP template (soft delete alternative) (Feature #575)
templatesRouter.post(
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

    res.json({
      success: true,
      message:
        'Template archived. It will no longer appear in template selection but existing lots will continue working.',
      template: transformedTemplate,
    });
  }),
);

// Restore archived ITP template (Feature #575)
templatesRouter.post(
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

    res.json({
      success: true,
      message: 'Template restored and is now active.',
      template: transformedTemplate,
    });
  }),
);

// Propagate template changes to selected lots
templatesRouter.post(
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

    res.json({
      success: true,
      updatedCount: updateResult.count,
      message: `Updated ${updateResult.count} lot(s) with latest template`,
    });
  }),
);
