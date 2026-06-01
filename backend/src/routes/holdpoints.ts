import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import crypto from 'crypto';
import { sendNotificationIfEnabled } from './notifications.js';
import {
  sendHPReleaseRequestEmail,
  sendHPChaseEmail,
  sendHPReleaseConfirmationEmail,
} from '../lib/email.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { parsePagination, getPaginationMeta } from '../lib/pagination.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { activeSubcontractorCompanyWhere } from '../lib/projectAccess.js';
import { buildFrontendUrl } from '../lib/runtimeConfig.js';
import { logError } from '../lib/serverLogger.js';
import {
  MAX_ID_LENGTH,
  MAX_RELEASE_TOKEN_LENGTH,
  isValidEmailAddress,
  parseNotificationEmailList,
  parseHPDefaultRecipients,
  parseHPProjectSettings,
  requestReleaseSchema,
  releaseHoldPointSchema,
  escalateSchema,
  calculateNotificationTimeSchema,
  previewEvidencePackageSchema,
  publicReleaseSchema,
} from './holdpoints/validation.js';
import {
  parseScheduledDateInput,
  parseReleaseDateTimeInput,
  parseRequiredDateTimeInput,
} from './holdpoints/dateParsing.js';
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
} from './holdpoints/access.js';
import { calculateNotificationTime, calculateWorkingDays } from './holdpoints/scheduling.js';
import {
  SECURE_LINK_EXPIRY_HOURS,
  hashHoldPointReleaseToken,
  holdPointReleaseTokenLookup,
} from './holdpoints/tokens.js';
import {
  HP_SUPERINTENDENT_RELEASE_ROLES,
  requireSuperintendentApprovalRecipients,
} from './holdpoints/superintendentRecipients.js';
import {
  buildHoldPointEvidenceChecklist,
  buildHoldPointEvidencePackageResponse,
  buildHoldPointEvidenceSummary,
  buildPublicHoldPointEvidencePackageResponse,
  mapHoldPointEvidenceItpTemplate,
  mapHoldPointEvidenceLot,
  mapHoldPointEvidencePhotos,
  mapHoldPointEvidenceProject,
  mapHoldPointEvidenceTestResults,
} from './holdpoints/evidencePackage.js';
import {
  buildHoldPointPrerequisites,
  buildIncompletePrerequisiteDetails,
  getIncompletePrerequisites,
  getPrecedingChecklistItems,
} from './holdpoints/prerequisites.js';
import {
  buildEmptyHoldPointListResponse,
  buildHoldPointListItems,
  buildHoldPointListResponse,
} from './holdpoints/listPresentation.js';
import {
  buildHoldPointReleaseEmailNotification,
  buildHoldPointReleaseNotifications,
} from './holdpoints/releaseNotifications.js';
import {
  buildHoldPointReleaseConfirmationEmail,
  selectHoldPointReleaseContractors,
  selectHoldPointReleaseSuperintendents,
} from './holdpoints/releaseConfirmationEmails.js';
import {
  buildHoldPointChaseEmail,
  selectHoldPointChaseRecipients,
} from './holdpoints/chaseNotifications.js';
import {
  buildHoldPointDetailResponse,
  resolveHoldPointDetailSettings,
} from './holdpoints/detailResponse.js';
import {
  buildHoldPointChaseResponse,
  buildHoldPointEscalatedResponse,
  buildHoldPointEscalationResolvedResponse,
  buildHoldPointReleasedResponse,
  buildHoldPointReleaseRequestedResponse,
  buildPublicHoldPointReleasedResponse,
} from './holdpoints/actionResponses.js';
import {
  buildNotificationTimeResponse,
  buildProjectWorkingHoursResponse,
} from './holdpoints/workingHoursResponses.js';

interface HoldPointReleaseRecipient {
  email: string;
  fullName: string | null;
  secureToken: string;
  tokenExpiry: Date;
}

const holdpointsRouter = Router();

const HP_RELEASE_ROLES = [...HP_REQUEST_ROLES, 'superintendent'];
const HP_ESCALATION_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'superintendent',
];

function parseHoldPointRouteParam(
  value: unknown,
  fieldName: string,
  maxLength = MAX_ID_LENGTH,
): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

// Get all hold points for a project
holdpointsRouter.get(
  '/project/:projectId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseHoldPointRouteParam(req.params.projectId, 'projectId');
    const user = req.user!;

    await requireProjectReadAccess(projectId, user);
    await requireHoldPointsPortalAccess(projectId, user);

    // Build where clause for lots
    const lotsWhere: Prisma.LotWhereInput = { projectId };

    // Subcontractors can only see hold points on their assigned lots
    if (isSubcontractorUser(user)) {
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: {
          userId: user.id,
          subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
        },
        include: { subcontractorCompany: true },
      });

      if (subcontractorUser) {
        const subCompanyId = subcontractorUser.subcontractorCompanyId;

        // Get lots assigned via LotSubcontractorAssignment
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
        lotsWhere.OR = [
          { assignedSubcontractorId: subCompanyId },
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
                  where: { pointType: 'hold_point' },
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
          },
        },
      },
    });

    // Transform to a sorted hold point list (one item per hold-point checklist
    // item; persisted row reused when present, otherwise a virtual entry).
    const holdPoints = buildHoldPointListItems(lots);

    // Apply pagination
    const { page, limit } = parsePagination(req.query);
    const total = holdPoints.length;
    const start = (page - 1) * limit;
    const paginatedHoldPoints = holdPoints.slice(start, start + limit);

    res.json(
      buildHoldPointListResponse(paginatedHoldPoints, getPaginationMeta(total, page, limit)),
    );
  }),
);

