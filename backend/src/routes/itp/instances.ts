// ITP instance creation, listing, assignment to lots
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import type { TemplateSnapshot, ChecklistItem } from './helpers/witnessPoints.js';
import type { AuthUser } from '../../lib/auth.js';
import {
  ITP_MANAGE_ROLES,
  isItpSubcontractorUser,
  requireItpLotAccess,
  requireItpProjectRole,
} from './helpers/access.js';
import { requireSubcontractorPortalModuleAccess } from '../../lib/projectAccess.js';

// Type for ITP completion with attachments
interface CompletionWithAttachments {
  checklistItemId: string;
  status: string;
  verificationStatus?: string | null;
  attachments?: Array<{
    id: string;
    documentId: string;
    document?: {
      id: string;
      filename: string;
      fileUrl: string;
      caption?: string | null;
    };
  }>;
}

// Extended checklist item with frontend-friendly properties
interface TransformedChecklistItem extends Omit<ChecklistItem, 'sequenceNumber'> {
  category: string;
  isHoldPoint: boolean;
  order: number;
  sequenceNumber?: number;
}

// Type for transformed template data
interface TransformedTemplateData extends Omit<TemplateSnapshot, 'checklistItems'> {
  checklistItems: TransformedChecklistItem[];
}

// POST /instances - Create ITP instance (assign to lot)
const createInstanceSchema = z.object({
  lotId: z.string().uuid(),
  templateId: z.string().uuid(),
});

const ITP_INSTANCE_ROUTE_PARAM_MAX_LENGTH = 128;

export const instancesRouter = Router();

function parseInstanceRouteParam(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a single value`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest(`${field} is required`);
  }

  if (normalized.length > ITP_INSTANCE_ROUTE_PARAM_MAX_LENGTH) {
    throw AppError.badRequest(`${field} is too long`);
  }

  return normalized;
}

function parseOptionalBooleanQuery(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} query parameter must be a single value`);
  }

  const normalized = value.trim();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw AppError.badRequest(`${field} must be true or false`);
}

// Assign ITP template to lot (create ITP instance)
instancesRouter.post(
  '/instances',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const parseResult = createInstanceSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(
        parseResult.error.errors[0]?.message || 'lotId and templateId are required',
      );
    }
    const { lotId, templateId } = parseResult.data;

    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      select: { id: true, projectId: true, status: true },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    if (lot.status === 'conformed' || lot.status === 'claimed') {
      throw AppError.badRequest(`Cannot assign an ITP to a ${lot.status} lot`);
    }

    await requireItpProjectRole(
      user,
      lot.projectId,
      ITP_MANAGE_ROLES,
      'ITP template assignment access required',
    );

    // Check if lot already has an ITP instance
    const existingInstance = await prisma.iTPInstance.findUnique({
      where: { lotId },
    });

    if (existingInstance) {
      throw AppError.badRequest('Lot already has an ITP assigned');
    }

    // Get the template with checklist items
    const template = await prisma.iTPTemplate.findUnique({
      where: { id: templateId },
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' },
        },
      },
    });

    if (!template) {
      throw AppError.notFound('Template');
    }

    if (!template.isActive) {
      throw AppError.badRequest('ITP template is archived and cannot be assigned');
    }

    if (template.projectId && template.projectId !== lot.projectId) {
      throw AppError.badRequest('ITP template is not available for this lot project');
    }

    // Create a snapshot of the template at assignment time
    const templateSnapshot = {
      id: template.id,
      name: template.name,
      description: template.description,
      activityType: template.activityType,
      checklistItems: template.checklistItems.map((item) => ({
        id: item.id,
        description: item.description,
        sequenceNumber: item.sequenceNumber,
        pointType: item.pointType,
        responsibleParty: item.responsibleParty,
        evidenceRequired: item.evidenceRequired,
        acceptanceCriteria: item.acceptanceCriteria,
        testType: item.testType,
      })),
    };

    // Create instance and link the lot atomically.
    const instance = await prisma.$transaction(async (tx) => {
      const createdInstance = await tx.iTPInstance.create({
        data: {
          lotId,
          templateId,
          templateSnapshot: JSON.stringify(templateSnapshot),
        },
        include: {
          template: {
            include: {
              checklistItems: {
                orderBy: { sequenceNumber: 'asc' },
              },
            },
          },
          completions: true,
        },
      });

      await tx.lot.update({
        where: { id: lotId },
        data: { itpTemplateId: templateId },
      });

      return createdInstance;
    });

    // Transform to frontend-friendly format
    const transformedInstance = {
      ...instance,
      template: {
        ...instance.template,
        checklistItems: instance.template.checklistItems.map((item) => ({
          id: item.id,
          description: item.description,
          category: item.responsibleParty || 'general',
          responsibleParty: item.responsibleParty || 'contractor',
          isHoldPoint: item.pointType === 'hold_point',
          pointType: item.pointType || 'standard',
          evidenceRequired: item.evidenceRequired || 'none',
          order: item.sequenceNumber,
          acceptanceCriteria: item.acceptanceCriteria,
        })),
      },
    };

    res.status(201).json({ instance: transformedInstance });
  }),
);

