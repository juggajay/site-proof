import { Router } from 'express';

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AuditAction, writeAuditLogInTransaction } from '../../lib/auditLog.js';
import { buildApiKeyRevokedResponse } from '../apiKeys/responses.js';
import { requireBrowserSession, requireCompanyAdmin } from './access.js';
import { buildCompanyApiKeyInventoryResponse } from './responses.js';

export const companyApiKeyRoutes = Router();

const API_KEY_ID_MAX_LENGTH = 120;

function parseCompanyApiKeyRouteId(value: unknown): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest('keyId must be a single value');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest('keyId is required');
  }

  if (trimmed.length > API_KEY_ID_MAX_LENGTH) {
    throw AppError.badRequest('keyId is too long');
  }

  return trimmed;
}

// GET /api/company/api-keys
// M72(b): owner/admin inventory of every API key across the company's users —
// the creator, last-used, and active state of each key. The per-user
// self-service list stays at GET /api/api-keys; this is the company-wide view a
// company admin needs to audit and clean up keys. ApiKey has a userId FK and no
// companyId, so keys are scoped through the owning user's company.
companyApiKeyRoutes.get(
  '/api-keys',
  asyncHandler(async (req, res) => {
    requireBrowserSession(req, 'Company API key inventory');
    const user = req.user!;
    const companyId = requireCompanyAdmin(user);

    const apiKeys = await prisma.apiKey.findMany({
      where: { user: { companyId } },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, email: true } },
      },
      // Active keys first, then most-recently created — the order an admin scans.
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    res.json(buildCompanyApiKeyInventoryResponse(apiKeys));
  }),
);

// DELETE /api/company/api-keys/:keyId
// Company owners/admins need an incident-response path for keys owned by
// departed or unavailable members. The self-service /api/api-keys/:keyId route
// remains user-scoped; this route scopes through the key owner's company.
companyApiKeyRoutes.delete(
  '/api-keys/:keyId',
  asyncHandler(async (req, res) => {
    requireBrowserSession(req, 'Company API key revocation');
    const actor = req.user!;
    const companyId = requireCompanyAdmin(actor);
    const keyId = parseCompanyApiKeyRouteId(req.params.keyId);

    await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: actor.userId },
        select: { companyId: true, roleInCompany: true },
      });

      if (currentUser?.companyId !== companyId) {
        throw AppError.forbidden('Invalid company session');
      }

      if (!['owner', 'admin'].includes(currentUser.roleInCompany || '')) {
        throw AppError.forbidden('Only company owners and admins can revoke company API keys');
      }

      const apiKey = await tx.apiKey.findFirst({
        where: {
          id: keyId,
          user: { companyId },
        },
        select: {
          id: true,
          userId: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          isActive: true,
          user: { select: { id: true, email: true } },
        },
      });

      if (!apiKey) {
        throw AppError.notFound('API key');
      }

      if (apiKey.isActive) {
        await tx.apiKey.update({
          where: { id: keyId },
          data: { isActive: false },
        });
      }

      await writeAuditLogInTransaction(tx, {
        userId: actor.userId,
        entityType: 'api_key',
        entityId: apiKey.id,
        action: AuditAction.API_KEY_REVOKED,
        changes: {
          name: apiKey.name,
          scopes: apiKey.scopes,
          keyPrefix: apiKey.keyPrefix,
          ownerUserId: apiKey.user?.id ?? apiKey.userId,
          ownerEmail: apiKey.user?.email ?? null,
          revokedByCompanyAdmin: true,
          isActive: { from: apiKey.isActive, to: false },
        },
        req,
      });
    });

    res.json(buildApiKeyRevokedResponse());
  }),
);