// Get hold point details with prerequisite status
holdpointsRouter.get(
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
          include: { itpChecklistItem: true },
        },
      },
    });

    if (!lot || !lot.itpInstance) {
      throw AppError.notFound('Lot or ITP instance');
    }

    const user = req.user!;
    await requireLotReadAccess(lot, user);
    const hasRequestPermission = await canRequestHoldPointRelease(lot.projectId, user);

    // Find the hold point item
    const holdPointItem = lot.itpInstance.template.checklistItems.find((i) => i.id === itemId);
    if (!holdPointItem || holdPointItem.pointType !== 'hold_point') {
      throw AppError.notFound('Hold point item');
    }

    // Get all preceding items (items with lower sequence number)
    const precedingItems = getPrecedingChecklistItems(
      lot.itpInstance.template.checklistItems,
      holdPointItem.sequenceNumber,
    );

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

// Request hold point release - checks prerequisites first
holdpointsRouter.post(
  '/request-release',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = requestReleaseSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const {
      lotId,
      itpChecklistItemId,
      scheduledDate,
      scheduledTime,
      notificationSentTo,
      noticePeriodOverride,
      noticePeriodOverrideReason,
    } = parseResult.data;
    const scheduledDateValue = parseScheduledDateInput(scheduledDate);
    const notificationEmails = parseNotificationEmailList(notificationSentTo);
    const normalizedNotificationSentTo =
      notificationEmails.length > 0 ? notificationEmails.join(', ') : null;

    // Get the lot with ITP instance and project
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
            completions: true,
          },
        },
        holdPoints: {
          where: { itpChecklistItemId },
        },
      },
    });

    if (!lot || !lot.itpInstance) {
      throw AppError.notFound('Lot or ITP instance');
    }

    await requireLotReadAccess(lot, req.user!);
    await requireProjectRole(
      lot.projectId,
      req.user!,
      HP_REQUEST_ROLES,
      'You do not have permission to request hold point release',
    );

    // Find the hold point item
    const holdPointItem = lot.itpInstance.template.checklistItems.find(
      (i) => i.id === itpChecklistItemId,
    );
    if (!holdPointItem || holdPointItem.pointType !== 'hold_point') {
      throw AppError.badRequest('Item is not a hold point');
    }

    // Get all preceding items
    const precedingItems = getPrecedingChecklistItems(
      lot.itpInstance.template.checklistItems,
      holdPointItem.sequenceNumber,
    );

    // Check completion status of preceding items
    const prerequisites = buildHoldPointPrerequisites(precedingItems, lot.itpInstance.completions);
    const incompleteItems = getIncompletePrerequisites(prerequisites);

    // If there are incomplete prerequisites, return error with list
    if (incompleteItems.length > 0) {
      throw AppError.badRequest(
        'Cannot request hold point release until all preceding checklist items are completed.',
        {
          incompleteItems: buildIncompletePrerequisiteDetails(incompleteItems) as unknown as Record<
            string,
            unknown
          >,
        },
      );
    }

    // Check minimum notice period (Feature #180)
    const projectSettings = parseHPProjectSettings(lot.project.settings);

    // Default minimum notice period is 1 working day
    const minimumNoticeDays = projectSettings.holdPointMinimumNoticeDays ?? 1;

    if (scheduledDateValue && minimumNoticeDays > 0 && !noticePeriodOverride) {
      const today = new Date();
      const workingDays = calculateWorkingDays(
        today,
        scheduledDateValue,
        lot.project.workingDays || '1,2,3,4,5',
      );

      if (workingDays < minimumNoticeDays) {
        throw new AppError(
          400,
          `The scheduled date is less than the minimum ${minimumNoticeDays} working day${minimumNoticeDays > 1 ? 's' : ''} notice period.`,
          'NOTICE_PERIOD_WARNING',
          {
            scheduledDate,
            workingDaysNotice: workingDays,
            minimumNoticeDays,
            requiresOverride: true,
          },
        );
      }
    }

    // All prerequisites completed - create or update hold point request
    // If override was used, include the reason in notes
    const overrideNote =
      noticePeriodOverride && noticePeriodOverrideReason
        ? `[Notice period override: ${noticePeriodOverrideReason}]`
        : null;

    const requestingUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { fullName: true, email: true },
    });

    let recipientsToNotify = notificationEmails.map((email) => ({
      email,
      fullName: null as string | null,
    }));

    if (recipientsToNotify.length === 0) {
      const defaultRecipientEmails = parseHPDefaultRecipients(projectSettings);
      recipientsToNotify = defaultRecipientEmails.map((email) => ({
        email,
        fullName: null as string | null,
      }));
    }

    if (recipientsToNotify.length === 0) {
      // Get project users with superintendent role to notify
      const superintendents = await prisma.projectUser.findMany({
        where: {
          projectId: lot.project.id,
          role: 'superintendent',
          status: 'active',
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });

      // If no superintendents, also check for project managers
      const projectUserRecipients =
        superintendents.length > 0
          ? superintendents
          : await prisma.projectUser.findMany({
              where: {
                projectId: lot.project.id,
                role: 'project_manager',
                status: 'active',
              },
              include: {
                user: { select: { id: true, email: true, fullName: true } },
              },
            });

      recipientsToNotify = projectUserRecipients.map((recipient) => ({
        email: recipient.user.email,
        fullName: recipient.user.fullName,
      }));
    }

    recipientsToNotify = await requireSuperintendentApprovalRecipients(
      lot.projectId,
      projectSettings,
      recipientsToNotify,
    );

    const uniqueRecipients = new Map<string, HoldPointReleaseRecipient>();
    for (const recipient of recipientsToNotify) {
      const email = recipient.email.trim();
      if (!email || !isValidEmailAddress(email)) {
        continue;
      }

      const key = email.toLowerCase();
      if (!uniqueRecipients.has(key)) {
        const tokenExpiry = new Date(Date.now() + SECURE_LINK_EXPIRY_HOURS * 60 * 60 * 1000);
        uniqueRecipients.set(key, {
          email,
          fullName: recipient.fullName,
          secureToken: crypto.randomBytes(32).toString('hex'),
          tokenExpiry,
        });
      }
    }

    const releaseTokenEntries = Array.from(uniqueRecipients.values());

    const notificationSentAt = new Date();

    const holdPoint = await prisma.$transaction(async (tx) => {
      const data = {
        status: 'notified',
        notificationSentAt,
        notificationSentTo: normalizedNotificationSentTo,
        scheduledDate: scheduledDateValue,
        scheduledTime: scheduledTime || null,
        ...(overrideNote && { releaseNotes: overrideNote }),
      };

      const savedHoldPoint =
        lot.holdPoints.length > 0
          ? await tx.holdPoint.update({
              where: { id: lot.holdPoints[0].id },
              data,
              include: { itpChecklistItem: true },
            })
          : await tx.holdPoint.create({
              data: {
                lotId,
                itpChecklistItemId,
                pointType: 'hold_point',
                description: holdPointItem.description,
                ...data,
              },
              include: { itpChecklistItem: true },
            });

      await tx.holdPointReleaseToken.deleteMany({
        where: {
          holdPointId: savedHoldPoint.id,
          usedAt: null,
        },
      });

      if (releaseTokenEntries.length > 0) {
        await tx.holdPointReleaseToken.createMany({
          data: releaseTokenEntries.map((recipient) => ({
            holdPointId: savedHoldPoint.id,
            recipientEmail: recipient.email,
            recipientName: recipient.fullName,
            token: hashHoldPointReleaseToken(recipient.secureToken),
            expiresAt: recipient.tokenExpiry,
          })),
        });
      }

      return savedHoldPoint;
    });

    // Feature #946 - Send HP release request email to superintendent
    try {
      const requestedBy = requestingUser?.fullName || requestingUser?.email || 'Unknown';
      const releaseUrl = buildFrontendUrl(`/projects/${lot.project.id}/lots/${lot.id}?tab=itp`);
      const evidencePackageUrl = buildFrontendUrl(
        `/projects/${lot.project.id}/lots/${lot.id}/evidence-preview?holdPointId=${holdPoint.id}`,
      );

      // Format scheduled date for display
      const formattedScheduledDate = scheduledDateValue
        ? scheduledDateValue.toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : undefined;

      for (const recipient of releaseTokenEntries) {
        // Generate secure release URL
        const secureReleaseUrl = buildFrontendUrl(`/hp-release/${recipient.secureToken}`);

        await sendHPReleaseRequestEmail({
          to: recipient.email,
          superintendentName: recipient.fullName || 'Reviewer',
          projectName: lot.project.name,
          lotNumber: lot.lotNumber,
          holdPointDescription: holdPointItem.description,
          scheduledDate: formattedScheduledDate,
          scheduledTime: scheduledTime || undefined,
          evidencePackageUrl,
          releaseUrl,
          secureReleaseUrl, // Feature #23 - Include secure release link
          requestedBy,
          noticeOverrideReason: noticePeriodOverrideReason || undefined,
        });
      }
    } catch (emailError) {
      logError('[HP Release Request] Failed to send superintendent email:', emailError);
      // Don't fail the main request
    }

    // Audit log for HP release request
    await createAuditLog({
      projectId: lot.project.id,
      userId: req.user!.userId,
      entityType: 'hold_point',
      entityId: holdPoint.id,
      action: AuditAction.HP_RELEASE_REQUESTED,
      changes: {
        lotId,
        itpChecklistItemId,
        scheduledDate,
        scheduledTime,
        notificationSentTo: normalizedNotificationSentTo,
        noticePeriodOverride,
      },
      req,
    });

    res.json(buildHoldPointReleaseRequestedResponse(holdPoint));
  }),
);

