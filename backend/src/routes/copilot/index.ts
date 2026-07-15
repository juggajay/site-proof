import { Router } from 'express';
import type { AiProposal } from '@prisma/client';
import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import {
  requireInternalProjectAccess,
  requireProjectRoleExcludingSubcontractors,
} from '../../lib/projectAccess.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { LOT_CREATORS } from '../lots/roles.js';
import { parseProjectRouteParam } from '../controlLines/validation.js';
import { decideProposal, rollbackProposal } from './proposalService.js';

// Deciding a proposal applies its stage's handler (creating lots, control lines,
// etc.), so it needs the same write-capable role set as lot setup. Reads are
// open to any internal project member (subcontractors excluded).
const DECIDE_DENIED_MESSAGE = 'You do not have permission to decide AI proposals';

const PROPOSAL_LIST_LIMIT = 100;

// editedPayload is only meaningful when accepting (it replaces the AI candidate);
// sending it with a reject is a client error.
const decisionSchema = z
  .object({
    action: z.enum(['accept', 'reject']),
    editedPayload: z.unknown().optional(),
  })
  .refine((data) => data.action === 'accept' || data.editedPayload === undefined, {
    message: 'editedPayload is only valid when accepting a proposal',
    path: ['editedPayload'],
  });

const listQuerySchema = z.object({
  stage: z.string().trim().min(1).max(120).optional(),
  status: z.string().trim().min(1).max(40).optional(),
});

function mapProposal(proposal: AiProposal) {
  return {
    id: proposal.id,
    projectId: proposal.projectId,
    stage: proposal.stage,
    status: proposal.status,
    requestedById: proposal.requestedById,
    model: proposal.model,
    sourceRefs: proposal.sourceRefs,
    payload: proposal.payload,
    warnings: proposal.warnings,
    decidedById: proposal.decidedById,
    decidedAt: proposal.decidedAt ? proposal.decidedAt.toISOString() : null,
    editedPayload: proposal.editedPayload,
    appliedRecordIds: proposal.appliedRecordIds,
    createdAt: proposal.createdAt.toISOString(),
  };
}

const copilotRouter = Router();

copilotRouter.use(requireAuth);

copilotRouter.get(
  '/:projectId/copilot/proposals',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireInternalProjectAccess(req.user!, projectId);

    const query = listQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw AppError.fromZodError(query.error);
    }

    const proposals = await prisma.aiProposal.findMany({
      where: {
        projectId,
        ...(query.data.stage ? { stage: query.data.stage } : {}),
        ...(query.data.status ? { status: query.data.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: PROPOSAL_LIST_LIMIT,
    });

    res.json({ proposals: proposals.map(mapProposal) });
  }),
);

copilotRouter.get(
  '/:projectId/copilot/proposals/:proposalId',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const proposalId = parseProjectRouteParam(req.params.proposalId, 'proposalId');
    await requireInternalProjectAccess(req.user!, projectId);

    const proposal = await prisma.aiProposal.findUnique({ where: { id: proposalId } });
    if (!proposal || proposal.projectId !== projectId) {
      throw AppError.notFound('Proposal');
    }

    res.json({ proposal: mapProposal(proposal) });
  }),
);

copilotRouter.post(
  '/:projectId/copilot/proposals/:proposalId/decision',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const proposalId = parseProjectRouteParam(req.params.proposalId, 'proposalId');
    await requireProjectRoleExcludingSubcontractors(
      projectId,
      req.user!,
      LOT_CREATORS,
      DECIDE_DENIED_MESSAGE,
      { requireWritable: true },
    );

    const validation = decisionSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const proposal = await decideProposal({
      proposalId,
      projectId,
      userId: req.user!.id,
      action: validation.data.action,
      editedPayload: validation.data.editedPayload,
    });

    res.json({ proposal: mapProposal(proposal) });
  }),
);

copilotRouter.post(
  '/:projectId/copilot/proposals/:proposalId/rollback',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const proposalId = parseProjectRouteParam(req.params.proposalId, 'proposalId');
    await requireProjectRoleExcludingSubcontractors(
      projectId,
      req.user!,
      LOT_CREATORS,
      DECIDE_DENIED_MESSAGE,
      { requireWritable: true },
    );

    const proposal = await rollbackProposal({
      proposalId,
      projectId,
      userId: req.user!.id,
    });

    res.json({ proposal: mapProposal(proposal) });
  }),
);

export { copilotRouter };
