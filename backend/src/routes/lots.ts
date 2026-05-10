import { Router, type Request } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { checkConformancePrerequisites } from '../lib/conformancePrerequisites.js';
import {
  activeSubcontractorCompanyWhere,
  checkProjectAccess,
  requireSubcontractorPortalModuleAccess,
  type SubcontractorPortalAccessKey,
} from '../lib/projectAccess.js';
import { getPaginationMeta, getPrismaSkipTake } from '../lib/pagination.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';

// ============================================================================
// Zod Validation Schemas
// ============================================================================

// Valid lot statuses
const validStatuses = [
  'not_started',
  'in_progress',
  'awaiting_test',
  'hold_point',
  'ncr_raised',
  'completed',
] as const;

const terminalStatuses = ['conformed', 'claimed'] as const;
const queryableStatuses = [...validStatuses, ...terminalStatuses] as const;

// Valid lot types
const validLotTypes = ['chainage', 'area', 'structure'] as const;

const lotSortFields = [
  'lotNumber',
  'status',
  'activityType',
  'chainageStart',
  'chainageEnd',
  'createdAt',
  'updatedAt',
] as const;
const LOT_PORTAL_MODULES = new Set<SubcontractorPortalAccessKey>(['lots', 'itps']);

const MAX_ID_LENGTH = 120;
const MAX_LOT_NUMBER_LENGTH = 100;
const MAX_SHORT_TEXT_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_BULK_LOTS = 500;
const MAX_SEARCH_LENGTH = 200;

const requiredIdSchema = (field: string) =>
  z.string().trim().min(1, `${field} is required`).max(MAX_ID_LENGTH, `${field} is too long`);

const requiredTextSchema = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .max(maxLength, `${field} must be ${maxLength} characters or less`);

