import crypto from 'node:crypto';

import type { AiProposal, Prisma } from '@prisma/client';
import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';
import { computeAutoLinks } from '../../lib/models/lotLinking.js';
import { prisma } from '../../lib/prisma.js';
import {
  applyHandlers,
  createProposal,
  rollbackHandlers,
  type AppliedRecordGroup,
} from './proposalService.js';

export const MODEL_LOT_LINKING_STAGE = 'model_lot_linking';

const linkSchema = z.object({
  elementId: z.string().uuid(),
  ifcGuid: z.string().min(1),
  lotNumberValue: z.string().nullable(),
  lotId: z.string().uuid(),
  source: z.enum(['auto', 'manual']).optional(),
  carriedForward: z.boolean().optional(),
});

const applyPayloadSchema = z
  .object({
    versionId: z.string().uuid(),
    links: z.array(linkSchema),
  })
  .superRefine((payload, context) => {
    const seen = new Set<string>();
    for (const [index, link] of payload.links.entries()) {
      if (seen.has(link.elementId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Each model element can be linked only once.',
          path: ['links', index, 'elementId'],
        });
      }
      seen.add(link.elementId);
    }
  });

function proposalVersionId(proposal: AiProposal): string | null {
  if (
    !proposal.payload ||
    typeof proposal.payload !== 'object' ||
    Array.isArray(proposal.payload)
  ) {
    return null;
  }
  const value = (proposal.payload as Record<string, unknown>).versionId;
  return typeof value === 'string' ? value : null;
}

applyHandlers[MODEL_LOT_LINKING_STAGE] = async (
  tx: Prisma.TransactionClient,
  proposal: AiProposal,
  effectivePayload: unknown,
  context,
): Promise<AppliedRecordGroup[]> => {
  const parsed = applyPayloadSchema.safeParse(effectivePayload);
  if (!parsed.success) throw AppError.fromZodError(parsed.error);
  if (proposalVersionId(proposal) !== parsed.data.versionId) {
    throw AppError.badRequest('The reviewed payload cannot target a different model version.');
  }

  const version = await tx.designModelVersion.findFirst({
    where: { id: parsed.data.versionId, model: { projectId: proposal.projectId } },
    select: { id: true },
  });
  if (!version) throw AppError.badRequest('versionId does not belong to this project.');

  const elementIds = parsed.data.links.map((link) => link.elementId);
  const lotIds = [...new Set(parsed.data.links.map((link) => link.lotId))];
  const [elementCount, lotCount] = await Promise.all([
    tx.modelElement.count({ where: { id: { in: elementIds }, versionId: version.id } }),
    tx.lot.count({ where: { id: { in: lotIds }, projectId: proposal.projectId } }),
  ]);
  if (elementCount !== elementIds.length) {
    throw AppError.badRequest('Every elementId must belong to the proposal model version.');
  }
  if (lotCount !== lotIds.length) {
    throw AppError.badRequest('Every lotId must belong to the proposal project.');
  }

  await tx.modelElementLotLink.deleteMany({ where: { versionId: version.id } });
  const rows = parsed.data.links.map((link) => ({
    id: crypto.randomUUID(),
    versionId: version.id,
    elementId: link.elementId,
    lotId: link.lotId,
    source: link.source === 'manual' ? 'manual' : 'auto',
    createdById: link.source === 'manual' ? context.userId : null,
  }));
  if (rows.length > 0) await tx.modelElementLotLink.createMany({ data: rows });
  return [{ model: 'ModelElementLotLink', ids: rows.map((row) => row.id) }];
};

rollbackHandlers[MODEL_LOT_LINKING_STAGE] = async (
  tx: Prisma.TransactionClient,
  _proposal: AiProposal,
  groups: AppliedRecordGroup[],
): Promise<void> => {
  const ids = groups
    .filter((group) => group.model === 'ModelElementLotLink')
    .flatMap((group) => group.ids);
  if (ids.length > 0) await tx.modelElementLotLink.deleteMany({ where: { id: { in: ids } } });
};

