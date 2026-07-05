import type { Prisma } from '@prisma/client';
import type { Request } from 'express';

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { buildFrontendUrl } from '../../lib/runtimeConfig.js';
import { logError } from '../../lib/serverLogger.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { isProjectNotificationEnabled } from '../../lib/projectNotificationPreferences.js';
import { projectTimeZoneFromState } from '../../lib/projectTimeZone.js';
import { sendHPReleaseConfirmationEmail } from '../../lib/email.js';
import { sendNotificationIfEnabled } from '../notifications.js';
import { updateLotStatusFromITP } from '../itp/helpers/lotProgression.js';
import { assertHoldPointCompletionCanBeReleased } from './releaseCompletionGuard.js';
import { emitHoldPointWebhookEvent } from './webhookEvents.js';
import {
  buildHoldPointReleaseEmailNotification,
  buildHoldPointReleaseNotifications,
} from './releaseNotifications.js';
import {
  buildHoldPointReleaseConfirmationEmail,
  selectImmediateHoldPointReleaseConfirmationRecipients,
  selectHoldPointReleaseContractors,
  selectHoldPointReleaseSuperintendents,
} from './releaseConfirmationEmails.js';

// =============================================================================
// Shared trust-boundary hold-point release execution. Extracted verbatim from
// the inline POST /api/holdpoints/public/:token/release handler so the single
// secure-link release and the batch review-room release share ONE
// implementation (never fork the trust boundary). The transactional core is
// `tx`-scoped so the batch route can release many hold points in a single
// atomic transaction.
// =============================================================================

// Terminal-status guard shared by the pre-check and the transactional core.
export function rejectTerminalPublicHoldPointRelease(status: string | null | undefined): void {
  if (status === 'released') {
    throw AppError.badRequest('This hold point has already been released.');
  }

  if (status === 'completed') {
    throw AppError.badRequest('This hold point has already been completed.');
  }
}

export interface ExecuteHoldPointTokenReleaseParams {
  tokenId: string;
  holdPointId: string;
  releasedAt: Date;
  effectiveReleasedByName: string;
  releasedByOrg?: string | null;
  releaseNotes?: string | null;
  signatureDataUrl?: string | null;
}

type ReleasedHoldPoint = Prisma.HoldPointGetPayload<{
  include: { lot: true; itpChecklistItem: true };
}>;

