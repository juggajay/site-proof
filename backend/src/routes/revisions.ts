/**
 * Wave G G1 — revision governance routes
 * (`docs/plans/wave-g-execution-spec-2026-07-31.md` §1).
 *
 * What is deliberately NOT here:
 *
 *  - **Drawing supersession.** `POST /api/drawings/:id/supersede` already owns
 *    it, file upload and all, and G1 adds the `RevisionIssue` write inside that
 *    route's existing transaction. Two writers for one chain is how the chain
 *    ends up disagreeing with itself, so this router rejects `drawing` on the
 *    issue endpoint and says where to go.
 *  - **Any external acknowledgement link.** Link possession is not identity;
 *    external identity is Wave E's problem and Wave E's threat model owns it
 *    (spec §7 row 6). `recipientEmail` records who a revision was addressed to;
 *    only a signed-in user can acknowledge.
 *  - **Notification sending.** `notifiedAt` stays null until something actually
 *    sends. Recording a recipient is not evidence that they were told.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { prisma } from '../lib/prisma.js';
import {
  GOVERNED_ENTITY_TYPES,
  DOCUMENT_BACKED_ENTITY_TYPES,
  revisionGovernanceEnabled,
  type GovernedEntityType,
} from '../lib/revisionGovernance.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  requireAcknowledgeAccess,
  requireGoverningRevisionLinkAccess,
  requireRevisionIssueAccess,
  requireRevisionReadAccess,
} from './revisions/access.js';

const router = Router();

// Spec §1.9: flag OFF ⇒ these routes do not exist. Mounted before `requireAuth`
// so an unauthenticated probe cannot distinguish "off" from "unauthorised".
router.use((_req, _res, next) => {
  next(revisionGovernanceEnabled() ? undefined : AppError.notFound('Route'));
});
router.use(requireAuth);

const MAX_LABEL = 80;
const MAX_REASON = 1000;
const MAX_ID = 120;

const idSchema = z.string().trim().min(1).max(MAX_ID);
const entityTypeSchema = z.enum(GOVERNED_ENTITY_TYPES);

const recipientSchema = z
  .object({
    userId: idSchema.optional(),
    email: z.string().trim().email().max(320).optional(),
  })
  // The "exactly one addressee" invariant lives HERE, not in the database: it
  // is a statement about an INSERT, and the database cannot enforce it without
  // also rejecting the (null, null) row that `onDelete: SetNull` legitimately
  // produces when an acknowledger's account is deleted. See the CHECK in
  // `prisma/migrations/20260806000000_g1_revision_issue_and_acknowledgement`.
  .refine((value) => Boolean(value.userId) !== Boolean(value.email), {
    message: 'each recipient must have exactly one of userId or email',
  });

const issueSchema = z.object({
  projectId: idSchema,
  entityType: entityTypeSchema,
  entityId: idSchema,
  revisionLabel: z.string().trim().min(1).max(MAX_LABEL),
  supersedesId: idSchema.optional(),
  reason: z.string().trim().min(1).max(MAX_REASON).optional(),
  recipients: z.array(recipientSchema).max(200).optional(),
});

const linkSchema = z.object({
  entityType: entityTypeSchema,
  entityId: idSchema,
  revisionLabel: z.string().trim().min(1).max(MAX_LABEL),
});

function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw AppError.fromZodError(parsed.error);
  return parsed.data;
}

/**
 * Asserts the governed record exists AND belongs to `projectId`.
 *
 * 404 rather than 403 on a cross-tenant id: a 403 confirms the row exists in
 * somebody else's project (spec §7 row 4's no-existence-disclosure rule).
 *
 * AT-G36: an `itp_template` that resolves to a GLOBAL library row
 * (`projectId IS NULL`) is rejected. `RevisionIssue` records issue and
 * distribution to named recipients inside a project; the global library has
 * nobody to issue to and uses its own supersession chain (G2 §2.2(f)).
 */
async function assertGovernedEntityInProject(
  projectId: string,
  entityType: GovernedEntityType,
  entityId: string,
): Promise<void> {
  if (entityType === 'drawing') {
    const drawing = await prisma.drawing.findFirst({
      where: { id: entityId, projectId },
      select: { id: true },
    });
    if (!drawing) throw AppError.notFound('Drawing');
    return;
  }

  if (entityType === 'itp_template') {
    const template = await prisma.iTPTemplate.findUnique({
      where: { id: entityId },
      select: { projectId: true },
    });
    if (!template) throw AppError.notFound('ITP template');
    if (template.projectId === null) {
      throw AppError.badRequest(
        'Global library templates are not issued through project revision governance',
        { code: 'GLOBAL_TEMPLATE_NOT_ISSUABLE' },
      );
    }
    if (template.projectId !== projectId) throw AppError.notFound('ITP template');
    return;
  }

  const document = await prisma.document.findFirst({
    where: { id: entityId, projectId },
    select: { id: true },
  });
  if (!document) throw AppError.notFound('Document');
}

