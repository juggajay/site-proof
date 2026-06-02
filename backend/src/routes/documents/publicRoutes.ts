import { Router, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

type SignedUrlValidation = {
  valid: boolean;
  expired?: boolean;
  userId?: string;
  expiresAt?: Date;
  createdAt?: Date;
};

type DocumentDownloadRecord = {
  fileUrl: string;
  filename: string;
  mimeType: string | null;
};

type CreateDocumentPublicRouterDependencies = {
  prisma: PrismaClient;
  maxDocumentIdLength: number;
  parseDocumentRouteParam: (value: unknown, fieldName: string) => string;
  parseDocumentContentDisposition: (value: unknown) => 'inline' | 'attachment';
  getOptionalQueryString: (
    query: Record<string, unknown>,
    fieldName: string,
    maxLength: number,
  ) => string | undefined;
  validateSignedUrlToken: (token: string, documentId: string) => Promise<SignedUrlValidation>;
  sendDocumentFile: (
    document: DocumentDownloadRecord,
    res: Response,
    disposition: 'inline' | 'attachment',
  ) => Promise<void>;
  buildInvalidDocumentSignedUrlTokenResponse: (expired?: boolean) => unknown;
  buildDocumentSignedUrlTokenResponse: (validation: {
    documentId: string;
    expiresAt?: Date;
    createdAt?: Date;
  }) => unknown;
};

export function createDocumentPublicRouter({
  prisma,
  maxDocumentIdLength,
  parseDocumentRouteParam,
  parseDocumentContentDisposition,
  getOptionalQueryString,
  validateSignedUrlToken,
  sendDocumentFile,
  buildInvalidDocumentSignedUrlTokenResponse,
  buildDocumentSignedUrlTokenResponse,
}: CreateDocumentPublicRouterDependencies) {
  const publicRoutes = Router();

  // Feature #741: Public route for signed URL download (no auth required)
  publicRoutes.get(
    '/download/:documentId',
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = parseDocumentRouteParam(req.params.documentId, 'documentId');
      const { token } = req.query;
      const disposition = parseDocumentContentDisposition(req.query.disposition);

      if (!token || typeof token !== 'string') {
        throw AppError.badRequest('Token is required', {
          message: 'Please provide a valid signed URL token',
        });
      }

      // Validate the signed token
      const validation = await validateSignedUrlToken(token, documentId);

      if (!validation.valid) {
        if (validation.expired) {
          throw new AppError(
            410,
            'This signed URL has expired. Please request a new one.',
            'URL_EXPIRED',
          );
        }
        throw AppError.forbidden(
          'The signed URL token is invalid or does not match this document.',
        );
      }

      // Get document
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw AppError.notFound('Document');
      }

      await sendDocumentFile(document, res, disposition);
    }),
  );

  // Feature #741: Public route for token validation (no auth required)
  publicRoutes.get(
    '/signed-url/validate',
    asyncHandler(async (req: Request, res: Response) => {
      const { token } = req.query;
      const documentId = getOptionalQueryString(req.query, 'documentId', maxDocumentIdLength);

      if (!token || typeof token !== 'string') {
        throw AppError.badRequest('Token is required');
      }

      if (!documentId) {
        throw AppError.badRequest('Document ID is required');
      }

      const validation = await validateSignedUrlToken(token, documentId);

      if (!validation.valid) {
        return res.json(buildInvalidDocumentSignedUrlTokenResponse(validation.expired));
      }

      res.json(buildDocumentSignedUrlTokenResponse({ documentId, ...validation }));
    }),
  );

  return publicRoutes;
}