// Transactional core: mark the per-hold-point token used, flip the hold point to
// `released`, and reconcile the matching ITP completion — all guarded by
// updateMany counts so a concurrent release or expiry loses the race safely.
// Runs inside a caller-provided transaction so the batch route can wrap many
// releases in one atomic transaction (all succeed or the request fails).
export async function executeHoldPointTokenRelease(
  tx: Prisma.TransactionClient,
  {
    tokenId,
    holdPointId,
    releasedAt,
    effectiveReleasedByName,
    releasedByOrg,
    releaseNotes,
    signatureDataUrl,
  }: ExecuteHoldPointTokenReleaseParams,
): Promise<{ holdPoint: ReleasedHoldPoint; releasedItpInstanceId: string | null }> {
  const tokenUpdate = await tx.holdPointReleaseToken.updateMany({
    where: {
      id: tokenId,
      usedAt: null,
      expiresAt: { gt: releasedAt },
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
    const currentToken = await tx.holdPointReleaseToken.findUnique({
      where: { id: tokenId },
      select: { usedAt: true, expiresAt: true, releasedByName: true },
    });

    if (!currentToken || currentToken.expiresAt <= releasedAt) {
      throw new AppError(
        410,
        'This secure release link has expired. Please contact the site team for a new link.',
        'TOKEN_EXPIRED',
      );
    }

    throw new AppError(
      410,
      'This hold point has already been released using this link.',
      'TOKEN_USED',
      currentToken.usedAt
        ? {
            releasedAt: currentToken.usedAt as unknown as Record<string, unknown>,
            releasedByName: currentToken.releasedByName as unknown as Record<string, unknown>,
          }
        : undefined,
    );
  }

  const holdPointUpdate = await tx.holdPoint.updateMany({
    where: {
      id: holdPointId,
      status: { notIn: ['released', 'completed'] },
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
    const currentHoldPoint = await tx.holdPoint.findUnique({
      where: { id: holdPointId },
      select: { status: true },
    });
    rejectTerminalPublicHoldPointRelease(currentHoldPoint?.status);
    throw AppError.badRequest('This hold point can no longer be released.');
  }

  const updatedHoldPoint = await tx.holdPoint.findUnique({
    where: { id: holdPointId },
    include: {
      lot: true,
      itpChecklistItem: true,
    },
  });

  if (!updatedHoldPoint) {
    throw AppError.notFound('Hold point');
  }

  // Also mark the ITP completion as verified in the same transaction.
  let releasedItpInstanceId: string | null = null;
  const itpInstance = await tx.iTPInstance.findUnique({
    where: { lotId: updatedHoldPoint.lotId },
    select: { id: true },
  });

  if (itpInstance) {
    releasedItpInstanceId = itpInstance.id;
    const completionKey = {
      itpInstanceId: itpInstance.id,
      checklistItemId: updatedHoldPoint.itpChecklistItemId,
    };
    const existingCompletion = await tx.iTPCompletion.findUnique({
      where: { itpInstanceId_checklistItemId: completionKey },
      select: { status: true },
    });
    assertHoldPointCompletionCanBeReleased(existingCompletion);

    // I1-core RECONCILE: releasing the hold point satisfies the ITP item. Set
    // status='completed' + completedAt (releasedAt) alongside the verification
    // fields, and CREATE the completion row if the hold point was never ticked.
    // This is a public release (no authenticated user), so completedById /
    // verifiedById stay null — attribution lives on the HoldPoint.
    const completionData = {
      status: 'completed',
      completedAt: releasedAt,
      verificationStatus: 'verified',
      verifiedAt: releasedAt,
    };
    await tx.iTPCompletion.upsert({
      where: {
        itpInstanceId_checklistItemId: completionKey,
      },
      update: completionData,
      create: {
        ...completionKey,
        ...completionData,
      },
    });
  }

  return { holdPoint: updatedHoldPoint, releasedItpInstanceId };
}

export interface HoldPointReleaseProject {
  id: string;
  name: string;
  state: string | null;
  settings: string | null;
}

export interface RunHoldPointReleasePostCommitParams {
  holdPoint: ReleasedHoldPoint;
  project: HoldPointReleaseProject;
  releasedItpInstanceId: string | null;
  releasedAt: Date;
  effectiveReleasedByName: string;
  submittedReleasedByName: string;
  releasedByOrg?: string | null;
  releaseNotes?: string | null;
  tokenRecipientEmail: string;
  tokenRecipientName: string | null;
  req: Request;
}

// Post-commit side effects for a single released hold point: lot-status
// progression, in-app + email notifications, contractor/superintendent
// confirmation emails, audit log, and webhook event. Extracted verbatim; each
// step swallows its own errors so a post-commit failure never rolls back the
// already-committed release. Safe to call once per hold point in a batch.
export async function runHoldPointReleasePostCommit({
  holdPoint,
  project,
  releasedItpInstanceId,
  releasedAt,
  effectiveReleasedByName,
  submittedReleasedByName,
  releasedByOrg,
  releaseNotes,
  tokenRecipientEmail,
  tokenRecipientName,
  req,
}: RunHoldPointReleasePostCommitParams): Promise<void> {
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
      projectId: project.id,
      status: 'active',
    },
    include: {
      user: {
        select: { id: true, email: true, fullName: true },
      },
    },
  });

  if (isProjectNotificationEnabled(project.settings, 'holdPointReleases')) {
    const notificationsToCreate = buildHoldPointReleaseNotifications(projectUsers, {
      projectId: project.id,
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
      projectId: project.id,
      holdPointDescription: holdPoint.description,
      lotNumber: holdPoint.lot.lotNumber,
      releasedByName: effectiveReleasedByName,
      projectName: project.name,
      releaseMethod: 'secure_link',
      releaseNotes,
    });

    const immediateHoldPointReleaseEmailUserIds = new Set<string>();
    for (const pu of projectUsers) {
      try {
        const delivery = await sendNotificationIfEnabled(
          pu.userId,
          'holdPointRelease',
          releaseEmailNotification,
        );
        if (delivery.sent) {
          immediateHoldPointReleaseEmailUserIds.add(pu.userId);
        }
      } catch (emailError) {
        logError(`[HP Secure Release] Failed to send email to user ${pu.userId}:`, emailError);
      }
    }

    // Send confirmation emails
    try {
      const lotUrl = buildFrontendUrl(`/projects/${project.id}/lots/${holdPoint.lot.id}`);
      // Format the instant we actually recorded on the hold point (above), not a
      // fresh new Date(), so the confirmation email always matches the stored
      // release time.
      const projectTimeZone = projectTimeZoneFromState(project.state);
      const releasedAtDisplay = releasedAt.toLocaleString('en-AU', {
        timeZone: projectTimeZone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const confirmationContext = {
        projectName: project.name,
        lotNumber: holdPoint.lot.lotNumber,
        holdPointDescription: holdPoint.description,
        releasedByName: effectiveReleasedByName,
        releasedByOrg,
        releaseMethod: 'secure_link',
        releaseNotes,
        releasedAt: releasedAtDisplay,
        lotUrl,
      };

      const contractors = selectImmediateHoldPointReleaseConfirmationRecipients(
        selectHoldPointReleaseContractors(projectUsers),
        immediateHoldPointReleaseEmailUserIds,
      );
      for (const contractor of contractors) {
        await sendHPReleaseConfirmationEmail(
          buildHoldPointReleaseConfirmationEmail(contractor, 'contractor', confirmationContext),
        );
      }

      const superintendents = selectImmediateHoldPointReleaseConfirmationRecipients(
        selectHoldPointReleaseSuperintendents(projectUsers),
        immediateHoldPointReleaseEmailUserIds,
      );
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
    projectId: project.id,
    entityType: 'hold_point',
    entityId: holdPoint.id,
    action: AuditAction.HP_PUBLIC_RELEASED,
    changes: {
      releasedByName: effectiveReleasedByName,
      submittedReleasedByName,
      releasedByOrg,
      releaseMethod: 'secure_link',
      tokenRecipient: tokenRecipientEmail,
      tokenRecipientName,
    },
    req,
  });

  emitHoldPointWebhookEvent(project.id, 'hold_point.released', {
    holdPointId: holdPoint.id,
    projectId: project.id,
    lotId: holdPoint.lotId,
    lotNumber: holdPoint.lot.lotNumber,
    itpChecklistItemId: holdPoint.itpChecklistItemId,
    description: holdPoint.description,
    status: holdPoint.status,
    actorUserId: null,
    action: 'released',
    releaseSource: 'public_secure_link',
    releaseMethod: 'secure_link',
    releasedByName: effectiveReleasedByName || null,
    releasedByOrg: releasedByOrg || null,
    releaseEvidenceDocumentId: null,
    hasReleaseNotes: Boolean(releaseNotes?.trim()),
  });
}
