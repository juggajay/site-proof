// Feature #776: Privacy Consent Tracking
import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/authMiddleware.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { z } from 'zod';

const router = Router();

// All consent routes require authentication
router.use(requireAuth);

// Consent types supported
const CONSENT_TYPES = [
  'terms_of_service',
  'privacy_policy',
  'marketing',
  'analytics',
  'data_processing',
  'cookie_policy',
] as const;

// Current versions of consent documents
const CONSENT_VERSIONS = {
  terms_of_service: '1.0',
  privacy_policy: '1.0',
  marketing: '1.0',
  analytics: '1.0',
  data_processing: '1.0',
  cookie_policy: '1.0',
};
const MAX_CONSENT_VERSION_LENGTH = 32;
const MAX_BULK_CONSENTS = CONSENT_TYPES.length;
const MAX_USER_AGENT_LENGTH = 512;
const CONSENT_TYPE_SET = new Set<string>(CONSENT_TYPES);

// Validation schemas
const recordConsentSchema = z.object({
  consentType: z.enum(CONSENT_TYPES),
  granted: z.boolean(),
  version: z.string().trim().min(1).max(MAX_CONSENT_VERSION_LENGTH).optional(),
});

const bulkConsentSchema = z.object({
  consents: z
    .array(
      z.object({
        consentType: z.enum(CONSENT_TYPES),
        granted: z.boolean(),
      }),
    )
    .max(MAX_BULK_CONSENTS),
});

function getRequestUserAgent(req: Request): string | null {
  const userAgent = req.headers['user-agent'];
  if (typeof userAgent !== 'string') return null;
  return userAgent.slice(0, MAX_USER_AGENT_LENGTH);
}

function getConsentTypeValidationMessage(): string {
  return `consentType must be one of: ${CONSENT_TYPES.join(', ')}`;
}

function parseConsentTypeFilter(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value) || typeof value !== 'string' || !CONSENT_TYPE_SET.has(value)) {
    throw AppError.badRequest(getConsentTypeValidationMessage());
  }

  return value;
}

type CurrentConsentRecord = {
  id: string;
  consentType: string;
  version: string;
  granted: boolean;
  createdAt: Date;
};

// GET /api/consent - Get user's current consent status
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const latestRecords = await prisma.$queryRaw<CurrentConsentRecord[]>(Prisma.sql`
    SELECT DISTINCT ON (consent_type)
      id,
      consent_type AS "consentType",
      version,
      granted,
      created_at AS "createdAt"
    FROM consent_records
    WHERE user_id = ${userId}
      AND consent_type IN (${Prisma.join([...CONSENT_TYPES])})
    ORDER BY consent_type, created_at DESC, id DESC
  `);
    const latestByType = new Map(latestRecords.map((record) => [record.consentType, record]));

    const consents: Record<
      string,
      {
        granted: boolean;
        version: string;
        grantedAt: string | null;
      }
    > = {};

    for (const consentType of CONSENT_TYPES) {
      const latest = latestByType.get(consentType);

      consents[consentType] = {
        granted: latest?.granted ?? false,
        version: latest?.version ?? CONSENT_VERSIONS[consentType],
        grantedAt: latest?.granted ? latest.createdAt.toISOString() : null,
      };
    }

    res.json({
      consents,
      currentVersions: CONSENT_VERSIONS,
    });
  }),
);

// POST /api/consent - Record a consent decision
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const validation = recordConsentSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error, 'Invalid request');
    }

    const { consentType, granted, version } = validation.data;
    const consentVersion = version || CONSENT_VERSIONS[consentType];

    // Create consent record
    const consentRecord = await prisma.consentRecord.create({
      data: {
        userId,
        consentType,
        version: consentVersion,
        granted,
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        userAgent: getRequestUserAgent(req),
      },
    });

    res.status(201).json({
      consentRecord: {
        id: consentRecord.id,
        consentType: consentRecord.consentType,
        granted: consentRecord.granted,
        version: consentRecord.version,
        recordedAt: consentRecord.createdAt.toISOString(),
      },
      message: granted ? 'Consent granted' : 'Consent withdrawn',
    });
  }),
);

// POST /api/consent/bulk - Record multiple consent decisions at once
router.post(
  '/bulk',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const validation = bulkConsentSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error, 'Invalid request');
    }

    const { consents } = validation.data;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = getRequestUserAgent(req);

    const createConsentOperations = consents.map((consent) =>
      prisma.consentRecord.create({
        data: {
          userId,
          consentType: consent.consentType,
          version: CONSENT_VERSIONS[consent.consentType],
          granted: consent.granted,
          ipAddress,
          userAgent,
        },
      }),
    );
    const createdRecords =
      createConsentOperations.length > 0 ? await prisma.$transaction(createConsentOperations) : [];

    res.status(201).json({
      consentRecords: createdRecords.map((record) => ({
        id: record.id,
        consentType: record.consentType,
        granted: record.granted,
        version: record.version,
        recordedAt: record.createdAt.toISOString(),
      })),
      message: `${createdRecords.length} consent records created`,
    });
  }),
);

// GET /api/consent/history - Get user's consent history
router.get(
  '/history',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const { consentType } = req.query;
    const consentTypeFilter = parseConsentTypeFilter(consentType);

    const where: { userId: string; consentType?: string } = { userId };
    if (consentTypeFilter) {
      where.consentType = consentTypeFilter;
    }

    const history = await prisma.consentRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({
      history: history.map((record) => ({
        id: record.id,
        consentType: record.consentType,
        granted: record.granted,
        version: record.version,
        recordedAt: record.createdAt.toISOString(),
      })),
    });
  }),
);

// POST /api/consent/withdraw-all - Withdraw all consents (for data deletion requests)
router.post(
  '/withdraw-all',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = getRequestUserAgent(req);

    const withdrawals = await prisma.$transaction(
      CONSENT_TYPES.map((consentType) =>
        prisma.consentRecord.create({
          data: {
            userId,
            consentType,
            version: CONSENT_VERSIONS[consentType],
            granted: false,
            ipAddress,
            userAgent,
          },
        }),
      ),
    );

    res.json({
      message: 'All consents withdrawn',
      withdrawnCount: withdrawals.length,
      withdrawnAt: new Date().toISOString(),
    });
  }),
);

// GET /api/consent/types - Get available consent types and their descriptions
router.get('/types', async (_req: Request, res: Response) => {
  res.json({
    consentTypes: CONSENT_TYPES.map((type) => ({
      type,
      version: CONSENT_VERSIONS[type],
      description: getConsentDescription(type),
    })),
  });
});

function getConsentDescription(consentType: string): string {
  const descriptions: Record<string, string> = {
    terms_of_service: 'Agreement to the Terms of Service',
    privacy_policy: 'Acknowledgment of the Privacy Policy',
    marketing: 'Consent to receive marketing communications',
    analytics: 'Consent to analytics and usage tracking',
    data_processing: 'Consent to process personal data',
    cookie_policy: 'Consent to use cookies',
  };
  return descriptions[consentType] || 'Consent required';
}

export { router as consentRouter };