const optionalNullableTextSchema = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${field} must be ${maxLength} characters or less`)
    .optional()
    .nullable();

const finiteNumberSchema = (field: string) =>
  z.number({ invalid_type_error: `${field} must be a number` }).finite(`${field} must be finite`);

function validateChainageRange(
  chainageStart: number | null | undefined,
  chainageEnd: number | null | undefined,
  addIssue: (message: string, path: (string | number)[]) => void,
) {
  if (
    chainageStart !== null &&
    chainageStart !== undefined &&
    chainageEnd !== null &&
    chainageEnd !== undefined &&
    chainageStart > chainageEnd
  ) {
    addIssue('chainageStart must be less than or equal to chainageEnd', ['chainageStart']);
  }
}

function addDuplicateIssues(
  values: string[],
  addIssue: (message: string, path: (string | number)[]) => void,
  field: string,
) {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      addIssue(`Duplicate ${field} values are not allowed`, [index]);
      return;
    }
    seen.add(value);
  });
}

const lotIdArraySchema = z
  .array(requiredIdSchema('lotId'))
  .min(1, 'lotIds array is required and must not be empty')
  .max(MAX_BULK_LOTS, `Cannot operate on more than ${MAX_BULK_LOTS} lots at once`)
  .superRefine((lotIds, ctx) => {
    addDuplicateIssues(
      lotIds,
      (message, path) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path }),
      'lotId',
    );
  });

// Schema for creating a lot
const createLotSchema = z
  .object({
    projectId: requiredIdSchema('projectId'),
    lotNumber: requiredTextSchema('lotNumber', MAX_LOT_NUMBER_LENGTH),
    description: optionalNullableTextSchema('description', MAX_DESCRIPTION_LENGTH),
    activityType: requiredTextSchema('activityType', MAX_SHORT_TEXT_LENGTH).optional(),
    chainageStart: finiteNumberSchema('chainageStart').optional().nullable(),
    chainageEnd: finiteNumberSchema('chainageEnd').optional().nullable(),
    lotType: z.enum(validLotTypes).optional(),
    itpTemplateId: requiredIdSchema('itpTemplateId').optional().nullable(),
    assignedSubcontractorId: requiredIdSchema('assignedSubcontractorId').optional().nullable(),
    areaZone: optionalNullableTextSchema('areaZone', MAX_SHORT_TEXT_LENGTH),
    structureId: optionalNullableTextSchema('structureId', MAX_SHORT_TEXT_LENGTH),
    structureElement: optionalNullableTextSchema('structureElement', MAX_SHORT_TEXT_LENGTH),
    canCompleteITP: z.boolean().optional(),
    itpRequiresVerification: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    validateChainageRange(data.chainageStart, data.chainageEnd, (message, path) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
    });
  });

// Schema for bulk creating lots
const bulkCreateLotsSchema = z
  .object({
    projectId: requiredIdSchema('projectId'),
    lots: z
      .array(
        z
          .object({
            lotNumber: requiredTextSchema('lotNumber', MAX_LOT_NUMBER_LENGTH),
            description: optionalNullableTextSchema('description', MAX_DESCRIPTION_LENGTH),
            activityType: optionalNullableTextSchema('activityType', MAX_SHORT_TEXT_LENGTH),
            lotType: z.enum(validLotTypes).optional(),
            chainageStart: finiteNumberSchema('chainageStart').optional().nullable(),
            chainageEnd: finiteNumberSchema('chainageEnd').optional().nullable(),
            layer: optionalNullableTextSchema('layer', MAX_SHORT_TEXT_LENGTH),
          })
          .superRefine((data, ctx) => {
            validateChainageRange(data.chainageStart, data.chainageEnd, (message, path) => {
              ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
            });
          }),
      )
      .min(1, 'lots array is required and must not be empty')
      .max(MAX_BULK_LOTS, `Cannot create more than ${MAX_BULK_LOTS} lots at once`),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.lots.forEach((lot, index) => {
      if (seen.has(lot.lotNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate lotNumber values are not allowed',
          path: ['lots', index, 'lotNumber'],
        });
        return;
      }
      seen.add(lot.lotNumber);
    });
  });

// Schema for cloning a lot
const cloneLotSchema = z
  .object({
    lotNumber: requiredTextSchema('lotNumber', MAX_LOT_NUMBER_LENGTH).optional(),
    chainageStart: finiteNumberSchema('chainageStart').optional().nullable(),
    chainageEnd: finiteNumberSchema('chainageEnd').optional().nullable(),
  })
  .superRefine((data, ctx) => {
    validateChainageRange(data.chainageStart, data.chainageEnd, (message, path) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
    });
  });

// Schema for updating a lot
const updateLotSchema = z
  .object({
    lotNumber: requiredTextSchema('lotNumber', MAX_LOT_NUMBER_LENGTH).optional(),
    description: optionalNullableTextSchema('description', MAX_DESCRIPTION_LENGTH),
    activityType: requiredTextSchema('activityType', MAX_SHORT_TEXT_LENGTH).optional(),
    chainageStart: finiteNumberSchema('chainageStart').optional().nullable(),
    chainageEnd: finiteNumberSchema('chainageEnd').optional().nullable(),
    offset: optionalNullableTextSchema('offset', MAX_SHORT_TEXT_LENGTH),
    offsetCustom: optionalNullableTextSchema('offsetCustom', MAX_SHORT_TEXT_LENGTH),
    layer: optionalNullableTextSchema('layer', MAX_SHORT_TEXT_LENGTH),
    areaZone: optionalNullableTextSchema('areaZone', MAX_SHORT_TEXT_LENGTH),
    lotType: z.enum(validLotTypes).optional(),
    structureId: optionalNullableTextSchema('structureId', MAX_SHORT_TEXT_LENGTH),
    structureElement: optionalNullableTextSchema('structureElement', MAX_SHORT_TEXT_LENGTH),
    status: z
      .enum(validStatuses, {
        errorMap: () => ({ message: `status must be one of: ${validStatuses.join(', ')}` }),
      })
      .optional(),
    budgetAmount: finiteNumberSchema('budgetAmount')
      .nonnegative('budgetAmount cannot be negative')
      .optional()
      .nullable(),
    assignedSubcontractorId: requiredIdSchema('assignedSubcontractorId').optional().nullable(),
    expectedUpdatedAt: z.string().optional(), // For optimistic locking
  })
  .superRefine((data, ctx) => {
    validateChainageRange(data.chainageStart, data.chainageEnd, (message, path) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
    });
  });

// Schema for bulk delete
const bulkDeleteSchema = z.object({
  lotIds: lotIdArraySchema,
});

// Schema for bulk update status
const bulkUpdateStatusSchema = z.object({
  lotIds: lotIdArraySchema,
  status: z.enum(validStatuses, {
    errorMap: () => ({ message: `status must be one of: ${validStatuses.join(', ')}` }),
  }),
});

// Schema for bulk assign subcontractor
const bulkAssignSubcontractorSchema = z.object({
  lotIds: lotIdArraySchema,
  subcontractorId: requiredIdSchema('subcontractorId').nullable().optional(),
});

// Schema for assigning subcontractor to lot
const assignSubcontractorSchema = z.object({
  subcontractorId: requiredIdSchema('subcontractorId').nullable().optional(),
});

// Schema for conforming a lot
const conformLotSchema = z.object({
  force: z.boolean().optional(),
});

// Schema for overriding status
const overrideStatusSchema = z.object({
  status: z.enum(validStatuses, {
    errorMap: () => ({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }),
  }),
  reason: requiredTextSchema('reason', 1000).min(5, 'Reason must be at least 5 characters'),
});

// Schema for creating subcontractor assignment
const createSubcontractorAssignmentSchema = z.object({
  subcontractorCompanyId: requiredIdSchema('subcontractorCompanyId'),
  canCompleteITP: z.boolean().optional(),
  itpRequiresVerification: z.boolean().optional(),
});

// Schema for updating subcontractor assignment
const updateSubcontractorAssignmentSchema = z.object({
  canCompleteITP: z.boolean().optional(),
  itpRequiresVerification: z.boolean().optional(),
});

export const lotsRouter = Router();

// Apply authentication middleware to all lot routes
lotsRouter.use(requireAuth);

// Roles that can create lots
const LOT_CREATORS = ['owner', 'admin', 'project_manager', 'site_manager', 'foreman'];
// Roles that can delete lots
const LOT_DELETERS = ['owner', 'admin', 'project_manager'];
// Roles that can conform lots (quality management)
const LOT_CONFORMERS = ['owner', 'admin', 'project_manager', 'quality_manager'];
const SUBCONTRACTOR_ROLES = ['subcontractor', 'subcontractor_admin'];

type AuthenticatedUser = NonNullable<Request['user']>;

function isCompanyAdmin(user: AuthenticatedUser): boolean {
  return user.roleInCompany === 'admin' || user.roleInCompany === 'owner';
}

function isSubcontractorUser(user: AuthenticatedUser): boolean {
  return SUBCONTRACTOR_ROLES.includes(user.roleInCompany || '');
}

async function getEffectiveProjectRole(
  projectId: string,
  user: AuthenticatedUser,
): Promise<string | null> {
  const isSubcontractor = isSubcontractorUser(user);
  const [project, projectUser] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, companyId: true },
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

async function requireProjectRole(
  projectId: string,
  user: AuthenticatedUser,
  allowedRoles: string[],
  message: string,
): Promise<string> {
  const role = await getEffectiveProjectRole(projectId, user);

  if (!role || !allowedRoles.includes(role)) {
    throw AppError.forbidden(message);
  }

  return role;
}

async function getProjectSubcontractorCompanyId(
  userId: string,
  projectId: string,
): Promise<string | null> {
  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: { subcontractorCompanyId: true },
  });

  return subcontractorUser?.subcontractorCompanyId ?? null;
}

async function hasAssignedSubcontractorLotAccess(
  user: AuthenticatedUser,
  projectId: string,
  lotId: string,
): Promise<boolean> {
  if (!isSubcontractorUser(user)) {
    return true;
  }

  const subcontractorCompanyId = await getProjectSubcontractorCompanyId(user.id, projectId);
  if (!subcontractorCompanyId) {
    return false;
  }

  const [assignment, legacyLot] = await Promise.all([
    prisma.lotSubcontractorAssignment.findFirst({
      where: {
        projectId,
        lotId,
        subcontractorCompanyId,
        status: 'active',
      },
      select: { id: true },
    }),
    prisma.lot.findFirst({
      where: {
        id: lotId,
        projectId,
        assignedSubcontractorId: subcontractorCompanyId,
      },
      select: { id: true },
    }),
  ]);

  return Boolean(assignment || legacyLot);
}

async function requireLotReadAccess(
  lot: { id: string; projectId: string },
  user: AuthenticatedUser,
  message = 'You do not have access to this lot',
): Promise<void> {
  if (isSubcontractorUser(user)) {
    if (!(await hasAssignedSubcontractorLotAccess(user, lot.projectId, lot.id))) {
      throw AppError.forbidden(message);
    }
    return;
  }

  const role = await getEffectiveProjectRole(lot.projectId, user);
  if (!role) {
    throw AppError.forbidden(message);
  }
}

async function requireSubcontractorInProject(subcontractorId: string, projectId: string) {
  const subcontractor = await prisma.subcontractorCompany.findFirst({
    where: activeSubcontractorCompanyWhere({ id: subcontractorId, projectId }),
    select: { id: true },
  });

  if (!subcontractor) {
    throw AppError.notFound('Subcontractor company');
  }
}

async function requireItpTemplateForProject(templateId: string, projectId: string) {
  const template = await prisma.iTPTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, projectId: true, isActive: true },
  });

  if (!template) {
    throw AppError.notFound('ITP template');
  }

  if (!template.isActive) {
    throw AppError.badRequest('ITP template is archived and cannot be assigned');
  }

  if (template.projectId && template.projectId !== projectId) {
    throw AppError.badRequest('ITP template is not available for this project');
  }
}

function getRequiredQueryString(query: Request['query'], key: string, maxLength?: number): string {
  const value = query[key];
  if (value === undefined) {
    throw AppError.badRequest(`${key} query parameter is required`);
  }
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${key} query parameter must be a single value`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${key} query parameter is required`);
  }
  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw AppError.badRequest(`${key} query parameter is too long`);
  }
  return trimmed;
}

function getOptionalQueryString(query: Request['query'], key: string): string | undefined {
  const value = query[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${key} query parameter must be a single value`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${key} query parameter must not be empty`);
  }
  return trimmed;
}

function getOptionalBoundedQueryString(
  query: Request['query'],
  key: string,
  maxLength: number,
): string | undefined {
  const value = getOptionalQueryString(query, key);
  if (value === undefined) {
    return undefined;
  }
  if (value.length > maxLength) {
    throw AppError.badRequest(`${key} query parameter must be ${maxLength} characters or less`);
  }
  return value;
}

function parseLotRouteParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > MAX_ID_LENGTH) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

function getOptionalLotPortalModule(
  query: Request['query'],
): SubcontractorPortalAccessKey | undefined {
  const portalModule = getOptionalQueryString(query, 'portalModule');
  if (portalModule === undefined) {
    return undefined;
  }

  if (!LOT_PORTAL_MODULES.has(portalModule as SubcontractorPortalAccessKey)) {
    throw AppError.badRequest('portalModule must be one of: lots, itps');
  }

  return portalModule as SubcontractorPortalAccessKey;
}

function parsePositiveIntQuery(
  query: Request['query'],
  key: string,
  defaultValue: number,
  max?: number,
): number {
  const value = getOptionalQueryString(query, key);
  if (value === undefined) {
    return defaultValue;
  }
  if (!/^\d+$/.test(value)) {
    throw AppError.badRequest(`${key} must be a positive integer`);
  }
  const parsed = Number(value);
  if (parsed < 1 || !Number.isSafeInteger(parsed)) {
    throw AppError.badRequest(`${key} must be a positive integer`);
  }
  if (max !== undefined && parsed > max) {
    throw AppError.badRequest(`${key} must be less than or equal to ${max}`);
  }
  return parsed;
}

function parseLotStatusFilter(status: string): Prisma.StringFilter | string | undefined {
  const statuses = status
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (statuses.length === 0) {
    throw AppError.badRequest('status query parameter must not be empty');
  }

  const invalidStatuses = statuses.filter(
    (value) => !queryableStatuses.includes(value as (typeof queryableStatuses)[number]),
  );
  if (invalidStatuses.length > 0) {
    throw AppError.badRequest(`status must be one of: ${queryableStatuses.join(', ')}`);
  }

  const uniqueStatuses = [...new Set(statuses)];
  return uniqueStatuses.length === 1 ? uniqueStatuses[0] : { in: uniqueStatuses };
}

function getUniqueLotIds(lotIds: string[]): string[] {
  return [...new Set(lotIds)];
}

function assertAllRequestedLotsFound(requestedLotIds: string[], foundLots: Array<{ id: string }>) {
  const foundIds = new Set(foundLots.map((lot) => lot.id));
  const missingLotIds = requestedLotIds.filter((id) => !foundIds.has(id));
  if (missingLotIds.length > 0) {
    throw AppError.badRequest('One or more selected lots were not found', { missingLotIds });
  }
}

async function syncPrimaryLotSubcontractorAssignment(
  tx: Prisma.TransactionClient,
  options: {
    lotId: string;
    projectId: string;
    subcontractorId: string | null | undefined;
    assignedById: string;
    canCompleteITP?: boolean;
    itpRequiresVerification?: boolean;
  },
) {
  const {
    lotId,
    projectId,
    subcontractorId,
    assignedById,
    canCompleteITP,
    itpRequiresVerification,
  } = options;

  await tx.lotSubcontractorAssignment.updateMany({
    where: {
      lotId,
      status: 'active',
      ...(subcontractorId ? { subcontractorCompanyId: { not: subcontractorId } } : {}),
    },
    data: { status: 'removed' },
  });

  if (!subcontractorId) {
    return;
  }

  await tx.lotSubcontractorAssignment.upsert({
    where: {
      lotId_subcontractorCompanyId: {
        lotId,
        subcontractorCompanyId: subcontractorId,
      },
    },
    update: {
      projectId,
      status: 'active',
      assignedById,
      assignedAt: new Date(),
      ...(canCompleteITP !== undefined ? { canCompleteITP } : {}),
      ...(itpRequiresVerification !== undefined ? { itpRequiresVerification } : {}),
    },
    create: {
      lotId,
      projectId,
      subcontractorCompanyId: subcontractorId,
      canCompleteITP: canCompleteITP ?? false,
      itpRequiresVerification: itpRequiresVerification ?? true,
      assignedById,
      status: 'active',
    },
  });
}

// GET /api/lots - List all lots for a project (paginated)
lotsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const projectId = getRequiredQueryString(req.query, 'projectId', MAX_ID_LENGTH);
    const status = getOptionalQueryString(req.query, 'status');
    const unclaimed = getOptionalQueryString(req.query, 'unclaimed');
    const includeITP = getOptionalQueryString(req.query, 'includeITP');
    const portalModule = getOptionalLotPortalModule(req.query);
    const sortBy = getOptionalQueryString(req.query, 'sortBy');
    const sortOrderParam = getOptionalQueryString(req.query, 'sortOrder');
    const search = getOptionalBoundedQueryString(req.query, 'search', MAX_SEARCH_LENGTH);

    if (unclaimed !== undefined && unclaimed !== 'true' && unclaimed !== 'false') {
      throw AppError.badRequest('unclaimed must be true or false');
    }

    if (includeITP !== undefined && includeITP !== 'true' && includeITP !== 'false') {
      throw AppError.badRequest('includeITP must be true or false');
    }

    if (sortBy !== undefined && !lotSortFields.includes(sortBy as (typeof lotSortFields)[number])) {
      throw AppError.badRequest(`sortBy must be one of: ${lotSortFields.join(', ')}`);
    }

    if (sortOrderParam !== undefined && sortOrderParam !== 'asc' && sortOrderParam !== 'desc') {
      throw AppError.badRequest('sortOrder must be asc or desc');
    }
    const sortOrder: Prisma.SortOrder = sortOrderParam ?? 'desc';

    // Parse pagination parameters
    const page = parsePositiveIntQuery(req.query, 'page', 1);
    const limit = parsePositiveIntQuery(req.query, 'limit', 20, 100);
    const { skip, take } = getPrismaSkipTake(page, limit);

    // Build where clause based on user role
    const whereClause: Prisma.LotWhereInput = { projectId };

    const hasProjectAccess = await checkProjectAccess(user.id, projectId);
    if (!hasProjectAccess) {
      throw AppError.forbidden('Access denied');
    }

    const moduleToEnforce = portalModule ?? (includeITP === 'true' ? 'itps' : undefined);
    if (moduleToEnforce) {
      await requireSubcontractorPortalModuleAccess({
        userId: user.id,
        role: user.roleInCompany,
        projectId,
        module: moduleToEnforce,
      });
    }

    // Filter by status if provided
    if (status) {
      whereClause.status = parseLotStatusFilter(status);
    }

    // Filter for unclaimed lots (no claimedInId)
    if (unclaimed === 'true') {
      whereClause.claimedInId = null;
    }

    // Subcontractors can only see lots assigned to their company
    if (user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin') {
      // Find the user's subcontractor company for this project
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: {
          userId: user.id,
          subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
        },
        include: { subcontractorCompany: true },
      });

      if (subcontractorUser) {
        const subCompanyId = subcontractorUser.subcontractorCompanyId;

        // Get lots assigned via LotSubcontractorAssignment (new model)
        const lotAssignments = await prisma.lotSubcontractorAssignment.findMany({
          where: {
            subcontractorCompanyId: subCompanyId,
            status: 'active',
            projectId,
          },
          select: { lotId: true },
        });
        const assignedLotIds = lotAssignments.map((a) => a.lotId);

        // Include lots from both legacy field AND new assignment model
        whereClause.OR = [
          { assignedSubcontractorId: subCompanyId },
          ...(assignedLotIds.length > 0 ? [{ id: { in: assignedLotIds } }] : []),
        ];
      } else {
        // No subcontractor company found - return empty result with pagination
        return res.json({
          data: [],
          pagination: getPaginationMeta(0, page, limit),
          // Backward compatibility - keep 'lots' alias during transition
          lots: [],
        });
      }
    }

    const finalWhereClause: Prisma.LotWhereInput = search
      ? {
          AND: [
            whereClause,
            {
              OR: [
                { lotNumber: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { activityType: { contains: search, mode: 'insensitive' } },
                { areaZone: { contains: search, mode: 'insensitive' } },
                { structureId: { contains: search, mode: 'insensitive' } },
                { structureElement: { contains: search, mode: 'insensitive' } },
              ],
            },
          ],
        }
      : whereClause;

    // Build select clause - conditionally include ITP data
    const selectClause: Prisma.LotSelect = {
      id: true,
      lotNumber: true,
      description: true,
      status: true,
      activityType: true,
      chainageStart: true,
      chainageEnd: true,
      offset: true,
      offsetCustom: true,
      layer: true,
      areaZone: true,
      budgetAmount: true,
      assignedSubcontractorId: true,
      assignedSubcontractor: {
        select: {
          companyName: true,
        },
      },
      // Include subcontractor assignments with ITP permissions
      subcontractorAssignments: {
        where: { status: 'active' },
        select: {
          id: true,
          subcontractorCompanyId: true,
          canCompleteITP: true,
          itpRequiresVerification: true,
          subcontractorCompany: {
            select: { id: true, companyName: true },
          },
        },
      },
      createdAt: true,
    };

    // Include ITP instance data if requested
    if (includeITP === 'true') {
      selectClause.itpInstance = {
        select: {
          id: true,
          templateId: true,
          status: true,
          template: {
            select: {
              id: true,
              name: true,
              activityType: true,
            },
          },
        },
      };
    }

    // Determine sort field - default to lotNumber for lots
    const orderBy = sortBy ? { [sortBy]: sortOrder } : { lotNumber: 'asc' as const };

    // Execute count and findMany in parallel for efficiency
    const [lots, total] = await Promise.all([
      prisma.lot.findMany({
        where: finalWhereClause,
        select: selectClause,
        orderBy,
        skip,
        take,
      }),
      prisma.lot.count({ where: finalWhereClause }),
    ]);

    // Transform response to match frontend expectations
    // Frontend expects itpInstances array, but we have singular itpInstance
    const transformedLots =
      includeITP === 'true'
        ? lots.map((lot) => ({
            ...lot,
            itpInstances: lot.itpInstance ? [lot.itpInstance] : [],
          }))
        : lots;

    res.json({
      data: transformedLots,
      pagination: getPaginationMeta(total, page, limit),
      // Backward compatibility - keep 'lots' alias during transition
      lots: transformedLots,
    });
  }),
);

// GET /api/lots/suggest-number - Get suggested next lot number for a project
lotsRouter.get(
  '/suggest-number',
  asyncHandler(async (req, res) => {
    const projectId = getRequiredQueryString(req.query, 'projectId', MAX_ID_LENGTH);
    const user = req.user!;

    await requireProjectRole(
      projectId,
      user,
      LOT_CREATORS,
      'You do not have permission to create lots in this project.',
    );

    // Get project settings
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        lotPrefix: true,
        lotStartingNumber: true,
      },
    });

    if (!project) {
      throw AppError.notFound('Project');
    }

    const prefix = project.lotPrefix || 'LOT-';
    const startingNumber = project.lotStartingNumber || 1;

    // Find the highest existing lot number with this prefix
    const existingLots = await prisma.lot.findMany({
      where: {
        projectId,
        lotNumber: { startsWith: prefix },
      },
      select: { lotNumber: true },
      orderBy: { lotNumber: 'desc' },
    });

    let nextNumber = startingNumber;

    if (existingLots.length > 0) {
      // Extract numbers from existing lot numbers and find the highest
      const numbers = existingLots
        .map((lot) => {
          const match = lot.lotNumber.match(
            new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)`),
          );
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => !isNaN(n) && n > 0);

      if (numbers.length > 0) {
        nextNumber = Math.max(...numbers) + 1;
      }
    }

    // Pad with zeros to match the starting number format
    const paddingLength = Math.max(String(startingNumber).length, String(nextNumber).length, 3);
    const suggestedNumber = `${prefix}${String(nextNumber).padStart(paddingLength, '0')}`;

    res.json({
      suggestedNumber,
      prefix,
      nextNumber,
      startingNumber,
    });
  }),
);

