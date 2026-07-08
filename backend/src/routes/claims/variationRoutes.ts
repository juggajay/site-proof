import { Router } from 'express';
import { Prisma } from '@prisma/client';
import type { z } from 'zod';

import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import {
  createVariationWithAllocatedNumber,
  isUniqueConstraintOn,
} from './variationNumberAllocation.js';
import {
  assertVariationStatusTransition,
  attachVariationEvidenceSchema,
  createVariationSchema,
  updateVariationSchema,
} from './variationValidation.js';

type AuthUser = NonNullable<Express.Request['user']>;

interface VariationRouterDependencies {
  parseClaimRouteParam: (value: unknown, field: string) => string;
  requireCommercialProjectAccess: (
    user: AuthUser,
    projectId: string,
    options?: { requireWritable?: boolean },
  ) => Promise<void>;
}

const variationEvidenceDocumentSelect = {
  id: true,
  filename: true,
  fileUrl: true,
} as const;

const variationInclude = {
  evidence: {
    include: {
      document: {
        select: variationEvidenceDocumentSelect,
      },
    },
    orderBy: { uploadedAt: 'desc' },
  },
} as const;

type VariationWithEvidence = Prisma.VariationGetPayload<{ include: typeof variationInclude }>;
type VariationEvidenceWithDocument = Prisma.VariationEvidenceGetPayload<{
  include: { document: { select: typeof variationEvidenceDocumentSelect } };
}>;
type UpdateVariationInput = z.infer<typeof updateVariationSchema>;

function mapVariationEvidence(evidence: VariationEvidenceWithDocument) {
  return {
    id: evidence.id,
    evidenceType: evidence.evidenceType,
    uploadedAt: evidence.uploadedAt.toISOString(),
    document: evidence.document,
  };
}

function mapVariation(variation: VariationWithEvidence) {
  return {
    id: variation.id,
    projectId: variation.projectId,
    variationNumber: variation.variationNumber,
    title: variation.title,
    description: variation.description,
    status: variation.status,
    approvedAmount: variation.approvedAmount == null ? null : Number(variation.approvedAmount),
    clientReference: variation.clientReference,
    lotId: variation.lotId,
    claimedInId: variation.claimedInId,
    submittedAt: variation.submittedAt?.toISOString() ?? null,
    approvedAt: variation.approvedAt?.toISOString() ?? null,
    rejectedAt: variation.rejectedAt?.toISOString() ?? null,
    rejectionReason: variation.rejectionReason,
    createdById: variation.createdById,
    createdAt: variation.createdAt.toISOString(),
    updatedAt: variation.updatedAt.toISOString(),
    evidence: variation.evidence.map(mapVariationEvidence),
  };
}

function supplied<T extends object>(data: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function hasFieldEdits(data: UpdateVariationInput): boolean {
  return (
    supplied(data, 'title') ||
    supplied(data, 'description') ||
    supplied(data, 'clientReference') ||
    supplied(data, 'lotId') ||
    supplied(data, 'approvedAmount')
  );
}

async function requireLotInProject(
  client: Pick<typeof prisma, 'lot'>,
  projectId: string,
  lotId: string,
): Promise<void> {
  const lot = await client.lot.findFirst({
    where: { id: lotId, projectId },
    select: { id: true },
  });

  if (!lot) {
    throw AppError.notFound('Lot');
  }
}

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value?.trim() ? value : null;
}

