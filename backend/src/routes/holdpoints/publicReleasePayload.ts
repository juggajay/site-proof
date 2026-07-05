import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { holdPointReleaseTokenLookup } from './tokens.js';
import { resolveHoldPointEvidenceInputs } from './evidencePackageInputs.js';
import { buildHoldPointEvidencePackage } from './evidencePackage.js';

// =============================================================================
// Shared public hold-point release read helpers. Extracted verbatim from
// holdpoints.ts so the single secure-link routes and the batch review-room
// routes load and shape the token-scoped evidence package through ONE
// implementation (never fork the trust-boundary payload).
// =============================================================================

// Deep include used to build the public evidence package from a release token.
const publicHoldPointReleaseTokenInclude = {
  holdPoint: {
    include: {
      itpChecklistItem: true,
      lot: {
        include: {
          project: {
            include: {
              company: { select: { id: true, name: true, logoUrl: true } },
            },
          },
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
} satisfies Prisma.HoldPointReleaseTokenInclude;

export type PublicHoldPointReleaseToken = Prisma.HoldPointReleaseTokenGetPayload<{
  include: typeof publicHoldPointReleaseTokenInclude;
}>;

export async function loadPublicHoldPointReleaseToken(
  rawToken: string,
): Promise<PublicHoldPointReleaseToken | null> {
  return prisma.holdPointReleaseToken.findFirst({
    where: holdPointReleaseTokenLookup(rawToken),
    include: publicHoldPointReleaseTokenInclude,
  });
}

// Batch-scoped load: the per-hold-point token must belong to the given batch,
// so a batch link can only ever reach hold points that were part of that batch.
export async function loadBatchScopedHoldPointReleaseToken(
  batchId: string,
  holdPointId: string,
): Promise<PublicHoldPointReleaseToken | null> {
  return prisma.holdPointReleaseToken.findFirst({
    where: { batchId, holdPointId },
    include: publicHoldPointReleaseTokenInclude,
  });
}

export function assertPublicHoldPointTokenAvailable(
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

export async function buildPublicHoldPointReleasePayload(
  releaseToken: PublicHoldPointReleaseToken,
) {
  const holdPoint = releaseToken.holdPoint;
  const lot = holdPoint.lot;
  const { itpInstance, checklistItems, holdPointItem, itpTemplate } =
    resolveHoldPointEvidenceInputs({
      itpInstance: lot.itpInstance,
      checklistItemId: holdPoint.itpChecklistItemId,
      liveFallback: holdPoint.itpChecklistItem,
    });

  const evidencePackage = await buildHoldPointEvidencePackage({
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
      releasedByOrg: holdPoint.releasedByOrg,
      releaseMethod: holdPoint.releaseMethod,
      releaseSignatureUrl: holdPoint.releaseSignatureUrl,
      releaseNotes: holdPoint.releaseNotes,
      notificationSentTo: holdPoint.notificationSentTo,
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
      canRelease: !['released', 'completed'].includes(holdPoint.status) && !releaseToken.usedAt,
    },
  };
}

export function getPublicEvidenceDocumentIds(
  evidencePackage: Awaited<
    ReturnType<typeof buildPublicHoldPointReleasePayload>
  >['evidencePackage'],
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
