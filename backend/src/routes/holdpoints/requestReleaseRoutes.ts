import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { sendHPReleaseRequestEmail } from '../../lib/email.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { buildFrontendUrl } from '../../lib/runtimeConfig.js';
import { logError } from '../../lib/serverLogger.js';
import {
  isValidEmailAddress,
  parseNotificationEmailList,
  parseHPDefaultRecipients,
  parseHPProjectSettings,
  requestReleaseSchema,
} from './validation.js';
import { parseScheduledDateInput } from './dateParsing.js';
import { HP_REQUEST_ROLES, requireLotReadAccess, requireProjectRole } from './access.js';
import { calculateWorkingDays } from './scheduling.js';
import { SECURE_LINK_EXPIRY_HOURS, hashHoldPointReleaseToken } from './tokens.js';
import { requireSuperintendentApprovalRecipients } from './superintendentRecipients.js';
import {
  buildHoldPointPrerequisites,
  buildIncompletePrerequisiteDetails,
  getIncompletePrerequisites,
  getPrecedingChecklistItems,
} from './prerequisites.js';
import { buildHoldPointReleaseRequestedResponse } from './actionResponses.js';
import { isReleaseGatedChecklistItem } from '../../lib/holdPointReleaseGating.js';
import {
  getHoldPointChecklistItemsForInstance,
  resolveHoldPointChecklistItemForInstance,
} from './itpSnapshot.js';

// =============================================================================
// Authenticated hold point RELEASE-REQUEST route. Moved verbatim from
// holdpoints.ts (behavior-preserving) and mounted back on holdpointsRouter at
// the same /api/holdpoints/request-release path, keeping its own requireAuth,
// after the read routes and before the /:id mutation + public token routes.
// Mutation (release/chase/escalate/resolve-escalation) and public token-release
// routes stay in holdpoints.ts.
// =============================================================================

interface HoldPointReleaseRecipient {
  email: string;
  fullName: string | null;
  secureToken: string;
  tokenExpiry: Date;
}

export const holdPointRequestReleaseRouter = Router();

// Request hold point release - checks prerequisites first
holdPointRequestReleaseRouter.post(
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

    const checklistItems = getHoldPointChecklistItemsForInstance(lot.itpInstance);

    // Find the hold point item from the assigned ITP snapshot, falling back to
    // the live template only for legacy instances without a snapshot.
    const holdPointItem = resolveHoldPointChecklistItemForInstance(
      lot.itpInstance,
      itpChecklistItemId,
    );
    if (!holdPointItem || !isReleaseGatedChecklistItem(holdPointItem)) {
      throw AppError.badRequest('Item is not release-gated');
    }
    const releaseLot = lot;
    const releaseHoldPointItem = holdPointItem;
    const existingHoldPoint = lot.holdPoints[0];

    if (existingHoldPoint?.status === 'released') {
      throw AppError.badRequest('This hold point has already been released.');
    }

    if (existingHoldPoint?.status === 'completed') {
      throw AppError.badRequest('This hold point has already been completed.');
    }

    // Get all preceding items
    const precedingItems = getPrecedingChecklistItems(checklistItems, holdPointItem.sequenceNumber);

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
    if (releaseTokenEntries.length === 0) {
      throw AppError.badRequest('At least one valid hold point release recipient is required.');
    }

    const notificationSentAt = new Date();
    const requestedBy = requestingUser?.fullName || requestingUser?.email || 'Unknown';
    const releaseUrl = buildFrontendUrl(
      `/projects/${releaseLot.project.id}/lots/${releaseLot.id}?tab=itp`,
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

    async function sendReleaseRequestEmail(recipient: HoldPointReleaseRecipient) {
      const secureReleaseUrl = buildFrontendUrl(`/hp-release/${recipient.secureToken}`);
      const evidencePackageUrl = `${secureReleaseUrl}#evidence-package`;

      let result: Awaited<ReturnType<typeof sendHPReleaseRequestEmail>>;
      try {
        result = await sendHPReleaseRequestEmail({
          to: recipient.email,
          superintendentName: recipient.fullName || 'Reviewer',
          projectName: releaseLot.project.name,
          lotNumber: releaseLot.lotNumber,
          holdPointDescription: releaseHoldPointItem.description,
          scheduledDate: formattedScheduledDate,
          scheduledTime: scheduledTime || undefined,
          evidencePackageUrl,
          releaseUrl,
          secureReleaseUrl, // Feature #23 - Include secure release link
          requestedBy,
          noticeOverrideReason: noticePeriodOverrideReason || undefined,
        });
      } catch (emailError) {
        logError('[HP Release Request] Failed to send superintendent email:', emailError);
        throw new AppError(
          502,
          'Failed to send hold point release request email',
          'EXTERNAL_SERVICE_ERROR',
        );
      }

      if (!result.success) {
        logError('[HP Release Request] Superintendent email was not accepted for delivery:', {
          error: result.error || 'Unknown email delivery failure',
          provider: result.provider,
        });
        throw new AppError(
          502,
          'Failed to send hold point release request email',
          'EXTERNAL_SERVICE_ERROR',
        );
      }
    }

    const holdPoint = await prisma.$transaction(async (tx) => {
      const data = {
        status: 'notified',
        notificationSentAt,
        notificationSentTo: normalizedNotificationSentTo,
        scheduledDate: scheduledDateValue,
        scheduledTime: scheduledTime || null,
        ...(overrideNote && { releaseNotes: overrideNote }),
      };

      const savedHoldPoint = existingHoldPoint
        ? await tx.holdPoint.update({
            where: { id: existingHoldPoint.id },
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

    // Send only after token persistence commits. Email delivery is an external
    // side effect, so it cannot be rolled back safely; committing first ensures
    // any accepted email contains a release link that remains valid.
    await Promise.all(releaseTokenEntries.map(sendReleaseRequestEmail));

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
