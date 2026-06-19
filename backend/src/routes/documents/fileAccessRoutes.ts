import { Router, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { buildBackendUrl } from '../../lib/runtimeConfig.js';
import { buildDocumentSignedUrlResponse } from '../documentResponses.js';

type AuthUser = NonNullable<Express.Request['user']>;

type DocumentAccessRecord = {
  projectId: string;
  lotId: string | null;
  uploadedById: string | null;
  documentType?: string | null;
  category?: string | null;
};

type DocumentDownloadRecord = {
  fileUrl: string;
  filename: string;
  mimeType: string | null;
  projectId: string;
  documentType?: string | null;
};

type CreateDocumentFileAccessRouterDependencies = {
  prisma: PrismaClient;
  parseDocumentRouteParam: (value: unknown, fieldName: string) => string;
  parseDocumentContentDisposition: (value: unknown) => 'inline' | 'attachment';
  parseSignedUrlExpiryMinutes: (value: unknown) => number;
  generateSignedUrlToken: (
    documentId: string,
    userId: string,
    expiresInMinutes?: number,
  ) => Promise<{ token: string; expiresAt: Date }>;
  canReadDocument: (user: AuthUser, document: DocumentAccessRecord) => Promise<boolean>;
  sendDocumentFile: (
    document: DocumentDownloadRecord,
    res: Response,
    disposition?: 'inline' | 'attachment',
  ) => Promise<void>;
};

export function createDocumentFileAccessRouter({
  prisma,
  parseDocumentRouteParam,
  parseDocumentContentDisposition,
  parseSignedUrlExpiryMinutes,
  generateSignedUrlToken,
  canReadDocument,
  sendDocumentFile,
}: CreateDocumentFileAccessRouterDependencies) {
  const fileAccessRoutes = Router();

  // GET /api/documents/file/:documentId - Get document file (requires auth)
  fileAccessRoutes.get(
    '/file/:documentId',
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

      await sendDocumentFile(document, res);
    }),
  );

  // Feature #741: POST /api/documents/:documentId/signed-url - Generate a signed URL for file download
  // This creates a time-limited, secure URL that can be shared without requiring auth
  fileAccessRoutes.post(
    '/:documentId/signed-url',
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = parseDocumentRouteParam(req.params.documentId, 'documentId');
      const { expiresInMinutes } = req.body;
      const disposition = parseDocumentContentDisposition(req.body.disposition);
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

      // Validate expiry time (1 minute to 24 hours)
      const validExpiry = parseSignedUrlExpiryMinutes(expiresInMinutes);

      // Generate signed token
      const { token, expiresAt } = await generateSignedUrlToken(documentId, userId, validExpiry);

      const query = new URLSearchParams({ token });
      if (disposition === 'inline') {
        query.set('disposition', disposition);
      }
      const signedUrl = buildBackendUrl(`/api/documents/download/${documentId}?${query}`);

      res.json(
        buildDocumentSignedUrlResponse({
          signedUrl,
          token,
          documentId,
          filename: document.filename,
          mimeType: document.mimeType,
          disposition,
          expiresAt,
          expiresInMinutes: validExpiry,
        }),
      );
    }),
  );

  return fileAccessRoutes;
}
