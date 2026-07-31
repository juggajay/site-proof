/**
 * Wave G G5 — template-revision proposals
 * (`docs/plans/wave-g-execution-spec-2026-07-31.md` §5.3, AT-G30).
 *
 * The half of the learning loop that closes it. The analytics surface shows
 * that one checklist item failed N times across M subcontractors; a reviewer
 * writes what they think should change; accepting that proposal **opens a new
 * revision of the template** and supersedes the old one.
 *
 * Three rules this router exists to enforce, all from the spec:
 *
 *  1. **Never an in-place edit** (§5.3). Accept clones the template into a new
 *     row, points the old row's `supersededById` at it, and records a
 *     `RevisionIssue` — the same shape a drawing revision has. Every ITP
 *     instance already assigned keeps its snapshot, which is the whole reason
 *     G5 sequences after G1/G2.
 *  2. **No AI writes anything** (boundary §0.3.5). `proposedChange` is a human's
 *     words, and nothing here proposes automatically.
 *  3. **The evidence is computed, never asserted by the caller.** `ncrCount`,
 *     `subcontractorCount` and `activitySlug` are derived server-side from the
 *     project's own NCRs at the moment the proposal is written, then FROZEN, so
 *     a proposal reviewed six weeks later is judged against the trend that
 *     prompted it. The `parseProductEventItem` precedent (§7 row 5): a client
 *     may say what it wants done, never what the record says happened.
 *
 * The GLOBAL library is out of reach here by design. `templateAccess.ts` throws
 * 403 on any attempt to modify a library template, §2.3 puts library
 * supersession behind the operator seeder with `--execute`, and AT-G36 fences
 * `RevisionIssue` to project-scoped templates. Accepting a proposal against a
 * global template is rejected with the route that does own it.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { prisma } from '../lib/prisma.js';
import { ncrLearningLoopEnabled } from '../lib/ncrVocabulary.js';
import { revisionGovernanceEnabled } from '../lib/revisionGovernance.js';
import { assertProjectAllowsWrite } from '../lib/projectAccess.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireProjectTemplateAccess } from './itp/templateAccess.js';
import { resolveChecklistItemRoot } from './ncrs/ncrAnalyticsAggregation.js';
import { loadLineagePointers } from './ncrs/ncrAnalyticsLoaders.js';

const router = Router();

// Spec §5.4: flag OFF ⇒ these routes do not exist. Mounted before `requireAuth`
// so an unauthenticated probe cannot tell "off" from "unauthorised", matching
// the G1 revisions router.
router.use((_req, _res, next) => {
  next(ncrLearningLoopEnabled() ? undefined : AppError.notFound('Route'));
});
router.use(requireAuth);

const MAX_ID = 120;
const MAX_CHANGE = 5000;
const MAX_LABEL = 80;
const MAX_NOTE = 1000;
const PROPOSAL_PAGE_SIZE = 50;

const idSchema = z.string().trim().min(1).max(MAX_ID);

const createSchema = z
  .object({
    projectId: idSchema,
    // One of these two. A proposal about an item names the item; a proposal
    // about a template as a whole (an item that should EXIST has no id yet)
    // names the template.
    checklistItemId: idSchema.optional(),
    templateId: idSchema.optional(),
    proposedChange: z.string().trim().min(1).max(MAX_CHANGE),
  })
  .refine((value) => Boolean(value.checklistItemId) || Boolean(value.templateId), {
    message: 'A proposal must name either a checklistItemId or a templateId',
  });

const acceptSchema = z.object({
  // The human rev token for the new revision ('Rev C', 'v2'). Required: a
  // revision with no label is not citable on a conformance record, and the
  // product never invents one.
  revisionLabel: z.string().trim().min(1).max(MAX_LABEL),
  // Spec §1.7 E3 — a supersession with no stated reason is an unexplained
  // replacement of a controlled record.
  changeSummary: z.string().trim().min(1).max(MAX_CHANGE),
});

const rejectSchema = z.object({
  decisionNote: z.string().trim().min(1).max(MAX_NOTE),
});

function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw AppError.fromZodError(parsed.error);
  return parsed.data;
}

const proposalInclude = {
  template: { select: { id: true, name: true, projectId: true, supersededById: true } },
  checklistItem: { select: { id: true, description: true } },
  resultingTemplate: { select: { id: true, name: true } },
  proposedBy: { select: { id: true, fullName: true, email: true } },
  decidedBy: { select: { id: true, fullName: true, email: true } },
} as const;

/**
 * Recomputes the trend behind a proposal, scoped to one project (AT-G31).
 *
 * Counts every NCR in the project whose `itpChecklistItemId` resolves to the
 * same lineage ROOT as the named item — so a project that cloned a corporate
 * master into two controlled copies counts one requirement, not two
 * (spec §2.2(c) [GR-A3]). Identity is never guessed from description text.
 */
