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
  AuditAction: { DOCUMENT_DELETED: 'DOCUMENT_DELETED' },
  createAuditLog: vi.fn(),
}));

import { createAuditLog } from '../../lib/auditLog.js';

const mockCreateAuditLog = vi.mocked(createAuditLog);

function buildApp(documentType: string) {
  const document = {
    id: 'document-1',
    projectId: 'project-1',
    lotId: null,
    uploadedById: 'user-1',
    documentType,
    category: 'Quality',
    filename: `${documentType}.pdf`,
    fileUrl: 'data:application/pdf;base64,JVBERi0xLjQ=',
  };

  const prisma = {
    document: {
      findUnique: vi.fn(async () => document),
      delete: vi.fn(async () => document),
    },
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

  return { app, prisma };
}

describe('createDocumentDeleteRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not store raw document file locators in deletion audit changes', async () => {
    const { app } = buildApp('photo');

    const res = await request(app)
      .delete('/api/documents/document-1')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(204);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: {
          filename: 'photo.pdf',
          storageKind: 'inline',
        },
      }),
    );
    expect(mockCreateAuditLog.mock.calls[0][0].changes).not.toHaveProperty('fileUrl');
  });

  it.each([
    ['test_certificate', 'test result workflow'],
    ['drawing', 'drawing register'],
  ])('rejects generic deletion of %s documents', async (documentType, expectedMessage) => {
    const { app, prisma } = buildApp(documentType);

    const res = await request(app)
      .delete('/api/documents/document-1')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toContain(expectedMessage);
    expect(prisma.document.delete).not.toHaveBeenCalled();
  });
});
