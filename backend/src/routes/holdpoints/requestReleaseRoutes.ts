import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { sendEmail, sendHPReleaseRequestEmail } from '../../lib/email.js';
import { renderHoldPointBatchReleaseRequestEmail } from '../../lib/email/holdPointTemplates.js';
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
  getHoldPointMinimumNoticeDays,
  emailAddressSchema,
  MAX_EVIDENCE_DOCUMENT_IDS,
  MAX_NAME_LENGTH,
  nullableScheduledDateSchema,
  nullableScheduledTimeSchema,
  nullableTrimmedStringSchema,
  requiredIdSchema,
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
import { emitHoldPointWebhookEvent } from './webhookEvents.js';
import { attachHoldPointEvidenceDocuments } from './evidenceAttachments.js';

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

type HoldPointRequestStateData = {
  status: 'notified';
  notificationSentAt: Date;
  notificationSentTo: string | null;
  scheduledDate: Date | null;
  scheduledTime: string | null;
  releaseNotes?: string;
};

export const holdPointRequestReleaseRouter = Router();

const MAX_BATCH_RELEASE_ITEMS = 25;

const batchRequestReleaseItemSchema = z.object({
  itpChecklistItemId: requiredIdSchema('itpChecklistItemId'),
  evidenceDocumentIds: z
    .array(requiredIdSchema('evidenceDocumentIds'))
    .max(
      MAX_EVIDENCE_DOCUMENT_IDS,
      `evidenceDocumentIds cannot exceed ${MAX_EVIDENCE_DOCUMENT_IDS} documents`,
    )
    .optional()
    .default([]),
});

const batchRequestReleaseSchema = z
  .object({
    lotId: requiredIdSchema('lotId'),
    items: z
      .array(batchRequestReleaseItemSchema)
      .min(1, 'At least one hold point is required')
      .max(
        MAX_BATCH_RELEASE_ITEMS,
        `A batch release request cannot exceed ${MAX_BATCH_RELEASE_ITEMS} hold points`,
      ),
    sharedEvidenceDocumentIds: z
      .array(requiredIdSchema('sharedEvidenceDocumentIds'))
      .max(
        MAX_EVIDENCE_DOCUMENT_IDS,
        `sharedEvidenceDocumentIds cannot exceed ${MAX_EVIDENCE_DOCUMENT_IDS} documents`,
      )
      .optional()
      .default([]),
    scheduledDate: nullableScheduledDateSchema,
    scheduledTime: nullableScheduledTimeSchema,
    recipientEmail: emailAddressSchema,
    recipientName: nullableTrimmedStringSchema(MAX_NAME_LENGTH, 'recipientName'),
    noticeHours: z
      .number()
      .int()
      .min(0)
      .max(24 * 365)
      .optional(),
  })
  .superRefine((data, ctx) => {
    const seenItemIds = new Set<string>();
    data.items.forEach((item, index) => {
      if (seenItemIds.has(item.itpChecklistItemId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'itpChecklistItemId'],
          message: 'Duplicate hold point items are not allowed',
        });
      }
      seenItemIds.add(item.itpChecklistItemId);
    });
  });

function rejectTerminalHoldPointRequest(status: string): never {
  if (status === 'released') {
    throw AppError.badRequest('This hold point has already been released.');
  }

  if (status === 'completed') {
    throw AppError.badRequest('This hold point has already been completed.');
  }

  throw AppError.badRequest('This hold point can no longer be requested for release.');
}

async function updateExistingHoldPointForReleaseRequest(
  tx: Prisma.TransactionClient,
  holdPointId: string,
  data: HoldPointRequestStateData,
) {
  const updateResult = await tx.holdPoint.updateMany({
    where: {
      id: holdPointId,
      status: { notIn: ['released', 'completed'] },
    },
    data,
  });

  if (updateResult.count !== 1) {
    const currentHoldPoint = await tx.holdPoint.findUnique({
      where: { id: holdPointId },
      select: { status: true },
    });

    if (!currentHoldPoint) {
      throw AppError.notFound('Hold point');
    }

    rejectTerminalHoldPointRequest(currentHoldPoint.status);
  }

  const savedHoldPoint = await tx.holdPoint.findUnique({
    where: { id: holdPointId },
    include: { itpChecklistItem: true },
  });

  if (!savedHoldPoint) {
    throw AppError.notFound('Hold point');
  }

  return savedHoldPoint;
}

function formatScheduledDateForEmail(scheduledDateValue: Date | null) {
  return scheduledDateValue
    ? scheduledDateValue.toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : undefined;
}

