import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendHPReleaseConfirmationEmail } from '../lib/email.js';
import { sendNotificationIfEnabled } from './notifications.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { buildFrontendUrl } from '../lib/runtimeConfig.js';
import { logError } from '../lib/serverLogger.js';
import { assertProjectAllowsWrite } from '../lib/projectAccess.js';
import {
  MAX_RELEASE_TOKEN_LENGTH,
  parseHPProjectSettings,
  publicReleaseSchema,
  parseHoldPointRouteParam,
} from './holdpoints/validation.js';
import { holdPointReleaseTokenLookup } from './holdpoints/tokens.js';
import { requireSuperintendentApprovalRecipients } from './holdpoints/superintendentRecipients.js';
import {
  buildHoldPointEvidencePackage,
  buildPublicHoldPointEvidencePackageResponse,
} from './holdpoints/evidencePackage.js';
import { buildPublicHoldPointReleasedResponse } from './holdpoints/actionResponses.js';
import {
  buildHoldPointReleaseEmailNotification,
  buildHoldPointReleaseNotifications,
} from './holdpoints/releaseNotifications.js';
import {
  buildHoldPointReleaseConfirmationEmail,
  selectHoldPointReleaseContractors,
  selectHoldPointReleaseSuperintendents,
} from './holdpoints/releaseConfirmationEmails.js';
import { holdPointReadRouter } from './holdpoints/readRoutes.js';
import { holdPointRequestReleaseRouter } from './holdpoints/requestReleaseRoutes.js';
import { holdPointActionRouter } from './holdpoints/actionRoutes.js';
import { updateLotStatusFromITP } from './itp/helpers/lotProgression.js';
import { isProjectNotificationEnabled } from '../lib/projectNotificationPreferences.js';
import { parseDocumentContentDisposition, sendDocumentFile } from './documents/fileHelpers.js';
import { resolveHoldPointEvidenceInputs } from './holdpoints/evidencePackageInputs.js';

const holdpointsRouter = Router();

async function loadPublicHoldPointReleaseToken(rawToken: string) {
  return prisma.holdPointReleaseToken.findFirst({
    where: holdPointReleaseTokenLookup(rawToken),
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
            },
          },
        },
      },
    },
  });
}

type PublicHoldPointReleaseToken = NonNullable<
  Awaited<ReturnType<typeof loadPublicHoldPointReleaseToken>>
>;

function assertPublicHoldPointTokenAvailable(
  releaseToken: PublicHoldPointReleaseToken | null,
): asserts releaseToken is PublicHoldPointReleaseToken {
  if (!releaseToken) {
    throw AppError.notFound('Invalid or expired link');
  }

  if (new Date() > releaseToken.expiresAt) {
    throw new AppError(
      410,
      'This secure release link has expired. Please contact the site team for a new link.',
      'TOKEN_EXPIRED',
    );
  }
}

function buildPublicHoldPointReleasePayload(releaseToken: PublicHoldPointReleaseToken) {
  const holdPoint = releaseToken.holdPoint;
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
      itpChecklistItemId: holdPoint.itpChecklistItemId,
      status: holdPoint.status,
      notificationSentAt: holdPoint.notificationSentAt,
      scheduledDate: holdPoint.scheduledDate,
      scheduledTime: holdPoint.scheduledTime,
      releasedAt: holdPoint.releasedAt,
      releasedByName: holdPoint.releasedByName,
      releaseNotes: holdPoint.releaseNotes,
    },
    lot,
    itpTemplate,
    checklistItems,
    completions: itpInstance.completions,
    holdPointSequenceNumber: holdPointItem.sequenceNumber,
  });

  return {
    evidencePackage,
    tokenInfo: {
      recipientEmail: releaseToken.recipientEmail,
      recipientName: releaseToken.recipientName,
      expiresAt: releaseToken.expiresAt,
      canRelease: holdPoint.status !== 'released' && !releaseToken.usedAt,
    },
  };
}