// Release a hold point
holdpointsRouter.post(
  '/:id/release',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseHoldPointRouteParam(req.params.id, 'id');
    const parseResult = releaseHoldPointSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const {
      releasedByName,
      releasedByOrg,
      releaseDate,
      releaseTime,
      releaseMethod,
      releaseNotes,
      signatureDataUrl,
    } = parseResult.data;

    // Feature #698 - Check HP approval requirements from project settings
    const existingHP = await prisma.holdPoint.findUnique({
      where: { id },
      include: {
        lot: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!existingHP) {
      throw AppError.notFound('Hold point');
    }

    const user = req.user!;
    await requireHoldPointReadAccess(existingHP, user);
    await requireProjectRole(
      existingHP.lot.projectId,
      user,
      HP_RELEASE_ROLES,
      'You do not have permission to release hold points',
    );

    // Check if project requires superintendent-only release
    let approvalRequirement = 'any';
    if (existingHP.lot.project.settings) {
      try {
        const settings = JSON.parse(existingHP.lot.project.settings);
        if (settings.hpApprovalRequirement) {
          approvalRequirement = settings.hpApprovalRequirement;
        }
      } catch (_e) {
        // Invalid JSON, use default
      }
    }

    // If superintendent-only, check user's role in the project
    if (approvalRequirement === 'superintendent') {
      await requireProjectRole(
        existingHP.lot.projectId,
        user,
        HP_SUPERINTENDENT_RELEASE_ROLES,
        'This project requires superintendent approval to release hold points.',
      );
    }

    if (existingHP.status === 'released') {
      throw AppError.badRequest('This hold point has already been released.');
    }

    const releasedAt = parseReleaseDateTimeInput(releaseDate, releaseTime);
    const holdPoint = await prisma.$transaction(async (tx) => {
      const updatedHoldPoint = await tx.holdPoint.update({
        where: { id },
        data: {
          status: 'released',
          releasedAt,
          releasedByName: releasedByName || null,
          releasedByOrg: releasedByOrg || null,
          releaseMethod: releaseMethod || null,
          releaseSignatureUrl: signatureDataUrl || null,
          releaseNotes: releaseNotes || null,
        },
        include: {
          itpChecklistItem: true,
          lot: true,
        },
      });

      // Also mark the ITP completion as verified in the same transaction.
      const itpInstance = await tx.iTPInstance.findUnique({
        where: { lotId: updatedHoldPoint.lotId },
        select: { id: true },
      });

      if (itpInstance) {
        await tx.iTPCompletion.updateMany({
          where: {
            itpInstanceId: itpInstance.id,
            checklistItemId: updatedHoldPoint.itpChecklistItemId,
          },
          data: {
            verificationStatus: 'verified',
            verifiedById: req.user!.userId,
            verifiedAt: releasedAt,
          },
        });
      }

      return updatedHoldPoint;
    });

    // Feature #925 - HP release notification to team
    // Get project team members to notify about HP release
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: existingHP.lot.projectId,
        status: 'active',
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    // Create in-app notifications for all project team members
    const notificationsToCreate = buildHoldPointReleaseNotifications(projectUsers, {
      projectId: existingHP.lot.projectId,
      holdPointDescription: holdPoint.description,
      lotNumber: holdPoint.lot.lotNumber,
      releasedByName,
    });

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // Send email notifications to team members (if configured). The payload is
    // the same for every recipient, so build it once.
    const releaseEmailNotification = buildHoldPointReleaseEmailNotification({
      projectId: existingHP.lot.projectId,
      holdPointDescription: holdPoint.description,
      lotNumber: holdPoint.lot.lotNumber,
      releasedByName,
      projectName: existingHP.lot.project.name,
      releaseMethod,
      releaseNotes,
    });
    for (const pu of projectUsers) {
      try {
        await sendNotificationIfEnabled(pu.userId, 'holdPointRelease', releaseEmailNotification);
      } catch (emailError) {
        logError(`[HP Release] Failed to send email to user ${pu.userId}:`, emailError);
        // Continue with other notifications even if one fails
      }
    }

    // Feature #948 - Send HP release confirmation emails to contractor and superintendent
    try {
      const lotUrl = buildFrontendUrl(
        `/projects/${existingHP.lot.projectId}/lots/${existingHP.lot.id}`,
      );
      const releasedAtDisplay = releasedAt.toLocaleString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const confirmationContext = {
        projectName: existingHP.lot.project.name,
        lotNumber: holdPoint.lot.lotNumber,
        holdPointDescription: holdPoint.description,
        releasedByName,
        releasedByOrg,
        releaseMethod,
        releaseNotes,
        releasedAt: releasedAtDisplay,
        lotUrl,
      };

      // Send to contractors (site_engineer, foreman roles)
      const contractors = selectHoldPointReleaseContractors(projectUsers);
      for (const contractor of contractors) {
        await sendHPReleaseConfirmationEmail(
          buildHoldPointReleaseConfirmationEmail(contractor, 'contractor', confirmationContext),
        );
      }

      // Send to superintendents
      const superintendents = selectHoldPointReleaseSuperintendents(projectUsers);
      for (const superintendent of superintendents) {
        await sendHPReleaseConfirmationEmail(
          buildHoldPointReleaseConfirmationEmail(
            superintendent,
            'superintendent',
            confirmationContext,
          ),
        );
      }
    } catch (emailError) {
      logError('[HP Release] Failed to send confirmation emails:', emailError);
      // Don't fail the main request
    }

    // Audit log for HP release
    await createAuditLog({
      projectId: existingHP.lot.projectId,
      userId: req.user!.userId,
      entityType: 'hold_point',
      entityId: id,
      action: AuditAction.HP_RELEASED,
      changes: {
        releasedByName,
        releasedByOrg,
        releaseDate,
        releaseTime,
        releaseMethod,
        releaseNotes,
        signatureDataUrl: signatureDataUrl ? '[captured]' : null,
      },
      req,
    });

    res.json(buildHoldPointReleasedResponse(holdPoint, projectUsers));
  }),
);

