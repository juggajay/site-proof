import fs from 'fs';
import { Router, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { AuditAction, writeAuditLogInTransaction } from '../../lib/auditLog.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { sanitizeUrlValueForLog } from '../../lib/logSanitization.js';
import { logWarn } from '../../lib/serverLogger.js';
import { requireAuth } from '../../middleware/authMiddleware.js';

type AuthUser = NonNullable<Express.Request['user']>;

type DocumentAccessRecord = {
  projectId: string;
  lotId: string | null;
  uploadedById: string | null;
  documentType?: string | null;
  category?: string | null;
};

const GENERIC_DELETE_BLOCKED_DOCUMENT_MESSAGES: Record<string, string> = {
  test_certificate:
    'Test result certificates must be replaced or removed from the test result workflow.',
  drawing: 'Drawing files must be deleted from the drawing register.',
};

function getGenericDeleteBlockedMessage(documentType: string | null | undefined): string | null {
  if (!documentType) {
    return null;
  }

  return GENERIC_DELETE_BLOCKED_DOCUMENT_MESSAGES[documentType] ?? null;
}

function getDocumentStorageKind(fileUrl: string): 'supabase' | 'external' | 'inline' | 'local' {
  if (fileUrl.startsWith('supabase://')) {
    return 'supabase';
  }
  if (/^https?:\/\//i.test(fileUrl)) {
    return 'external';
  }
  if (fileUrl.startsWith('data:')) {
    return 'inline';
  }
  return 'local';
}

type CreateDocumentDeleteRouterDependencies = {
  prisma: PrismaClient;
  parseDocumentRouteParam: (value: unknown, fieldName: string) => string;
  canReadDocument: (user: AuthUser, document: DocumentAccessRecord) => Promise<boolean>;
  requireDocumentMutationAccess: (user: AuthUser, document: DocumentAccessRecord) => Promise<void>;
  isSupabaseConfigured: () => boolean;
  getOwnedDocumentStoragePath: (
    fileUrl: string,
    projectId: string,
    documentType?: string | null,
  ) => string | null;
  deleteFromSupabase: (
    fileUrl: string,
    projectId: string,
    documentType?: string | null,
  ) => Promise<void>;
  isExternalFileUrl: (fileUrl: string) => boolean;
  resolveLocalDocumentFilePath: (fileUrl: string) => string;
};

export function createDocumentDeleteRouter({
  prisma,
  parseDocumentRouteParam,
  canReadDocument,
  requireDocumentMutationAccess,
  isSupabaseConfigured,
  getOwnedDocumentStoragePath,
  deleteFromSupabase,
  isExternalFileUrl,
  resolveLocalDocumentFilePath,
}: CreateDocumentDeleteRouterDependencies) {
  const router = Router();

  router.use(requireAuth);

  // DELETE /api/documents/:documentId - Delete a document
  router.delete(
    '/:documentId',
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = parseDocumentRouteParam(req.params.documentId, 'documentId');
      const userId = req.user!.id;

      if (!userId) {
        throw AppError.unauthorized();
      }

      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw AppError.notFound('Document');
      }

      const hasAccess = await canReadDocument(req.user!, document);
      if (!hasAccess) {
        throw AppError.forbidden('Access denied');
      }
      await requireDocumentMutationAccess(req.user!, document);

      const blockedMessage = getGenericDeleteBlockedMessage(document.documentType);
      if (blockedMessage) {
        throw AppError.conflict(blockedMessage, {
          documentType: document.documentType,
        });
      }

      // Mirror the versioning guard: a document linked as NCR evidence must not
      // be deleted through the generic route, because NCREvidence -> Document is
      // an onDelete: Cascade FK — deleting the document would silently drop the
      // evidence link, including from an already-closed NCR. Removal must go
      // through the NCR evidence workflow, which enforces the NCR lifecycle.
      const ncrEvidenceLink = await prisma.nCREvidence.findFirst({
        where: { documentId: document.id },
        select: { id: true },
      });
      if (ncrEvidenceLink) {
        throw AppError.conflict('NCR evidence documents must be removed from the NCR workflow.', {
          code: 'WORKFLOW_EVIDENCE_DELETE_BLOCKED',
          evidenceType: 'ncr',
        });
      }

      await prisma.$transaction(async (tx) => {
        let previousVersionId: string | null = null;
        if (document.isLatestVersion) {
          const rootDocumentId = document.parentDocumentId || document.id;
          const previousVersion = await tx.document.findFirst({
            where: {
              id: { not: document.id },
              OR: [{ id: rootDocumentId }, { parentDocumentId: rootDocumentId }],
            },
            orderBy: [{ version: 'desc' }, { uploadedAt: 'desc' }],
            select: { id: true },
          });
          previousVersionId = previousVersion?.id ?? null;
        }

        if (!document.parentDocumentId) {
          const remainingVersions = await tx.document.findMany({
            where: { parentDocumentId: document.id },
            orderBy: [{ version: 'asc' }, { uploadedAt: 'asc' }],
            select: { id: true },
          });
          const replacementRoot = remainingVersions[0];
          if (replacementRoot) {
            await tx.document.update({
              where: { id: replacementRoot.id },
              data: { parentDocumentId: null },
            });
            await tx.document.updateMany({
              where: {
                parentDocumentId: document.id,
                id: { not: replacementRoot.id },
              },
              data: { parentDocumentId: replacementRoot.id },
            });
          }
        }

        await writeAuditLogInTransaction(tx, {
          projectId: document.projectId,
          userId,
          entityType: 'document',
          entityId: documentId,
          action: AuditAction.DOCUMENT_DELETED,
          changes: {
            filename: document.filename,
            storageKind: getDocumentStorageKind(document.fileUrl),
          },
          req,
        });

        await tx.document.delete({ where: { id: documentId } });

        if (previousVersionId) {
          await tx.document.update({
            where: { id: previousVersionId },
            data: { isLatestVersion: true },
          });
        }
      });

      try {
        if (
          isSupabaseConfigured() &&
          getOwnedDocumentStoragePath(document.fileUrl, document.projectId, document.documentType)
        ) {
          await deleteFromSupabase(document.fileUrl, document.projectId, document.documentType);
        } else if (isExternalFileUrl(document.fileUrl)) {
          logWarn(
            'Skipping delete for external document URL:',
            sanitizeUrlValueForLog(document.fileUrl),
          );
        } else if (document.fileUrl.startsWith('data:')) {
          // Legacy inline documents have no storage object to delete.
        } else {
          const filePath = resolveLocalDocumentFilePath(document.fileUrl);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      } catch (error) {
        logWarn('Failed to delete document storage object after database delete:', error);
      }

      res.status(204).send();
    }),
  );

  return router;
}