// GET /api/lots/:id - Get a single lot
lotsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;
    const portalModule = getOptionalLotPortalModule(req.query);

    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        lotNumber: true,
        description: true,
        status: true,
        activityType: true,
        chainageStart: true,
        chainageEnd: true,
        offset: true,
        offsetCustom: true,
        layer: true,
        areaZone: true,
        projectId: true,
        assignedSubcontractorId: true,
        assignedSubcontractor: {
          select: {
            id: true,
            companyName: true,
          },
        },
        // Include subcontractor assignments with ITP permissions
        subcontractorAssignments: {
          where: { status: 'active' },
          select: {
            id: true,
            subcontractorCompanyId: true,
            canCompleteITP: true,
            itpRequiresVerification: true,
            subcontractorCompany: {
              select: { id: true, companyName: true },
            },
          },
        },
        createdAt: true,
        updatedAt: true,
        conformedAt: true,
        conformedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        _count: {
          select: {
            testResults: true,
            ncrLots: true,
            documents: true,
          },
        },
        itpInstance: {
          select: { id: true },
        },
      },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireLotReadAccess(lot, user);
    if (portalModule) {
      await requireSubcontractorPortalModuleAccess({
        userId: user.id,
        role: user.roleInCompany,
        projectId: lot.projectId,
        module: portalModule,
      });
    }

    // Remove sensitive fields before sending response
    const {
      projectId: _projectId,
      assignedSubcontractorId: _assignedSubcontractorId,
      ...lotResponse
    } = lot;

    if (isSubcontractorUser(user)) {
      const subcontractorCompanyId = await getProjectSubcontractorCompanyId(user.id, lot.projectId);
      lotResponse.subcontractorAssignments = lotResponse.subcontractorAssignments.filter(
        (assignment) => assignment.subcontractorCompanyId === subcontractorCompanyId,
      );
      if (lot.assignedSubcontractorId !== subcontractorCompanyId) {
        lotResponse.assignedSubcontractor = null;
      }
    }

    res.json({ lot: lotResponse });
  }),
);