function getPublicEvidenceDocumentIds(
  evidencePackage: ReturnType<typeof buildPublicHoldPointReleasePayload>['evidencePackage'],
): Set<string> {
  const documentIds = new Set<string>();

  for (const item of evidencePackage.checklist) {
    for (const attachment of item.attachments) {
      if (attachment.documentId) {
        documentIds.add(attachment.documentId);
      }
    }
  }

  for (const photo of evidencePackage.photos) {
    documentIds.add(photo.id);
  }

  return documentIds;
}

// Authenticated read/detail/evidence routes (project list, lot/item detail,
// evidence package + preview, working hours, notification-time calculation).
// Mounted before the mutation and public token-release routes below so that
// route-match precedence (e.g. GET /:id/evidence-package ahead of the public
// GET /public/:token) is preserved exactly. Extracted verbatim to
// ./holdpoints/readRoutes.js (behavior-preserving).
holdpointsRouter.use(holdPointReadRouter);

// Request hold point release (prerequisite checks, recipient resolution,
// release-token creation, superintendent email + audit). Extracted verbatim to
// ./holdpoints/requestReleaseRoutes.js; mounted after the read routes and
// before the /:id mutation + public token routes so route order is unchanged.
holdpointsRouter.use(holdPointRequestReleaseRouter);

// Authenticated hold point action routes (release, chase, escalate,
// resolve-escalation). Extracted verbatim to ./holdpoints/actionRoutes.js;
// mounted after the request-release route and before the public token-release
// routes so route order and per-route authentication are unchanged.
holdpointsRouter.use(holdPointActionRouter);

// ============================================================================
// PUBLIC ENDPOINTS - No authentication required (Feature #23)
// These endpoints use secure time-limited tokens for superintendent access
// ============================================================================

// Download one file from the token-scoped evidence package (no auth required)
holdpointsRouter.get(
  '/public/:token/documents/:documentId',
  asyncHandler(async (req: Request, res: Response) => {
    const token = parseHoldPointRouteParam(req.params.token, 'token', MAX_RELEASE_TOKEN_LENGTH);
    const documentId = parseHoldPointRouteParam(req.params.documentId, 'documentId');
    const disposition = parseDocumentContentDisposition(req.query.disposition);

    const releaseToken = await loadPublicHoldPointReleaseToken(token);
    assertPublicHoldPointTokenAvailable(releaseToken);
    const { evidencePackage } = buildPublicHoldPointReleasePayload(releaseToken);
    const scopedDocumentIds = getPublicEvidenceDocumentIds(evidencePackage);

    if (!scopedDocumentIds.has(documentId)) {
      throw AppError.forbidden('This document is not part of this hold point evidence package.');
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        fileUrl: true,
        filename: true,
        mimeType: true,
        projectId: true,
        documentType: true,
      },
    });

    if (!document) {
      throw AppError.notFound('Document');
    }

    await sendDocumentFile(document, res, disposition);
  }),
);

