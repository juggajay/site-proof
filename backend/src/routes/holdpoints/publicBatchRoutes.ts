import { Router, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { assertProjectAllowsWrite } from '../../lib/projectAccess.js';
import { parseDocumentContentDisposition, sendDocumentFile } from '../documents/fileHelpers.js';
import { hashHoldPointReleaseToken } from './tokens.js';
import {
  MAX_RELEASE_TOKEN_LENGTH,
  parseHoldPointRouteParam,
  parseHPProjectSettings,
  publicBatchReleaseSchema,
} from './validation.js';
import {
  assertPublicHoldPointTokenAvailable,
  buildPublicHoldPointReleasePayload,
  getPublicEvidenceDocumentIds,
  loadBatchScopedHoldPointReleaseToken,
} from './publicReleasePayload.js';
import { buildPublicHoldPointEvidencePackageResponse } from './evidencePackage.js';
import { buildPublicHoldPointReleasedResponse } from './actionResponses.js';
import { requireSuperintendentApprovalRecipients } from './superintendentRecipients.js';
import {
  executeHoldPointTokenRelease,
  runHoldPointReleasePostCommit,
} from './publicReleaseExecution.js';

// =============================================================================
// PUBLIC batch review-room endpoints — no authentication required. A batch
// secure link ("review room") groups the per-hold-point release tokens created
// by POST /request-release/batch. It uses the same hashed-token validation,
// expiry policy, and evidence-package/release logic as the single per-HP public
// routes (reused, never forked). Mounted on holdpointsRouter before any
// route-wide auth, alongside the single /public/:token routes.
// =============================================================================

const batchInclude = {
  lot: { include: { project: true } },
  releaseTokens: {
    include: {
      holdPoint: {
        include: {
          itpChecklistItem: { select: { sequenceNumber: true, description: true } },
        },
      },
    },
  },
} satisfies Prisma.HoldPointReleaseBatchInclude;

type PublicHoldPointReleaseBatch = Prisma.HoldPointReleaseBatchGetPayload<{
  include: typeof batchInclude;
}>;

async function loadPublicHoldPointReleaseBatch(
  rawToken: string,
): Promise<PublicHoldPointReleaseBatch | null> {
  return prisma.holdPointReleaseBatch.findFirst({
    where: { token: hashHoldPointReleaseToken(rawToken) },
    include: batchInclude,
  });
}

function assertPublicHoldPointBatchAvailable(
  batch: PublicHoldPointReleaseBatch | null,
): asserts batch is PublicHoldPointReleaseBatch {
  if (!batch) {
    throw AppError.notFound('Invalid or expired link');
  }

  if (new Date() > batch.expiresAt) {
    throw new AppError(
      410,
      'This secure release link has expired. Please contact the site team for a new link.',
      'TOKEN_EXPIRED',
    );
  }
}

export const holdPointPublicBatchRouter = Router();

// a) Batch summary: project/lot/requester/schedule/recipient + the hold points.
holdPointPublicBatchRouter.get(
  '/public/batch/:batchToken',
  asyncHandler(async (req: Request, res: Response) => {
    const batchToken = parseHoldPointRouteParam(
      req.params.batchToken,
      'batchToken',
      MAX_RELEASE_TOKEN_LENGTH,
    );

    const batch = await loadPublicHoldPointReleaseBatch(batchToken);
    assertPublicHoldPointBatchAvailable(batch);

    const requestedByUser = batch.requestedByUserId
      ? await prisma.user.findUnique({
          where: { id: batch.requestedByUserId },
          select: { fullName: true, email: true },
        })
      : null;

    const seenHoldPointIds = new Set<string>();
    const holdPoints = [];
    for (const token of batch.releaseTokens) {
      const holdPoint = token.holdPoint;
      if (!holdPoint || seenHoldPointIds.has(holdPoint.id)) {
        continue;
      }
      seenHoldPointIds.add(holdPoint.id);
      holdPoints.push({
        holdPointId: holdPoint.id,
        sequenceNumber: holdPoint.itpChecklistItem?.sequenceNumber ?? null,
        description:
          holdPoint.description || holdPoint.itpChecklistItem?.description || 'Hold point',
        status: holdPoint.status,
        releasedAt: holdPoint.releasedAt,
        releasedByName: holdPoint.releasedByName,
      });
    }
    holdPoints.sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));

    res.json({
      isPublicAccess: true,
      batch: {
        project: {
          name: batch.lot.project.name,
          projectNumber: batch.lot.project.projectNumber,
        },
        lot: {
          lotNumber: batch.lot.lotNumber,
          activityType: batch.lot.activityType,
        },
        requestedBy: requestedByUser?.fullName || requestedByUser?.email || null,
        scheduledDate: batch.scheduledDate,
        scheduledTime: batch.scheduledTime,
        recipient: {
          email: batch.recipientEmail,
          name: batch.recipientName,
        },
        expiresAt: batch.expiresAt,
        holdPoints,
      },
    });
  }),
);

// b) Full evidence package for one hold point in the batch — same payload shape
// as the single public token endpoint (reused builder).
holdPointPublicBatchRouter.get(
  '/public/batch/:batchToken/holdpoints/:holdPointId',
  asyncHandler(async (req: Request, res: Response) => {
    const batchToken = parseHoldPointRouteParam(
      req.params.batchToken,
      'batchToken',
      MAX_RELEASE_TOKEN_LENGTH,
    );
    const holdPointId = parseHoldPointRouteParam(req.params.holdPointId, 'holdPointId');

    const batch = await loadPublicHoldPointReleaseBatch(batchToken);
    assertPublicHoldPointBatchAvailable(batch);

    const releaseToken = await loadBatchScopedHoldPointReleaseToken(batch.id, holdPointId);
    if (!releaseToken) {
      throw AppError.notFound('Hold point');
    }
    assertPublicHoldPointTokenAvailable(releaseToken);

    const { evidencePackage, tokenInfo } = await buildPublicHoldPointReleasePayload(releaseToken);
    res.json(buildPublicHoldPointEvidencePackageResponse(evidencePackage, tokenInfo));
  }),
);