// POST /api/lots - Create a new lot (requires creator role in project)
lotsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Validate request body
    const validation = createLotSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const {
      projectId,
      lotNumber,
      description,
      activityType,
      chainageStart,
      chainageEnd,
      lotType,
      itpTemplateId,
      assignedSubcontractorId,
      areaZone,
      structureId,
      structureElement,
      canCompleteITP,
      itpRequiresVerification,
    } = validation.data;

    // Feature #853: Area zone required for area lot type
    if (lotType === 'area' && !areaZone) {
      throw AppError.badRequest('Area zone is required for area lot type', {
        code: 'AREA_ZONE_REQUIRED',
      });
    }

    // Feature #854: Structure ID required for structure lot type
    if (lotType === 'structure' && !structureId) {
      throw AppError.badRequest('Structure ID is required for structure lot type', {
        code: 'STRUCTURE_ID_REQUIRED',
      });
    }

    await requireProjectRole(
      projectId,
      user,
      LOT_CREATORS,
      'You do not have permission to create lots in this project.',
    );

    if (itpTemplateId) {
      await requireItpTemplateForProject(itpTemplateId, projectId);
    }

    if (assignedSubcontractorId) {
      await requireSubcontractorInProject(assignedSubcontractorId, projectId);
    }

    const lot = await prisma.$transaction(async (tx) => {
      const createdLot = await tx.lot.create({
        data: {
          projectId,
          lotNumber,
          description: description || null,
          activityType: activityType || 'Earthworks',
          lotType: lotType || 'chainage',
          chainageStart,
          chainageEnd,
          itpTemplateId: itpTemplateId || null,
          assignedSubcontractorId: assignedSubcontractorId || null,
          areaZone: areaZone || null,
          structureId: structureId || null, // Feature #854
          structureElement: structureElement || null, // Feature #854
        },
        select: {
          id: true,
          lotNumber: true,
          description: true,
          status: true,
          assignedSubcontractorId: true,
          createdAt: true,
        },
      });

      if (itpTemplateId) {
        await tx.iTPInstance.create({
          data: {
            lotId: createdLot.id,
            templateId: itpTemplateId,
            status: 'not_started',
          },
        });
      }

      if (assignedSubcontractorId) {
        await syncPrimaryLotSubcontractorAssignment(tx, {
          lotId: createdLot.id,
          projectId,
          subcontractorId: assignedSubcontractorId,
          canCompleteITP,
          itpRequiresVerification,
          assignedById: user.id,
        });
      }

      return createdLot;
    });

    res.status(201).json({ lot });
  }),
);

// POST /api/lots/bulk - Bulk create lots (requires creator role)
lotsRouter.post(
  '/bulk',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Validate request body
    const validation = bulkCreateLotsSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { projectId, lots: lotsData } = validation.data;

    await requireProjectRole(
      projectId,
      user,
      LOT_CREATORS,
      'You do not have permission to create lots in this project.',
    );

    // Create all lots in a transaction
    const createdLots = await prisma.$transaction(
      lotsData.map((lot) =>
        prisma.lot.create({
          data: {
            projectId,
            lotNumber: lot.lotNumber,
            description: lot.description || null,
            activityType: lot.activityType || 'Earthworks',
            lotType: lot.lotType || 'chainage',
            chainageStart: lot.chainageStart ?? null,
            chainageEnd: lot.chainageEnd ?? null,
            layer: lot.layer || null,
          },
          select: {
            id: true,
            lotNumber: true,
            description: true,
            status: true,
            activityType: true,
            chainageStart: true,
            chainageEnd: true,
            createdAt: true,
          },
        }),
      ),
    );

    res.status(201).json({
      message: `Successfully created ${createdLots.length} lots`,
      lots: createdLots,
      count: createdLots.length,
    });
  }),
);