// Feature #271: Get ITP instance for a lot with subcontractor filtering
// Subcontractors only see items where responsibleParty = 'subcontractor'
instancesRouter.get(
  '/instances/lot/:lotId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const subcontractorView =
      parseOptionalBooleanQuery(req.query.subcontractorView, 'subcontractorView') ?? false;

    const lotId = parseInstanceRouteParam(req.params.lotId, 'lotId');

    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      select: { projectId: true },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireItpLotAccess(user, lot.projectId, lotId);
    await requireSubcontractorPortalModuleAccess({
      userId: user.userId,
      role: user.role,
      projectId: lot.projectId,
      module: 'itps',
    });

    const instance = await prisma.iTPInstance.findUnique({
      where: { lotId },
      include: {
        template: {
          include: {
            checklistItems: {
              orderBy: { sequenceNumber: 'asc' },
            },
          },
        },
        completions: {
          include: {
            completedBy: {
              select: { id: true, fullName: true, email: true },
            },
            verifiedBy: {
              select: { id: true, fullName: true, email: true },
            },
            attachments: {
              include: {
                document: {
                  include: {
                    uploadedBy: {
                      select: { id: true, fullName: true, email: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!instance) {
      throw AppError.notFound('No ITP assigned to this lot');
    }

    // Use snapshot if available, otherwise fall back to live template
    let templateData: TransformedTemplateData;
    if (instance.templateSnapshot) {
      // Parse the snapshot (template state at assignment time)
      const snapshot: TemplateSnapshot = JSON.parse(instance.templateSnapshot);
      templateData = {
        ...snapshot,
        checklistItems: snapshot.checklistItems.map((item) => ({
          id: item.id,
          description: item.description,
          category: item.responsibleParty || 'general',
          responsibleParty: item.responsibleParty || 'contractor',
          isHoldPoint: item.pointType === 'hold_point',
          pointType: item.pointType || 'standard',
          evidenceRequired: item.evidenceRequired || 'none',
          order: item.sequenceNumber,
          acceptanceCriteria: item.acceptanceCriteria,
          testType: item.testType || null,
        })),
      };
    } else {
      // Fall back to live template for backwards compatibility
      templateData = {
        ...instance.template,
        checklistItems: instance.template.checklistItems.map((item) => ({
          id: item.id,
          description: item.description,
          category: item.responsibleParty || 'general',
          responsibleParty: item.responsibleParty || 'contractor',
          isHoldPoint: item.pointType === 'hold_point',
          pointType: item.pointType || 'standard',
          evidenceRequired: item.evidenceRequired || 'none',
          order: item.sequenceNumber,
          acceptanceCriteria: item.acceptanceCriteria,
          testType: item.testType || null,
        })),
      };
    }

    // Feature #271: Filter to subcontractor-assigned items only if subcontractorView is true
    const useSubcontractorView = subcontractorView || isItpSubcontractorUser(user);

    if (useSubcontractorView) {
      templateData.checklistItems = templateData.checklistItems.filter(
        (item) => item.responsibleParty === 'subcontractor',
      );
    }

    // Get item IDs for filtered items (used to filter completions)
    const filteredItemIds = new Set(templateData.checklistItems.map((item) => item.id));

    // Transform to frontend-friendly format
    const transformedInstance = {
      ...instance,
      template: templateData,
      completions: instance.completions
        .filter((c) => !useSubcontractorView || filteredItemIds.has(c.checklistItemId))
        .map((c) => ({
          ...c,
          isCompleted: c.status === 'completed' || c.status === 'not_applicable',
          isNotApplicable: c.status === 'not_applicable',
          isFailed: c.status === 'failed',
          isVerified: c.verificationStatus === 'verified',
          isPendingVerification: c.verificationStatus === 'pending_verification',
          attachments:
            (c as unknown as CompletionWithAttachments).attachments?.map((a) => ({
              id: a.id,
              documentId: a.documentId,
              document: a.document,
            })) || [],
        })),
    };

    res.json({ instance: transformedInstance });
  }),
);