// Get hold point and evidence package via secure link (no auth required)
holdpointsRouter.get(
  '/public/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const token = parseHoldPointRouteParam(req.params.token, 'token', MAX_RELEASE_TOKEN_LENGTH);

    const releaseToken = await loadPublicHoldPointReleaseToken(token);
    assertPublicHoldPointTokenAvailable(releaseToken);
    const { evidencePackage, tokenInfo } = buildPublicHoldPointReleasePayload(releaseToken);

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
    await assertProjectAllowsWrite(releaseToken.holdPoint.lot.projectId);
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
    let releasedItpInstanceId: string | null = null;
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
        releasedItpInstanceId = itpInstance.id;
        // I1-core RECONCILE: releasing the hold point satisfies the ITP item.
        // Set status='completed' + completedAt (releasedAt) alongside the
        // verification fields, and CREATE the completion row if the hold point
        // was never ticked. This is a public release (no authenticated user), so
        // completedById / verifiedById stay null — attribution lives on the
        // HoldPoint (releasedByName/Org/Method) and is surfaced via the GET
        // serializer. ITPCompletion has no unique key on
        // [itpInstanceId, checklistItemId] (only @@index), so this is a
        // find-then-update-or-create inside the existing transaction.
        const completionData = {
          status: 'completed',
          completedAt: releasedAt,
          verificationStatus: 'verified',
          verifiedAt: releasedAt,
        };
        const existingCompletion = await tx.iTPCompletion.findFirst({
          where: {
            itpInstanceId: itpInstance.id,
            checklistItemId: updatedHoldPoint.itpChecklistItemId,
          },
          select: { id: true },
        });
        if (existingCompletion) {
          await tx.iTPCompletion.update({
            where: { id: existingCompletion.id },
            data: completionData,
          });
        } else {
          await tx.iTPCompletion.create({
            data: {
              itpInstanceId: itpInstance.id,
              checklistItemId: updatedHoldPoint.itpChecklistItemId,
              ...completionData,
            },
          });
        }
      }

      return updatedHoldPoint;
    });

    if (releasedItpInstanceId) {
      try {
        await updateLotStatusFromITP(releasedItpInstanceId);
      } catch (progressionError) {
        logError('[HP Secure Release] Failed to update lot status after public release:', {
          holdPointId: holdPoint.id,
          lotId: holdPoint.lotId,
          itpInstanceId: releasedItpInstanceId,
          error: progressionError instanceof Error ? progressionError.message : progressionError,
        });
      }
    }

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

    if (
      isProjectNotificationEnabled(releaseToken.holdPoint.lot.project.settings, 'holdPointReleases')
    ) {
      const notificationsToCreate = buildHoldPointReleaseNotifications(projectUsers, {
        projectId: releaseToken.holdPoint.lot.projectId,
        holdPointDescription: holdPoint.description,
        lotNumber: holdPoint.lot.lotNumber,
        releasedByName: effectiveReleasedByName,
      });

      if (notificationsToCreate.length > 0) {
        try {
          await prisma.notification.createMany({
            data: notificationsToCreate,
          });
        } catch (notificationError) {
          logError('[HP Secure Release] Failed to create in-app notifications:', notificationError);
          // The release already committed above; don't fail the request if the
          // post-commit notification insert throws.
        }
      }

      const releaseEmailNotification = buildHoldPointReleaseEmailNotification({
        projectId: releaseToken.holdPoint.lot.projectId,
        holdPointDescription: holdPoint.description,
        lotNumber: holdPoint.lot.lotNumber,
        releasedByName: effectiveReleasedByName,
        projectName: releaseToken.holdPoint.lot.project.name,
        releaseMethod: 'secure_link',
        releaseNotes,
      });

      for (const pu of projectUsers) {
        try {
          await sendNotificationIfEnabled(pu.userId, 'holdPointRelease', releaseEmailNotification);
        } catch (emailError) {
          logError(`[HP Secure Release] Failed to send email to user ${pu.userId}:`, emailError);
        }
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
        const confirmationContext = {
          projectName: releaseToken.holdPoint.lot.project.name,
          lotNumber: holdPoint.lot.lotNumber,
          holdPointDescription: holdPoint.description,
          releasedByName: effectiveReleasedByName,
          releasedByOrg,
          releaseMethod: 'secure_link',
          releaseNotes,
          releasedAt,
          lotUrl,
        };

        const contractors = selectHoldPointReleaseContractors(projectUsers);
        for (const contractor of contractors) {
          await sendHPReleaseConfirmationEmail(
            buildHoldPointReleaseConfirmationEmail(contractor, 'contractor', confirmationContext),
          );
        }

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
        logError('[HP Secure Release] Failed to send confirmation emails:', emailError);
        // Don't fail the main request
      }
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