// POST /api/lots/:id/clone - Clone a lot with suggested adjacent chainage
lotsRouter.post(
  '/:id/clone',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const validation = cloneLotSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { lotNumber, chainageStart, chainageEnd } = validation.data;

    // Get the original lot
    const sourceLot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        lotNumber: true,
        description: true,
        activityType: true,
        lotType: true,
        chainageStart: true,
        chainageEnd: true,
        offset: true,
        offsetCustom: true,
        layer: true,
        areaZone: true,
        assignedSubcontractorId: true,
      },
    });

    if (!sourceLot) {
      throw AppError.notFound('Lot');
    }

    await requireProjectRole(
      sourceLot.projectId,
      user,
      LOT_CREATORS,
      'You do not have permission to create lots in this project.',
    );

    // Calculate suggested adjacent chainage if not provided
    let suggestedChainageStart = chainageStart;
    let suggestedChainageEnd = chainageEnd;

    if (suggestedChainageStart === undefined && sourceLot.chainageEnd !== null) {
      // Suggest next section starting from where the original ended
      suggestedChainageStart = Number(sourceLot.chainageEnd);
      if (sourceLot.chainageStart !== null) {
        const sectionLength = Number(sourceLot.chainageEnd) - Number(sourceLot.chainageStart);
        suggestedChainageEnd = Number(suggestedChainageStart) + sectionLength;
      }
    }

    // If no lotNumber provided, generate a suggestion
    let newLotNumber = lotNumber;
    if (!newLotNumber) {
      // Try to increment the lot number (e.g., LOT-001 -> LOT-002)
      const match = sourceLot.lotNumber.match(/^(.*)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const num = parseInt(match[2], 10);
        const paddedNum = String(num + 1).padStart(match[2].length, '0');
        newLotNumber = `${prefix}${paddedNum}`;
      } else {
        newLotNumber = `${sourceLot.lotNumber}-copy`;
      }
    }

    const finalChainageStart =
      suggestedChainageStart !== undefined ? suggestedChainageStart : sourceLot.chainageStart;
    const finalChainageEnd =
      suggestedChainageEnd !== undefined ? suggestedChainageEnd : sourceLot.chainageEnd;
    if (
      finalChainageStart !== null &&
      finalChainageEnd !== null &&
      Number(finalChainageStart) > Number(finalChainageEnd)
    ) {
      throw AppError.badRequest('chainageStart must be less than or equal to chainageEnd');
    }

    // Create the cloned lot and keep legacy/new subcontractor assignment state aligned.
    const clonedLot = await prisma.$transaction(async (tx) => {
      const lot = await tx.lot.create({
        data: {
          projectId: sourceLot.projectId,
          lotNumber: newLotNumber,
          description: sourceLot.description,
          activityType: sourceLot.activityType,
          lotType: sourceLot.lotType,
          chainageStart: finalChainageStart,
          chainageEnd: finalChainageEnd,
          offset: sourceLot.offset,
          offsetCustom: sourceLot.offsetCustom,
          layer: sourceLot.layer,
          areaZone: sourceLot.areaZone,
          assignedSubcontractorId: sourceLot.assignedSubcontractorId,
        },
        select: {
          id: true,
          lotNumber: true,
          description: true,
          status: true,
          activityType: true,
          chainageStart: true,
          chainageEnd: true,
          offset: true,
          layer: true,
          areaZone: true,
          assignedSubcontractorId: true,
          createdAt: true,
        },
      });

      if (sourceLot.assignedSubcontractorId) {
        await syncPrimaryLotSubcontractorAssignment(tx, {
          lotId: lot.id,
          projectId: sourceLot.projectId,
          subcontractorId: sourceLot.assignedSubcontractorId,
          assignedById: user.id,
        });
      }

      return lot;
    });

    res.status(201).json({
      lot: clonedLot,
      sourceLotId: sourceLot.id,
      message: `Lot cloned from ${sourceLot.lotNumber}`,
    });
  }),
);

// Roles that can edit lots
const LOT_EDITORS = [
  'owner',
  'admin',
  'project_manager',
  'site_engineer',
  'quality_manager',
  'foreman',
];

// PATCH /api/lots/:id - Update a lot
lotsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const validation = updateLotSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        status: true,
        updatedAt: true,
      },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    const userProjectRole = await requireProjectRole(
      lot.projectId,
      user,
      LOT_EDITORS,
      'You do not have permission to edit lots',
    );

    // Don't allow editing conformed or claimed lots (without special override)
    if (lot.status === 'conformed' || lot.status === 'claimed') {
      throw AppError.badRequest(`Cannot edit a ${lot.status} lot`);
    }

    // Feature #871: Concurrent edit detection (optimistic locking)
    // If client sends expectedUpdatedAt, check if lot was modified since
    const { expectedUpdatedAt } = req.body;
    if (expectedUpdatedAt) {
      const clientExpectedTime = new Date(expectedUpdatedAt).getTime();
      const serverUpdatedTime = lot.updatedAt.getTime();
      const timeDiff = Math.abs(clientExpectedTime - serverUpdatedTime);

      // Allow 1 second tolerance for timing differences
      if (timeDiff > 1000) {
        throw AppError.conflict(
          'This lot has been modified by another user. Please refresh and try again.',
          {
            serverUpdatedAt: lot.updatedAt.toISOString(),
            clientExpectedAt: expectedUpdatedAt,
          },
        );
      }
    }

    // Extract validated fields
    const {
      lotNumber,
      description,
      activityType,
      chainageStart,
      chainageEnd,
      offset,
      offsetCustom,
      layer,
      areaZone,
      status,
      budgetAmount,
      assignedSubcontractorId,
      lotType: validatedLotType,
      structureId: validatedStructureId,
      structureElement: validatedStructureElement,
    } = validation.data;

    // Feature #853 & #854: Validate area zone and structure ID for respective lot types
    const existingLot = await prisma.lot.findUnique({
      where: { id },
      select: {
        lotType: true,
        areaZone: true,
        structureId: true,
        chainageStart: true,
        chainageEnd: true,
      },
    });
    const newLotType = validatedLotType ?? existingLot?.lotType;
    const newAreaZone = areaZone ?? existingLot?.areaZone;
    const newStructureId = validatedStructureId ?? existingLot?.structureId;
    const newChainageStart =
      chainageStart !== undefined ? chainageStart : existingLot?.chainageStart;
    const newChainageEnd = chainageEnd !== undefined ? chainageEnd : existingLot?.chainageEnd;

    if (newLotType === 'area' && !newAreaZone) {
      throw AppError.badRequest('Area zone is required for area lot type', {
        code: 'AREA_ZONE_REQUIRED',
      });
    }

    // Feature #854: Structure ID required for structure lot type
    if (newLotType === 'structure' && !newStructureId) {
      throw AppError.badRequest('Structure ID is required for structure lot type', {
        code: 'STRUCTURE_ID_REQUIRED',
      });
    }

    if (
      newChainageStart !== null &&
      newChainageStart !== undefined &&
      newChainageEnd !== null &&
      newChainageEnd !== undefined &&
      Number(newChainageStart) > Number(newChainageEnd)
    ) {
      throw AppError.badRequest('chainageStart must be less than or equal to chainageEnd');
    }

    // Build update data - only include fields that were provided
    const updateData: Record<string, unknown> = {};
    if (validatedLotType !== undefined) updateData.lotType = validatedLotType;
    if (lotNumber !== undefined) updateData.lotNumber = lotNumber;
    if (description !== undefined) updateData.description = description;
    if (activityType !== undefined) updateData.activityType = activityType;
    if (chainageStart !== undefined) updateData.chainageStart = chainageStart;
    if (chainageEnd !== undefined) updateData.chainageEnd = chainageEnd;
    if (offset !== undefined) updateData.offset = offset;
    if (offsetCustom !== undefined) updateData.offsetCustom = offsetCustom;
    if (layer !== undefined) updateData.layer = layer;
    if (areaZone !== undefined) updateData.areaZone = areaZone;
    if (validatedStructureId !== undefined) updateData.structureId = validatedStructureId; // Feature #854
    if (validatedStructureElement !== undefined)
      updateData.structureElement = validatedStructureElement; // Feature #854
    if (status !== undefined) updateData.status = status;
    // Only PMs and above can set budget
    if (
      budgetAmount !== undefined &&
      ['owner', 'admin', 'project_manager'].includes(userProjectRole)
    ) {
      updateData.budgetAmount = budgetAmount;
    }
    // Only PMs and above can assign subcontractors
    if (
      assignedSubcontractorId !== undefined &&
      ['owner', 'admin', 'project_manager'].includes(userProjectRole)
    ) {
      if (assignedSubcontractorId) {
        await requireSubcontractorInProject(assignedSubcontractorId, lot.projectId);
      }
      updateData.assignedSubcontractorId = assignedSubcontractorId || null;
    }

    const updatedLot = await prisma.$transaction(async (tx) => {
      const updated = await tx.lot.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          lotNumber: true,
          description: true,
          status: true,
          activityType: true,
          chainageStart: true,
          chainageEnd: true,
          offset: true,
          offsetCustom: true,
          layer: true,
          areaZone: true,
          budgetAmount: true,
          assignedSubcontractorId: true,
          updatedAt: true,
        },
      });

      if (
        assignedSubcontractorId !== undefined &&
        ['owner', 'admin', 'project_manager'].includes(userProjectRole)
      ) {
        await syncPrimaryLotSubcontractorAssignment(tx, {
          lotId: id,
          projectId: lot.projectId,
          subcontractorId: assignedSubcontractorId,
          assignedById: user.id,
        });
      }

      return updated;
    });

    res.json({ lot: updatedLot });
  }),
);

