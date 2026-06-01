import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { checkConformancePrerequisites } from '../lib/conformancePrerequisites.js';
import { buildLotReadinessFromInputs } from '../lib/evidenceReadiness.js';
import {
  activeSubcontractorCompanyWhere,
  checkProjectAccess,
  getEffectiveProjectRole,
} from '../lib/projectAccess.js';
import { getPaginationMeta, getPrismaSkipTake } from '../lib/pagination.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { assertLotDeletable, assertLotsBulkDeletable } from '../lib/lotDeletion.js';
import {
  lotSortFields,
  MAX_ID_LENGTH,
  MAX_SEARCH_LENGTH,
  createLotSchema,
  bulkCreateLotsSchema,
  cloneLotSchema,
  updateLotSchema,
  bulkDeleteSchema,
  bulkUpdateStatusSchema,
  bulkAssignSubcontractorSchema,
  assignSubcontractorSchema,
  conformLotSchema,
  overrideStatusSchema,
  createSubcontractorAssignmentSchema,
  updateSubcontractorAssignmentSchema,
} from './lots/validation.js';
import {
  isSubcontractorUser,
  canViewLotBudget,
  requireSubcontractorLotPortalModules,
  requireProjectRole,
  getProjectSubcontractorCompanyId,
  requireLotReadAccess,
} from './lots/access.js';
import {
  getRequiredQueryString,
  getOptionalQueryString,
  getOptionalBoundedQueryString,
  parseLotRouteParam,
  getOptionalLotPortalModule,
  parsePositiveIntQuery,
  parseLotStatusFilter,
  getUniqueLotIds,
  assertAllRequestedLotsFound,
} from './lots/requestParsing.js';
import {
  requireSubcontractorInProject,
  requireItpTemplateForProject,
  syncPrimaryLotSubcontractorAssignment,
} from './lots/assignmentHelpers.js';

export const lotsRouter = Router();

// Apply authentication middleware to all lot routes
lotsRouter.use(requireAuth);

