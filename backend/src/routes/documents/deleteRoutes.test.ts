import type { PrismaClient } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../middleware/errorHandler.js';
import { createDocumentDeleteRouter } from './deleteRoutes.js';

vi.mock('../../middleware/authMiddleware.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      id: 'user-1',
      userId: 'user-1',
      email: 'user@example.com',
      fullName: 'Test User',
      role: 'owner',
      companyId: 'company-1',
      roleInCompany: 'owner',
    };
    next();
  },
}));

vi.mock('../../lib/auditLog.js', () => ({
  AuditAction: { DOCUMENT_DELETED: 'document_deleted' },
  writeAuditLogInTransaction: vi.fn(),
}));

import { writeAuditLogInTransaction } from '../../lib/auditLog.js';

const mockWriteAuditLogInTransaction = vi.mocked(writeAuditLogInTransaction);

function buildApp(
  documentType: string,
  { ncrEvidenceLink = false, variationEvidenceLink = false } = {},
) {
  const document = {
    id: 'document-1',
    projectId: 'project-1',
    lotId: null,
    uploadedById: 'user-1',
    documentType,
    category: 'Quality',
    filename: `${documentType}.pdf`,
    fileUrl: 'data:application/pdf;base64,JVBERi0xLjQ=',
    parentDocumentId: null,
    isLatestVersion: false,
  };

  const txDocumentDelete = vi.fn(async () => document);
  const transactionClient = {
    document: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: txDocumentDelete,
    },
  };
  const transaction = vi.fn(async (callback) => callback(transactionClient));
  const rootDocumentDelete = vi.fn(async () => document);

  const prisma = {
    document: {
      findUnique: vi.fn(async () => document),
      delete: rootDocumentDelete,
    },
    nCREvidence: {
      findFirst: vi.fn(async () => (ncrEvidenceLink ? { ncr: { status: 'open' } } : null)),
    },
    variationEvidence: {
      findFirst: vi.fn(async () =>
        variationEvidenceLink ? { variation: { status: 'claimed', claimedInId: 'claim-1' } } : null,
      ),
    },
    $transaction: transaction,
  } as unknown as PrismaClient;

  const app = express();
  app.use(express.json());
  app.use(
    '/api/documents',
    createDocumentDeleteRouter({
      prisma,
      parseDocumentRouteParam: (value) => String(value),
      canReadDocument: vi.fn(async () => true),
      requireDocumentMutationAccess: vi.fn(async () => undefined),
      isSupabaseConfigured: () => false,
      getOwnedDocumentStoragePath: () => null,
      deleteFromSupabase: vi.fn(),
      isExternalFileUrl: () => false,
      resolveLocalDocumentFilePath: () => 'unused',
    }),
  );
  app.use(errorHandler);

  return { app, prisma, rootDocumentDelete, transaction, transactionClient, txDocumentDelete };
}

describe('createDocumentDeleteRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not store raw document file locators in deletion audit changes', async () => {
    const { app, transaction, transactionClient, txDocumentDelete } = buildApp('photo');

    const res = await request(app)
      .delete('/api/documents/document-1')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(204);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(mockWriteAuditLogInTransaction).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({
        action: 'document_deleted',
        changes: {
          filename: 'photo.pdf',
          storageKind: 'inline',
        },
      }),
    );
    expect(mockWriteAuditLogInTransaction.mock.calls[0][1].changes).not.toHaveProperty('fileUrl');
    expect(txDocumentDelete).toHaveBeenCalledWith({ where: { id: 'document-1' } });
  });

  it.each([
    ['test_certificate', 'test result workflow'],
    ['drawing', 'drawing register'],
  ])('rejects generic deletion of %s documents', async (documentType, expectedMessage) => {
    const { app, rootDocumentDelete, transaction } = buildApp(documentType);

    const res = await request(app)
      .delete('/api/documents/document-1')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toContain(expectedMessage);
    expect(transaction).not.toHaveBeenCalled();
    expect(rootDocumentDelete).not.toHaveBeenCalled();
  });

  it('rejects generic deletion of a document linked as NCR evidence', async () => {
    const { app, rootDocumentDelete, transaction, txDocumentDelete } = buildApp('photo', {
      ncrEvidenceLink: true,
    });

    const res = await request(app)
      .delete('/api/documents/document-1')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toContain('NCR workflow');
    expect(transaction).not.toHaveBeenCalled();
    expect(rootDocumentDelete).not.toHaveBeenCalled();
    expect(txDocumentDelete).not.toHaveBeenCalled();
  });

  it('rejects generic deletion of a document linked as variation evidence', async () => {
    const { app, rootDocumentDelete, transaction, txDocumentDelete } = buildApp('photo', {
      variationEvidenceLink: true,
    });

    const res = await request(app)
      .delete('/api/documents/document-1')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toContain('variation register');
    expect(transaction).not.toHaveBeenCalled();
    expect(rootDocumentDelete).not.toHaveBeenCalled();
    expect(txDocumentDelete).not.toHaveBeenCalled();
  });
});