// c) Download one file from a batch hold point's evidence package.
holdPointPublicBatchRouter.get(
  '/public/batch/:batchToken/holdpoints/:holdPointId/documents/:documentId',
  asyncHandler(async (req: Request, res: Response) => {
    const batchToken = parseHoldPointRouteParam(
      req.params.batchToken,
      'batchToken',
      MAX_RELEASE_TOKEN_LENGTH,
    );
    const holdPointId = parseHoldPointRouteParam(req.params.holdPointId, 'holdPointId');
    const documentId = parseHoldPointRouteParam(req.params.documentId, 'documentId');
    const disposition = parseDocumentContentDisposition(req.query.disposition);

    const batch = await loadPublicHoldPointReleaseBatch(batchToken);
    assertPublicHoldPointBatchAvailable(batch);

    const releaseToken = await loadBatchScopedHoldPointReleaseToken(batch.id, holdPointId);
    if (!releaseToken) {
      throw AppError.notFound('Hold point');
    }
    assertPublicHoldPointTokenAvailable(releaseToken);

    const { evidencePackage } = await buildPublicHoldPointReleasePayload(releaseToken);
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

// d) Release the selected hold points of a batch under one signed identity.
// All requested ids succeed atomically or the request fails naming the blocker.
holdPointPublicBatchRouter.post(
  '/public/batch/:batchToken/release',
  asyncHandler(async (req: Request, res: Response) => {
    const batchToken = parseHoldPointRouteParam(
      req.params.batchToken,
      'batchToken',
      MAX_RELEASE_TOKEN_LENGTH,
    );
    const parseResult = publicBatchReleaseSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const { holdPointIds, releasedByName, releasedByOrg, releaseNotes, signatureDataUrl } =
      parseResult.data;

    const batch = await loadPublicHoldPointReleaseBatch(batchToken);
    assertPublicHoldPointBatchAvailable(batch);

    // One token per hold point in the batch. Map by hold point id.
    const tokenByHoldPointId = new Map<
      string,
      PublicHoldPointReleaseBatch['releaseTokens'][number]
    >();
    for (const token of batch.releaseTokens) {
      if (!tokenByHoldPointId.has(token.holdPointId)) {
        tokenByHoldPointId.set(token.holdPointId, token);
      }
    }

    const requestedIds = Array.from(new Set(holdPointIds));
    const prepared = requestedIds.map((holdPointId) => {
      const token = tokenByHoldPointId.get(holdPointId);
      if (!token || !token.holdPoint) {
        throw new AppError(
          404,
          'One or more selected hold points are not part of this release batch.',
          'HOLD_POINT_NOT_IN_BATCH',
        );
      }

      const holdPoint = token.holdPoint;
      const label =
        holdPoint.description || holdPoint.itpChecklistItem?.description || 'This hold point';

      if (token.usedAt) {
        throw AppError.badRequest(`${label} has already been released using this link.`);
      }
      if (holdPoint.status === 'released') {
        throw AppError.badRequest(`${label} has already been released.`);
      }
      if (holdPoint.status === 'completed') {
        throw AppError.badRequest(`${label} has already been completed.`);
      }

      return { token, holdPoint };
    });

    const project = batch.lot.project;
    const projectSettings = parseHPProjectSettings(project.settings);
    // Same trust-boundary pre-checks as the single public release, run once for
    // the batch (all hold points share one lot/project and one recipient).
    await assertProjectAllowsWrite(project.id);
    await requireSuperintendentApprovalRecipients(project.id, projectSettings, [
      { email: batch.recipientEmail, fullName: batch.recipientName },
    ]);

    const batchRecipientName = batch.recipientName?.trim();
    const releasedAt = new Date();

    const releasedResults = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of prepared) {
        const effectiveReleasedByName = batchRecipientName || releasedByName;
        const { holdPoint, releasedItpInstanceId } = await executeHoldPointTokenRelease(tx, {
          tokenId: item.token.id,
          holdPointId: item.holdPoint.id,
          releasedAt,
          effectiveReleasedByName,
          releasedByOrg,
          releaseNotes,
          signatureDataUrl,
        });
        results.push({
          holdPoint,
          releasedItpInstanceId,
          effectiveReleasedByName,
          token: item.token,
        });
      }
      return results;
    });

    // Post-commit side effects per hold point (progression, notifications,
    // confirmation emails, audit, webhook). Failures here never roll back the
    // committed releases.
    for (const result of releasedResults) {
      await runHoldPointReleasePostCommit({
        holdPoint: result.holdPoint,
        project,
        releasedItpInstanceId: result.releasedItpInstanceId,
        releasedAt,
        effectiveReleasedByName: result.effectiveReleasedByName,
        submittedReleasedByName: releasedByName,
        releasedByOrg,
        releaseNotes,
        tokenRecipientEmail: result.token.recipientEmail,
        tokenRecipientName: result.token.recipientName,
        req,
      });
    }

    res.json({
      success: true,
      message: `Released ${releasedResults.length} hold point${
        releasedResults.length === 1 ? '' : 's'
      } successfully via secure link.`,
      released: releasedResults.map((result) => {
        const response = buildPublicHoldPointReleasedResponse(result.holdPoint);
        return { ...response.holdPoint, lot: response.lot };
      }),
    });
  }),
);
