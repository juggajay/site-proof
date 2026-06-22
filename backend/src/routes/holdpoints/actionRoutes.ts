import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { sendNotificationIfEnabled } from '../notifications.js';
import { sendHPChaseEmail, sendHPReleaseConfirmationEmail } from '../../lib/email.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { buildFrontendUrl } from '../../lib/runtimeConfig.js';
import { logError } from '../../lib/serverLogger.js';
import { releaseHoldPointSchema, parseHoldPointRouteParam } from './validation.js';
import { parseReleaseDateTimeInput } from './dateParsing.js';
import {
  HP_REQUEST_ROLES,
  requireHoldPointReadAccess,
  requireProjectRole,
  type AuthenticatedUser,
} from './access.js';
import { HP_SUPERINTENDENT_RELEASE_ROLES } from './superintendentRecipients.js';
import {
  buildHoldPointReleaseEmailNotification,
  buildHoldPointReleaseNotifications,
} from './releaseNotifications.js';
import {
  buildHoldPointReleaseConfirmationEmail,
  selectHoldPointReleaseContractors,
  selectHoldPointReleaseSuperintendents,
} from './releaseConfirmationEmails.js';
import { buildHoldPointChaseEmail, selectHoldPointChaseRecipients } from './chaseNotifications.js';
import { buildHoldPointChaseResponse, buildHoldPointReleasedResponse } from './actionResponses.js';
import { holdPointEscalationRouter } from './escalationRoutes.js';
import { isProjectNotificationEnabled } from '../../lib/projectNotificationPreferences.js';
import { SECURE_LINK_EXPIRY_HOURS, hashHoldPointReleaseToken } from './tokens.js';
import { updateLotStatusFromITP } from '../itp/helpers/lotProgression.js';
import { emitHoldPointWebhookEvent } from './webhookEvents.js';

// =============================================================================
// Authenticated hold point ACTION routes (release, chase, escalate,
// resolve-escalation). Moved verbatim from holdpoints.ts (behavior-preserving)
// and mounted back on holdpointsRouter at the same /api/holdpoints paths,
// keeping each route's own requireAuth, after the read + request-release routes
// and before the public token-release routes. The public token-release routes
// stay in holdpoints.ts.
// =============================================================================

export const holdPointActionRouter = Router();

const HP_RELEASE_ROLES = [...HP_REQUEST_ROLES, 'superintendent'];

type HoldPointChaseTarget = {
  email: string;
  fullName: string | null;
  secureToken?: string;
};

type HoldPointReleaseTokenRecipient = {
  recipientEmail: string;
  recipientName: string | null;
};

type ExistingHoldPointForRelease = {
  status: string;
  lotId: string;
  lot: {
    id: string;
    projectId: string;
    project: {
      settings: string | null;
    };
  };
};

function buildTokenChaseTargets(
  existingReleaseTokens: HoldPointReleaseTokenRecipient[],
): HoldPointChaseTarget[] {
  const tokenTargetsByEmail = new Map<string, HoldPointChaseTarget>();

  for (const tokenRecipient of existingReleaseTokens) {
    const email = tokenRecipient.recipientEmail.trim();
    if (!email) continue;

    const key = email.toLowerCase();
    if (!tokenTargetsByEmail.has(key)) {
      tokenTargetsByEmail.set(key, {
        email,
        fullName: tokenRecipient.recipientName,
        secureToken: crypto.randomBytes(32).toString('hex'),
      });
    }
  }

  return Array.from(tokenTargetsByEmail.values());
}

