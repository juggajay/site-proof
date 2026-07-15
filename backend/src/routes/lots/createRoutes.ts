/**
 * Lot create / bulk-create / clone routes.
 *
 * Moved verbatim from backend/src/routes/lots.ts as part of the route-handler
 * relocation phase (engineering-health Workstream 1). These are the
 * authenticated lot-creation endpoints:
 *
 *   POST /            (create a single lot)
 *   POST /bulk        (bulk create lots)
 *   POST /:id/clone   (clone a lot with suggested adjacent chainage)
 *
 * Route order is preserved relative to the parent: lots.ts mounts this router
 * immediately AFTER the read router (lotReadRouter) and BEFORE the update /
 * delete / bulk mutation routes, matching the original inline position. The
 * three paths here are mutually non-shadowing (`/` and `/bulk` are exact, and
 * `/:id/clone` is a two-segment dynamic path), and none of them can swallow the
 * mutation routes that remain in the parent.
 *
 * Auth: lots.ts mounts this router after its route-wide
 * `lotsRouter.use(requireAuth)`, exactly like the diary/ and dockets/ child
 * routers, so every route here is already authenticated. Do NOT add a separate
 * requireAuth here (it would run authentication twice). routeAuthCoverage.test.ts
 * treats the `lots/` prefix as parent-protected for this reason.
 */

import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { createLotSchema, bulkCreateLotsSchema, cloneLotSchema } from './validation.js';
import { requireProjectRole } from './access.js';
import { parseLotRouteParam } from './requestParsing.js';
import {
  requireItpTemplateForProject,
  syncPrimaryLotSubcontractorAssignment,
} from './assignmentHelpers.js';
import { LOT_CREATORS } from './roles.js';
import { LOT_BUDGET_EDITORS } from './updateFields.js';
import { prepareClonedLot } from './cloneHelpers.js';
import {
  buildLotClonedResponse,
  buildLotCreatedResponse,
  buildLotsCreatedResponse,
} from './coreResponses.js';
import { buildTemplateSnapshot, type TemplateSnapshot } from '../itp/helpers/templateSnapshot.js';
import { emitLotWebhookEvent, emitLotWebhookEvents } from './webhookEvents.js';
import { createBulkLots } from './bulkCreateCore.js';

export const lotCreateRouter = Router();

// POST /api/lots - Create a new lot (requires creator role in project)
lotCreateRouter.post(
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
      areaZone,
      structureId,
      structureElement,
      budgetAmount,
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

    const userProjectRole = await requireProjectRole(
      projectId,
      user,
      LOT_CREATORS,
      'You do not have permission to create lots in this project.',
      { requireWritable: true },
    );
    const canSetBudgetAmount = LOT_BUDGET_EDITORS.includes(userProjectRole);

    let templateSnapshot: TemplateSnapshot | null = null;
    if (itpTemplateId) {
      await requireItpTemplateForProject(itpTemplateId, projectId);
      const template = await prisma.iTPTemplate.findUnique({
        where: { id: itpTemplateId },
        include: {
          checklistItems: {
            orderBy: { sequenceNumber: 'asc' },
          },
        },
      });

      if (!template) {
        throw AppError.notFound('ITP template');
      }

      templateSnapshot = buildTemplateSnapshot(template);
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
          areaZone: areaZone || null,
          structureId: structureId || null, // Feature #854
          structureElement: structureElement || null, // Feature #854
          ...(canSetBudgetAmount && budgetAmount !== undefined ? { budgetAmount } : {}),
        },
        select: {
          id: true,
          lotNumber: true,
          description: true,
          activityType: true,
          lotType: true,
          status: true,
          assignedSubcontractorId: true,
          budgetAmount: true,
          createdAt: true,
        },
      });

      if (itpTemplateId) {
        await tx.iTPInstance.create({
          data: {
            lotId: createdLot.id,
            templateId: itpTemplateId,
            templateSnapshot: JSON.stringify(templateSnapshot),
            status: 'not_started',
          },
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
        budgetAmount: lot.budgetAmount === null ? null : Number(lot.budgetAmount),
      },
      req,
    });

    emitLotWebhookEvent(projectId, 'lot.created', {
      lotId: lot.id,
      projectId,
      lotNumber: lot.lotNumber,
      status: lot.status,
      actorUserId: user.id,
      action: 'created',
    });

    res.status(201).json(buildLotCreatedResponse(lot));
  }),
);