// DELETE /api/lots/:id - Delete a lot (requires deleter role)
// Feature #585: Added docket allocation integrity check
lotsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    const lot = await prisma.lot.findUnique({
      where: { id },
      include: {
        // Check for actual hold point records that aren't released
        holdPoints: {
          where: {
            status: { not: 'released' },
          },
        },
        // Also check for ITP instances with hold point items (virtual hold points)
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  where: { pointType: 'hold_point' },
                },
              },
            },
            completions: {
              where: {
                checklistItem: { pointType: 'hold_point' },
              },
            },
          },
        },
        // Check for docket allocations
        docketLabourLots: {
          select: { id: true },
        },
        docketPlantLots: {
          select: { id: true },
        },
      },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireProjectRole(
      lot.projectId,
      user,
      LOT_DELETERS,
      'You do not have permission to delete lots',
    );

    // Check if lot is conformed or claimed - cannot delete these
    if (lot.status === 'conformed') {
      throw AppError.badRequest(
        'Cannot delete a conformed lot. Conformed lots have been quality-approved.',
        {
          code: 'LOT_CONFORMED',
        },
      );
    }

    if (lot.status === 'claimed') {
      throw AppError.badRequest(
        'Cannot delete a claimed lot. This lot is part of a progress claim.',
        {
          code: 'LOT_CLAIMED',
        },
      );
    }

    // Check for unreleased hold points (actual records in hold_points table)
    if (lot.holdPoints && lot.holdPoints.length > 0) {
      throw AppError.badRequest(
        `This lot has ${lot.holdPoints.length} unreleased hold point(s). Release all hold points before deleting the lot.`,
        {
          code: 'UNRELEASED_HOLD_POINTS',
          unreleasedHoldPoints: lot.holdPoints.length,
        },
      );
    }

    // Check for virtual hold points (ITP checklist items with hold_point type that haven't been released)
    if (lot.itpInstance?.template?.checklistItems) {
      const holdPointItems = lot.itpInstance.template.checklistItems;
      const releasedCompletions =
        lot.itpInstance.completions?.filter((c) => c.verificationStatus === 'verified') || [];

      // Find hold point items that haven't been verified/released
      const unreleasedHoldPoints = holdPointItems.filter(
        (item) => !releasedCompletions.some((c) => c.checklistItemId === item.id),
      );

      if (unreleasedHoldPoints.length > 0) {
        throw AppError.badRequest(
          `This lot has ${unreleasedHoldPoints.length} unreleased hold point(s). Release all hold points before deleting the lot.`,
          {
            code: 'UNRELEASED_HOLD_POINTS',
            unreleasedHoldPoints: unreleasedHoldPoints.length,
          },
        );
      }
    }

    // Check for docket allocations - lots with docket costs cannot be deleted
    const docketLabourCount = lot.docketLabourLots?.length || 0;
    const docketPlantCount = lot.docketPlantLots?.length || 0;
    const totalDocketAllocations = docketLabourCount + docketPlantCount;

    if (totalDocketAllocations > 0) {
      throw AppError.badRequest(
        `This lot has ${totalDocketAllocations} docket allocation(s) (${docketLabourCount} labour, ${docketPlantCount} plant). Remove docket allocations before deleting the lot.`,
        {
          code: 'HAS_DOCKET_ALLOCATIONS',
          docketAllocations: {
            labour: docketLabourCount,
            plant: docketPlantCount,
            total: totalDocketAllocations,
          },
        },
      );
    }

    await prisma.lot.delete({
      where: { id },
    });

    res.json({ message: 'Lot deleted successfully' });
  }),
);

// POST /api/lots/bulk-delete - Bulk delete lots (requires deleter role)
lotsRouter.post(
  '/bulk-delete',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Validate request body
    const validation = bulkDeleteSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { lotIds } = validation.data;
    const uniqueLotIds = getUniqueLotIds(lotIds);

    // Check that lots exist and can be deleted (not conformed or claimed)
    const lotsToDelete = await prisma.lot.findMany({
      where: {
        id: { in: uniqueLotIds },
      },
      select: {
        id: true,
        projectId: true,
        lotNumber: true,
        status: true,
        holdPoints: {
          where: {
            status: { not: 'released' },
          },
          select: { id: true },
        },
        itpInstance: {
          select: {
            template: {
              select: {
                checklistItems: {
                  where: { pointType: 'hold_point' },
                  select: { id: true },
                },
              },
            },
            completions: {
              where: {
                checklistItem: { pointType: 'hold_point' },
              },
              select: {
                checklistItemId: true,
                verificationStatus: true,
              },
            },
          },
        },
        docketLabourLots: {
          select: { id: true },
        },
        docketPlantLots: {
          select: { id: true },
        },
      },
    });
    assertAllRequestedLotsFound(uniqueLotIds, lotsToDelete);

    const projectIds = [...new Set(lotsToDelete.map((lot) => lot.projectId))];
    for (const projectId of projectIds) {
      await requireProjectRole(
        projectId,
        user,
        LOT_DELETERS,
        'You do not have permission to delete lots',
      );
    }

    // Check for lots that cannot be deleted (conformed or claimed)
    const undeletableLots = lotsToDelete.filter(
      (lot) => lot.status === 'conformed' || lot.status === 'claimed',
    );

    if (undeletableLots.length > 0) {
      throw AppError.badRequest(
        `Cannot delete ${undeletableLots.length} lot(s) that are conformed or claimed: ${undeletableLots.map((l) => l.lotNumber).join(', ')}`,
      );
    }

    // Check for lots with unreleased hold points
    const lotsWithUnreleasedHP = lotsToDelete.filter(
      (lot) => lot.holdPoints && lot.holdPoints.length > 0,
    );

    if (lotsWithUnreleasedHP.length > 0) {
      throw AppError.badRequest(
        `Cannot delete ${lotsWithUnreleasedHP.length} lot(s) with unreleased hold points: ${lotsWithUnreleasedHP.map((l) => l.lotNumber).join(', ')}`,
        {
          code: 'UNRELEASED_HOLD_POINTS',
        },
      );
    }

    const lotsWithVirtualUnreleasedHP = lotsToDelete.filter((lot) => {
      const holdPointItems = lot.itpInstance?.template?.checklistItems ?? [];
      const verifiedHoldPointCompletions =
        lot.itpInstance?.completions?.filter(
          (completion) => completion.verificationStatus === 'verified',
        ) ?? [];

      return holdPointItems.some(
        (item) =>
          !verifiedHoldPointCompletions.some(
            (completion) => completion.checklistItemId === item.id,
          ),
      );
    });

    if (lotsWithVirtualUnreleasedHP.length > 0) {
      throw AppError.badRequest(
        `Cannot delete ${lotsWithVirtualUnreleasedHP.length} lot(s) with unreleased ITP hold points: ${lotsWithVirtualUnreleasedHP.map((l) => l.lotNumber).join(', ')}`,
        {
          code: 'UNRELEASED_HOLD_POINTS',
        },
      );
    }

    const lotsWithDocketAllocations = lotsToDelete.filter(
      (lot) => (lot.docketLabourLots?.length || 0) + (lot.docketPlantLots?.length || 0) > 0,
    );

    if (lotsWithDocketAllocations.length > 0) {
      throw AppError.badRequest(
        `Cannot delete ${lotsWithDocketAllocations.length} lot(s) with docket allocations: ${lotsWithDocketAllocations.map((l) => l.lotNumber).join(', ')}`,
        {
          code: 'HAS_DOCKET_ALLOCATIONS',
        },
      );
    }

    // Delete all lots in a transaction
    const result = await prisma.lot.deleteMany({
      where: {
        id: { in: uniqueLotIds },
        status: { notIn: ['conformed', 'claimed'] },
      },
    });

    res.json({
      message: `Successfully deleted ${result.count} lot(s)`,
      count: result.count,
    });
  }),
);

