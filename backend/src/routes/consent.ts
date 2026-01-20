// Feature #776: Privacy Consent Tracking
import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const router = Router()
const prisma = new PrismaClient()

// Consent types supported
const CONSENT_TYPES = [
  'terms_of_service',
  'privacy_policy',
  'marketing',
  'analytics',
  'data_processing',
  'cookie_policy',
] as const

// Current versions of consent documents
const CONSENT_VERSIONS = {
  terms_of_service: '1.0',
  privacy_policy: '1.0',
  marketing: '1.0',
  analytics: '1.0',
  data_processing: '1.0',
  cookie_policy: '1.0',
}

// Validation schemas
const recordConsentSchema = z.object({
  consentType: z.enum(CONSENT_TYPES),
  granted: z.boolean(),
  version: z.string().optional(),
})

const bulkConsentSchema = z.object({
  consents: z.array(z.object({
    consentType: z.enum(CONSENT_TYPES),
    granted: z.boolean(),
  })),
})

// GET /api/consent - Get user's current consent status
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get most recent consent record for each type
    const consents: Record<string, {
      granted: boolean
      version: string
      grantedAt: string | null
    }> = {}

    for (const consentType of CONSENT_TYPES) {
      const latest = await prisma.consentRecord.findFirst({
        where: { userId, consentType },
        orderBy: { createdAt: 'desc' },
      })

      consents[consentType] = {
        granted: latest?.granted ?? false,
        version: latest?.version ?? CONSENT_VERSIONS[consentType],
        grantedAt: latest?.granted ? latest.createdAt.toISOString() : null,
      }
    }

    res.json({
      consents,
      currentVersions: CONSENT_VERSIONS,
    })
  } catch (error) {
    console.error('Error getting consent status:', error)
    res.status(500).json({ error: 'Failed to get consent status' })
  }
})

// POST /api/consent - Record a consent decision
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const validation = recordConsentSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.issues })
    }

    const { consentType, granted, version } = validation.data
    const consentVersion = version || CONSENT_VERSIONS[consentType]

    // Create consent record
    const consentRecord = await prisma.consentRecord.create({
      data: {
        userId,
        consentType,
        version: consentVersion,
        granted,
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      },
    })

    res.status(201).json({
      consentRecord: {
        id: consentRecord.id,
        consentType: consentRecord.consentType,
        granted: consentRecord.granted,
        version: consentRecord.version,
        recordedAt: consentRecord.createdAt.toISOString(),
      },
      message: granted ? 'Consent granted' : 'Consent withdrawn',
    })
  } catch (error) {
    console.error('Error recording consent:', error)
    res.status(500).json({ error: 'Failed to record consent' })
  }
})

// POST /api/consent/bulk - Record multiple consent decisions at once
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const validation = bulkConsentSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.issues })
    }

    const { consents } = validation.data
    const ipAddress = req.ip || req.connection?.remoteAddress || null
    const userAgent = req.headers['user-agent'] || null

    // Create all consent records
    const createdRecords = await Promise.all(
      consents.map(consent =>
        prisma.consentRecord.create({
          data: {
            userId,
            consentType: consent.consentType,
            version: CONSENT_VERSIONS[consent.consentType],
            granted: consent.granted,
            ipAddress,
            userAgent,
          },
        })
      )
    )

    res.status(201).json({
      consentRecords: createdRecords.map(record => ({
        id: record.id,
        consentType: record.consentType,
        granted: record.granted,
        version: record.version,
        recordedAt: record.createdAt.toISOString(),
      })),
      message: `${createdRecords.length} consent records created`,
    })
  } catch (error) {
    console.error('Error recording bulk consent:', error)
    res.status(500).json({ error: 'Failed to record consents' })
  }
})

// GET /api/consent/history - Get user's consent history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { consentType } = req.query

    const where: any = { userId }
    if (consentType && CONSENT_TYPES.includes(consentType as any)) {
      where.consentType = consentType
    }

    const history = await prisma.consentRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    res.json({
      history: history.map(record => ({
        id: record.id,
        consentType: record.consentType,
        granted: record.granted,
        version: record.version,
        recordedAt: record.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Error getting consent history:', error)
    res.status(500).json({ error: 'Failed to get consent history' })
  }
})

// POST /api/consent/withdraw-all - Withdraw all consents (for data deletion requests)
router.post('/withdraw-all', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || null
    const userAgent = req.headers['user-agent'] || null

    // Create withdrawal records for all consent types
    const withdrawals = await Promise.all(
      CONSENT_TYPES.map(consentType =>
        prisma.consentRecord.create({
          data: {
            userId,
            consentType,
            version: CONSENT_VERSIONS[consentType],
            granted: false,
            ipAddress,
            userAgent,
          },
        })
      )
    )

    res.json({
      message: 'All consents withdrawn',
      withdrawnCount: withdrawals.length,
      withdrawnAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error withdrawing all consents:', error)
    res.status(500).json({ error: 'Failed to withdraw consents' })
  }
})

// GET /api/consent/types - Get available consent types and their descriptions
router.get('/types', async (_req: Request, res: Response) => {
  res.json({
    consentTypes: CONSENT_TYPES.map(type => ({
      type,
      version: CONSENT_VERSIONS[type],
      description: getConsentDescription(type),
    })),
  })
})

function getConsentDescription(consentType: string): string {
  const descriptions: Record<string, string> = {
    terms_of_service: 'Agreement to the Terms of Service',
    privacy_policy: 'Acknowledgment of the Privacy Policy',
    marketing: 'Consent to receive marketing communications',
    analytics: 'Consent to analytics and usage tracking',
    data_processing: 'Consent to process personal data',
    cookie_policy: 'Consent to use cookies',
  }
  return descriptions[consentType] || 'Consent required'
}

export { router as consentRouter }
