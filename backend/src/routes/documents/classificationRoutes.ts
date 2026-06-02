import { Router, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError, ErrorCodes } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { fetchWithTimeout } from '../../lib/fetchWithTimeout.js';
import { logWarn } from '../../lib/serverLogger.js';
import {
  buildDocumentClassificationResponse,
  buildSavedDocumentClassificationResponse,
} from '../documentResponses.js';

type AuthUser = NonNullable<Express.Request['user']>;

type DocumentAccessRecord = {
  projectId: string;
  lotId: string | null;
  uploadedById: string | null;
  documentType?: string | null;
  category?: string | null;
};

type DocumentImageRecord = {
  fileUrl: string;
  projectId: string;
  documentType?: string | null;
};

type CreateDocumentClassificationRouterDependencies = {
  prisma: PrismaClient;
  parseDocumentRouteParam: (value: unknown, fieldName: string) => string;
  canReadDocument: (user: AuthUser, document: DocumentAccessRecord) => Promise<boolean>;
  requireDocumentMutationAccess: (
    user: AuthUser,
    document: DocumentAccessRecord,
    targetLotId?: string | null,
    targetCategory?: string | null,
  ) => Promise<void>;
  loadDocumentImageAsBase64: (document: DocumentImageRecord, mimeType: string) => Promise<string>;
};

const PHOTO_CLASSIFICATION_CATEGORIES = [
  'Survey',
  'Compaction',
  'Material Delivery',
  'Excavation',
  'Formwork',
  'Concrete Pour',
  'Pipe Laying',
  'General Progress',
  'Inspection',
  'Testing',
  'Safety',
  'Plant/Equipment',
] as const;

type PhotoClassificationCategory = (typeof PHOTO_CLASSIFICATION_CATEGORIES)[number];
type PhotoClassificationSuggestion = { label: PhotoClassificationCategory; confidence: number };

const MAX_DOCUMENT_ID_LENGTH = 120;
const MAX_CATEGORY_LENGTH = 160;
const MAX_CAPTION_LENGTH = 2000;
const MAX_TAGS_LENGTH = 2000;

const requiredFormStringSchema = (fieldName: string, maxLength = MAX_DOCUMENT_ID_LENGTH) =>
  z.string().trim().min(1, `${fieldName} is required`).max(maxLength, `${fieldName} is too long`);

const optionalFormStringSchema = (fieldName: string, maxLength: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z.string().max(maxLength, `${fieldName} is too long`).nullish(),
  );

const updateDocumentBodySchema = z.object({
  lotId: optionalFormStringSchema('lotId', MAX_DOCUMENT_ID_LENGTH),
  category: optionalFormStringSchema('category', MAX_CATEGORY_LENGTH),
  caption: optionalFormStringSchema('caption', MAX_CAPTION_LENGTH),
  tags: optionalFormStringSchema('tags', MAX_TAGS_LENGTH),
  isFavourite: z.boolean().optional(),
});

const saveClassificationBodySchema = z
  .object({
    classification: optionalFormStringSchema('classification', MAX_CATEGORY_LENGTH),
    classifications: z
      .array(
        z.object({
          label: requiredFormStringSchema('label', MAX_CATEGORY_LENGTH),
        }),
      )
      .max(3, 'classifications must contain at most 3 labels')
      .optional(),
  })
  .refine(
    (data) =>
      Boolean(data.classification || (data.classifications && data.classifications.length > 0)),
    { message: 'Classification is required' },
  );

function isAnthropicConfigured(): boolean {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return Boolean(
    apiKey &&
    apiKey !== 'sk-placeholder' &&
    !apiKey.toLowerCase().includes('placeholder') &&
    !apiKey.toLowerCase().includes('your-'),
  );
}

function photoClassificationUnavailable(
  message = 'AI photo classification is not configured',
): AppError {
  return new AppError(503, message, ErrorCodes.EXTERNAL_SERVICE_ERROR);
}

function normalizeClassificationConfidence(value: string | undefined): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(100, Math.max(0, parsed));
}

function parseClassificationResponse(text: string): PhotoClassificationSuggestion[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const suggestions: PhotoClassificationSuggestion[] = [];

  for (const line of lines) {
    const [category, confidenceStr] = line.split('|');
    const matchedCategory = PHOTO_CLASSIFICATION_CATEGORIES.find(
      (c) => c.toLowerCase() === category?.toLowerCase().trim(),
    );

    if (!matchedCategory) {
      continue;
    }

    const confidence = normalizeClassificationConfidence(confidenceStr);
    if (confidence <= 0) {
      continue;
    }

    suggestions.push({ label: matchedCategory, confidence });
  }

  return suggestions;
}

