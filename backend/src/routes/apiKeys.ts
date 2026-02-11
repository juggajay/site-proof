// Feature #747: API Keys for external REST access
import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { AppError } from '../lib/AppError.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import crypto from 'crypto'
import { z } from 'zod'

const router = Router()

// Apply authentication to all routes in this router
router.use(requireAuth)

// Generate secure random API key
function generateApiKey(): string {
  return `sp_${crypto.randomBytes(32).toString('hex')}`
}

// Hash API key for storage
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

// Validation schemas
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.string().optional().default('read'),
  expiresInDays: z.number().optional(),
})

// POST /api/api-keys - Create a new API key
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id

  const validation = createApiKeySchema.safeParse(req.body)
  if (!validation.success) {
    throw AppError.fromZodError(validation.error, 'Invalid request')
  }

  const { name, scopes, expiresInDays } = validation.data

  // Generate the key
  const apiKey = generateApiKey()
  const keyHash = hashApiKey(apiKey)
  const keyPrefix = apiKey.substring(0, 11) // "sp_" + first 8 chars

  // Calculate expiry if specified
  let expiresAt: Date | null = null
  if (expiresInDays && expiresInDays > 0) {
    expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)
  }

  // Create the API key record
  const apiKeyRecord = await prisma.apiKey.create({
    data: {
      userId,
      name,
      keyHash,
      keyPrefix,
      scopes,
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
  })

  // Return the key (only shown once!)
  res.status(201).json({
    apiKey: {
      ...apiKeyRecord,
      key: apiKey, // Only returned on creation
    },
    message: 'API key created. Save this key securely - it cannot be retrieved again.',
  })
}))

// GET /api/api-keys - List user's API keys
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id

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
  })

  res.json({ apiKeys })
}))

// DELETE /api/api-keys/:keyId - Revoke an API key
router.delete('/:keyId', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id

  const { keyId } = req.params

  // Verify ownership
  const apiKey = await prisma.apiKey.findFirst({
    where: { id: keyId, userId },
  })

  if (!apiKey) {
    throw AppError.notFound('API key')
  }

  // Soft delete by deactivating
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { isActive: false },
  })

  res.json({ message: 'API key revoked successfully' })
}))

// Middleware to authenticate API key requests
export async function authenticateApiKey(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined

  // Check for API key in header
  const apiKey = apiKeyHeader || (authHeader?.startsWith('ApiKey ') ? authHeader.substring(7) : null)

  if (!apiKey) {
    return next() // Let other auth middleware handle it
  }

  try {
    const keyHash = hashApiKey(apiKey)

    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
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
    })

    if (!apiKeyRecord) {
      return next(AppError.unauthorized('Invalid or expired API key'))
    }

    // Update last used timestamp (non-blocking)
    prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {/* non-critical */})

    // Set user on request
    req.user = apiKeyRecord.user as Express.Request['user']
    req.apiKey = {
      id: apiKeyRecord.id,
      scopes: apiKeyRecord.scopes.split(','),
    }

    next()
  } catch (error) {
    next(AppError.internal('Authentication failed'))
  }
}

// Middleware to check API key scopes
export function requireScope(scope: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const apiKey = req.apiKey

    // If not API key auth, allow (JWT auth handles its own permissions)
    if (!apiKey) {
      return next()
    }

    if (apiKey.scopes.includes('admin') || apiKey.scopes.includes(scope)) {
      return next()
    }

    next(AppError.forbidden(`Insufficient scope. Required: ${scope}`))
  }
}

export default router