// POST /api/lots/bulk-update-status - Bulk update lot status (requires creator role)
lotsRouter.post(
  '/bulk-update-status',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Validate request body
    const validation = bulkUpdateStatusSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { lotIds, status } = validation.data;
    const uniqueLotIds = getUniqueLotIds(lotIds);

    // Check that lots exist and can be updated (not conformed or claimed)
    const lotsToUpdate = await prisma.lot.findMany({
      where: {
        id: { in: uniqueLotIds },
      },
      select: {
        id: true,
        projectId: true,
        lotNumber: true,
        status: true,
      },
    });
    assertAllRequestedLotsFound(uniqueLotIds, lotsToUpdate);

    const projectIds = [...new Set(lotsToUpdate.map((lot) => lot.projectId))];
    for (const projectId of projectIds) {
      await requireProjectRole(
        projectId,
        user,
        LOT_CREATORS,
        'You do not have permission to update lots',
      );
    }

    // Check for lots that cannot be updated (conformed or claimed)
    const unupdatableLots = lotsToUpdate.filter(
      (lot) => lot.status === 'conformed' || lot.status === 'claimed',
    );

    if (unupdatableLots.length > 0) {
      throw AppError.badRequest(
        `Cannot update ${unupdatableLots.length} lot(s) that are conformed or claimed: ${unupdatableLots.map((l) => l.lotNumber).join(', ')}`,
      );
    }

    // Update all lots
    const result = await prisma.lot.updateMany({
      where: {
        id: { in: uniqueLotIds },
        status: { notIn: ['conformed', 'claimed'] },
      },
      data: {
        status: status,
        updatedAt: new Date(),
      },
    });

    res.json({
      message: `Successfully updated ${result.count} lot(s) to "${status.replace('_', ' ')}"`,
      count: result.count,
    });
  }),
);

// POST /api/lots/bulk-assign-subcontractor - Bulk assign lots to subcontractor (requires creator role)
lotsRouter.post(
  '/bulk-assign-subcontractor',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Validate request body
    const validation = bulkAssignSubcontractorSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { lotIds, subcontractorId } = validation.data;
    const uniqueLotIds = getUniqueLotIds(lotIds);

    // Check that lots exist and can be updated (not conformed or claimed)
    const lotsToUpdate = await prisma.lot.findMany({
      where: {
        id: { in: uniqueLotIds },
      },
      select: {
        id: true,
        projectId: true,
        lotNumber: true,
        status: true,
      },
    });
    assertAllRequestedLotsFound(uniqueLotIds, lotsToUpdate);

    const projectIds = [...new Set(lotsToUpdate.map((lot) => lot.projectId))];
    for (const projectId of projectIds) {
      await requireProjectRole(
        projectId,
        user,
        ['owner', 'admin', 'project_manager', 'site_manager'],
        'You do not have permission to assign lots',
      );
    }

    if (subcontractorId) {
      if (projectIds.length !== 1) {
        throw AppError.badRequest(
          'Bulk subcontractor assignment must target lots in a single project',
        );
      }
      await requireSubcontractorInProject(subcontractorId, projectIds[0]);
    }

    // Check for lots that cannot be updated (conformed or claimed)
    const unupdatableLots = lotsToUpdate.filter(
      (lot) => lot.status === 'conformed' || lot.status === 'claimed',
    );

    if (unupdatableLots.length > 0) {
      throw AppError.badRequest(
        `Cannot update ${unupdatableLots.length} lot(s) that are conformed or claimed: ${unupdatableLots.map((l) => l.lotNumber).join(', ')}`,
      );
    }

    // Update all lots and keep assignment records in sync with the legacy field.
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.lot.updateMany({
        where: {
          id: { in: uniqueLotIds },
          status: { notIn: ['conformed', 'claimed'] },
        },
        data: {
          assignedSubcontractorId: subcontractorId || null,
          updatedAt: new Date(),
        },
      });

      for (const lot of lotsToUpdate) {
        await syncPrimaryLotSubcontractorAssignment(tx, {
          lotId: lot.id,
          projectId: lot.projectId,
          subcontractorId,
          assignedById: user.id,
        });
      }

      return updateResult;
    });

    const action = subcontractorId ? 'assigned' : 'unassigned';
    res.json({
      message: `Successfully ${action} ${result.count} lot(s)`,
      count: result.count,
    });
  }),
);

// POST /api/lots/:id/assign - Assign a subcontractor to a lot with notification
lotsRouter.post(
  '/:id/assign',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const validation = assignSubcontractorSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { subcontractorId } = validation.data;

    // Get the lot with project info
    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        lotNumber: true,
        description: true,
        status: true,
        projectId: true,
        assignedSubcontractorId: true,
      },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    // Don't allow assigning terminal lots
    if (lot.status === 'conformed' || lot.status === 'claimed') {
      throw AppError.badRequest(`Cannot assign a ${lot.status} lot`);
    }

    await requireProjectRole(
      lot.projectId,
      user,
      ['owner', 'admin', 'project_manager', 'site_manager'],
      'You do not have permission to assign lots',
    );

    if (subcontractorId) {
      await requireSubcontractorInProject(subcontractorId, lot.projectId);
    }

    // Update the lot and keep the new assignment table aligned with the legacy field.
    const updatedLot = await prisma.$transaction(async (tx) => {
      await syncPrimaryLotSubcontractorAssignment(tx, {
        lotId: id,
        projectId: lot.projectId,
        subcontractorId,
        assignedById: user.id,
      });

      return tx.lot.update({
        where: { id },
        data: {
          assignedSubcontractorId: subcontractorId || null,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          lotNumber: true,
          description: true,
          status: true,
          assignedSubcontractorId: true,
          assignedSubcontractor: {
            select: {
              id: true,
              companyName: true,
            },
          },
        },
      });
    });

    // If assigning (not unassigning), send notifications to subcontractor users
    if (subcontractorId) {
      // Find all users linked to this subcontractor company
      const subcontractorUsers = await prisma.subcontractorUser.findMany({
        where: {
          subcontractorCompanyId: subcontractorId,
        },
        select: {
          userId: true,
        },
      });

      if (subcontractorUsers.length > 0) {
        // Get assigner info
        const assignerName = user.fullName || user.email || 'A project manager';

        // Create notifications for all subcontractor users
        await prisma.notification.createMany({
          data: subcontractorUsers.map((su) => ({
            userId: su.userId,
            projectId: lot.projectId,
            type: 'lot_assigned',
            title: 'Lot Assigned to Your Company',
            message: `${assignerName} assigned lot ${lot.lotNumber}${lot.description ? ` (${lot.description})` : ''} to your company.`,
            linkUrl: `/projects/${lot.projectId}/lots/${lot.id}`,
          })),
        });
      }

      // Record in audit log
      await prisma.auditLog.create({
        data: {
          projectId: lot.projectId,
          userId: user.id,
          entityType: 'Lot',
          entityId: id,
          action: 'subcontractor_assigned',
          changes: JSON.stringify({
            lotNumber: lot.lotNumber,
            subcontractorId,
            subcontractorName: updatedLot.assignedSubcontractor?.companyName,
            previousSubcontractorId: lot.assignedSubcontractorId,
            assignedBy: user.email,
          }),
        },
      });
    }

    res.json({
      message: subcontractorId
        ? `Lot assigned to ${updatedLot.assignedSubcontractor?.companyName || 'subcontractor'}`
        : 'Lot unassigned from subcontractor',
      lot: updatedLot,
      notificationsSent: subcontractorId ? true : false,
    });
  }),
);

