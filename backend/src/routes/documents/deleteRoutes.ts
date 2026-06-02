import fs from 'fs';
import { Router, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
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

      // Audit log for document deletion
      await createAuditLog({
        projectId: document.projectId,
        userId,
        entityType: 'document',
        entityId: documentId,
        action: AuditAction.DOCUMENT_DELETED,
        changes: { filename: document.filename, fileUrl: document.fileUrl },
        req,
      });

      // Delete database record
      await prisma.document.delete({ where: { id: documentId } });

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