function isDocumentBacked(entityType: GovernedEntityType): boolean {
  return DOCUMENT_BACKED_ENTITY_TYPES.includes(entityType);
}

// ---------------------------------------------------------------------------
// Revision issues
// ---------------------------------------------------------------------------

// GET /api/revisions?projectId=&entityType=&entityId= — one record's timeline.
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const query = parseBody(
      z.object({ projectId: idSchema, entityType: entityTypeSchema, entityId: idSchema }),
      req.query,
    );

    await requireRevisionReadAccess(req.user!, query.projectId);

    const issues = await prisma.revisionIssue.findMany({
      where: {
        projectId: query.projectId,
        entityType: query.entityType,
        entityId: query.entityId,
      },
      orderBy: { issuedAt: 'desc' },
      include: {
        issuedBy: { select: { id: true, fullName: true, email: true } },
        recipients: {
          select: {
            id: true,
            userId: true,
            recipientEmail: true,
            notifiedAt: true,
            openedAt: true,
            acknowledgedAt: true,
          },
        },
      },
    });

    res.json({ issues });
  }),
);

// POST /api/revisions — issue a revision of a non-drawing governed record.
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(issueSchema, req.body);

    if (body.entityType === 'drawing') {
      throw AppError.badRequest(
        'Drawing revisions are issued through POST /api/drawings/:drawingId/supersede',
        { code: 'USE_DRAWING_SUPERSEDE_ROUTE' },
      );
    }

    // Spec §1.7 E3: a supersession with no stated reason is an unexplained
    // replacement of a controlled record. A FIRST issue may omit it.
    if (body.supersedesId && !body.reason) {
      throw AppError.badRequest('A reason is required when superseding a revision', {
        code: 'REVISION_REASON_REQUIRED',
      });
    }

    await requireRevisionIssueAccess(req.user!, body.projectId, body.entityType);
    await assertGovernedEntityInProject(body.projectId, body.entityType, body.entityId);
    if (body.supersedesId) {
      if (body.supersedesId === body.entityId) {
        throw AppError.badRequest('A revision cannot supersede itself');
      }
      await assertGovernedEntityInProject(body.projectId, body.entityType, body.supersedesId);
    }

    // Recipients must be members of the project being issued in — otherwise a
    // caller could address a revision to a user in another tenant and learn
    // their id is real from whether the write succeeded.
    const recipientUserIds = (body.recipients ?? [])
      .map((recipient) => recipient.userId)
      .filter((userId): userId is string => Boolean(userId));
    if (recipientUserIds.length > 0) {
      const members = await prisma.projectUser.findMany({
        where: { projectId: body.projectId, userId: { in: recipientUserIds }, status: 'active' },
        select: { userId: true },
      });
      const memberIds = new Set(members.map((member) => member.userId));
      const stranger = recipientUserIds.find((userId) => !memberIds.has(userId));
      if (stranger) {
        throw AppError.badRequest('Every recipient must be an active member of this project', {
          code: 'RECIPIENT_NOT_IN_PROJECT',
        });
      }
    }

    const issue = await prisma.$transaction(async (tx) => {
      const created = await tx.revisionIssue.create({
        data: {
          projectId: body.projectId,
          entityType: body.entityType,
          entityId: body.entityId,
          revisionLabel: body.revisionLabel,
          supersedesId: body.supersedesId,
          reason: body.reason,
          issuedById: req.user!.id,
        },
      });

      if (body.recipients?.length) {
        await tx.revisionAcknowledgement.createMany({
          data: body.recipients.map((recipient) => ({
            issueId: created.id,
            userId: recipient.userId ?? null,
            recipientEmail: recipient.email ?? null,
          })),
        });
      }

      // The supersession pointer. `itp_template` has none until G2 §2.2(a) adds
      // `ITPTemplate.supersededById`, so a template supersession records the
      // ISSUE here and gains its chain in G2 — stated rather than silently
      // skipped.
      if (body.supersedesId && isDocumentBacked(body.entityType)) {
        await tx.document.update({
          where: { id: body.supersedesId },
          data: { supersededById: body.entityId },
        });
      }

      return created;
    });

    res.status(201).json({ issue });
  }),
);

// POST /api/revisions/:issueId/recipients — record further distribution.
router.post(
  '/:issueId/recipients',
  asyncHandler(async (req: Request, res: Response) => {
    const issueId = parseBody(idSchema, req.params.issueId);
    const body = parseBody(
      z.object({ recipients: z.array(recipientSchema).min(1).max(200) }),
      req.body,
    );

    const issue = await prisma.revisionIssue.findUnique({
      where: { id: issueId },
      select: { id: true, projectId: true, entityType: true },
    });
    if (!issue) throw AppError.notFound('Revision issue');

    await requireRevisionIssueAccess(
      req.user!,
      issue.projectId,
      issue.entityType as GovernedEntityType,
    );

    await prisma.revisionAcknowledgement.createMany({
      data: body.recipients.map((recipient) => ({
        issueId: issue.id,
        userId: recipient.userId ?? null,
        recipientEmail: recipient.email ?? null,
      })),
      // A re-send to someone already on the list is not an error.
      skipDuplicates: true,
    });

    res.status(201).json({ ok: true });
  }),
);