async function computeItemEvidence(
  projectId: string,
  checklistItemId: string,
): Promise<{ ncrCount: number; subcontractorCount: number; activitySlug: string | null }> {
  const groups = await prisma.nCR.groupBy({
    by: ['itpChecklistItemId', 'responsibleSubcontractorId'],
    where: { projectId, itpChecklistItemId: { not: null } },
    _count: { _all: true },
  });

  // Same walk the analytics surface uses, from the same module: two
  // implementations of "what is this item's root" would eventually disagree,
  // and the proposal's frozen evidence must match the trend that produced it.
  const pointers = await loadLineagePointers([
    ...groups.map((group) => group.itpChecklistItemId).filter((id): id is string => Boolean(id)),
    checklistItemId,
  ]);

  const targetRoot = resolveChecklistItemRoot(checklistItemId, pointers);
  const matching = groups.filter(
    (group) =>
      group.itpChecklistItemId &&
      resolveChecklistItemRoot(group.itpChecklistItemId, pointers) === targetRoot,
  );

  const ncrCount = matching.reduce((sum, group) => sum + group._count._all, 0);
  const subcontractorCount = new Set(
    matching
      .map((group) => group.responsibleSubcontractorId)
      .filter((id): id is string => Boolean(id)),
  ).size;

  // The activity the item's own template is written for. Read from the
  // template, not inferred from the lots — a lot's activity can be null and
  // guessing one would be a fabricated attribution.
  const item = await prisma.iTPChecklistItem.findUnique({
    where: { id: checklistItemId },
    select: { template: { select: { activityType: true } } },
  });

  return { ncrCount, subcontractorCount, activitySlug: item?.template?.activityType ?? null };
}

// GET /api/ncr-learning/proposals?projectId=&status=
router.get(
  '/proposals',
  asyncHandler(async (req: Request, res: Response) => {
    const query = parseBody(
      z.object({
        projectId: idSchema,
        status: z.enum(['open', 'accepted', 'rejected']).optional(),
      }),
      req.query,
    );

    await requireProjectTemplateAccess(query.projectId, req.user!);

    const proposals = await prisma.templateRevisionProposal.findMany({
      where: { projectId: query.projectId, ...(query.status ? { status: query.status } : {}) },
      orderBy: [{ status: 'asc' }, { proposedAt: 'desc' }],
      // Bounded for the same reason every list in G5 is bounded ([GR-N4]).
      take: PROPOSAL_PAGE_SIZE,
      include: proposalInclude,
    });

    res.json({ proposals });
  }),
);

// POST /api/ncr-learning/proposals — a reviewer proposes a template change.
router.post(
  '/proposals',
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(createSchema, req.body);

    await requireProjectTemplateAccess(body.projectId, req.user!, true);
    await assertProjectAllowsWrite(body.projectId);

    let templateId = body.templateId ?? null;
    let evidence = { ncrCount: 0, subcontractorCount: 0, activitySlug: null as string | null };

    if (body.checklistItemId) {
      const item = await prisma.iTPChecklistItem.findUnique({
        where: { id: body.checklistItemId },
        select: { id: true, templateId: true, template: { select: { projectId: true } } },
      });
      // 404 rather than 403 on a cross-tenant id: a 403 confirms the row exists
      // in somebody else's project (spec §7 row 4).
      if (!item) throw AppError.notFound('Checklist item');
      // A GLOBAL item (projectId null) is reachable from any project — it is the
      // shared library — but a project-scoped one belongs to exactly one.
      if (item.template.projectId !== null && item.template.projectId !== body.projectId) {
        throw AppError.notFound('Checklist item');
      }
      templateId = item.templateId;
      evidence = await computeItemEvidence(body.projectId, item.id);
    }

    if (!templateId) throw AppError.badRequest('templateId could not be resolved');

    const template = await prisma.iTPTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, projectId: true },
    });
    if (!template) throw AppError.notFound('ITP template');
    if (template.projectId !== null && template.projectId !== body.projectId) {
      throw AppError.notFound('ITP template');
    }

    const proposal = await prisma.templateRevisionProposal.create({
      data: {
        projectId: body.projectId,
        templateId,
        checklistItemId: body.checklistItemId ?? null,
        ncrCount: evidence.ncrCount,
        subcontractorCount: evidence.subcontractorCount,
        activitySlug: evidence.activitySlug,
        proposedChange: body.proposedChange,
        proposedById: req.user!.id,
      },
      include: proposalInclude,
    });

    res.status(201).json({ proposal });
  }),
);

async function loadOpenProposal(proposalId: string) {
  const proposal = await prisma.templateRevisionProposal.findUnique({
    where: { id: proposalId },
    include: proposalInclude,
  });
  if (!proposal) throw AppError.notFound('Proposal');
  return proposal;
}

