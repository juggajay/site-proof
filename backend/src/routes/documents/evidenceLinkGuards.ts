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
];

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