// POST /api/revisions/:issueId/acknowledge — "I have seen this revision."
router.post(
  '/:issueId/acknowledge',
  asyncHandler(async (req: Request, res: Response) => {
    const issueId = parseBody(idSchema, req.params.issueId);

    const issue = await prisma.revisionIssue.findUnique({
      where: { id: issueId },
      select: { id: true, projectId: true },
    });
    if (!issue) throw AppError.notFound('Revision issue');

    await requireAcknowledgeAccess(req.user!, issue.projectId);

    // The actor comes from the session, never the body (spec §7 row 5): a
    // repudiation defence is worth nothing if the client names the actor.
    const existing = await prisma.revisionAcknowledgement.findUnique({
      where: { issueId_userId: { issueId: issue.id, userId: req.user!.id } },
    });
    if (!existing) {
      throw AppError.forbidden('This revision was not addressed to you');
    }

    // `acknowledgedAt` is immutable once set — re-acknowledging returns the
    // original instant rather than moving it.
    if (existing.acknowledgedAt) {
      res.json({ acknowledgement: existing });
      return;
    }

    const acknowledgement = await prisma.revisionAcknowledgement.update({
      where: { id: existing.id },
      data: {
        acknowledgedAt: new Date(),
        openedAt: existing.openedAt ?? new Date(),
      },
    });

    res.json({ acknowledgement });
  }),
);

// ---------------------------------------------------------------------------
// Lot ↔ governing revision links
//
// Mounted under this router rather than on `lotsRouter` on purpose: the lots
// router's mount order is load-bearing (specific paths before `/:id`), and
// threading one more sub-router through it buys nothing G1 needs. All of G1's
// surface then sits behind one flag check, in one file.
// ---------------------------------------------------------------------------

async function lotForLinking(lotId: string): Promise<{ id: string; projectId: string }> {
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    select: { id: true, projectId: true },
  });
  if (!lot) throw AppError.notFound('Lot');
  return lot;
}

router.get(
  '/lots/:lotId/governing-revisions',
  asyncHandler(async (req: Request, res: Response) => {
    const lotId = parseBody(idSchema, req.params.lotId);
    const lot = await lotForLinking(lotId);
    await requireRevisionReadAccess(req.user!, lot.projectId);

    const links = await prisma.lotGoverningRevision.findMany({
      where: { lotId: lot.id },
      orderBy: [{ unlinkedAt: 'asc' }, { linkedAt: 'desc' }],
      include: { linkedBy: { select: { id: true, fullName: true, email: true } } },
    });

    res.json({ links });
  }),
);

router.post(
  '/lots/:lotId/governing-revisions',
  asyncHandler(async (req: Request, res: Response) => {
    const lotId = parseBody(idSchema, req.params.lotId);
    const body = parseBody(linkSchema, req.body);
    const lot = await lotForLinking(lotId);

    await requireGoverningRevisionLinkAccess(req.user!, lot.projectId);
    // Spec §1.7 E7: linking a lot to a record in another project is a 400 (or a
    // 404 when the id resolves to nothing this project can see) — the
    // comparison is against the LOT's project, and the answer is then persisted
    // on the row so no later read has to resolve `entityId` polymorphically.
    await assertGovernedEntityInProject(lot.projectId, body.entityType, body.entityId);

    // A second ACTIVE row for the same (lot, entityType, entityId) violates
    // `lot_governing_revision_active_uniq` → P2002 → 409 from the shipped
    // handler. No new mapping (AT-G38).
    const link = await prisma.lotGoverningRevision.create({
      data: {
        lotId: lot.id,
        projectId: lot.projectId,
        entityType: body.entityType,
        entityId: body.entityId,
        revisionLabel: body.revisionLabel,
        linkedById: req.user!.id,
      },
    });

    res.status(201).json({ link });
  }),
);

router.delete(
  '/lots/:lotId/governing-revisions/:linkId',
  asyncHandler(async (req: Request, res: Response) => {
    const lotId = parseBody(idSchema, req.params.lotId);
    const linkId = parseBody(idSchema, req.params.linkId);
    const lot = await lotForLinking(lotId);

    await requireGoverningRevisionLinkAccess(req.user!, lot.projectId);

    const existing = await prisma.lotGoverningRevision.findFirst({
      where: { id: linkId, lotId: lot.id },
      select: { id: true, unlinkedAt: true },
    });
    if (!existing) throw AppError.notFound('Governing revision link');

    // Never hard-deleted — history is the product (spec §1.3(c)). Unlinking an
    // already-unlinked row is a no-op, not a second timestamp.
    const link = existing.unlinkedAt
      ? existing
      : await prisma.lotGoverningRevision.update({
          where: { id: existing.id },
          data: { unlinkedAt: new Date() },
        });

    res.json({ link });
  }),
);

export const revisionsRouter = router;
