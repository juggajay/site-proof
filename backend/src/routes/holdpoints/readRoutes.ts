import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { parsePagination, getPaginationMeta } from '../../lib/pagination.js';
import { getActiveSubcontractorPortalCompanyIdsForProject } from '../../lib/projectAccess.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import {
  parseHoldPointRouteParam,
  calculateNotificationTimeSchema,
  previewEvidencePackageSchema,
} from './validation.js';
import {
  HP_REQUEST_ROLES,
  isSubcontractorUser,
  requireProjectReadAccess,
  requireHoldPointsPortalAccess,
  requireInternalProjectReadAccess,
  canRequestHoldPointRelease,
  requireLotReadAccess,
  requireHoldPointReadAccess,
  requireProjectRole,
} from './access.js';
import { parseRequiredDateTimeInput } from './dateParsing.js';
import { calculateNotificationTime } from './scheduling.js';
import {
  buildHoldPointPrerequisites,
  getIncompletePrerequisites,
  getPrecedingChecklistItems,
} from './prerequisites.js';
import {
  buildEmptyHoldPointListResponse,
  buildHoldPointListItems,
  buildHoldPointListResponse,
} from './listPresentation.js';
import { buildHoldPointDetailResponse, resolveHoldPointDetailSettings } from './detailResponse.js';
import {
  buildHoldPointEvidencePackage,
  buildHoldPointEvidencePackageResponse,
} from './evidencePackage.js';
import {
  buildNotificationTimeResponse,
  buildProjectWorkingHoursResponse,
} from './workingHoursResponses.js';
import { isReleaseGatedChecklistItem } from '../../lib/holdPointReleaseGating.js';
import { resolveHoldPointEvidenceInputs } from './evidencePackageInputs.js';
import {
  getHoldPointChecklistItemsForInstance,
  resolveHoldPointChecklistItemForInstance,
} from './itpSnapshot.js';

// =============================================================================
// Authenticated hold point READ routes: project list, lot/item detail,
// evidence package + preview, project working hours, and notification-time
// calculation. Moved verbatim from holdpoints.ts (behavior-preserving) and
// mounted back on holdpointsRouter at the same /api/holdpoints paths. Every
// route keeps its own requireAuth exactly as before; no public route lives in
// this module. The mutation flows (request-release/release/chase/escalate/
// resolve-escalation) and the public token-release routes stay in holdpoints.ts.
// =============================================================================

export const holdPointReadRouter = Router();
const HOLD_POINT_REGISTER_ALL_LIMIT = 5000;

// Get all hold points for a project
holdPointReadRouter.get(
  '/project/:projectId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseHoldPointRouteParam(req.params.projectId, 'projectId');
    const user = req.user!;
    const requestedSubcontractorCompanyId =
      req.query.subcontractorCompanyId === undefined
        ? undefined
        : parseHoldPointRouteParam(req.query.subcontractorCompanyId, 'subcontractorCompanyId');

    await requireProjectReadAccess(projectId, user);
    await requireHoldPointsPortalAccess(projectId, user);

    // Build where clause for lots
    const lotsWhere: Prisma.LotWhereInput = { projectId };

    // Subcontractors can only see hold points on their assigned lots
    if (isSubcontractorUser(user)) {
      const accessibleSubcontractorCompanyIds =
        await getActiveSubcontractorPortalCompanyIdsForProject({
          userId: user.id,
          projectId,
          module: 'holdPoints',
        });
      const subcontractorCompanyIds = requestedSubcontractorCompanyId
        ? accessibleSubcontractorCompanyIds.includes(requestedSubcontractorCompanyId)
          ? [requestedSubcontractorCompanyId]
          : []
        : accessibleSubcontractorCompanyIds;

      if (subcontractorCompanyIds.length > 0) {
        // Get lots assigned via LotSubcontractorAssignment
        const lotAssignments = await prisma.lotSubcontractorAssignment.findMany({
          where: {
            subcontractorCompanyId: { in: subcontractorCompanyIds },
            status: 'active',
            projectId,
          },
          select: { lotId: true },
        });
        const assignedLotIds = lotAssignments.map((a) => a.lotId);

        // Include lots from both legacy field AND new assignment model
        lotsWhere.OR = [
          { assignedSubcontractorId: { in: subcontractorCompanyIds } },
          ...(assignedLotIds.length > 0 ? [{ id: { in: assignedLotIds } }] : []),
        ];
      } else {
        // No subcontractor company - return empty
        return res.json(buildEmptyHoldPointListResponse());
      }
    }

    // Get all lots for the project that have ITP instances with hold points
    const lots = await prisma.lot.findMany({
      where: lotsWhere,
      include: {
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  orderBy: { sequenceNumber: 'asc' },
                },
              },
            },
            completions: true,
          },
        },
        holdPoints: {
          include: {
            itpChecklistItem: true,
            releaseTokens: {
              where: {
                usedAt: { not: null },
              },
              orderBy: { usedAt: 'desc' },
              take: 1,
              select: {
                recipientEmail: true,
                usedAt: true,
              },
            },
          },
        },
      },
    });

    // Transform to a sorted hold point list (one item per hold-point checklist
    // item; persisted row reused when present, otherwise a virtual entry).
    const holdPoints = buildHoldPointListItems(lots);

    // Apply pagination. The office register needs the full list for client-side
    // stats, filters, and deep links; `all=true` returns the same bounded register
    // in one response so clients do not force this route to rebuild the full
    // project graph once per page.
    const returnAll = req.query.all === 'true';
    const { page, limit } = returnAll
      ? { page: 1, limit: HOLD_POINT_REGISTER_ALL_LIMIT }
      : parsePagination(req.query);
    const total = holdPoints.length;
    const start = (page - 1) * limit;
    const paginatedHoldPoints = holdPoints.slice(start, start + limit);

    res.json(
      buildHoldPointListResponse(paginatedHoldPoints, getPaginationMeta(total, page, limit)),
    );
  }),
);