export function createVariationRouter({
  parseClaimRouteParam,
  requireCommercialProjectAccess,
}: VariationRouterDependencies) {
  const variationRouter = Router();

  variationRouter.get(
    '/:projectId/variations',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      await requireCommercialProjectAccess(req.user!, projectId);

      const variations = await prisma.variation.findMany({
        where: { projectId },
        include: variationInclude,
        orderBy: { variationNumber: 'desc' },
      });

      res.json({ variations: variations.map(mapVariation) });
    }),
  );

  variationRouter.post(
    '/:projectId/variations',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      const userId = req.user!.userId;
      await requireCommercialProjectAccess(req.user!, projectId, { requireWritable: true });

      const validation = createVariationSchema.safeParse(req.body);
      if (!validation.success) {
        throw AppError.fromZodError(validation.error);
      }

      const variation = await createVariationWithAllocatedNumber(
        projectId,
        async (tx, variationNumber) => {
          if (validation.data.lotId) {
            await requireLotInProject(tx, projectId, validation.data.lotId);
          }

          return tx.variation.create({
            data: {
              projectId,
              variationNumber,
              title: validation.data.title,
              description: validation.data.description || null,
              clientReference: validation.data.clientReference || null,
              lotId: validation.data.lotId || null,
              approvedAmount: validation.data.approvedAmount,
              createdById: userId,
            },
            include: variationInclude,
          });
        },
      );

      await createAuditLog({
        projectId,
        userId,
        entityType: 'variation',
        entityId: variation.id,
        action: AuditAction.VARIATION_CREATED,
        changes: {
          variationNumber: variation.variationNumber,
          title: variation.title,
          approvedAmount:
            variation.approvedAmount == null ? null : Number(variation.approvedAmount),
        },
        req,
      });

      res.status(201).json({ variation: mapVariation(variation) });
    }),
  );

  variationRouter.put(
    '/:projectId/variations/:id',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      const id = parseClaimRouteParam(req.params.id, 'id');
      const userId = req.user!.userId;
      await requireCommercialProjectAccess(req.user!, projectId, { requireWritable: true });

      const validation = updateVariationSchema.safeParse(req.body);
      if (!validation.success) {
        throw AppError.fromZodError(validation.error);
      }

      const updateResult = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM variations
          WHERE id = ${id} AND project_id = ${projectId}
          FOR UPDATE
        `;

        const variation = await tx.variation.findFirst({
          where: { id, projectId },
          include: variationInclude,
        });

        if (!variation) {
          throw AppError.notFound('Variation');
        }

        const data = validation.data;
        const fieldEdits = hasFieldEdits(data);
        const approvedAmountForTransition = supplied(data, 'approvedAmount')
          ? data.approvedAmount
          : variation.approvedAmount;
        assertVariationStatusTransition(variation.status, data.status, {
          isClaimed: variation.claimedInId !== null,
          approvedAmount: approvedAmountForTransition,
        });

        if (fieldEdits && !['proposed', 'submitted', 'rejected'].includes(variation.status)) {
          throw AppError.badRequest(
            'Only proposed, submitted, or rejected variations can be edited',
          );
        }

        if (data.lotId) {
          await requireLotInProject(tx, projectId, data.lotId);
        }

        const updateData: Prisma.VariationUpdateInput = {};

        if (data.title !== undefined) {
          updateData.title = data.title;
        }
        if (supplied(data, 'description')) {
          updateData.description = normalizeNullableText(data.description);
        }
        if (supplied(data, 'clientReference')) {
          updateData.clientReference = normalizeNullableText(data.clientReference);
        }
        if (supplied(data, 'lotId')) {
          updateData.lot = data.lotId ? { connect: { id: data.lotId } } : { disconnect: true };
        }
        if (supplied(data, 'approvedAmount')) {
          updateData.approvedAmount = data.approvedAmount;
        }

        if (data.status && data.status !== variation.status) {
          updateData.status = data.status;
          if (data.status === 'submitted') {
            updateData.submittedAt = new Date();
            updateData.rejectedAt = null;
            updateData.rejectionReason = null;
          }
          if (data.status === 'approved') {
            updateData.approvedAt = new Date();
            updateData.rejectedAt = null;
            updateData.rejectionReason = null;
          }
          if (data.status === 'rejected') {
            updateData.rejectedAt = new Date();
            updateData.rejectionReason = normalizeNullableText(data.rejectionReason) ?? null;
          }
        } else if (supplied(data, 'rejectionReason')) {
          updateData.rejectionReason = normalizeNullableText(data.rejectionReason);
        }

        if (Object.keys(updateData).length === 0) {
          throw AppError.badRequest('No fields to update');
        }

        const updatedVariation = await tx.variation.update({
          where: { id },
          data: updateData,
          include: variationInclude,
        });

        return { previous: variation, updated: updatedVariation };
      });

      await createAuditLog({
        projectId,
        userId,
        entityType: 'variation',
        entityId: id,
        action: AuditAction.VARIATION_UPDATED,
        changes: {
          variationNumber: updateResult.previous.variationNumber,
          previousStatus: updateResult.previous.status,
          status: updateResult.updated.status,
        },
        req,
      });

      res.json({ variation: mapVariation(updateResult.updated) });
    }),
  );

  variationRouter.delete(
    '/:projectId/variations/:id',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      const id = parseClaimRouteParam(req.params.id, 'id');
      const userId = req.user!.userId;
      await requireCommercialProjectAccess(req.user!, projectId, { requireWritable: true });

      const variation = await prisma.variation.findFirst({
        where: { id, projectId },
        select: {
          id: true,
          variationNumber: true,
          status: true,
          claimedInId: true,
        },
      });

      if (!variation) {
        throw AppError.notFound('Variation');
      }

      if (variation.claimedInId || variation.status === 'claimed') {
        throw AppError.conflict('Cannot delete a claimed variation', {
          code: 'VARIATION_CLAIMED',
        });
      }

      if (!['proposed', 'rejected'].includes(variation.status)) {
        throw AppError.conflict('Only proposed or rejected variations can be deleted', {
          code: 'VARIATION_DELETE_STATUS',
          status: variation.status,
        });
      }

      await prisma.variation.delete({ where: { id } });

      await createAuditLog({
        projectId,
        userId,
        entityType: 'variation',
        entityId: id,
        action: AuditAction.VARIATION_DELETED,
        changes: {
          variationNumber: variation.variationNumber,
          previousStatus: variation.status,
        },
        req,
      });

      res.json({ success: true });
    }),
  );

  variationRouter.post(
    '/:projectId/variations/:id/evidence',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      const id = parseClaimRouteParam(req.params.id, 'id');
      const userId = req.user!.userId;
      await requireCommercialProjectAccess(req.user!, projectId, { requireWritable: true });

      const validation = attachVariationEvidenceSchema.safeParse(req.body);
      if (!validation.success) {
        throw AppError.fromZodError(validation.error);
      }

      const variation = await prisma.variation.findFirst({
        where: { id, projectId },
        select: { id: true, variationNumber: true, status: true, claimedInId: true },
      });
      if (!variation) {
        throw AppError.notFound('Variation');
      }
      if (variation.claimedInId || variation.status === 'claimed') {
        throw AppError.conflict('Cannot add evidence to a claimed variation', {
          code: 'VARIATION_CLAIMED',
        });
      }

      const document = await prisma.document.findFirst({
        where: { id: validation.data.documentId, projectId },
        select: { id: true },
      });
      if (!document) {
        throw AppError.notFound('Document');
      }

      try {
        const evidence = await prisma.variationEvidence.create({
          data: {
            variationId: id,
            documentId: validation.data.documentId,
            evidenceType: validation.data.evidenceType,
          },
          include: {
            document: { select: variationEvidenceDocumentSelect },
          },
        });

        await createAuditLog({
          projectId,
          userId,
          entityType: 'variation_evidence',
          entityId: evidence.id,
          action: AuditAction.VARIATION_EVIDENCE_ADDED,
          changes: {
            variationId: id,
            variationNumber: variation.variationNumber,
            documentId: validation.data.documentId,
            evidenceType: evidence.evidenceType,
          },
          req,
        });

        res.status(201).json({ evidence: mapVariationEvidence(evidence) });
      } catch (error) {
        if (isUniqueConstraintOn(error, ['variationId', 'documentId'])) {
          throw AppError.conflict('Document is already linked to this variation', {
            code: 'VARIATION_EVIDENCE_ALREADY_LINKED',
          });
        }
        throw error;
      }
    }),
  );

  variationRouter.delete(
    '/:projectId/variations/:id/evidence/:evidenceId',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      const id = parseClaimRouteParam(req.params.id, 'id');
      const evidenceId = parseClaimRouteParam(req.params.evidenceId, 'evidenceId');
      const userId = req.user!.userId;
      await requireCommercialProjectAccess(req.user!, projectId, { requireWritable: true });

      const variation = await prisma.variation.findFirst({
        where: { id, projectId },
        select: { id: true, variationNumber: true, status: true, claimedInId: true },
      });
      if (!variation) {
        throw AppError.notFound('Variation');
      }
      if (variation.claimedInId || variation.status === 'claimed') {
        throw AppError.conflict('Cannot remove evidence from a claimed variation', {
          code: 'VARIATION_CLAIMED',
        });
      }

      const evidence = await prisma.variationEvidence.findFirst({
        where: { id: evidenceId, variationId: id },
        select: { id: true, documentId: true, evidenceType: true },
      });
      if (!evidence) {
        throw AppError.notFound('Evidence');
      }

      await prisma.variationEvidence.delete({ where: { id: evidenceId } });

      await createAuditLog({
        projectId,
        userId,
        entityType: 'variation_evidence',
        entityId: evidenceId,
        action: AuditAction.VARIATION_EVIDENCE_REMOVED,
        changes: {
          variationId: id,
          variationNumber: variation.variationNumber,
          documentId: evidence.documentId,
          evidenceType: evidence.evidenceType,
        },
        req,
      });

      res.json({ success: true });
    }),
  );

  return variationRouter;
}