// POST /api/ncr-learning/proposals/:id/accept — open a NEW template revision.
router.post(
  '/proposals/:id/accept',
  asyncHandler(async (req: Request, res: Response) => {
    const proposalId = parseBody(idSchema, req.params.id);
    const body = parseBody(acceptSchema, req.body);

    const proposal = await loadOpenProposal(proposalId);
    await requireProjectTemplateAccess(proposal.projectId, req.user!, true);
    await assertProjectAllowsWrite(proposal.projectId);

    if (proposal.status !== 'open') {
      throw AppError.badRequest(`This proposal was already ${proposal.status}`, {
        code: 'PROPOSAL_ALREADY_DECIDED',
      });
    }

    // §2.3: the shared library is operator-only. There is no API path to a new
    // library edition and G5 does not open one.
    if (proposal.template.projectId === null) {
      throw AppError.badRequest(
        'This is a global library template. A new library edition is published by the ITP seeder with --supersede --execute, not from the app. Clone it into this project first, then propose against the copy.',
        { code: 'GLOBAL_TEMPLATE_NOT_ISSUABLE' },
      );
    }

    if (proposal.template.supersededById) {
      throw AppError.badRequest(
        'That template has already been superseded. Re-raise the proposal against the current revision.',
        { code: 'TEMPLATE_ALREADY_SUPERSEDED' },
      );
    }

    const source = await prisma.iTPTemplate.findUniqueOrThrow({
      where: { id: proposal.templateId },
      include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
    });

    const revisedName = `${source.name} (${body.revisionLabel})`;
    const userId = req.user!.id;
    const governanceEnabled = revisionGovernanceEnabled();

    const result = await prisma.$transaction(async (tx) => {
      // The new revision is a COPY carrying the reviewer's change summary. The
      // reviewer edits the items on the new revision afterwards, through the
      // shipped template routes — which is exactly why this route does not try
      // to apply a diff it would have had to guess.
      const revision = await tx.iTPTemplate.create({
        data: {
          projectId: source.projectId,
          name: revisedName,
          description: source.description,
          activityType: source.activityType,
          specificationReference: source.specificationReference,
          stateSpec: source.stateSpec,
          isActive: true,
          sourceTemplateId: source.id,
          // Provenance travels with the revision: it is still written against
          // the same published specification edition. A revision of OUR
          // controlled copy is not a new edition of the authority's spec, and
          // inventing a `specEdition` here would be a fabricated claim.
          authority: source.authority,
          specEdition: source.specEdition,
          specIssuedOn: source.specIssuedOn,
          reviewDueOn: source.reviewDueOn,
          annexureWarning: source.annexureWarning,
          effectiveFrom: new Date(),
          changeSummary:
            `${body.changeSummary} (raised from ${proposal.ncrCount} NCR(s) across ` +
            `${proposal.subcontractorCount} subcontractor(s))`,
          checklistItems: {
            create: source.checklistItems.map((item, index) => ({
              description: item.description,
              sequenceNumber: index + 1,
              pointType: item.pointType,
              responsibleParty: item.responsibleParty,
              evidenceRequired: item.evidenceRequired,
              acceptanceCriteria: item.acceptanceCriteria,
              testType: item.testType,
              notes: item.notes,
              // Immediate parent, not the root — cross-copy aggregation walks
              // the chain (spec §2.2(c) [GR-A3]).
              sourceChecklistItemId: item.id,
            })),
          },
        },
        select: { id: true, name: true },
      });

      // The supersession pointer G1's generic route could not set, because
      // `ITPTemplate.supersededById` did not exist until G2 §2.2(a).
      await tx.iTPTemplate.update({
        where: { id: source.id },
        data: { supersededById: revision.id, supersededAt: new Date(), isActive: false },
      });

      if (governanceEnabled) {
        await tx.revisionIssue.create({
          data: {
            projectId: proposal.projectId,
            entityType: 'itp_template',
            entityId: revision.id,
            revisionLabel: body.revisionLabel,
            supersedesId: source.id,
            reason: body.changeSummary,
            issuedById: userId,
          },
        });
      }

      const decided = await tx.templateRevisionProposal.update({
        where: { id: proposal.id },
        data: {
          status: 'accepted',
          decidedById: userId,
          decidedAt: new Date(),
          decisionNote: body.changeSummary,
          resultingTemplateId: revision.id,
        },
        include: proposalInclude,
      });

      return { revision, proposal: decided };
    });

    res.status(201).json(result);
  }),
);

// POST /api/ncr-learning/proposals/:id/reject
router.post(
  '/proposals/:id/reject',
  asyncHandler(async (req: Request, res: Response) => {
    const proposalId = parseBody(idSchema, req.params.id);
    const body = parseBody(rejectSchema, req.body);

    const proposal = await loadOpenProposal(proposalId);
    await requireProjectTemplateAccess(proposal.projectId, req.user!, true);
    await assertProjectAllowsWrite(proposal.projectId);

    if (proposal.status !== 'open') {
      throw AppError.badRequest(`This proposal was already ${proposal.status}`, {
        code: 'PROPOSAL_ALREADY_DECIDED',
      });
    }

    const decided = await prisma.templateRevisionProposal.update({
      where: { id: proposal.id },
      data: {
        status: 'rejected',
        decidedById: req.user!.id,
        decidedAt: new Date(),
        decisionNote: body.decisionNote,
      },
      include: proposalInclude,
    });

    res.json({ proposal: decided });
  }),
);

export const ncrLearningRouter = router;