// Get hold point details with prerequisite status
holdPointReadRouter.get(
  '/lot/:lotId/item/:itemId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const lotId = parseHoldPointRouteParam(req.params.lotId, 'lotId');
    const itemId = parseHoldPointRouteParam(req.params.itemId, 'itemId');

    // Get the lot with ITP instance and all checklist items
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        project: true, // Include project to get HP recipients from settings
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  orderBy: { sequenceNumber: 'asc' },
                },
              },
            },
            completions: true,
          },
        },
        holdPoints: {
          where: { itpChecklistItemId: itemId },
          include: {
            itpChecklistItem: true,
            releaseTokens: {
              where: {
                usedAt: { not: null },
              },
              orderBy: { usedAt: 'desc' },
              take: 1,
              select: {
                recipientEmail: true,
                usedAt: true,
              },
            },
          },
        },
      },
    });

    if (!lot || !lot.itpInstance) {
      throw AppError.notFound('Lot or ITP instance');
    }

    const user = req.user!;
    await requireLotReadAccess(lot, user);
    const hasRequestPermission = await canRequestHoldPointRelease(lot.projectId, user);

    const checklistItems = getHoldPointChecklistItemsForInstance(lot.itpInstance);

    // Find the hold point item from the assigned ITP snapshot, falling back to
    // the live template only for legacy instances without a snapshot.
    const holdPointItem = resolveHoldPointChecklistItemForInstance(lot.itpInstance, itemId);
    if (!holdPointItem || !isReleaseGatedChecklistItem(holdPointItem)) {
      throw AppError.notFound('Hold point item');
    }

    // Get all preceding items (items with lower sequence number)
    const precedingItems = getPrecedingChecklistItems(checklistItems, holdPointItem.sequenceNumber);

    // Check completion status of each preceding item
    const prerequisites = buildHoldPointPrerequisites(precedingItems, lot.itpInstance.completions);

    // Check if all prerequisites are completed
    const incompletePrerequisites = getIncompletePrerequisites(prerequisites);
    const canRequestRelease = hasRequestPermission && incompletePrerequisites.length === 0;

    // Get existing hold point record
    const existingHP = lot.holdPoints[0];

    const { defaultRecipients, approvalRequirement } = resolveHoldPointDetailSettings({
      hasRequestPermission,
      projectSettings: lot.project.settings,
    });

    res.json(
      buildHoldPointDetailResponse({
        lotId,
        lotNumber: lot.lotNumber,
        itemId,
        holdPointItem,
        existingHoldPoint: existingHP,
        prerequisites,
        incompletePrerequisites,
        canRequestRelease,
        defaultRecipients,
        approvalRequirement,
      }),
    );
  }),
);

