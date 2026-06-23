import { Router } from 'express';

import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireCompanyAdmin } from './access.js';
import { buildCompanyApiKeyInventoryResponse } from './responses.js';

export const companyApiKeyRoutes = Router();

// GET /api/company/api-keys
// M72(b): owner/admin inventory of every API key across the company's users —
// the creator, last-used, and active state of each key. The per-user
// self-service list stays at GET /api/api-keys; this is the company-wide view a
// company admin needs to audit and (via the existing revoke endpoint) clean up
// keys. ApiKey has a userId FK and no companyId, so keys are scoped through the
// owning user's company.
companyApiKeyRoutes.get(
  '/api-keys',
  asyncHandler(async (req, res) => {
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
