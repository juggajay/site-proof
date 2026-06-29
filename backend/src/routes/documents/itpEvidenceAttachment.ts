/**
 * ITP-evidence attachment handling for POST /api/documents/upload.
 *
 * The offline photo sync worker (frontend/src/lib/offline/syncWorker.ts) has
 * always sent `entityType` / `entityId` in its upload FormData, but the upload
 * route ignored them — queued ITP evidence photos landed as orphan documents,
 * never attached to their completion. This module closes that gap: when an
 * upload declares `entityType === 'itp'` with an ITP completion id in
 * `entityId`, the created document is linked to that completion with the same
 * `ITPCompletionAttachment` row the direct attach endpoint
 * (routes/itp/completionAttachmentRoutes.ts POST
 * /completions/:completionId/attachments) creates, so both paths converge on
 * an identical data shape.
 *
 * Contract (mirrors the attach endpoint):
 *  - Unknown completion id  -> null (orphan-safe: the upload still succeeds so
 *    a queued photo is never wedged or lost; it just stays a plain document).
 *  - Cross-project / cross-lot ids -> 400 with the attach endpoint's wording.
 *  - Role gate -> ITP_WRITE_ROLES on the completion's lot (or project when the
 *    instance has no lot), plus the subcontractor canCompleteITP permission —
 *    byte-for-byte the checks the attach endpoint runs.
 *
 * Resolution runs BEFORE the file is stored so a rejected upload never leaves
 * a stored file or document row behind; the attachment row is created after
 * the document exists.
 */
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import type { AuthUser } from '../../lib/auth.js';
import {
  ITP_WRITE_ROLES,
  isItpSubcontractorUser,
  requireItpLotRole,
  requireItpProjectRole,
  requireItpSubcontractorCompletionPermission,
} from '../itp/helpers/access.js';
import {
  isSubcontractorVisibleChecklistItem,
  resolveChecklistItemForInstance,
} from '../itp/helpers/templateSnapshot.js';
import { assertItpCompletionEvidenceUnlocked } from '../itp/helpers/evidenceLock.js';

export const ITP_EVIDENCE_ENTITY_TYPE = 'itp';

export interface ItpEvidenceAttachmentTarget {
  completionId: string;
  lotId: string | null;
}

/**
 * Resolve and authorize the ITP completion an upload wants to attach to.
 *
 * Returns null when the upload is not ITP evidence (different/absent
 * entityType, missing entityId) or when the completion no longer exists
 * (orphan-safe). Throws the attach endpoint's 400/403 errors for
 * cross-project, cross-lot, or insufficient-role uploads.
 */
export async function resolveItpEvidenceAttachmentTarget(
  user: AuthUser,
  {
    entityType,
    entityId,
    projectId,
    lotId,
  }: {
    entityType: string | null | undefined;
    entityId: string | null | undefined;
    projectId: string;
    lotId: string | null | undefined;
  },
): Promise<ItpEvidenceAttachmentTarget | null> {
  if (entityType !== ITP_EVIDENCE_ENTITY_TYPE || !entityId) {
    return null;
  }

  const completion = await prisma.iTPCompletion.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      status: true,
      verificationStatus: true,
      checklistItemId: true,
      checklistItem: {
        select: {
          id: true,
          description: true,
          sequenceNumber: true,
          pointType: true,
          responsibleParty: true,
          evidenceRequired: true,
          acceptanceCriteria: true,
          testType: true,
        },
      },
      itpInstance: {
        select: {
          lotId: true,
          templateSnapshot: true,
          lot: { select: { projectId: true } },
          template: {
            select: {
              projectId: true,
              checklistItems: {
                select: {
                  id: true,
                  description: true,
                  sequenceNumber: true,
                  pointType: true,
                  responsibleParty: true,
                  evidenceRequired: true,
                  acceptanceCriteria: true,
                  testType: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Orphan-safe: a completion deleted while the photo sat in the offline queue
  // must not wedge the upload — the document is still created, just unattached.
  if (!completion) {
    return null;
  }

  // Same project resolution as the attach endpoint: the lot's project wins
  // (cross-project template imports), falling back to the template's project.
  const completionProjectId =
    completion.itpInstance?.lot?.projectId || completion.itpInstance?.template?.projectId;

  if (!completionProjectId) {
    throw AppError.badRequest('Unable to determine project for attachment');
  }

  if (completionProjectId !== projectId) {
    throw AppError.badRequest('Document must belong to the same project as the ITP completion');
  }

  const completionLotId = completion.itpInstance?.lotId;
  if (completionLotId && lotId && lotId !== completionLotId) {
    throw AppError.badRequest('Document must belong to the same lot as the ITP completion');
  }

  if (completionLotId) {
    await requireItpLotRole(
      user,
      completionProjectId,
      completionLotId,
      ITP_WRITE_ROLES,
      'ITP attachment write access required',
    );
    await requireItpSubcontractorCompletionPermission(user, completionProjectId, completionLotId);
  } else {
    await requireItpProjectRole(
      user,
      completionProjectId,
      ITP_WRITE_ROLES,
      'ITP attachment write access required',
    );
    if (isItpSubcontractorUser(user)) {
      throw AppError.forbidden('ITP attachment write access required');
    }
  }

  const checklistItem = resolveChecklistItemForInstance(
    completion.itpInstance,
    completion.checklistItemId,
    completion.checklistItem,
  );

  if (isItpSubcontractorUser(user) && !isSubcontractorVisibleChecklistItem(checklistItem ?? {})) {
    throw AppError.forbidden('ITP attachment write access required');
  }
  assertItpCompletionEvidenceUnlocked(completion);

  return { completionId: completion.id, lotId: completionLotId ?? null };
}

/**
 * Link an uploaded document to its ITP completion — the same association row
 * the attach endpoint creates, so queued-and-synced evidence is
 * indistinguishable from directly uploaded evidence.
 */
export async function attachDocumentToItpCompletion(
  target: ItpEvidenceAttachmentTarget,
  documentId: string,
): Promise<void> {
  await prisma.iTPCompletionAttachment.create({
    data: {
      completionId: target.completionId,
      documentId,
    },
  });
}
