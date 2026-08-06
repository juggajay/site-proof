import crypto from 'crypto';
import { Router, Request, Response } from 'express';

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { buildFrontendUrl } from '../../lib/runtimeConfig.js';
import { HP_REQUEST_ROLES, requireHoldPointReadAccess, requireProjectRole } from './access.js';
import { hashHoldPointReleaseToken } from './tokens.js';
import { parseHoldPointRouteParam, parseNotificationEmailList } from './validation.js';
import { resolveQrReleaseLinkRecipient, type ReleaseLinkTokenRow } from './releaseLinkRecipient.js';

// =============================================================================
// Benchmark T2 — QR release.
//
// The raw secure-link token is never persisted (only `sha256:<hex>` is), so an
// already-emailed release link cannot be read back and rendered as a QR code.
// This route therefore MINTS a fresh token for the SAME invited recipient the
// release request went to, exactly as the chase paths already re-mint rather
// than recover, and returns the raw URL once to the authenticated caller.
//
// Trust boundary notes:
//   - The link releases AS the invited recipient, because the public page locks
//     `releasedByName` to the token's `recipientName`. We therefore refuse to
//     mint one until a release has actually been requested — that request is
//     what establishes who the authority is.
//   - The URL is handed to whoever is standing at the caller's screen, so the
//     token is deliberately SHORT-lived (see below) and every mint writes an
//     audit row naming the user who produced it.
//   - Releasing through it runs the unchanged public release door: same
//     register record, same signature, same evidence package. Nothing about
//     this route decides what the token may do.
// =============================================================================

export const holdPointReleaseLinkRouter = Router();

/**
 * A QR link is for the approver standing in front of you. Keeping it far
 * shorter than the 48 h emailed link limits the blast radius of a photographed
 * screen while still leaving time to read the evidence package and sign.
 */
export const QR_RELEASE_LINK_EXPIRY_MINUTES = 30;

const TERMINAL_STATUSES = new Set(['released', 'completed']);

holdPointReleaseLinkRouter.post(
  '/:id/release-link',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseHoldPointRouteParam(req.params.id, 'id');

    const holdPoint = await prisma.holdPoint.findUnique({
      where: { id },
      include: {
        lot: { select: { id: true, projectId: true, lotNumber: true } },
      },
    });

    if (!holdPoint) {
      throw AppError.notFound('Hold point');
    }

    await requireHoldPointReadAccess(holdPoint, req.user!);
    await requireProjectRole(
      holdPoint.lot.projectId,
      req.user!,
      HP_REQUEST_ROLES,
      'You do not have permission to create hold point release links',
      { requireWritable: true },
    );

    if (TERMINAL_STATUSES.has(holdPoint.status)) {
      throw AppError.badRequest('This hold point has already been released.');
    }

    if (holdPoint.status !== 'notified') {
      throw AppError.badRequest(
        'Request the release first — the release request is what records who may approve this hold point.',
        { code: 'HP_RELEASE_NOT_REQUESTED' },
      );
    }

    const now = new Date();
    const liveTokens: ReleaseLinkTokenRow[] = await prisma.holdPointReleaseToken.findMany({
      where: { holdPointId: holdPoint.id, usedAt: null, expiresAt: { gt: now } },
      select: { recipientEmail: true, recipientName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const recipient = resolveQrReleaseLinkRecipient(
      liveTokens,
      parseNotificationEmailList(holdPoint.notificationSentTo),
    );

    if (!recipient) {
      throw AppError.badRequest(
        'This hold point has no valid release recipient. Request the release again to set one.',
        { code: 'HP_NO_RELEASE_RECIPIENT' },
      );
    }

    const secureToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(now.getTime() + QR_RELEASE_LINK_EXPIRY_MINUTES * 60 * 1000);

    // Additive: the emailed token stays live, so the authority can still use the
    // link in their inbox. Both are single-use against the same hold point, and
    // the second one to arrive gets the existing 410 TOKEN/state guard.
    await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId: holdPoint.id,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        token: hashHoldPointReleaseToken(secureToken),
        expiresAt,
      },
    });

    await createAuditLog({
      projectId: holdPoint.lot.projectId,
      userId: req.user!.userId,
      entityType: 'hold_point',
      entityId: holdPoint.id,
      action: AuditAction.HP_RELEASE_LINK_MINTED,
      changes: {
        lotId: holdPoint.lotId,
        itpChecklistItemId: holdPoint.itpChecklistItemId,
        // Redacted by sanitizeAuditChanges' /token/i pattern, like the public
        // release audit payload — the identity is carried by the name.
        tokenRecipient: recipient.email,
        tokenRecipientName: recipient.name,
        expiresAt: expiresAt.toISOString(),
        expiryMinutes: QR_RELEASE_LINK_EXPIRY_MINUTES,
      },
      req,
    });

    res.json({
      releaseUrl: buildFrontendUrl(`/hp-release/${secureToken}`),
      expiresAt: expiresAt.toISOString(),
      // Same audience as the register, which already lists the release
      // recipient — the operator has to be able to confirm whose approval this
      // link records before handing over the screen.
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      lotNumber: holdPoint.lot.lotNumber,
      holdPointDescription: holdPoint.description,
    });
  }),
);
