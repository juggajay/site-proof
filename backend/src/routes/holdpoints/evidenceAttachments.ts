import type { Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';

type EvidenceAttachmentClient = {
  document: {
    findMany(args: Prisma.DocumentFindManyArgs): Promise<Array<{ id: string }>>;
  };
  iTPCompletion: {
    upsert(args: Prisma.ITPCompletionUpsertArgs): Promise<{ id: string }>;
  };
  iTPCompletionAttachment: {
    createMany(args: Prisma.ITPCompletionAttachmentCreateManyArgs): Promise<unknown>;
  };
};

export interface AttachHoldPointEvidenceDocumentsInput {
  projectId: string;
  lotId: string;
  itpInstanceId: string;
  itpChecklistItemId: string;
  documentIds: string[];
}

export interface AttachHoldPointEvidenceDocumentsResult {
  completionId: string | null;
  documentIds: string[];
}

function normalizeEvidenceDocumentIds(documentIds: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const documentId of documentIds) {
    const trimmed = documentId.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export async function attachHoldPointEvidenceDocuments(
  tx: EvidenceAttachmentClient,
  {
    projectId,
    lotId,
    itpInstanceId,
    itpChecklistItemId,
    documentIds,
  }: AttachHoldPointEvidenceDocumentsInput,
): Promise<AttachHoldPointEvidenceDocumentsResult> {
  const uniqueDocumentIds = normalizeEvidenceDocumentIds(documentIds);

  if (uniqueDocumentIds.length === 0) {
    return { completionId: null, documentIds: [] };
  }

  const documents = await tx.document.findMany({
    where: {
      id: { in: uniqueDocumentIds },
      projectId,
      lotId,
    },
    select: { id: true },
  });

  if (documents.length !== uniqueDocumentIds.length) {
    throw AppError.badRequest('Evidence documents must belong to this hold point lot');
  }

  const completion = await tx.iTPCompletion.upsert({
    where: {
      itpInstanceId_checklistItemId: {
        itpInstanceId,
        checklistItemId: itpChecklistItemId,
      },
    },
    update: {},
    create: {
      itpInstanceId,
      checklistItemId: itpChecklistItemId,
      status: 'pending',
    },
    select: { id: true },
  });

  await tx.iTPCompletionAttachment.createMany({
    data: uniqueDocumentIds.map((documentId) => ({
      completionId: completion.id,
      documentId,
    })),
    skipDuplicates: true,
  });

  return { completionId: completion.id, documentIds: uniqueDocumentIds };
}
