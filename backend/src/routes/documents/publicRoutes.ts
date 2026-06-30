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
  projectId: string;
  lotId: string | null;
  uploadedById: string | null;
  documentType?: string | null;
  category?: string | null;
};

type SignedUrlUser = NonNullable<Express.Request['user']>;
type CanReadDocument = (user: SignedUrlUser, document: DocumentDownloadRecord) => Promise<boolean>;

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
  canReadDocument: CanReadDocument;
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

async function getSignedUrlUser(prisma: PrismaClient, userId: string): Promise<SignedUrlUser> {
  const tokenUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      roleInCompany: true,
      companyId: true,
    },
  });

  if (!tokenUser?.roleInCompany) {
    throw AppError.forbidden('Access denied');
  }

  return {
    id: tokenUser.id,
    userId: tokenUser.id,
    email: tokenUser.email,
    fullName: tokenUser.fullName,
    roleInCompany: tokenUser.roleInCompany,
    role: tokenUser.roleInCompany,
    companyId: tokenUser.companyId,
  };
}

async function assertSignedUrlUserCanReadDocument({
  prisma,
  canReadDocument,
  userId,
  document,
}: {
  prisma: PrismaClient;
  canReadDocument: CanReadDocument;
  userId: string | undefined;
  document: DocumentDownloadRecord;
}): Promise<void> {
  if (!userId) {
    throw AppError.forbidden('The signed URL token is invalid or does not match this document.');
  }

  const tokenUser = await getSignedUrlUser(prisma, userId);
  if (!(await canReadDocument(tokenUser, document))) {
    throw AppError.forbidden('Access denied');
  }
}

export function createDocumentPublicRouter({
  prisma,
  maxDocumentIdLength,
  parseDocumentRouteParam,
  parseDocumentContentDisposition,
  getOptionalQueryString,
  validateSignedUrlToken,
  canReadDocument,
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

      await assertSignedUrlUserCanReadDocument({
        prisma,
        canReadDocument,
        userId: validation.userId,
        document,
      });

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

      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        return res.json(buildInvalidDocumentSignedUrlTokenResponse());
      }

      try {
        await assertSignedUrlUserCanReadDocument({
          prisma,
          canReadDocument,
          userId: validation.userId,
          document,
        });
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 403) {
          return res.json(buildInvalidDocumentSignedUrlTokenResponse());
        }
        throw error;
      }

      res.json(buildDocumentSignedUrlTokenResponse({ documentId, ...validation }));
    }),
  );

  return publicRoutes;
}