export async function extractModelLotLinkingProposal(args: {
  projectId: string;
  versionId: string;
  requestedById: string;
}) {
  const version = await prisma.designModelVersion.findFirst({
    where: { id: args.versionId, model: { projectId: args.projectId } },
    select: {
      id: true,
      versionNumber: true,
      fileName: true,
      modelId: true,
      model: { select: { name: true } },
      elements: {
        orderBy: { ifcGuid: 'asc' },
        select: { id: true, ifcGuid: true, lotNumberValue: true },
      },
    },
  });
  if (!version) throw AppError.notFound('Design model version');

  const [lots, previousVersion] = await Promise.all([
    prisma.lot.findMany({
      where: { projectId: args.projectId },
      select: { id: true, lotNumber: true },
      orderBy: [{ lotNumber: 'asc' }, { id: 'asc' }],
    }),
    prisma.designModelVersion.findFirst({
      where: { modelId: version.modelId, versionNumber: { lt: version.versionNumber } },
      orderBy: { versionNumber: 'desc' },
      select: {
        elementLotLinks: {
          where: { source: 'manual' },
          orderBy: { elementId: 'asc' },
          select: {
            lotId: true,
            element: { select: { id: true, ifcGuid: true, lotNumberValue: true } },
          },
        },
      },
    }),
  ]);

  const buckets = computeAutoLinks(version.elements, lots);
  const currentByGuid = new Map(version.elements.map((element) => [element.ifcGuid, element]));
  const carriedForward = [];
  const orphanedManual = [];
  for (const prior of previousVersion?.elementLotLinks ?? []) {
    const current = currentByGuid.get(prior.element.ifcGuid);
    if (current) {
      carriedForward.push({
        elementId: current.id,
        ifcGuid: current.ifcGuid,
        lotNumberValue: current.lotNumberValue,
        lotId: prior.lotId,
        source: 'manual' as const,
        carriedForward: true,
      });
    } else {
      orphanedManual.push({
        elementId: prior.element.id,
        ifcGuid: prior.element.ifcGuid,
        lotNumberValue: prior.element.lotNumberValue,
        lotId: prior.lotId,
      });
    }
  }

  const carriedElementIds = new Set(carriedForward.map((link) => link.elementId));
  const links = [
    ...carriedForward,
    ...buckets.linked
      .filter((link) => !carriedElementIds.has(link.id))
      .map((link) => ({
        elementId: link.id,
        ifcGuid: link.ifcGuid,
        lotNumberValue: link.lotNumberValue,
        lotId: link.lotId,
      })),
  ];
  const ambiguous = buckets.ambiguous
    .filter((element) => !carriedElementIds.has(element.id))
    .map((element) => ({
      elementId: element.id,
      ifcGuid: element.ifcGuid,
      lotNumberValue: element.lotNumberValue,
      candidateLotIds: element.candidateLotIds,
    }));
  const unlinked = buckets.unlinked
    .filter((element) => !carriedElementIds.has(element.id))
    .map((element) => ({
      elementId: element.id,
      ifcGuid: element.ifcGuid,
      lotNumberValue: element.lotNumberValue,
    }));
  const payload = {
    versionId: version.id,
    links,
    ambiguous,
    unlinked: unlinked.slice(0, 50),
    unlinkedCount: unlinked.length,
    orphanedManual,
    counts: {
      elements: version.elements.length,
      linked: links.length,
      ambiguous: ambiguous.length,
      unlinked: unlinked.length,
      carriedForward: carriedForward.length,
      orphanedManual: orphanedManual.length,
    },
  };

  const proposal = await createProposal({
    projectId: args.projectId,
    stage: MODEL_LOT_LINKING_STAGE,
    requestedById: args.requestedById,
    model: 'deterministic',
    sourceRefs: [
      {
        fileName: version.fileName,
        note: `Model ${version.model.name}, version ${version.versionNumber}`,
      },
    ],
    payload,
  });
  return { proposal, payload };
}
