import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendHPReleaseConfirmationEmail } from '../lib/email.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { buildFrontendUrl } from '../lib/runtimeConfig.js';
import { logError } from '../lib/serverLogger.js';
import {
  MAX_RELEASE_TOKEN_LENGTH,
  parseHPProjectSettings,
  publicReleaseSchema,
  parseHoldPointRouteParam,
} from './holdpoints/validation.js';
import { holdPointReleaseTokenLookup } from './holdpoints/tokens.js';
import { requireSuperintendentApprovalRecipients } from './holdpoints/superintendentRecipients.js';
import {
  buildHoldPointEvidenceChecklist,
  buildHoldPointEvidenceChecklistItemIdSet,
  buildHoldPointEvidencePhotoDocuments,
  buildHoldPointEvidenceSummary,
  buildPublicHoldPointEvidencePackageResponse,
  mapHoldPointEvidenceItpTemplate,
  mapHoldPointEvidenceLot,
  mapHoldPointEvidencePhotos,
  mapHoldPointEvidenceProject,
  mapHoldPointEvidenceTestResults,
} from './holdpoints/evidencePackage.js';
import { buildPublicHoldPointReleasedResponse } from './holdpoints/actionResponses.js';
import { holdPointReadRouter } from './holdpoints/readRoutes.js';
import { holdPointRequestReleaseRouter } from './holdpoints/requestReleaseRoutes.js';
import { holdPointActionRouter } from './holdpoints/actionRoutes.js';
import {
  getHoldPointChecklistItemsForInstance,
  getHoldPointItpTemplateForInstance,
  resolveHoldPointChecklistItemForInstance,
} from './holdpoints/itpSnapshot.js';

const holdpointsRouter = Router();

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

    const checklistItems = getHoldPointChecklistItemsForInstance(itpInstance);

    // Get all checklist items up to and including the hold point from the
    // assigned ITP snapshot, falling back to live data only for legacy instances.
    const holdPointItem = resolveHoldPointChecklistItemForInstance(
      itpInstance,
      holdPoint.itpChecklistItemId,
      holdPoint.itpChecklistItem,
    );
    if (!holdPointItem) {
      throw AppError.notFound('Hold point checklist item');
    }
    const includedChecklistItemIds = buildHoldPointEvidenceChecklistItemIdSet(
      checklistItems,
      holdPointItem.sequenceNumber,
    );
    const checklistWithStatus = buildHoldPointEvidenceChecklist(
      checklistItems,
      itpInstance.completions,
      holdPointItem.sequenceNumber,
    );
    const itpTemplate = getHoldPointItpTemplateForInstance(itpInstance);
    if (!itpTemplate) {
      throw AppError.badRequest('No ITP template assigned to this lot');
    }

    const scope = { includedChecklistItemIds };
    const testResults = mapHoldPointEvidenceTestResults(lot.testResults, scope);

    const photos = mapHoldPointEvidencePhotos(
      buildHoldPointEvidencePhotoDocuments(itpInstance.completions),
      scope,
    );

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
      itpTemplate: mapHoldPointEvidenceItpTemplate(itpTemplate),
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