// GET /api/lots/check-role/:projectId - Check user's role on a project
lotsRouter.get(
  '/check-role/:projectId',
  asyncHandler(async (req, res) => {
    const projectId = parseLotRouteParam(req.params.projectId, 'projectId');
    const user = req.user!;

    const role = await getEffectiveProjectRole(projectId, user);
    if (!role) {
      throw AppError.forbidden('You do not have access to this project');
    }

    // Check quality management permissions
    const isQualityManager = role === 'quality_manager';
    const canConformLots = LOT_CONFORMERS.includes(role);
    const canVerifyTestResults = LOT_CONFORMERS.includes(role);
    const canCloseNCRs = LOT_CONFORMERS.includes(role);
    const canManageITPTemplates = LOT_CONFORMERS.includes(role);

    res.json({
      role,
      isQualityManager,
      canConformLots,
      canVerifyTestResults,
      canCloseNCRs,
      canManageITPTemplates,
    });
  }),
);

// GET /api/lots/:id/conform-status - Get lot conformance prerequisites status
lotsRouter.get(
  '/:id/conform-status',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    const result = await checkConformancePrerequisites(id);

    if (result.error) {
      throw AppError.notFound('Lot');
    }

    await requireLotReadAccess(result.lot!, user);

    res.json(result);
  }),
);

// POST /api/lots/:id/conform - Conform a lot (quality management)
lotsRouter.post(
  '/:id/conform',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const validation = conformLotSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { force } = validation.data; // Optional force parameter to skip prerequisite check

    // Check conformance prerequisites first
    const conformStatus = await checkConformancePrerequisites(id);

    if (conformStatus.error) {
      throw AppError.notFound('Lot');
    }

    const lot = conformStatus.lot!;

    await requireProjectRole(
      lot.projectId,
      user,
      LOT_CONFORMERS,
      'You do not have permission to conform lots. Required roles: Quality Manager, Project Manager, Admin, or Owner.',
    );

    // Check if lot is already conformed or claimed
    if (lot.status === 'conformed' || lot.status === 'claimed') {
      throw AppError.badRequest(`Lot is already ${lot.status}`);
    }

    // Check prerequisites unless force flag is provided (only for admins)
    if (!conformStatus.canConform && !force) {
      throw AppError.badRequest('Cannot conform lot - prerequisites not met', {
        blockingReasons: conformStatus.blockingReasons as unknown as Record<string, unknown>,
        prerequisites: conformStatus.prerequisites as unknown as Record<string, unknown>,
      });
    }

    // Update lot status to conformed
    const updatedLot = await prisma.lot.update({
      where: { id },
      data: {
        status: 'conformed',
        conformedAt: new Date(),
        conformedBy: {
          connect: { id: user.id },
        },
      },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        conformedAt: true,
      },
    });

    res.json({
      message: 'Lot conformed successfully',
      lot: updatedLot,
    });
  }),
);

// Roles that can override lot status
const STATUS_OVERRIDERS = ['owner', 'admin', 'project_manager', 'quality_manager'];

// POST /api/lots/:id/override-status - Manual status override with reason (Feature #159)
lotsRouter.post(
  '/:id/override-status',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const validation = overrideStatusSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { status, reason } = validation.data;

    // Get the lot
    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        projectId: true,
      },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    // Don't allow overriding claimed lots
    if (lot.status === 'claimed') {
      throw AppError.badRequest('Cannot override status of a claimed lot');
    }

    await requireProjectRole(
      lot.projectId,
      user,
      STATUS_OVERRIDERS,
      'You do not have permission to override lot status. Required roles: Quality Manager, Project Manager, Admin, or Owner.',
    );

    const previousStatus = lot.status;

    // Update the lot status
    const updatedLot = await prisma.lot.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        updatedAt: true,
      },
    });

    // Record the override in the audit log with the reason
    await prisma.auditLog.create({
      data: {
        projectId: lot.projectId,
        userId: user.id,
        entityType: 'Lot',
        entityId: id,
        action: 'status_override',
        changes: JSON.stringify({
          status: {
            from: previousStatus,
            to: status,
          },
          reason: reason.trim(),
          overriddenBy: user.email,
        }),
      },
    });

    res.json({
      message: 'Status overridden successfully',
      lot: updatedLot,
      previousStatus,
      reason: reason.trim(),
    });
  }),
);

// ============================================================================
// Lot Subcontractor Assignment Management (new permission system)
// ============================================================================

// GET /api/lots/:id/subcontractors - List all subcontractor assignments for a lot
lotsRouter.get(
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

    res.json(assignments);
  }),
);

// GET /api/lots/:id/subcontractors/mine - Get the current subcontractor user's assignment for a lot
lotsRouter.get(
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

    const subcontractorCompanyId = await getProjectSubcontractorCompanyId(user.id, lot.projectId);
    if (!subcontractorCompanyId) {
      throw AppError.forbidden('You do not have access to this lot');
    }

    const assignment = await prisma.lotSubcontractorAssignment.findFirst({
      where: {
        lotId: id,
        projectId: lot.projectId,
        subcontractorCompanyId,
        status: 'active',
      },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
      },
    });

    if (assignment) {
      return res.json(assignment);
    }

    const legacyLot = await prisma.lot.findFirst({
      where: {
        id,
        projectId: lot.projectId,
        assignedSubcontractorId: subcontractorCompanyId,
      },
      select: { id: true },
    });

    if (!legacyLot) {
      throw AppError.notFound('Assignment');
    }

    res.json({
      id: `legacy-${id}-${subcontractorCompanyId}`,
      lotId: id,
      projectId: lot.projectId,
      subcontractorCompanyId,
      canCompleteITP: false,
      itpRequiresVerification: true,
      status: 'active',
    });
  }),
);

// POST /api/lots/:id/subcontractors - Assign a subcontractor to a lot
lotsRouter.post(
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

    res.status(201).json(assignment);
  }),
);

// PATCH /api/lots/:id/subcontractors/:assignmentId - Update assignment permissions
lotsRouter.patch(
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
      select: { id: true, projectId: true, assignedSubcontractorId: true },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireProjectRole(
      lot.projectId,
      user,
      ['owner', 'admin', 'project_manager', 'site_manager'],
      'You do not have permission to manage subcontractor assignments',
    );

    // Verify assignment exists and belongs to this lot
    const assignment = await prisma.lotSubcontractorAssignment.findFirst({
      where: { id: assignmentId, lotId: id },
      select: { id: true, subcontractorCompanyId: true },
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

    res.json(updated);
  }),
);

// DELETE /api/lots/:id/subcontractors/:assignmentId - Remove assignment
lotsRouter.delete(
  '/:id/subcontractors/:assignmentId',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const assignmentId = parseLotRouteParam(req.params.assignmentId, 'assignmentId');
    const user = req.user!;

    // Get the lot to verify access
    const lot = await prisma.lot.findUnique({
      where: { id },
      select: { id: true, projectId: true, assignedSubcontractorId: true },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireProjectRole(
      lot.projectId,
      user,
      ['owner', 'admin', 'project_manager', 'site_manager'],
      'You do not have permission to manage subcontractor assignments',
    );

    // Verify assignment exists and belongs to this lot
    const assignment = await prisma.lotSubcontractorAssignment.findFirst({
      where: { id: assignmentId, lotId: id },
      select: { id: true, subcontractorCompanyId: true },
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

    res.json({ message: 'Assignment removed successfully' });
  }),
);
