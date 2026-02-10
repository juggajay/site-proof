// Feature #747: API Keys for external REST access
import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id

    const validation = createApiKeySchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.issues })
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
  } catch (error) {
    console.error('Error creating API key:', error)
    res.status(500).json({ error: 'Failed to create API key' })
  }
})

// GET /api/api-keys - List user's API keys
router.get('/', async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    console.error('Error listing API keys:', error)
    res.status(500).json({ error: 'Failed to list API keys' })
  }
})

// DELETE /api/api-keys/:keyId - Revoke an API key
router.delete('/:keyId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id

    const { keyId } = req.params

    // Verify ownership
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    })

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' })
    }

    // Soft delete by deactivating
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    })

    res.json({ message: 'API key revoked successfully' })
  } catch (error) {
    console.error('Error revoking API key:', error)
    res.status(500).json({ error: 'Failed to revoke API key' })
  }
})

// Middleware to authenticate API key requests
export async function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
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
      return res.status(401).json({ error: 'Invalid or expired API key' })
    }

    // Update last used timestamp (non-blocking)
    prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    }).catch(err => console.error('Failed to update API key last used:', err))

    // Set user on request
    req.user = apiKeyRecord.user as Express.Request['user']
    ;(req as any).apiKey = {
      id: apiKeyRecord.id,
      scopes: apiKeyRecord.scopes.split(','),
    }

    next()
  } catch (error) {
    console.error('API key authentication error:', error)
    res.status(500).json({ error: 'Authentication failed' })
  }
}

// Middleware to check API key scopes
export function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiKey = (req as any).apiKey

    // If not API key auth, allow (JWT auth handles its own permissions)
    if (!apiKey) {
      return next()
    }

    const scopes = apiKey.scopes as string[]
    if (scopes.includes('admin') || scopes.includes(scope)) {
      return next()
    }

    res.status(403).json({ error: `Insufficient scope. Required: ${scope}` })
  }
}

export default router