// Generate evidence package for a hold point
holdPointReadRouter.get(
  '/:id/evidence-package',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseHoldPointRouteParam(req.params.id, 'id');

    // Get the hold point with all related data
    const holdPoint = await prisma.holdPoint.findUnique({
      where: { id },
      include: {
        itpChecklistItem: true,
        lot: {
          include: {
            project: true,
            itpInstance: {
              include: {
                template: {
                  include: {
                    checklistItems: {
                      orderBy: { sequenceNumber: 'asc' },
                    },
                  },
                },
                completions: {
                  include: {
                    completedBy: {
                      select: { id: true, fullName: true, email: true },
                    },
                    verifiedBy: {
                      select: { id: true, fullName: true, email: true },
                    },
                    attachments: {
                      include: {
                        document: true,
                      },
                    },
                  },
                },
              },
            },
            testResults: {
              include: {
                verifiedBy: {
                  select: { id: true, fullName: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    if (!holdPoint) {
      throw AppError.notFound('Hold point');
    }

    await requireInternalProjectReadAccess(
      holdPoint.lot.projectId,
      req.user!,
      'You do not have access to this hold point',
    );
    await requireHoldPointReadAccess(holdPoint, req.user!);

    const lot = holdPoint.lot;
    const { itpInstance, checklistItems, holdPointItem, itpTemplate } =
      resolveHoldPointEvidenceInputs({
        itpInstance: lot.itpInstance,
        checklistItemId: holdPoint.itpChecklistItemId,
        liveFallback: holdPoint.itpChecklistItem,
      });

    const evidencePackage = buildHoldPointEvidencePackage({
      holdPoint: {
        id: holdPoint.id,
        description: holdPoint.description,
        status: holdPoint.status,
        notificationSentAt: holdPoint.notificationSentAt,
        scheduledDate: holdPoint.scheduledDate,
        releasedAt: holdPoint.releasedAt,
        releasedByName: holdPoint.releasedByName,
        releasedByOrg: holdPoint.releasedByOrg,
        releaseMethod: holdPoint.releaseMethod,
        releaseNotes: holdPoint.releaseNotes,
      },
      lot,
      itpTemplate,
      checklistItems,
      completions: itpInstance.completions,
      holdPointSequenceNumber: holdPointItem.sequenceNumber,
    });

    res.json(buildHoldPointEvidencePackageResponse(evidencePackage));
  }),
);

// Get notification timing for a hold point request based on working hours
holdPointReadRouter.post(
  '/calculate-notification-time',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = calculateNotificationTimeSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const { projectId, requestedDateTime } = parseResult.data;

    // Get project working hours configuration
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        workingHoursStart: true,
        workingHoursEnd: true,
        workingDays: true,
      },
    });

    if (!project) {
      throw AppError.notFound('Project');
    }

    await requireProjectRole(
      projectId,
      req.user!,
      HP_REQUEST_ROLES,
      'You do not have permission to calculate hold point notification times',
    );

    const requestedDate = parseRequiredDateTimeInput(requestedDateTime, 'requestedDateTime');
    const result = calculateNotificationTime(
      requestedDate,
      project.workingHoursStart || '07:00',
      project.workingHoursEnd || '17:00',
      project.workingDays || '1,2,3,4,5',
    );

    res.json(buildNotificationTimeResponse(requestedDate, result, project));
  }),
);

// Get project working hours configuration
holdPointReadRouter.get(
  '/project/:projectId/working-hours',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseHoldPointRouteParam(req.params.projectId, 'projectId');

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        workingDays: true,
      },
    });

    if (!project) {
      throw AppError.notFound('Project');
    }

    await requireInternalProjectReadAccess(projectId, req.user!);

    res.json(buildProjectWorkingHoursResponse(project));
  }),
);

// Preview evidence package before submitting HP release request (Feature #179)
holdPointReadRouter.post(
  '/preview-evidence-package',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = previewEvidencePackageSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const { lotId, itpChecklistItemId } = parseResult.data;

    // Get the lot with all related data
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        project: true,
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  orderBy: { sequenceNumber: 'asc' },
                },
              },
            },
            completions: {
              include: {
                completedBy: {
                  select: { id: true, fullName: true, email: true },
                },
                verifiedBy: {
                  select: { id: true, fullName: true, email: true },
                },
                attachments: {
                  include: {
                    document: true,
                  },
                },
              },
            },
          },
        },
        testResults: {
          include: {
            verifiedBy: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireLotReadAccess(lot, req.user!);
    await requireProjectRole(
      lot.projectId,
      req.user!,
      HP_REQUEST_ROLES,
      'You do not have permission to preview hold point evidence packages',
    );

    const { itpInstance, checklistItems, holdPointItem, itpTemplate } =
      resolveHoldPointEvidenceInputs({
        itpInstance: lot.itpInstance,
        checklistItemId: itpChecklistItemId,
      });

    const evidencePackage = buildHoldPointEvidencePackage({
      holdPoint: {
        id: 'preview', // Placeholder for preview
        description: holdPointItem.description,
        status: 'pending',
        notificationSentAt: null,
        scheduledDate: null,
        releasedAt: null,
        releasedByName: null,
        releasedByOrg: null,
        releaseMethod: null,
        releaseNotes: null,
      },
      lot,
      itpTemplate,
      checklistItems,
      completions: itpInstance.completions,
      holdPointSequenceNumber: holdPointItem.sequenceNumber,
      extraFields: { isPreview: true },
    });

    res.json(buildHoldPointEvidencePackageResponse(evidencePackage));
  }),
);
