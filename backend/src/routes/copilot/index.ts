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
import {
  cleanSetoutCandidate,
  extractSetoutRawCandidate,
  setoutUpload,
} from '../controlLines/setoutExtraction.js';
import { createProposal, decideProposal, rollbackProposal } from './proposalService.js';
// Importing this module registers the project_facts apply/rollback handlers.
import {
  PROJECT_FACTS_STAGE,
  cleanProjectFactsCandidate,
  extractProjectFactsRawCandidate,
  projectFactsUpload,
} from './projectFactsExtraction.js';
// Importing this module registers the control_line apply/rollback handlers.
import { CONTROL_LINE_STAGE } from './controlLineExecutor.js';

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

// Stage 1 executor: read the four project facts off a drawing title block and
// persist them as a 'proposed' proposal for human review. Writes NOTHING to the
// project — the AI candidate only becomes real through the decision endpoint.
// Same write-capable role set as decisions (deciding this proposal edits the
// project). Multipart PDF/image upload, kept in memory, streamed to the AI.
copilotRouter.post(
  '/:projectId/copilot/project_facts/extract',
  projectFactsUpload.single('file'),
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireProjectRoleExcludingSubcontractors(
      projectId,
      req.user!,
      LOT_CREATORS,
      DECIDE_DENIED_MESSAGE,
      { requireWritable: true },
    );

    if (!req.file) {
      throw AppError.badRequest('A drawing file is required.');
    }

    const raw = await extractProjectFactsRawCandidate(req.file);
    const { candidate, warnings, page } = cleanProjectFactsCandidate(raw);
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

    const proposal = await createProposal({
      projectId,
      stage: PROJECT_FACTS_STAGE,
      requestedById: req.user!.id,
      model,
      sourceRefs: [
        { fileName: req.file.originalname, page: page ?? undefined, note: 'Read from title block' },
      ],
      payload: candidate,
      warnings,
    });

    res.json({ proposalId: proposal.id, candidate, warnings });
  }),
);

// Stage 2 executor: read the survey control line(s) off a "Geometric Setout
// Details" sheet and persist them as a 'proposed' proposal for human review.
// Reuses the existing setout extraction (extractSetoutRawCandidate +
// cleanSetoutCandidate); a 400 SETOUT_EXTRACTION_INSUFFICIENT propagates before
// any proposal is persisted. Writes NO control lines — the candidate only
// becomes real through the decision endpoint's apply handler.
copilotRouter.post(
  '/:projectId/copilot/control_line/extract',
  setoutUpload.single('file'),
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireProjectRoleExcludingSubcontractors(
      projectId,
      req.user!,
      LOT_CREATORS,
      DECIDE_DENIED_MESSAGE,
      { requireWritable: true },
    );

    if (!req.file) {
      throw AppError.badRequest('A setout sheet is required.');
    }

    const raw = await extractSetoutRawCandidate(req.file);
    const candidate = cleanSetoutCandidate(raw);
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

    const proposal = await createProposal({
      projectId,
      stage: CONTROL_LINE_STAGE,
      requestedById: req.user!.id,
      model,
      sourceRefs: [{ fileName: req.file.originalname, note: 'Read from setout sheet' }],
      payload: candidate,
      warnings: candidate.warnings,
    });

    res.json({ proposalId: proposal.id, candidate, warnings: candidate.warnings });
  }),
);

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
