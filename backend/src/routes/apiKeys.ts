// Feature #747: API Keys for external REST access
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import crypto from 'crypto';
import { z } from 'zod';

const router = Router();
const ALLOWED_API_KEY_SCOPES = ['read', 'write', 'admin'];
const ADMIN_API_KEY_CREATORS = ['owner', 'admin'];
const SAFE_API_KEY_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const API_KEY_PATTERN = /^sp_[a-f0-9]{64}$/;
const API_KEY_ID_MAX_LENGTH = 120;

// Apply authentication to all routes in this router
router.use(requireAuth);

// Generate secure random API key
function generateApiKey(): string {
  return `sp_${crypto.randomBytes(32).toString('hex')}`;
}

// Hash API key for storage
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function parseApiKeyRouteId(value: unknown): string {
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

// Validation schemas
const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(100),
  scopes: z.string().max(100).optional().default('read'),
  expiresInDays: z
    .number()
    .finite('expiresInDays must be finite')
    .int()
    .positive()
    .max(365)
    .optional(),
});

function normalizeApiKeyScopes(scopes: string): string {
  const parsedScopes = scopes
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);

  if (
    parsedScopes.length === 0 ||
    parsedScopes.some((scope) => !ALLOWED_API_KEY_SCOPES.includes(scope))
  ) {
    throw AppError.badRequest('Invalid API key scopes');
  }

  return Array.from(new Set(parsedScopes)).join(',');
}

function parseNormalizedScopes(scopes: string): string[] {
  return scopes
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function hasApiKeyScope(scopes: string[], requiredScope: string): boolean {
  return scopes.includes('admin') || scopes.includes(requiredScope);
}

function getRequiredScopeForMethod(method: string): string {
  return SAFE_API_KEY_METHODS.includes(method) ? 'read' : 'write';
}

async function assertCanCreateApiKeyScopes(userId: string, normalizedScopes: string) {
  const requestedScopes = parseNormalizedScopes(normalizedScopes);

  if (!requestedScopes.includes('admin')) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roleInCompany: true },
  });

  if (!user) {
    throw AppError.unauthorized('Authentication required');
  }

  if (!ADMIN_API_KEY_CREATORS.includes(user.roleInCompany)) {
    throw AppError.forbidden('Only company owners and admins can create admin-scoped API keys');
  }
}

function rejectApiKeyManagement(req: Request, _res: Response, next: NextFunction) {
  if (req.apiKey) {
    return next(AppError.forbidden('API keys cannot be used to manage API keys'));
  }

  next();
}

function getSingleHeaderValue(
  value: string | string[] | undefined,
  headerName: string,
): string | null {
  if (Array.isArray(value)) {
    throw AppError.badRequest(`${headerName} must be a single value`);
  }

  if (typeof value !== 'string') {
    return null;
  }

  return value;
}

function extractApiKey(req: Request): string | null {
  const apiKeyHeader = getSingleHeaderValue(req.headers['x-api-key'], 'x-api-key');
  const trimmedApiKeyHeader = apiKeyHeader?.trim();
  if (trimmedApiKeyHeader) {
    return trimmedApiKeyHeader;
  }

  const authHeader = getSingleHeaderValue(req.headers.authorization, 'Authorization');
  const normalizedAuthHeader = authHeader?.trimStart();
  if (normalizedAuthHeader === 'ApiKey' || normalizedAuthHeader?.startsWith('ApiKey ')) {
    const apiKey = normalizedAuthHeader.substring('ApiKey'.length).trim();
    if (!apiKey) {
      throw AppError.unauthorized('Invalid or expired API key');
    }
    return apiKey;
  }

  return null;
}

router.use(rejectApiKeyManagement);

// POST /api/api-keys - Create a new API key
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const validation = createApiKeySchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error, 'Invalid request');
    }

    const { name, scopes, expiresInDays } = validation.data;
    const normalizedScopes = normalizeApiKeyScopes(scopes);
    await assertCanCreateApiKeyScopes(userId, normalizedScopes);

    // Generate the key
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 11); // "sp_" + first 8 chars

    // Calculate expiry if specified
    let expiresAt: Date | null = null;
    if (expiresInDays !== undefined) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Create the API key record
    const apiKeyRecord = await prisma.apiKey.create({
      data: {
        userId,
        name,
        keyHash,
        keyPrefix,
        scopes: normalizedScopes,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // Return the key (only shown once!)
    res.status(201).json({
      apiKey: {
        ...apiKeyRecord,
        key: apiKey, // Only returned on creation
      },
      message: 'API key created. Save this key securely - it cannot be retrieved again.',
    });
  }),
);

// GET /api/api-keys - List user's API keys
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ apiKeys });
  }),
);

// DELETE /api/api-keys/:keyId - Revoke an API key
router.delete(
  '/:keyId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const keyId = parseApiKeyRouteId(req.params.keyId);

    // Verify ownership
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!apiKey) {
      throw AppError.notFound('API key');
    }

    // Soft delete by deactivating
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    res.json({ message: 'API key revoked successfully' });
  }),
);

// Middleware to authenticate API key requests
export async function authenticateApiKey(req: Request, _res: Response, next: NextFunction) {
  let apiKey: string | null;
  try {
    apiKey = extractApiKey(req);
  } catch (error) {
    return next(error);
  }

  if (!apiKey) {
    return next(); // Let other auth middleware handle it
  }

  if (!API_KEY_PATTERN.test(apiKey)) {
    return next(AppError.unauthorized('Invalid or expired API key'));
  }

  try {
    const keyHash = hashApiKey(apiKey);

    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            companyId: true,
            roleInCompany: true,
          },
        },
      },
    });

    if (!apiKeyRecord) {
      return next(AppError.unauthorized('Invalid or expired API key'));
    }

    // Update last used timestamp (non-blocking)
    prisma.apiKey
      .update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        /* non-critical */
      });

    // Set user on request
    req.user = {
      id: apiKeyRecord.user.id,
      userId: apiKeyRecord.user.id,
      email: apiKeyRecord.user.email,
      fullName: apiKeyRecord.user.fullName,
      roleInCompany: apiKeyRecord.user.roleInCompany,
      role: apiKeyRecord.user.roleInCompany,
      companyId: apiKeyRecord.user.companyId,
    };
    const apiKeyScopes = apiKeyRecord.scopes
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean);
    const requiredScope = getRequiredScopeForMethod(req.method);

    if (!hasApiKeyScope(apiKeyScopes, requiredScope)) {
      return next(AppError.forbidden(`Insufficient scope. Required: ${requiredScope}`));
    }

    req.apiKey = {
      id: apiKeyRecord.id,
      scopes: apiKeyScopes,
    };

    next();
  } catch (_error) {
    next(AppError.internal('Authentication failed'));
  }
}

// Middleware to check API key scopes
export function requireScope(scope: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const apiKey = req.apiKey;

    // If not API key auth, allow (JWT auth handles its own permissions)
    if (!apiKey) {
      return next();
    }

    if (hasApiKeyScope(apiKey.scopes, scope)) {
      return next();
    }

    next(AppError.forbidden(`Insufficient scope. Required: ${scope}`));
  };
}

export default router;