async function createChaseReleaseTokens(
  holdPointId: string,
  tokenTargets: HoldPointChaseTarget[],
): Promise<void> {
  if (tokenTargets.length === 0) {
    return;
  }

  const tokenExpiry = new Date(Date.now() + SECURE_LINK_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.holdPointReleaseToken.createMany({
    data: tokenTargets.map((recipient) => ({
      holdPointId,
      recipientEmail: recipient.email,
      recipientName: recipient.fullName,
      token: hashHoldPointReleaseToken(recipient.secureToken!),
      expiresAt: tokenExpiry,
    })),
  });
}

async function revokeSupersededChaseReleaseTokens(
  holdPointId: string,
  tokenTarget: HoldPointChaseTarget,
): Promise<void> {
  if (!tokenTarget.secureToken) {
    return;
  }

  await prisma.holdPointReleaseToken.deleteMany({
    where: {
      holdPointId,
      recipientEmail: tokenTarget.email,
      usedAt: null,
      token: { not: hashHoldPointReleaseToken(tokenTarget.secureToken) },
    },
  });
}

async function revokeFreshChaseReleaseToken(
  holdPointId: string,
  tokenTarget: HoldPointChaseTarget,
): Promise<void> {
  if (!tokenTarget.secureToken) {
    return;
  }

  await prisma.holdPointReleaseToken.deleteMany({
    where: {
      holdPointId,
      recipientEmail: tokenTarget.email,
      usedAt: null,
      token: hashHoldPointReleaseToken(tokenTarget.secureToken),
    },
  });
}

async function loadProjectChaseTargets(projectId: string): Promise<HoldPointChaseTarget[]> {
  // Get project users with superintendent role to notify.
  const superintendents = await prisma.projectUser.findMany({
    where: {
      projectId,
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
            projectId,
            role: 'project_manager',
            status: 'active',
          },
          include: {
            user: { select: { id: true, email: true, fullName: true } },
          },
        });

  return selectHoldPointChaseRecipients(superintendents, projectManagers).map((recipient) => ({
    email: recipient.user.email,
    fullName: recipient.user.fullName,
  }));
}

async function loadHoldPointChaseTargets(
  holdPointId: string,
  projectId: string,
): Promise<HoldPointChaseTarget[]> {
  const existingReleaseTokens = await prisma.holdPointReleaseToken.findMany({
    where: {
      holdPointId,
      usedAt: null,
    },
    select: { recipientEmail: true, recipientName: true },
    orderBy: { createdAt: 'desc' },
  });

  const tokenTargets = buildTokenChaseTargets(existingReleaseTokens);
  if (tokenTargets.length > 0) {
    await createChaseReleaseTokens(holdPointId, tokenTargets);
    return tokenTargets;
  }

  return loadProjectChaseTargets(projectId);
}

function buildChaseRecipientUrls(
  recipient: HoldPointChaseTarget,
  loggedInEvidencePackageUrl: string,
  loggedInReleaseUrl: string,
) {
  if (recipient.secureToken) {
    const secureReleaseUrl = buildFrontendUrl(`/hp-release/${recipient.secureToken}`);
    return {
      evidencePackageUrl: `${secureReleaseUrl}#evidence-package`,
      releaseUrl: secureReleaseUrl,
    };
  }

  return {
    evidencePackageUrl: loggedInEvidencePackageUrl,
    releaseUrl: loggedInReleaseUrl,
  };
}

async function loadReleaseEvidenceDocumentForHoldPoint(
  releaseEvidenceDocumentId: string | undefined,
  holdPoint: ExistingHoldPointForRelease,
) {
  if (!releaseEvidenceDocumentId) {
    return null;
  }

  const document = await prisma.document.findFirst({
    where: {
      id: releaseEvidenceDocumentId,
      projectId: holdPoint.lot.projectId,
      lotId: holdPoint.lotId,
    },
    select: {
      id: true,
      filename: true,
      documentType: true,
      category: true,
    },
  });

  if (!document) {
    throw AppError.badRequest('Release evidence document was not found for this hold point lot');
  }

  return document;
}

function getHoldPointApprovalRequirement(settings: string | null): string {
  if (!settings) {
    return 'any';
  }

  try {
    const parsed = JSON.parse(settings) as { hpApprovalRequirement?: string };
    return parsed.hpApprovalRequirement || 'any';
  } catch (_e) {
    return 'any';
  }
}

async function requireHoldPointReleaseAccess(
  holdPoint: ExistingHoldPointForRelease,
  user: AuthenticatedUser,
) {
  await requireHoldPointReadAccess(holdPoint, user);
  await requireProjectRole(
    holdPoint.lot.projectId,
    user,
    HP_RELEASE_ROLES,
    'You do not have permission to release hold points',
    { requireWritable: true },
  );

  if (getHoldPointApprovalRequirement(holdPoint.lot.project.settings) === 'superintendent') {
    await requireProjectRole(
      holdPoint.lot.projectId,
      user,
      HP_SUPERINTENDENT_RELEASE_ROLES,
      'This project requires superintendent approval to release hold points.',
    );
  }
}

function assertHoldPointNotReleased(holdPoint: ExistingHoldPointForRelease) {
  if (holdPoint.status === 'released') {
    throw AppError.badRequest('This hold point has already been released.');
  }
}

function assertHoldPointReleaseRequested(holdPoint: ExistingHoldPointForRelease) {
  if (holdPoint.status !== 'notified') {
    throw AppError.badRequest('Request hold point release before recording a manual release.');
  }
}

// Release a hold point
holdPointActionRouter.post(
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
      releaseEvidenceDocumentId,
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
    await requireHoldPointReleaseAccess(existingHP, user);
    assertHoldPointNotReleased(existingHP);
    assertHoldPointReleaseRequested(existingHP);

    const releaseEvidenceDocument = await loadReleaseEvidenceDocumentForHoldPoint(
      releaseEvidenceDocumentId,
      existingHP,
    );

    const releasedAt = parseReleaseDateTimeInput(releaseDate, releaseTime);
    let releasedItpInstanceId: string | null = null;
    const holdPoint = await prisma.$transaction(async (tx) => {
      const releaseTransition = await tx.holdPoint.updateMany({
        where: {
          id,
          status: { not: 'released' },
        },
        data: {
          status: 'released',
          releasedAt,
          releasedByName: releasedByName || null,
          releasedByOrg: releasedByOrg || null,
          releaseMethod: releaseMethod || null,
          releaseSignatureUrl: signatureDataUrl || null,
          releaseNotes: releaseNotes || null,
        },
      });

      if (releaseTransition.count !== 1) {
        throw AppError.badRequest('This hold point has already been released.');
      }

      const updatedHoldPoint = await tx.holdPoint.findUnique({
        where: { id },
        include: {
          itpChecklistItem: true,
          lot: true,
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
        // was never ticked. ITPCompletion has no unique key on
        // [itpInstanceId, checklistItemId] (only @@index), so this is a
        // find-then-update-or-create inside the existing transaction.
        const completionData = {
          status: 'completed',
          completedAt: releasedAt,
          completedById: req.user!.userId,
          verificationStatus: 'verified',
          verifiedById: req.user!.userId,
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
      await updateLotStatusFromITP(releasedItpInstanceId);
    }

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

    // Respect the project-level "Hold Point Releases" notification toggle. When
    // an admin turns this category off, suppress both the in-app records and the
    // emails for everyone on the project. Absent/missing settings default to on.
    if (isProjectNotificationEnabled(existingHP.lot.project.settings, 'holdPointReleases')) {
      // Create in-app notifications for all project team members
      const notificationsToCreate = buildHoldPointReleaseNotifications(projectUsers, {
        projectId: existingHP.lot.projectId,
        holdPointDescription: holdPoint.description,
        lotNumber: holdPoint.lot.lotNumber,
        releasedByName,
      });

      if (notificationsToCreate.length > 0) {
        try {
          await prisma.notification.createMany({
            data: notificationsToCreate,
          });
        } catch (notificationError) {
          logError('[HP Release] Failed to create in-app notifications:', notificationError);
          // The release already committed above; don't fail the request if the
          // post-commit notification insert throws.
        }
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

      // Feature #948 - Send HP release confirmation emails to contractor and
      // superintendent. These are part of the same "Hold Point Releases"
      // category (they fire on the same release event, to project users), so
      // they live under the same toggle as the in-app records and the primary
      // release emails above. sendHPReleaseConfirmationEmail is a direct `to:`
      // send that bypasses the per-user email preference system, so this
      // project-level gate is the only thing that can suppress it.
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
        releaseEvidenceDocumentId: releaseEvidenceDocument?.id ?? null,
        releaseEvidenceFilename: releaseEvidenceDocument?.filename ?? null,
        releaseEvidenceDocumentType: releaseEvidenceDocument?.documentType ?? null,
        releaseEvidenceCategory: releaseEvidenceDocument?.category ?? null,
      },
      req,
    });

    emitHoldPointWebhookEvent(existingHP.lot.projectId, 'hold_point.released', {
      holdPointId: holdPoint.id,
      projectId: existingHP.lot.projectId,
      lotId: holdPoint.lotId,
      lotNumber: holdPoint.lot.lotNumber,
      itpChecklistItemId: holdPoint.itpChecklistItemId,
      description: holdPoint.description,
      status: holdPoint.status,
      actorUserId: req.user!.userId,
      action: 'released',
      releaseSource: 'authenticated',
      releaseMethod: releaseMethod || null,
      releasedByName: releasedByName || null,
      releasedByOrg: releasedByOrg || null,
      releaseEvidenceDocumentId: releaseEvidenceDocument?.id ?? null,
      hasReleaseNotes: Boolean(releaseNotes?.trim()),
    });

    res.json(buildHoldPointReleasedResponse(holdPoint, projectUsers));
  }),
);

// Chase a hold point (send reminder)
holdPointActionRouter.post(
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
      { requireWritable: true },
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
      const recipientsToNotify = await loadHoldPointChaseTargets(
        existingHP.id,
        existingHP.lot.project.id,
      );

      const loggedInReleaseUrl = buildFrontendUrl(
        `/projects/${existingHP.lot.project.id}/lots/${existingHP.lot.id}?tab=itp`,
      );
      const loggedInEvidencePackageUrl = buildFrontendUrl(
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
        notificationSentTo: existingHP.notificationSentTo,
      };

      for (const recipient of recipientsToNotify) {
        const urls = buildChaseRecipientUrls(
          recipient,
          loggedInEvidencePackageUrl,
          loggedInReleaseUrl,
        );

        try {
          const emailResult = await sendHPChaseEmail(
            buildHoldPointChaseEmail(
              { user: { email: recipient.email, fullName: recipient.fullName } },
              {
                ...chaseContext,
                evidencePackageUrl: urls.evidencePackageUrl,
                releaseUrl: urls.releaseUrl,
              },
            ),
          );

          if (emailResult.success) {
            await revokeSupersededChaseReleaseTokens(existingHP.id, recipient);
          } else {
            await revokeFreshChaseReleaseToken(existingHP.id, recipient);
          }
        } catch (emailError) {
          await revokeFreshChaseReleaseToken(existingHP.id, recipient);
          logError('[HP Chase] Failed to send chase email:', emailError);
        }
      }
    } catch (emailError) {
      logError('[HP Chase] Failed to prepare chase email:', emailError);
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

holdPointActionRouter.use(holdPointEscalationRouter);
