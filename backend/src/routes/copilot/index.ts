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
import { readPlanSheetImage } from '../planSheets/storage.js';
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
// Importing this module registers the plan_sheets apply/rollback handlers.
import { PLAN_SHEETS_STAGE } from './planSheetExecutor.js';
import { cleanPlanSheetCandidate, extractPlanSheetRawCandidate } from './planSheetExtraction.js';
// Importing this module registers the lot_breakdown apply/rollback handlers.
import { LOT_BREAKDOWN_STAGE } from './lotBreakdownExecutor.js';
import {
  buildDeterministicCandidate,
  cleanLotBreakdownCandidate,
  controlLineExtent,
  deriveLotPrefix,
  extractLotBreakdownRawCandidate,
  lotBreakdownUpload,
} from './lotBreakdownExtraction.js';
import type { ControlPoint } from '../../lib/spatial/controlLineGeometry.js';

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

// Stage-3 extract targets an already-stored sheet by id (not a fresh upload), so
// the body is plain JSON rather than multipart.
const planSheetExtractSchema = z.object({ planSheetId: z.string().uuid() });

// Stage-4 extract names a control line to break into lots; an optional sheet
// upload lets the AI propose the activities present. controlLineId arrives as a
// form field (multipart) or a JSON key (no file) — both populate req.body.
const lotBreakdownExtractSchema = z.object({
  controlLineId: z.string().trim().min(1).max(120),
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

// Stage 3 executor: read printed coordinate marks off an already-stored plan
// sheet's raster and persist them as a 'proposed' proposal for human review.
// The AI positions are APPROXIMATE — the review UI seeds draggable markers the
// user snaps onto each mark before applying. Writes NO registration here; the
// candidate only becomes real through the decision endpoint's apply handler.
copilotRouter.post(
  '/:projectId/copilot/plan_sheets/extract',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireProjectRoleExcludingSubcontractors(
      projectId,
      req.user!,
      LOT_CREATORS,
      DECIDE_DENIED_MESSAGE,
      { requireWritable: true },
    );

    const body = planSheetExtractSchema.safeParse(req.body);
    if (!body.success) {
      throw AppError.fromZodError(body.error);
    }

    const sheet = await prisma.planSheet.findFirst({
      where: { id: body.data.planSheetId, projectId },
      select: { id: true, name: true, imageRef: true },
    });
    if (!sheet) {
      throw AppError.notFound('Plan sheet');
    }

    const png = await readPlanSheetImage(sheet.imageRef, projectId);
    const raw = await extractPlanSheetRawCandidate(png);
    const { candidate, warnings } = cleanPlanSheetCandidate(raw);
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

    const payload = { planSheetId: sheet.id, ...candidate };
    const proposal = await createProposal({
      projectId,
      stage: PLAN_SHEETS_STAGE,
      requestedById: req.user!.id,
      model,
      sourceRefs: [{ fileName: sheet.name, note: 'Read from sheet raster' }],
      payload,
      warnings,
    });

    res.json({ proposalId: proposal.id, candidate: payload, warnings });
  }),
);

// Stage 4 executor: propose a thin-lot breakdown (chainage interval × activities)
// along a control line, applied through the shared bulk lot generator on accept.
// Two paths: WITH a sheet the AI proposes the activities present; WITHOUT one a
// deterministic candidate (full extent, 100 m, one Earthworks activity) is built —
// so this stage works even when AI is not configured. Writes NO lots; the
// candidate only becomes real through the decision endpoint's apply handler.
copilotRouter.post(
  '/:projectId/copilot/lot_breakdown/extract',
  lotBreakdownUpload.single('file'),
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireProjectRoleExcludingSubcontractors(
      projectId,
      req.user!,
      LOT_CREATORS,
      DECIDE_DENIED_MESSAGE,
      { requireWritable: true },
    );

    const body = lotBreakdownExtractSchema.safeParse(req.body);
    if (!body.success) {
      throw AppError.fromZodError(body.error);
    }

    const controlLine = await prisma.controlLine.findFirst({
      where: { id: body.data.controlLineId, projectId },
      select: { id: true, name: true, points: true },
    });
    if (!controlLine) {
      throw AppError.notFound('Control line');
    }
    const extent = controlLineExtent(controlLine.points as unknown as ControlPoint[]);
    if (!extent) {
      throw AppError.badRequest(
        `${controlLine.name} has no usable chainage extent — pick another control line.`,
        { code: 'CONTROL_LINE_NO_EXTENT' },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { projectNumber: true },
    });
    const base = {
      controlLineId: controlLine.id,
      startChainage: extent.min,
      endChainage: extent.max,
      lotPrefix: deriveLotPrefix(project?.projectNumber ?? null, controlLine.name),
    };

    let extraction;
    const sourceRefs: { fileName?: string; note?: string }[] = [
      { note: `From control line ${controlLine.name}` },
    ];
    if (req.file) {
      const raw = await extractLotBreakdownRawCandidate(req.file);
      extraction = cleanLotBreakdownCandidate(raw, base);
      sourceRefs.push({ fileName: req.file.originalname, note: 'Read for activities' });
    } else {
      extraction = buildDeterministicCandidate(base);
    }

    const model = req.file
      ? process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022'
      : 'deterministic';

    const proposal = await createProposal({
      projectId,
      stage: LOT_BREAKDOWN_STAGE,
      requestedById: req.user!.id,
      model,
      sourceRefs,
      payload: extraction.candidate,
      warnings: extraction.warnings,
    });

    res.json({
      proposalId: proposal.id,
      candidate: extraction.candidate,
      warnings: extraction.warnings,
    });
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