// POST /api/lots/bulk - Bulk create lots (requires creator role)
lotCreateRouter.post(
  '/bulk',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Validate request body
    const validation = bulkCreateLotsSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { projectId, lots: lotsData, itpTemplateId, geometry } = validation.data;

    await requireProjectRole(
      projectId,
      user,
      LOT_CREATORS,
      'You do not have permission to create lots in this project.',
      { requireWritable: true },
    );

    // Lots + per-lot ITP instances + chainage-offset geometry in one transaction
    // (createBulkLots is the shared source of truth with the copilot lot_breakdown
    // apply handler). All-or-nothing: the preview count is what you get.
    let result;
    try {
      result = await prisma.$transaction((tx) =>
        createBulkLots(tx, { projectId, lotsData, itpTemplateId, geometry }),
      );
    } catch (err) {
      // Unique [projectId, lotNumber] violation → actionable message instead of a 500.
      if (
        err !== null &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      ) {
        throw AppError.badRequest(
          'One or more of these lot numbers already exist in this project — change the prefix or numbering and try again.',
          { code: 'LOT_NUMBER_TAKEN' },
        );
      }
      throw err;
    }

    const { createdLots, itpPlan, geometryIds } = result;

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
            itpTemplateId: itpPlan.templateIdByLotNumber.get(lot.lotNumber) ?? null,
            generatedGeometry: geometryIds.length > 0,
          },
          req,
        }),
      ),
    );

    emitLotWebhookEvents(
      projectId,
      createdLots.map((lot) => ({
        event: 'lot.created',
        payload: {
          lotId: lot.id,
          projectId,
          lotNumber: lot.lotNumber,
          status: lot.status,
          actorUserId: user.id,
          action: 'created',
          bulk: true,
        },
      })),
    );

    res.status(201).json({
      ...buildLotsCreatedResponse(createdLots),
      itpInstancesCreated: [...itpPlan.templateIdByLotNumber.values()].filter(Boolean).length,
      geometriesCreated: geometryIds.length,
    });
  }),
);

// POST /api/lots/:id/clone - Clone a lot with suggested adjacent chainage
lotCreateRouter.post(
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
        itpTemplateId: true,
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
      { requireWritable: true },
    );

    // Carry the source lot's ITP forward so the clone is inspectable. We snapshot
    // the CURRENT template and start a fresh not_started instance — completions
    // are never copied. If the template no longer exists, the clone simply has
    // no ITP (rather than failing).
    let clonedTemplateSnapshot: TemplateSnapshot | null = null;
    if (sourceLot.itpTemplateId) {
      const template = await prisma.iTPTemplate.findUnique({
        where: { id: sourceLot.itpTemplateId },
        include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
      });
      if (template) {
        clonedTemplateSnapshot = buildTemplateSnapshot(template);
      }
    }
    const cloneItpTemplateId = clonedTemplateSnapshot ? sourceLot.itpTemplateId : null;

    // Compute the cloned lot number + final chainage (suggestion, increment,
    // and range validation), keeping the route's DB/transaction work below.
    const {
      lotNumber: newLotNumber,
      chainageStart: finalChainageStart,
      chainageEnd: finalChainageEnd,
    } = prepareClonedLot({
      provided: { lotNumber, chainageStart, chainageEnd },
      source: {
        lotNumber: sourceLot.lotNumber,
        chainageStart: sourceLot.chainageStart,
        chainageEnd: sourceLot.chainageEnd,
      },
    });

    // Carry the source lot's subcontractor forward in MODERN form only: the
    // legacy Lot.assignedSubcontractorId FK write path is retired, so the clone
    // starts with a null legacy field and syncPrimaryLotSubcontractorAssignment
    // (below) creates the LotSubcontractorAssignment join row. See docs/research/
    // agentic-setup-synthesis-2026-07-15.md §1.
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
          assignedSubcontractorId: null,
          itpTemplateId: cloneItpTemplateId,
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

      if (cloneItpTemplateId) {
        await tx.iTPInstance.create({
          data: {
            lotId: lot.id,
            templateId: cloneItpTemplateId,
            templateSnapshot: JSON.stringify(clonedTemplateSnapshot),
            status: 'not_started',
          },
        });
      }

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

    emitLotWebhookEvent(sourceLot.projectId, 'lot.created', {
      lotId: clonedLot.id,
      projectId: sourceLot.projectId,
      lotNumber: clonedLot.lotNumber,
      status: clonedLot.status,
      actorUserId: user.id,
      action: 'cloned',
      sourceLotId: sourceLot.id,
    });

    res.status(201).json(buildLotClonedResponse(clonedLot, sourceLot.id, sourceLot.lotNumber));
  }),
);
