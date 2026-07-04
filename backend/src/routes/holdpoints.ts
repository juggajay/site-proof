import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { assertProjectAllowsWrite } from '../lib/projectAccess.js';
import {
  MAX_RELEASE_TOKEN_LENGTH,
  parseHPProjectSettings,
  publicReleaseSchema,
  parseHoldPointRouteParam,
} from './holdpoints/validation.js';
import { holdPointReleaseTokenLookup } from './holdpoints/tokens.js';
import { requireSuperintendentApprovalRecipients } from './holdpoints/superintendentRecipients.js';
import { buildPublicHoldPointEvidencePackageResponse } from './holdpoints/evidencePackage.js';
import { buildPublicHoldPointReleasedResponse } from './holdpoints/actionResponses.js';
import { holdPointReadRouter } from './holdpoints/readRoutes.js';
import { holdPointRequestReleaseRouter } from './holdpoints/requestReleaseRoutes.js';
import { holdPointActionRouter } from './holdpoints/actionRoutes.js';
import { holdPointPublicBatchRouter } from './holdpoints/publicBatchRoutes.js';
import { parseDocumentContentDisposition, sendDocumentFile } from './documents/fileHelpers.js';
import {
  assertPublicHoldPointTokenAvailable,
  buildPublicHoldPointReleasePayload,
  getPublicEvidenceDocumentIds,
  loadPublicHoldPointReleaseToken,
} from './holdpoints/publicReleasePayload.js';
import {
  executeHoldPointTokenRelease,
  rejectTerminalPublicHoldPointRelease,
  runHoldPointReleasePostCommit,
} from './holdpoints/publicReleaseExecution.js';

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

    rejectTerminalPublicHoldPointRelease(releaseToken.holdPoint.status);

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
    const { holdPoint, releasedItpInstanceId } = await prisma.$transaction((tx) =>
      executeHoldPointTokenRelease(tx, {
        tokenId: releaseToken.id,
        holdPointId: releaseToken.holdPoint.id,
        releasedAt,
        effectiveReleasedByName,
        releasedByOrg,
        releaseNotes,
        signatureDataUrl,
      }),
    );

    await runHoldPointReleasePostCommit({
      holdPoint,
      project: releaseToken.holdPoint.lot.project,
      releasedItpInstanceId,
      releasedAt,
      effectiveReleasedByName,
      submittedReleasedByName: releasedByName,
      releasedByOrg,
      releaseNotes,
      tokenRecipientEmail: releaseToken.recipientEmail,
      tokenRecipientName: releaseToken.recipientName,
      req,
    });

    res.json(buildPublicHoldPointReleasedResponse(holdPoint));
  }),
);

// Public batch review-room endpoints (summary, per-hold-point evidence + file
// download, and batch release). Same hashed-token validation and reused
// evidence/release logic as the single /public/:token routes; mounted here
// alongside them, before any route-wide auth. Their /public/batch/... paths do
// not collide with the single /public/:token routes above.
holdpointsRouter.use(holdPointPublicBatchRouter);

export { holdpointsRouter };