// Roles that can create lots
const LOT_CREATORS = ['owner', 'admin', 'project_manager', 'site_manager', 'foreman'];
// Roles that can delete lots
const LOT_DELETERS = ['owner', 'admin', 'project_manager'];
// Roles that can conform lots (quality management)
const LOT_CONFORMERS = ['owner', 'admin', 'project_manager', 'quality_manager'];
const LOT_FORCE_CONFORMERS = ['owner', 'admin'];

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
    let subcontractorCompanyId: string | null = null;

    const hasProjectAccess = await checkProjectAccess(user.id, projectId);
    if (!hasProjectAccess) {
      throw AppError.forbidden('Access denied');
    }

    const effectiveProjectRole = isSubcontractorUser(user)
      ? null
      : await getEffectiveProjectRole(user, projectId, {
          excludeSubcontractorProjectMemberships: true,
          throwIfProjectMissing: true,
        });
    const canViewBudgetAmount = canViewLotBudget(effectiveProjectRole);

    await requireSubcontractorLotPortalModules(
      user,
      projectId,
      portalModule === 'itps' || includeITP === 'true' ? ['itps'] : [],
    );

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
        subcontractorCompanyId = subCompanyId;
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
    const visibleLots = lots.map((lot) => ({
      ...lot,
      budgetAmount: canViewBudgetAmount ? lot.budgetAmount : null,
      subcontractorAssignments: subcontractorCompanyId
        ? lot.subcontractorAssignments.filter(
            (assignment) => assignment.subcontractorCompanyId === subcontractorCompanyId,
          )
        : lot.subcontractorAssignments,
    }));

    const transformedLots =
      includeITP === 'true'
        ? visibleLots.map((lot) => ({
            ...lot,
            itpInstances: lot.itpInstance ? [lot.itpInstance] : [],
          }))
        : visibleLots;

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
    await requireSubcontractorLotPortalModules(
      user,
      lot.projectId,
      portalModule === 'itps' ? ['itps'] : [],
    );

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
          activityType: true,
          lotType: true,
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

    await createAuditLog({
      projectId,
      userId: user.id,
      entityType: 'lot',
      entityId: lot.id,
      action: AuditAction.LOT_CREATED,
      changes: {
        lotNumber: lot.lotNumber,
        activityType: lot.activityType,
        lotType: lot.lotType,
        status: lot.status,
        assignedSubcontractorId: lot.assignedSubcontractorId,
      },
      req,
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

    await Promise.all(
      createdLots.map((lot) =>
        createAuditLog({
          projectId,
          userId: user.id,
          entityType: 'lot',
          entityId: lot.id,
          action: AuditAction.LOT_CREATED,
          changes: {
            lotNumber: lot.lotNumber,
            activityType: lot.activityType,
            status: lot.status,
            bulkCreate: true,
          },
          req,
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
const LOT_BUDGET_EDITORS = ['owner', 'admin', 'project_manager'];
const CONFORMED_LOT_BUDGET_EDIT_FIELDS = new Set(['budgetAmount', 'expectedUpdatedAt']);

function getProvidedUpdateFields(data: z.infer<typeof updateLotSchema>) {
  return Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
}

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
    const providedUpdateFields = getProvidedUpdateFields(validation.data);
    const isConformedBudgetOnlyUpdate =
      lot.status === 'conformed' &&
      budgetAmount !== undefined &&
      providedUpdateFields.every((field) => CONFORMED_LOT_BUDGET_EDIT_FIELDS.has(field));

    if (lot.status === 'claimed') {
      throw AppError.badRequest('Cannot edit a claimed lot');
    }

    if (lot.status === 'conformed' && !isConformedBudgetOnlyUpdate) {
      throw AppError.badRequest(
        'Cannot edit a conformed lot. Only the budget amount can be updated before the lot is claimed.',
      );
    }

    if (isConformedBudgetOnlyUpdate && !LOT_BUDGET_EDITORS.includes(userProjectRole)) {
      throw AppError.forbidden(
        'Only project managers, admins, or owners can edit budgets on conformed lots',
      );
    }

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
    if (budgetAmount !== undefined && LOT_BUDGET_EDITORS.includes(userProjectRole)) {
      updateData.budgetAmount = budgetAmount;
    }
    // Only PMs and above can assign subcontractors
    if (assignedSubcontractorId !== undefined && LOT_BUDGET_EDITORS.includes(userProjectRole)) {
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

      if (assignedSubcontractorId !== undefined && LOT_BUDGET_EDITORS.includes(userProjectRole)) {
        await syncPrimaryLotSubcontractorAssignment(tx, {
          lotId: id,
          projectId: lot.projectId,
          subcontractorId: assignedSubcontractorId,
          assignedById: user.id,
        });
      }

      return updated;
    });

    res.json({
      lot: {
        ...updatedLot,
        budgetAmount: canViewLotBudget(userProjectRole) ? updatedLot.budgetAmount : null,
      },
    });
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

    // Block deletion when the lot is conformed/claimed, has unreleased hold
    // points, or carries docket allocations.
    assertLotDeletable(lot);

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

    // Block the bulk delete when any requested lot is conformed/claimed, has
    // unreleased hold points, or carries docket allocations.
    assertLotsBulkDeletable(lotsToDelete);

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

    const role = await getEffectiveProjectRole(user, projectId, {
      excludeSubcontractorProjectMemberships: true,
      throwIfProjectMissing: true,
    });
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

// GET /api/lots/:id/readiness - Get deterministic evidence readiness for a lot
lotsRouter.get(
  '/:id/readiness',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        projectId: true,
        budgetAmount: true,
        claimedInId: true,
        holdPoints: {
          select: { status: true },
        },
        documents: {
          select: {
            documentType: true,
            category: true,
            mimeType: true,
          },
        },
        testResults: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireLotReadAccess(lot, user);
    await requireSubcontractorLotPortalModules(user, lot.projectId, [
      'itps',
      'testResults',
      'ncrs',
    ]);

    const effectiveProjectRole = isSubcontractorUser(user)
      ? null
      : await getEffectiveProjectRole(user, lot.projectId, {
          excludeSubcontractorProjectMemberships: true,
          throwIfProjectMissing: true,
        });
    const canViewCommercial = !isSubcontractorUser(user) && canViewLotBudget(effectiveProjectRole);
    const conformStatus = await checkConformancePrerequisites(id);

    if (!conformStatus.prerequisites) {
      throw AppError.notFound('Lot');
    }

    const readiness = buildLotReadinessFromInputs({
      lot: {
        id: lot.id,
        lotNumber: lot.lotNumber,
        status: lot.status,
        budgetAmount: lot.budgetAmount === null ? null : Number(lot.budgetAmount),
        claimedInId: lot.claimedInId,
      },
      canViewCommercial,
      conformStatus: {
        canConform: Boolean(conformStatus.canConform),
        blockingReasons: conformStatus.blockingReasons ?? [],
        prerequisites: conformStatus.prerequisites,
      },
      evidenceCounts: {
        unreleasedHoldPoints: lot.holdPoints.filter((holdPoint) => holdPoint.status !== 'released')
          .length,
        releasedHoldPoints: lot.holdPoints.filter((holdPoint) => holdPoint.status === 'released')
          .length,
        approvedDockets: 0,
        diaryEntries: 0,
        documents: lot.documents.length,
        photos: lot.documents.filter((document) => {
          const type = `${document.documentType ?? ''} ${document.category ?? ''} ${
            document.mimeType ?? ''
          }`.toLowerCase();
          return type.includes('photo') || type.includes('image/');
        }).length,
        pendingTests: lot.testResults.filter((test) =>
          ['pending', 'requested', 'submitted'].includes(test.status),
        ).length,
      },
    });

    res.json({ readiness });
  }),
);

// GET /api/lots/:id/conform-status - Get lot conformance prerequisites status
lotsRouter.get(
  '/:id/conform-status',
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

    await requireLotReadAccess(lot, user);
    await requireSubcontractorLotPortalModules(user, lot.projectId, [
      'itps',
      'testResults',
      'ncrs',
    ]);

    const result = await checkConformancePrerequisites(id);

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
    const { force, reason } = validation.data; // Optional force parameter to skip prerequisite check
    const forceReason = reason?.trim();

    if (force && (!forceReason || forceReason.length < 5)) {
      throw AppError.badRequest(
        'Force conform reason is required and must be at least 5 characters',
      );
    }

    // Check conformance prerequisites first
    const conformStatus = await checkConformancePrerequisites(id);

    if (conformStatus.error) {
      throw AppError.notFound('Lot');
    }

    const lot = conformStatus.lot!;

    const role = await requireProjectRole(
      lot.projectId,
      user,
      LOT_CONFORMERS,
      'You do not have permission to conform lots. Required roles: Quality Manager, Project Manager, Admin, or Owner.',
    );

    if (force && !LOT_FORCE_CONFORMERS.includes(role)) {
      throw AppError.forbidden('Only project admins or owners can force lot conformance');
    }

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

    await createAuditLog({
      projectId: lot.projectId,
      userId: user.id,
      entityType: 'lot',
      entityId: updatedLot.id,
      action: force ? AuditAction.LOT_FORCE_CONFORMED : AuditAction.LOT_STATUS_CHANGED,
      changes: {
        lotNumber: lot.lotNumber,
        status: { from: lot.status, to: updatedLot.status },
        force,
        ...(forceReason ? { reason: forceReason } : {}),
      },
      req,
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

    await createAuditLog({
      projectId: lot.projectId,
      userId: user.id,
      entityType: 'lot',
      entityId: id,
      action: AuditAction.LOT_STATUS_CHANGED,
      changes: {
        lotNumber: lot.lotNumber,
        status: {
          from: previousStatus,
          to: status,
        },
        reason: reason.trim(),
        override: true,
      },
      req,
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

    res.json({ message: 'Assignment removed successfully' });
  }),
);
