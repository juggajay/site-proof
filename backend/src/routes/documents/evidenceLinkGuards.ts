import type { PrismaClient } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';

// A document can be linked to a workflow record as evidence. Those link rows use
// `onDelete: Cascade` on the document FK, so deleting the backing document
// through the generic document route silently drops the evidence — and workflow
// records (NCRs submitted for verification, claimed variations) treat their
// evidence as immutable once they reach those states.
//
// Each evidence-link table is described once here; the generic delete and
// metadata-mutation guards below iterate this list. Adding the next evidence
// table is a single entry, not another hand-written check in three routes.
type EvidenceLink = { metadataLocked: boolean };

type EvidenceLinkGuard = {
  evidenceType: string;
  // Returns the link for this document (with whether the owning record has
  // reached an immutable state), or null when the document is not linked here.
  findLink: (prisma: PrismaClient, documentId: string) => Promise<EvidenceLink | null>;
  deleteBlockedMessage: string;
  metadataLockedMessage: string;
};

const EVIDENCE_LINK_GUARDS: EvidenceLinkGuard[] = [
  {
    evidenceType: 'ncr',
    async findLink(prisma, documentId) {
      const link = await prisma.nCREvidence.findFirst({
        where: { documentId },
        select: { ncr: { select: { status: true } } },
      });
      if (!link) {
        return null;
      }
      // Mirrors the NCR evidence workflow (ncrs/ncrEvidence.ts): evidence is
      // immutable once the NCR is submitted for verification — it is the record
      // the QM verifies and closes against.
      const status = link.ncr.status;
      return {
        metadataLocked:
          status === 'verification' || status === 'closed' || status === 'closed_concession',
      };
    },
    deleteBlockedMessage: 'NCR evidence documents must be removed from the NCR workflow.',
    metadataLockedMessage:
      'NCR evidence cannot be modified once the NCR has been submitted for verification.',
  },
  {
    evidenceType: 'variation',
    async findLink(prisma, documentId) {
      const link = await prisma.variationEvidence.findFirst({
        where: { documentId },
        select: { variation: { select: { status: true, claimedInId: true } } },
      });
      if (!link) {
        return null;
      }
      // Mirrors the variation register (claims/variationRoutes.ts,
      // variationValidation.ts): a claimed variation is locked.
      const { status, claimedInId } = link.variation;
      return { metadataLocked: claimedInId !== null || status === 'claimed' };
    },
    deleteBlockedMessage:
      'Variation evidence documents must be removed from the variation register.',
    metadataLockedMessage:
      'Variation evidence cannot be modified once the variation has been claimed.',
  },
  {
    // Wave C5.1 §4.3 `[C5R-B3]`. `diary_deliveries.docket_document_id` is
    // `onDelete: Restrict`, so without this entry the generic delete returns a
    // bare 422 INVALID_REFERENCE from the FK (errorHandler's P2003 branch) —
    // no code the UI can branch on and no guidance.
    evidenceType: 'delivery_docket',
    async findLink(prisma, documentId) {
      const link = await prisma.diaryDelivery.findFirst({
        where: { docketDocumentId: documentId },
        select: { id: true },
      });
      if (!link) {
        return null;
      }
      // `metadataLocked` is deliberately FALSE. §4.4a exists precisely to keep
      // delivery evidence editable after the diary is submitted; locking the
      // document's caption while the link itself stays editable would be
      // incoherent. Flip it only if a pilot shows docket metadata being churned.
      return { metadataLocked: false };
    },
    deleteBlockedMessage: 'Delivery docket documents must be removed from the delivery.',
    metadataLockedMessage: 'Delivery docket documents cannot be modified.',
  },
  {
    // Wave C5.2 §4.3 `[C5R-B3]`. `survey_records.report_document_id` is
    // `onDelete: Restrict`; this turns the FK violation into a 409 with
    // guidance instead of a bare 422 INVALID_REFERENCE.
    evidenceType: 'survey_report',
    async findLink(prisma, documentId) {
      const link = await prisma.surveyRecord.findFirst({
        where: { reportDocumentId: documentId },
        select: { status: true },
      });
      if (!link) {
        return null;
      }
      // An accepted survey is closed: renaming or re-categorising the report
      // behind it would change evidence the acceptance was made against.
      return { metadataLocked: link.status === 'accepted' };
    },
    deleteBlockedMessage: 'Survey report documents must be removed from the survey record.',
    metadataLockedMessage: 'A survey report cannot be modified once the survey has been accepted.',
  },
];

/**
 * Wave B `[WBR2-3]` §3.3 — source survival is an APPLICATION-layer rule, not an
 * FK constraint. The `ImportBatch.sourceDocument` FK is deliberately
 * `onDelete: SetNull`: a `Restrict` child hanging off `Document`'s cascade
 * parent would abort project deletion outright. So the rule lives here, where it
 * can explain itself the way `assertCreatedLotsHaveNoProgress` does.
 *
 * Deleting a source file behind a LIVE or APPLIED import is refused. Terminal
 * batches (rolled_back, cancelled, failed) release their source — there is no
 * live record left to trace back to it.
 */
async function assertNotLiveImportSource(prisma: PrismaClient, documentId: string): Promise<void> {
  const batch = await prisma.importBatch.findFirst({
    where: {
      sourceDocumentId: documentId,
      status: { notIn: ['rolled_back', 'cancelled', 'failed'] },
    },
    select: { status: true },
  });
  if (!batch) return;

  throw AppError.conflict(
    batch.status === 'applied'
      ? 'This file is the source of an applied import — roll the import back first.'
      : 'This file is the source of an import that is still in progress — cancel the import first.',
    { code: 'IMPORT_SOURCE_DELETE_BLOCKED', importStatus: batch.status },
  );
}

// Generic document delete must not cascade-drop a workflow evidence link.
// Removal has to go through the owning workflow, which enforces its lifecycle.
export async function assertDocumentDeletableOutsideEvidenceWorkflow(
  prisma: PrismaClient,
  documentId: string,
): Promise<void> {
  for (const guard of EVIDENCE_LINK_GUARDS) {
    if (await guard.findLink(prisma, documentId)) {
      throw AppError.conflict(guard.deleteBlockedMessage, {
        code: 'WORKFLOW_EVIDENCE_DELETE_BLOCKED',
        evidenceType: guard.evidenceType,
      });
    }
  }

  await assertNotLiveImportSource(prisma, documentId);
}

// Generic document metadata mutation must not touch evidence whose owning
// workflow record has locked it (NCR at/past verification, claimed variation).
export async function assertEvidenceMetadataMutable(
  prisma: PrismaClient,
  documentId: string,
): Promise<void> {
  for (const guard of EVIDENCE_LINK_GUARDS) {
    const link = await guard.findLink(prisma, documentId);
    if (link?.metadataLocked) {
      throw AppError.conflict(guard.metadataLockedMessage, {
        code: 'WORKFLOW_EVIDENCE_LOCKED',
        evidenceType: guard.evidenceType,
      });
    }
  }
}