export function createDocumentClassificationRouter({
  prisma,
  parseDocumentRouteParam,
  canReadDocument,
  requireDocumentMutationAccess,
  loadDocumentImageAsBase64,
}: CreateDocumentClassificationRouterDependencies) {
  const classificationRoutes = Router();

  // Feature #247: AI Photo Classification
  // POST /api/documents/:documentId/classify - Classify a photo using AI
  classificationRoutes.post(
    '/:documentId/classify',
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = parseDocumentRouteParam(req.params.documentId, 'documentId');
      const userId = req.user!.id;

      if (!userId) {
        throw AppError.unauthorized();
      }

      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw AppError.notFound('Document');
      }

      const hasAccess = await canReadDocument(req.user!, document);
      if (!hasAccess) {
        throw AppError.forbidden('Access denied');
      }

      // Only classify images
      const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

      // Determine mimeType from document or extract from base64 data URL
      let mimeType = document.mimeType;
      if (!mimeType && document.fileUrl?.startsWith('data:')) {
        const dataUrlMatch = document.fileUrl.match(/^data:([^;]+);base64,/);
        if (dataUrlMatch) {
          mimeType = dataUrlMatch[1];
        }
      }

      if (!mimeType || !imageTypes.includes(mimeType)) {
        throw AppError.badRequest('Only image files can be classified');
      }

      // Feature #729: Multi-label classification support
      if (!isAnthropicConfigured()) {
        throw photoClassificationUnavailable();
      }

      const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      const base64Image = await loadDocumentImageAsBase64(document, mimeType);

      let suggestedClassifications: PhotoClassificationSuggestion[] = [];

      try {
        // Call Anthropic API for multi-label image classification
        const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model:
              process.env.ANTHROPIC_DOCUMENT_CLASS_MODEL ||
              process.env.ANTHROPIC_MODEL ||
              'claude-3-5-haiku-20241022',
            max_tokens: 200,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: mediaType,
                      data: base64Image,
                    },
                  },
                  {
                    type: 'text',
                    text: `Classify this civil construction photo. A photo may show multiple things happening.

Available categories: ${PHOTO_CLASSIFICATION_CATEGORIES.join(', ')}

List ALL applicable categories with confidence percentages (0-100), up to 3 categories.
Format each on a new line: CategoryName|Confidence

Example response for a photo showing excavation with safety equipment:
Excavation|90
Safety|75
Plant/Equipment|60

Respond with ONLY the category lines, nothing else.`,
                  },
                ],
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`Anthropic API request failed with status ${response.status}`);
        }

        const result = (await response.json()) as { content: { type: string; text: string }[] };
        const aiResponse = result.content[0]?.text?.trim() || '';
        suggestedClassifications = parseClassificationResponse(aiResponse);
      } catch (error) {
        logWarn('AI photo classification unavailable:', error);
        throw photoClassificationUnavailable('AI photo classification is temporarily unavailable');
      }

      if (suggestedClassifications.length === 0) {
        throw photoClassificationUnavailable(
          'AI photo classification did not return supported categories',
        );
      }

      // Sort by confidence and limit to top 3
      suggestedClassifications.sort((a, b) => b.confidence - a.confidence);
      suggestedClassifications = suggestedClassifications.slice(0, 3);

      res.json(
        buildDocumentClassificationResponse(
          documentId,
          suggestedClassifications,
          PHOTO_CLASSIFICATION_CATEGORIES,
        ),
      );
    }),
  );

  // POST /api/documents/:documentId/save-classification - Save the classification
  // Feature #729: Supports both single classification and multi-label classifications
  classificationRoutes.post(
    '/:documentId/save-classification',
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = parseDocumentRouteParam(req.params.documentId, 'documentId');
      const userId = req.user!.id;

      if (!userId) {
        throw AppError.unauthorized();
      }

      const bodyParse = saveClassificationBodySchema.safeParse(req.body);
      if (!bodyParse.success) {
        throw AppError.fromZodError(bodyParse.error);
      }
      const { classification, classifications } = bodyParse.data;

      // Support both single classification (backward compat) and multi-label
      const finalClassification =
        classification ||
        (classifications && classifications.length > 0
          ? classifications.map((c: { label: string }) => c.label).join(', ')
          : null);

      if (!finalClassification) {
        throw AppError.badRequest('Classification is required');
      }

      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw AppError.notFound('Document');
      }

      const hasAccess = await canReadDocument(req.user!, document);
      if (!hasAccess) {
        throw AppError.forbidden('Access denied');
      }
      await requireDocumentMutationAccess(req.user!, document);

      // Update the document with the classification
      // If multiple classifications provided, store as comma-separated for display
      const updatedDocument = await prisma.document.update({
        where: { id: documentId },
        data: {
          aiClassification: finalClassification,
        },
        include: {
          lot: { select: { id: true, lotNumber: true } },
          uploadedBy: { select: { id: true, fullName: true, email: true } },
        },
      });

      res.json(buildSavedDocumentClassificationResponse(updatedDocument, finalClassification));
    }),
  );

  // PATCH /api/documents/:documentId - Update document metadata
  classificationRoutes.patch(
    '/:documentId',
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = parseDocumentRouteParam(req.params.documentId, 'documentId');
      const userId = req.user!.id;

      if (!userId) {
        throw AppError.unauthorized();
      }

      const bodyParse = updateDocumentBodySchema.safeParse(req.body);
      if (!bodyParse.success) {
        throw AppError.fromZodError(bodyParse.error);
      }
      const { lotId, category, caption, tags, isFavourite } = bodyParse.data;

      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw AppError.notFound('Document');
      }

      const hasAccess = await canReadDocument(req.user!, document);
      if (!hasAccess) {
        throw AppError.forbidden('Access denied');
      }
      await requireDocumentMutationAccess(req.user!, document, lotId, category);

      const updatedDocument = await prisma.document.update({
        where: { id: documentId },
        data: {
          lotId: lotId !== undefined ? lotId || null : undefined,
          category: category !== undefined ? category : undefined,
          caption: caption !== undefined ? caption : undefined,
          tags: tags !== undefined ? tags : undefined,
          isFavourite: isFavourite !== undefined ? isFavourite : undefined,
        },
        include: {
          lot: { select: { id: true, lotNumber: true } },
          uploadedBy: { select: { id: true, fullName: true, email: true } },
        },
      });

      res.json(updatedDocument);
    }),
  );

  return classificationRoutes;
}