function buildReleaseRecipientToken(
  email: string,
  fullName: string | null,
): HoldPointReleaseRecipient {
  const tokenExpiry = new Date(Date.now() + SECURE_LINK_EXPIRY_HOURS * 60 * 60 * 1000);
  return {
    email,
    fullName,
    secureToken: crypto.randomBytes(32).toString('hex'),
    tokenExpiry,
  };
}

holdPointRequestReleaseRouter.post(
  '/request-release/batch',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = batchRequestReleaseSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const {
      lotId,
      items,
      sharedEvidenceDocumentIds,
      scheduledDate,
      scheduledTime,
      recipientEmail,
      recipientName,
      noticeHours,
    } = parseResult.data;
    const scheduledDateValue = parseScheduledDateInput(scheduledDate);
    const itemIds = items.map((item) => item.itpChecklistItemId);
    const itemRequestById = new Map(items.map((item) => [item.itpChecklistItemId, item]));

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
          where: { itpChecklistItemId: { in: itemIds } },
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
      { requireWritable: true },
    );

    const projectSettings = parseHPProjectSettings(lot.project.settings);
    const minimumNoticeDays = getHoldPointMinimumNoticeDays(projectSettings);

    if (scheduledDateValue && minimumNoticeDays > 0) {
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
            requiresOverride: false,
          },
        );
      }
    }

    const checklistItems = getHoldPointChecklistItemsForInstance(lot.itpInstance);
    const existingHoldPointByItemId = new Map(
      lot.holdPoints.map((holdPoint) => [holdPoint.itpChecklistItemId, holdPoint]),
    );

    const preparedItems = items.map((itemRequest) => {
      const holdPointItem = resolveHoldPointChecklistItemForInstance(
        lot.itpInstance!,
        itemRequest.itpChecklistItemId,
      );
      if (!holdPointItem || !isReleaseGatedChecklistItem(holdPointItem)) {
        throw AppError.badRequest('Selected item is not release-gated for this lot.');
      }

      const existingHoldPoint = existingHoldPointByItemId.get(itemRequest.itpChecklistItemId);
      if (existingHoldPoint?.status === 'released') {
        throw AppError.badRequest('This hold point has already been released.');
      }

      if (existingHoldPoint?.status === 'completed') {
        throw AppError.badRequest('This hold point has already been completed.');
      }

      const precedingItems = getPrecedingChecklistItems(
        checklistItems,
        holdPointItem.sequenceNumber,
      );
      const prerequisites = buildHoldPointPrerequisites(
        precedingItems,
        lot.itpInstance!.completions,
      );
      const incompleteItems = getIncompletePrerequisites(prerequisites);

      if (incompleteItems.length > 0) {
        throw AppError.badRequest(
          `Cannot request release for "${holdPointItem.description}" until all preceding checklist items are completed.`,
          {
            itpChecklistItemId: itemRequest.itpChecklistItemId,
            incompleteItems: buildIncompletePrerequisiteDetails(
              incompleteItems,
            ) as unknown as Record<string, unknown>,
          },
        );
      }

      return {
        itemRequest,
        holdPointItem,
        existingHoldPoint,
      };
    });

    const resolvedRecipients = await requireSuperintendentApprovalRecipients(
      lot.projectId,
      projectSettings,
      [{ email: recipientEmail, fullName: recipientName || null }],
    );
    const recipient = resolvedRecipients[0];
    if (!recipient || !isValidEmailAddress(recipient.email)) {
      throw AppError.badRequest('At least one valid hold point release recipient is required.');
    }

    const notificationSentAt = new Date();
    const requestingUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { fullName: true, email: true },
    });
    const requestedBy = requestingUser?.fullName || requestingUser?.email || 'Unknown';
    const formattedScheduledDate = formatScheduledDateForEmail(scheduledDateValue);
    const releaseUrl = buildFrontendUrl(`/projects/${lot.project.id}/lots/${lot.id}?tab=itp`);

    const savedBatchItems = await prisma.$transaction(async (tx) => {
      const savedItems = [];
      const data: HoldPointRequestStateData = {
        status: 'notified',
        notificationSentAt,
        notificationSentTo: recipient.email,
        scheduledDate: scheduledDateValue,
        scheduledTime: scheduledTime || null,
      };

      for (const preparedItem of preparedItems) {
        let savedHoldPoint;

        if (preparedItem.existingHoldPoint) {
          savedHoldPoint = await updateExistingHoldPointForReleaseRequest(
            tx,
            preparedItem.existingHoldPoint.id,
            data,
          );
        } else {
          savedHoldPoint = await tx.holdPoint.create({
            data: {
              lotId,
              itpChecklistItemId: preparedItem.itemRequest.itpChecklistItemId,
              pointType: 'hold_point',
              description: preparedItem.holdPointItem.description,
              ...data,
            },
            include: { itpChecklistItem: true },
          });
        }

        const releaseToken = buildReleaseRecipientToken(recipient.email, recipient.fullName);

        await tx.holdPointReleaseToken.deleteMany({
          where: {
            holdPointId: savedHoldPoint.id,
            usedAt: null,
          },
        });

        await tx.holdPointReleaseToken.createMany({
          data: [
            {
              holdPointId: savedHoldPoint.id,
              recipientEmail: releaseToken.email,
              recipientName: releaseToken.fullName,
              token: hashHoldPointReleaseToken(releaseToken.secureToken),
              expiresAt: releaseToken.tokenExpiry,
            },
          ],
        });

        const evidenceDocumentIds = [
          ...sharedEvidenceDocumentIds,
          ...(itemRequestById.get(preparedItem.itemRequest.itpChecklistItemId)
            ?.evidenceDocumentIds || []),
        ];

        await attachHoldPointEvidenceDocuments(tx, {
          projectId: lot.project.id,
          lotId: lot.id,
          itpInstanceId: lot.itpInstance!.id,
          itpChecklistItemId: preparedItem.itemRequest.itpChecklistItemId,
          documentIds: evidenceDocumentIds,
        });

        savedItems.push({
          holdPoint: savedHoldPoint,
          checklistItem: preparedItem.holdPointItem,
          releaseToken,
          evidenceDocumentIds,
        });
      }

      return savedItems;
    });

    const emailHoldPoints = savedBatchItems.map((item) => {
      const secureReleaseUrl = buildFrontendUrl(`/hp-release/${item.releaseToken.secureToken}`);
      return {
        sequenceNumber: item.checklistItem.sequenceNumber,
        description:
          item.holdPoint.description || item.checklistItem.description || 'Hold point release',
        secureReleaseUrl,
        evidencePackageUrl: `${secureReleaseUrl}#evidence-package`,
      };
    });

    let emailDelivery = { sent: 0, failed: 0 };
    const renderedEmail = renderHoldPointBatchReleaseRequestEmail({
      superintendentName: recipient.fullName || recipientName || 'Reviewer',
      projectName: lot.project.name,
      lotNumber: lot.lotNumber,
      holdPoints: emailHoldPoints,
      scheduledDate: formattedScheduledDate,
      scheduledTime: scheduledTime || undefined,
      releaseUrl,
      requestedBy,
      noticeHours,
    });

    try {
      const result = await sendEmail({
        to: recipient.email,
        subject: renderedEmail.subject,
        html: renderedEmail.html,
        text: renderedEmail.text,
      });

      if (result.success) {
        emailDelivery = { sent: 1, failed: 0 };
      } else {
        logError('[HP Batch Release Request] Consolidated email was not accepted for delivery:', {
          error: result.error || 'Unknown email delivery failure',
          provider: result.provider,
        });
        emailDelivery = { sent: 0, failed: 1 };
      }
    } catch (emailError) {
      logError('[HP Batch Release Request] Failed to send consolidated email:', emailError);
      emailDelivery = { sent: 0, failed: 1 };
    }

    await Promise.all(
      savedBatchItems.map((item, index) =>
        createAuditLog({
          projectId: lot.project.id,
          userId: req.user!.userId,
          entityType: 'hold_point',
          entityId: item.holdPoint.id,
          action: AuditAction.HP_RELEASE_REQUESTED,
          changes: {
            batchRequest: true,
            batchSize: savedBatchItems.length,
            batchItemIndex: index,
            lotId,
            itpChecklistItemId: item.holdPoint.itpChecklistItemId,
            scheduledDate,
            scheduledTime,
            notificationSentTo: recipient.email,
            sharedEvidenceDocumentIds,
            evidenceDocumentIds: item.evidenceDocumentIds,
            evidenceDocumentCount: item.evidenceDocumentIds.length,
            noticeHours,
            emailDelivery,
          },
          req,
        }),
      ),
    );

    for (const item of savedBatchItems) {
      emitHoldPointWebhookEvent(lot.project.id, 'hold_point.release_requested', {
        holdPointId: item.holdPoint.id,
        projectId: lot.project.id,
        lotId,
        lotNumber: lot.lotNumber,
        itpChecklistItemId: item.holdPoint.itpChecklistItemId,
        description: item.holdPoint.description,
        status: item.holdPoint.status,
        actorUserId: req.user!.userId,
        action: 'release_requested',
        scheduledDate: scheduledDateValue ? scheduledDateValue.toISOString() : null,
        scheduledTime: scheduledTime || null,
        recipientCount: 1,
        emailDelivery,
      });
    }

    if (emailDelivery.sent === 0) {
      throw new AppError(
        502,
        'Batch release request was saved but the consolidated email could not be sent.',
        'EXTERNAL_SERVICE_ERROR',
        {
          requestCreated: true,
          emailDelivery,
        },
      );
    }

    res.json({
      success: true,
      message: 'Batch hold point release requested successfully',
      holdPoints: savedBatchItems.map((item) => item.holdPoint),
      emailDelivery,
    });
  }),
);

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
      evidenceDocumentIds,
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
      { requireWritable: true },
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
    const minimumNoticeDays = getHoldPointMinimumNoticeDays(projectSettings);

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
      const data: HoldPointRequestStateData = {
        status: 'notified',
        notificationSentAt,
        notificationSentTo: normalizedNotificationSentTo,
        scheduledDate: scheduledDateValue,
        scheduledTime: scheduledTime || null,
        ...(overrideNote && { releaseNotes: overrideNote }),
      };

      let savedHoldPoint;

      if (existingHoldPoint) {
        savedHoldPoint = await updateExistingHoldPointForReleaseRequest(
          tx,
          existingHoldPoint.id,
          data,
        );
      } else {
        savedHoldPoint = await tx.holdPoint.create({
          data: {
            lotId,
            itpChecklistItemId,
            pointType: 'hold_point',
            description: holdPointItem.description,
            ...data,
          },
          include: { itpChecklistItem: true },
        });
      }

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

      await attachHoldPointEvidenceDocuments(tx, {
        projectId: releaseLot.project.id,
        lotId: releaseLot.id,
        itpInstanceId: releaseLot.itpInstance!.id,
        itpChecklistItemId,
        documentIds: evidenceDocumentIds,
      });

      return savedHoldPoint;
    });

    // Send only after token persistence commits. Email delivery is an external
    // side effect, so it cannot be rolled back safely; committing first ensures
    // any accepted email contains a release link that remains valid.
    const emailDeliveryResults = await Promise.allSettled(
      releaseTokenEntries.map(sendReleaseRequestEmail),
    );
    const failedDeliveryCount = emailDeliveryResults.filter(
      (result) => result.status === 'rejected',
    ).length;
    const sentDeliveryCount = emailDeliveryResults.length - failedDeliveryCount;

    if (failedDeliveryCount > 0) {
      logError('[HP Release Request] Some superintendent emails failed after token commit:', {
        holdPointId: holdPoint.id,
        sentDeliveryCount,
        failedDeliveryCount,
      });
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
        evidenceDocumentIds,
        evidenceDocumentCount: evidenceDocumentIds.length,
        noticePeriodOverride,
        emailDelivery: {
          sent: sentDeliveryCount,
          failed: failedDeliveryCount,
        },
      },
      req,
    });

    emitHoldPointWebhookEvent(lot.project.id, 'hold_point.release_requested', {
      holdPointId: holdPoint.id,
      projectId: lot.project.id,
      lotId,
      lotNumber: lot.lotNumber,
      itpChecklistItemId,
      description: holdPoint.description,
      status: holdPoint.status,
      actorUserId: req.user!.userId,
      action: 'release_requested',
      scheduledDate: scheduledDateValue ? scheduledDateValue.toISOString() : null,
      scheduledTime: scheduledTime || null,
      recipientCount: releaseTokenEntries.length,
      emailDelivery: {
        sent: sentDeliveryCount,
        failed: failedDeliveryCount,
      },
      noticePeriodOverride: Boolean(noticePeriodOverride),
    });

    if (sentDeliveryCount === 0) {
      throw new AppError(
        502,
        'Failed to send hold point release request email',
        'EXTERNAL_SERVICE_ERROR',
      );
    }

    res.json({
      ...buildHoldPointReleaseRequestedResponse(holdPoint),
      ...(failedDeliveryCount > 0 && {
        emailDelivery: {
          sent: sentDeliveryCount,
          failed: failedDeliveryCount,
          warning: 'Some release request emails could not be sent.',
        },
      }),
    });
  }),
);