// Chase a hold point (send reminder)
holdpointsRouter.post(
  '/:id/chase',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseHoldPointRouteParam(req.params.id, 'id');

    // Get the hold point with lot and project details before updating
    const existingHP = await prisma.holdPoint.findUnique({
      where: { id },
      include: {
        lot: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!existingHP) {
      throw AppError.notFound('Hold point');
    }

    await requireHoldPointReadAccess(existingHP, req.user!);
    await requireProjectRole(
      existingHP.lot.projectId,
      req.user!,
      HP_REQUEST_ROLES,
      'You do not have permission to chase hold points',
    );

    if (existingHP.status === 'released') {
      throw AppError.badRequest('Released hold points cannot be chased.');
    }

    const holdPoint = await prisma.holdPoint.update({
      where: { id },
      data: {
        chaseCount: { increment: 1 },
        lastChasedAt: new Date(),
      },
    });

    // Feature #947 - Send HP chase email to superintendent
    try {
      // Get project users with superintendent role to notify
      const superintendents = await prisma.projectUser.findMany({
        where: {
          projectId: existingHP.lot.project.id,
          role: 'superintendent',
          status: 'active',
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });

      // If no superintendents, also check for project managers. Keep the lookup
      // lazy: project managers are only queried when there are no superintendents.
      const projectManagers: typeof superintendents =
        superintendents.length > 0
          ? []
          : await prisma.projectUser.findMany({
              where: {
                projectId: existingHP.lot.project.id,
                role: 'project_manager',
                status: 'active',
              },
              include: {
                user: { select: { id: true, email: true, fullName: true } },
              },
            });
      const recipientsToNotify = selectHoldPointChaseRecipients(superintendents, projectManagers);

      const releaseUrl = buildFrontendUrl(
        `/projects/${existingHP.lot.project.id}/lots/${existingHP.lot.id}?tab=itp`,
      );
      const evidencePackageUrl = buildFrontendUrl(
        `/projects/${existingHP.lot.project.id}/lots/${existingHP.lot.id}/evidence-preview?holdPointId=${existingHP.id}`,
      );

      // Calculate days since original request
      const originalRequestDate = existingHP.notificationSentAt || existingHP.createdAt;
      const daysSinceRequest = Math.floor(
        (Date.now() - originalRequestDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const formattedRequestDate = originalRequestDate.toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const chaseContext = {
        projectName: existingHP.lot.project.name,
        lotNumber: existingHP.lot.lotNumber,
        holdPointDescription: existingHP.description,
        originalRequestDate: formattedRequestDate,
        chaseCount: holdPoint.chaseCount,
        daysSinceRequest,
        evidencePackageUrl,
        releaseUrl,
        notificationSentTo: existingHP.notificationSentTo,
      };

      for (const recipient of recipientsToNotify) {
        await sendHPChaseEmail(buildHoldPointChaseEmail(recipient, chaseContext));
      }
    } catch (emailError) {
      logError('[HP Chase] Failed to send chase email:', emailError);
      // Don't fail the main request
    }

    // Audit log for HP chase
    await createAuditLog({
      projectId: existingHP.lot.project.id,
      userId: req.user!.userId,
      entityType: 'hold_point',
      entityId: id,
      action: AuditAction.HP_CHASED,
      changes: { chaseCount: holdPoint.chaseCount },
      req,
    });

    res.json(buildHoldPointChaseResponse(holdPoint));
  }),
);

// Escalate a hold point to QM/PM
holdpointsRouter.post(
  '/:id/escalate',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseHoldPointRouteParam(req.params.id, 'id');
    const parseResult = escalateSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const { escalatedTo, escalationReason } = parseResult.data;
    const userId = req.user!.userId;

    // Get hold point with lot/project info
    const existingHP = await prisma.holdPoint.findUnique({
      where: { id },
      include: {
        lot: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!existingHP) {
      throw AppError.notFound('Hold point');
    }

    await requireHoldPointReadAccess(existingHP, req.user!);
    await requireProjectRole(
      existingHP.lot.projectId,
      req.user!,
      HP_ESCALATION_ROLES,
      'You do not have permission to escalate hold points',
    );

    if (existingHP.status === 'released') {
      throw AppError.badRequest('Released hold points cannot be escalated.');
    }

    // Update hold point with escalation info
    const holdPoint = await prisma.holdPoint.update({
      where: { id },
      data: {
        isEscalated: true,
        escalatedAt: new Date(),
        escalatedById: userId,
        escalatedTo: escalatedTo || 'QM,PM', // Default to QM and PM
        escalationReason: escalationReason || 'Stale hold point - no response received',
      },
      include: {
        lot: true,
        itpChecklistItem: true,
      },
    });

    // Get QM/PM users from the project to notify
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: existingHP.lot.projectId,
        role: { in: ['admin', 'project_manager', 'qm', 'quality_manager'] },
        status: 'active',
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    // Create notifications for QM/PM users
    const notificationsToCreate = projectUsers.map((pu) => ({
      userId: pu.userId,
      projectId: existingHP.lot.projectId,
      type: 'hold_point_escalation',
      title: 'Hold Point Escalated',
      message: `Hold point "${holdPoint.description}" on lot ${holdPoint.lot.lotNumber} has been escalated. Reason: ${holdPoint.escalationReason}`,
      linkUrl: `/projects/${existingHP.lot.projectId}/holdpoints/${id}`,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // Audit log for HP escalation
    await createAuditLog({
      projectId: existingHP.lot.projectId,
      userId,
      entityType: 'hold_point',
      entityId: id,
      action: AuditAction.HP_ESCALATED,
      changes: { escalatedTo, escalationReason },
      req,
    });

    res.json(buildHoldPointEscalatedResponse(holdPoint, projectUsers));
  }),
);

// Resolve an escalated hold point
holdpointsRouter.post(
  '/:id/resolve-escalation',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseHoldPointRouteParam(req.params.id, 'id');

    const existingHP = await prisma.holdPoint.findUnique({
      where: { id },
      include: { lot: { select: { projectId: true } } },
    });

    if (!existingHP) {
      throw AppError.notFound('Hold point');
    }

    await requireProjectReadAccess(
      existingHP.lot.projectId,
      req.user!,
      'You do not have access to this hold point',
    );
    await requireProjectRole(
      existingHP.lot.projectId,
      req.user!,
      HP_ESCALATION_ROLES,
      'You do not have permission to resolve hold point escalations',
    );

    const holdPoint = await prisma.holdPoint.update({
      where: { id },
      data: {
        escalationResolved: true,
        escalationResolvedAt: new Date(),
      },
      include: { lot: { select: { projectId: true } } },
    });

    // Audit log for HP escalation resolved
    await createAuditLog({
      projectId: holdPoint.lot.projectId,
      userId: req.user!.userId,
      entityType: 'hold_point',
      entityId: id,
      action: AuditAction.HP_ESCALATION_RESOLVED,
      changes: { escalationResolved: true },
      req,
    });

    res.json(buildHoldPointEscalationResolvedResponse(holdPoint));
  }),
);

// Generate evidence package for a hold point
holdpointsRouter.get(
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
            documents: {
              where: {
                OR: [{ documentType: 'photo' }, { category: 'itp_evidence' }],
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
    const itpInstance = lot.itpInstance;

    if (!itpInstance) {
      throw AppError.badRequest('No ITP assigned to this lot');
    }

    // Get all checklist items up to and including the hold point
    const holdPointItem = holdPoint.itpChecklistItem;
    const checklistWithStatus = buildHoldPointEvidenceChecklist(
      itpInstance.template.checklistItems,
      itpInstance.completions,
      holdPointItem.sequenceNumber,
    );

    const testResults = mapHoldPointEvidenceTestResults(lot.testResults);

    const photos = mapHoldPointEvidencePhotos(lot.documents);

    // Build evidence package response
    const evidencePackage = {
      holdPoint: {
        id: holdPoint.id,
        description: holdPoint.description,
        status: holdPoint.status,
        notificationSentAt: holdPoint.notificationSentAt,
        scheduledDate: holdPoint.scheduledDate,
        releasedAt: holdPoint.releasedAt,
        releasedByName: holdPoint.releasedByName,
        releaseNotes: holdPoint.releaseNotes,
      },
      lot: mapHoldPointEvidenceLot(lot),
      project: mapHoldPointEvidenceProject(lot.project),
      itpTemplate: mapHoldPointEvidenceItpTemplate(itpInstance.template),
      checklist: checklistWithStatus,
      testResults,
      photos,
      summary: buildHoldPointEvidenceSummary(checklistWithStatus, testResults, photos),
      generatedAt: new Date().toISOString(),
    };

    res.json(buildHoldPointEvidencePackageResponse(evidencePackage));
  }),
);

// Get notification timing for a hold point request based on working hours
holdpointsRouter.post(
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
holdpointsRouter.get(
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
holdpointsRouter.post(
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
        documents: {
          where: {
            OR: [{ documentType: 'photo' }, { category: 'itp_evidence' }],
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

    const itpInstance = lot.itpInstance;
    if (!itpInstance) {
      throw AppError.badRequest('No ITP assigned to this lot');
    }

    // Get the hold point checklist item
    const holdPointItem = itpInstance.template.checklistItems.find(
      (item) => item.id === itpChecklistItemId,
    );

    if (!holdPointItem) {
      throw AppError.notFound('Hold point checklist item');
    }

    // Get all checklist items up to and including the hold point
    const checklistWithStatus = buildHoldPointEvidenceChecklist(
      itpInstance.template.checklistItems,
      itpInstance.completions,
      holdPointItem.sequenceNumber,
    );

    const testResults = mapHoldPointEvidenceTestResults(lot.testResults);

    const photos = mapHoldPointEvidencePhotos(lot.documents);

    // Build preview evidence package response
    const evidencePackage = {
      holdPoint: {
        id: 'preview', // Placeholder for preview
        description: holdPointItem.description,
        status: 'pending',
        notificationSentAt: null,
        scheduledDate: null,
        releasedAt: null,
        releasedByName: null,
        releaseNotes: null,
      },
      lot: mapHoldPointEvidenceLot(lot),
      project: mapHoldPointEvidenceProject(lot.project),
      itpTemplate: mapHoldPointEvidenceItpTemplate(itpInstance.template),
      checklist: checklistWithStatus,
      testResults,
      photos,
      summary: buildHoldPointEvidenceSummary(checklistWithStatus, testResults, photos),
      isPreview: true,
      generatedAt: new Date().toISOString(),
    };

    res.json(buildHoldPointEvidencePackageResponse(evidencePackage));
  }),
);

// ============================================================================
// PUBLIC ENDPOINTS - No authentication required (Feature #23)
// These endpoints use secure time-limited tokens for superintendent access
// ============================================================================

// Get hold point and evidence package via secure link (no auth required)
holdpointsRouter.get(
  '/public/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const token = parseHoldPointRouteParam(req.params.token, 'token', MAX_RELEASE_TOKEN_LENGTH);

    // Find the token and validate it
    const releaseToken = await prisma.holdPointReleaseToken.findFirst({
      where: holdPointReleaseTokenLookup(token),
      include: {
        holdPoint: {
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
                documents: {
                  where: {
                    OR: [{ documentType: 'photo' }, { category: 'itp_evidence' }],
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!releaseToken) {
      throw AppError.notFound('Invalid or expired link');
    }

    // Check if token has expired
    if (new Date() > releaseToken.expiresAt) {
      throw new AppError(
        410,
        'This secure release link has expired. Please contact the site team for a new link.',
        'TOKEN_EXPIRED',
      );
    }

    // Check if token has been used (hold point already released via this token)
    if (releaseToken.usedAt) {
      throw new AppError(
        410,
        'This hold point has already been released using this link.',
        'TOKEN_USED',
        {
          releasedAt: releaseToken.usedAt as unknown as Record<string, unknown>,
          releasedByName: releaseToken.releasedByName as unknown as Record<string, unknown>,
        },
      );
    }

    const holdPoint = releaseToken.holdPoint;
    const lot = holdPoint.lot;
    const itpInstance = lot.itpInstance;

    if (!itpInstance) {
      throw AppError.badRequest('No ITP assigned to this lot');
    }

    // Get all checklist items up to and including the hold point
    const holdPointItem = holdPoint.itpChecklistItem;
    const checklistWithStatus = buildHoldPointEvidenceChecklist(
      itpInstance.template.checklistItems,
      itpInstance.completions,
      holdPointItem.sequenceNumber,
    );

    const testResults = mapHoldPointEvidenceTestResults(lot.testResults);

    const photos = mapHoldPointEvidencePhotos(lot.documents);

    // Build evidence package response
    const evidencePackage = {
      holdPoint: {
        id: holdPoint.id,
        description: holdPoint.description,
        status: holdPoint.status,
        notificationSentAt: holdPoint.notificationSentAt,
        scheduledDate: holdPoint.scheduledDate,
        scheduledTime: holdPoint.scheduledTime,
        releasedAt: holdPoint.releasedAt,
        releasedByName: holdPoint.releasedByName,
        releaseNotes: holdPoint.releaseNotes,
      },
      lot: mapHoldPointEvidenceLot(lot),
      project: mapHoldPointEvidenceProject(lot.project),
      itpTemplate: mapHoldPointEvidenceItpTemplate(itpInstance.template),
      checklist: checklistWithStatus,
      testResults,
      photos,
      summary: buildHoldPointEvidenceSummary(checklistWithStatus, testResults, photos),
      generatedAt: new Date().toISOString(),
    };

    // Token info for the UI
    const tokenInfo = {
      recipientEmail: releaseToken.recipientEmail,
      recipientName: releaseToken.recipientName,
      expiresAt: releaseToken.expiresAt,
      canRelease: holdPoint.status !== 'released',
    };

    res.json(buildPublicHoldPointEvidencePackageResponse(evidencePackage, tokenInfo));
  }),
);

// Release hold point via secure link (no auth required)
holdpointsRouter.post(
  '/public/:token/release',
  asyncHandler(async (req: Request, res: Response) => {
    const token = parseHoldPointRouteParam(req.params.token, 'token', MAX_RELEASE_TOKEN_LENGTH);
    const parseResult = publicReleaseSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const { releasedByName, releasedByOrg, releaseNotes, signatureDataUrl } = parseResult.data;

    // Find the token and validate it
    const releaseToken = await prisma.holdPointReleaseToken.findFirst({
      where: holdPointReleaseTokenLookup(token),
      include: {
        holdPoint: {
          include: {
            lot: {
              include: {
                project: true,
              },
            },
            itpChecklistItem: true,
          },
        },
      },
    });

    if (!releaseToken) {
      throw AppError.notFound('Invalid or expired link');
    }

    // Check if token has expired
    if (new Date() > releaseToken.expiresAt) {
      throw new AppError(
        410,
        'This secure release link has expired. Please contact the site team for a new link.',
        'TOKEN_EXPIRED',
      );
    }

    // Check if token has been used
    if (releaseToken.usedAt) {
      throw new AppError(
        410,
        'This hold point has already been released using this link.',
        'TOKEN_USED',
        {
          releasedAt: releaseToken.usedAt as unknown as Record<string, unknown>,
          releasedByName: releaseToken.releasedByName as unknown as Record<string, unknown>,
        },
      );
    }

    // Check if hold point is already released
    if (releaseToken.holdPoint.status === 'released') {
      throw AppError.badRequest('This hold point has already been released.');
    }

    const projectSettings = parseHPProjectSettings(releaseToken.holdPoint.lot.project.settings);
    const tokenRecipientName = releaseToken.recipientName?.trim();
    const effectiveReleasedByName = tokenRecipientName || releasedByName;
    await requireSuperintendentApprovalRecipients(
      releaseToken.holdPoint.lot.projectId,
      projectSettings,
      [
        {
          email: releaseToken.recipientEmail,
          fullName: releaseToken.recipientName,
        },
      ],
    );

    const releasedAt = new Date();
    const holdPoint = await prisma.$transaction(async (tx) => {
      const tokenUpdate = await tx.holdPointReleaseToken.updateMany({
        where: {
          id: releaseToken.id,
          usedAt: null,
        },
        data: {
          usedAt: releasedAt,
          releasedByName: effectiveReleasedByName,
          releasedByOrg: releasedByOrg || null,
          releaseSignatureUrl: signatureDataUrl || null,
          releaseNotes: releaseNotes || null,
        },
      });

      if (tokenUpdate.count !== 1) {
        throw new AppError(
          410,
          'This hold point has already been released using this link.',
          'TOKEN_USED',
        );
      }

      const holdPointUpdate = await tx.holdPoint.updateMany({
        where: {
          id: releaseToken.holdPoint.id,
          status: { not: 'released' },
        },
        data: {
          status: 'released',
          releasedAt,
          releasedByName: effectiveReleasedByName,
          releasedByOrg: releasedByOrg || null,
          releaseMethod: 'secure_link',
          releaseSignatureUrl: signatureDataUrl || null,
          releaseNotes: releaseNotes || null,
        },
      });

      if (holdPointUpdate.count !== 1) {
        throw AppError.badRequest('This hold point has already been released.');
      }

      const updatedHoldPoint = await tx.holdPoint.findUnique({
        where: { id: releaseToken.holdPoint.id },
        include: {
          lot: true,
          itpChecklistItem: true,
        },
      });

      if (!updatedHoldPoint) {
        throw AppError.notFound('Hold point');
      }

      // Also mark the ITP completion as verified in the same transaction.
      const itpInstance = await tx.iTPInstance.findUnique({
        where: { lotId: updatedHoldPoint.lotId },
        select: { id: true },
      });

      if (itpInstance) {
        await tx.iTPCompletion.updateMany({
          where: {
            itpInstanceId: itpInstance.id,
            checklistItemId: updatedHoldPoint.itpChecklistItemId,
          },
          data: {
            verificationStatus: 'verified',
            verifiedAt: releasedAt,
          },
        });
      }

      return updatedHoldPoint;
    });

    // Create in-app notifications for project team members
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: releaseToken.holdPoint.lot.projectId,
        status: 'active',
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    const notificationsToCreate = projectUsers.map((pu) => ({
      userId: pu.userId,
      projectId: releaseToken.holdPoint.lot.projectId,
      type: 'hold_point_release',
      title: 'Hold Point Released (via Secure Link)',
      message: `Hold point "${holdPoint.description}" on lot ${holdPoint.lot.lotNumber} has been released by ${effectiveReleasedByName} via secure link.`,
      linkUrl: `/projects/${releaseToken.holdPoint.lot.projectId}/hold-points`,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // Send confirmation emails
    try {
      const lotUrl = buildFrontendUrl(
        `/projects/${releaseToken.holdPoint.lot.projectId}/lots/${releaseToken.holdPoint.lot.id}`,
      );
      const releasedAt = new Date().toLocaleString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Send to contractors (site_engineer, foreman roles)
      const contractorRoles = ['site_engineer', 'foreman', 'engineer'];
      const contractors = projectUsers.filter((pu) => contractorRoles.includes(pu.role));

      for (const contractor of contractors) {
        await sendHPReleaseConfirmationEmail({
          to: contractor.user.email,
          recipientName: contractor.user.fullName || 'Site Team',
          recipientRole: 'contractor',
          projectName: releaseToken.holdPoint.lot.project.name,
          lotNumber: holdPoint.lot.lotNumber,
          holdPointDescription: holdPoint.description || 'Hold Point',
          releasedByName: effectiveReleasedByName,
          releasedByOrg: releasedByOrg || undefined,
          releaseMethod: 'secure_link',
          releaseNotes: releaseNotes || undefined,
          releasedAt,
          lotUrl,
        });
      }

      // Send to superintendents
      const superintendentRoles = ['superintendent', 'project_manager'];
      const superintendents = projectUsers.filter((pu) => superintendentRoles.includes(pu.role));

      for (const superintendent of superintendents) {
        await sendHPReleaseConfirmationEmail({
          to: superintendent.user.email,
          recipientName: superintendent.user.fullName || 'Superintendent',
          recipientRole: 'superintendent',
          projectName: releaseToken.holdPoint.lot.project.name,
          lotNumber: holdPoint.lot.lotNumber,
          holdPointDescription: holdPoint.description || 'Hold Point',
          releasedByName: effectiveReleasedByName,
          releasedByOrg: releasedByOrg || undefined,
          releaseMethod: 'secure_link',
          releaseNotes: releaseNotes || undefined,
          releasedAt,
          lotUrl,
        });
      }
    } catch (emailError) {
      logError('[HP Secure Release] Failed to send confirmation emails:', emailError);
      // Don't fail the main request
    }

    // Audit log for public HP release (no userId - public endpoint)
    await createAuditLog({
      projectId: releaseToken.holdPoint.lot.projectId,
      entityType: 'hold_point',
      entityId: holdPoint.id,
      action: AuditAction.HP_PUBLIC_RELEASED,
      changes: {
        releasedByName: effectiveReleasedByName,
        submittedReleasedByName: releasedByName,
        releasedByOrg,
        releaseMethod: 'secure_link',
        tokenRecipient: releaseToken.recipientEmail,
        tokenRecipientName: releaseToken.recipientName,
      },
      req,
    });

    res.json(buildPublicHoldPointReleasedResponse(holdPoint));
  }),
);

export { holdpointsRouter };
