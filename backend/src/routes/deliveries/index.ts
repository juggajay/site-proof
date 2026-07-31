/**
 * Wave C5.1 — delivery evidence
 * (`docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md` §4.4,
 * §4.4a, §7.1).
 *
 * Three read surfaces that did not exist — `Lot.diaryDeliveries` was a relation
 * with no route reading it — plus the one narrow write path the wave turns on.
 *
 * **Why the write path exists** (§4.4a, `[C5R-B2]`). Every shipped
 * `DiaryDelivery` mutation runs through `withEditableDiary` →
 * `requireEditableDiaryForWrite` (`diary/diaryAccess.ts:92-123`), which refuses
 * a diary that is `submitted` or `lockedAt`. The refusal starts the evening the
 * foreman submits — not at the 7-day auto-lock, because that path never calls
 * `isDiaryLocked` at all. The supplier's concrete docket arrives the next
 * morning. Without a path that does not take that lock, the docket can never be
 * attached and the wave's whole premise ("what material went into this lot")
 * is unanswerable at handover, months later.
 *
 * So `docketDocumentId`, `batchRef` and `lotId` are treated as EVIDENCE fields,
 * not diary content, and get one route that bypasses the diary lock and nothing
 * else. `description`, `quantity`, `unit`, `supplier` and `notes` — the
 * foreman's account of the day — stay exactly as locked as they are today
 * (`[C5S-B10]`).
 *
 * Four things narrow the bypass, and all four are load-bearing:
 *   1. a `.strict()` three-key body schema — an unknown key is a 400, not a
 *      silent diary edit. This is the inverse of the test-result exemption list
 *      (`testResults/crudRoutes.ts`), which silently widens when a field is
 *      added;
 *   2. a route-local role const that excludes viewers and portal roles;
 *   3. `requireWritable: true`, because `requireInternalProjectAccess` does NOT
 *      run the archived-project check — `assertProjectAllowsWrite` lives on the
 *      `requireEffectiveProjectRole` path;
 *   4. a HARD-FAIL `writeAuditLogInTransaction` recording `{from, to}` per field
 *      plus the diary's status and lock state at the moment of the edit. A route
 *      whose entire justification is that it edits evidence outside the normal
 *      lock cannot have a best-effort audit trail.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AuditAction, writeAuditLogInTransaction } from '../../lib/auditLog.js';
import { buildUnlinkedDeliveryItem } from '../../lib/evidenceReadiness/deliveryItems.js';
import { prisma } from '../../lib/prisma.js';
import {
  requireEffectiveProjectRole,
  requireInternalProjectAccess,
} from '../../lib/projectAccess.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { parseDiaryRouteParam, requireLotInProject } from '../diary/diaryAccess.js';

/**
 * §4.4a / §7.3. `DIARY_WRITE_ROLES` (`diary/diaryAccess.ts:19-26`) PLUS
 * `quality_manager` — the QM is the persona this wave is written for, this
 * attach action is theirs, and they are absent from `DIARY_WRITE_ROLES`. C5
 * does not widen `DIARY_WRITE_ROLES` itself: who may write diary CONTENT is a
 * diary decision, not this wave's.
 *
 * A ROUTE-LOCAL CONST in the `FOLIO_ISSUERS` / `TEST_VERIFIERS` shape, not a
 * hierarchy check — a hierarchy check silently widens the moment a role is
 * inserted into `ROLE_HIERARCHY`.
 *
 * Foreman stays in: the foreman who photographed the pour is who attaches the
 * docket that turns up next morning. Subcontractors and viewers appear nowhere
 * (DC5-3, DC5-5).
 */
export const DELIVERY_EVIDENCE_EDITORS = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
  'site_engineer',
  'foreman',
];

/** `[C3R-B1]`'s lesson: a bulk read surface is bounded at the route. */
export const DELIVERY_REGISTER_MAX_LIMIT = 200;
const DELIVERY_REGISTER_DEFAULT_LIMIT = 50;

const DELIVERY_SELECT = {
  id: true,
  diaryId: true,
  description: true,
  supplier: true,
  docketNumber: true,
  quantity: true,
  unit: true,
  notes: true,
  lotId: true,
  batchRef: true,
  docketDocumentId: true,
  createdAt: true,
  updatedAt: true,
  lot: { select: { id: true, lotNumber: true } },
  docketDocument: {
    select: { id: true, filename: true, mimeType: true, category: true, documentType: true },
  },
  diary: { select: { id: true, date: true, projectId: true, status: true } },
} as const;

// The three evidence keys, and only those three. `.strict()` is the trust
// boundary: a future `quantity` in this body is a test failure, not a silent
// diary edit (AT-184).
const EVIDENCE_FIELDS = ['docketDocumentId', 'batchRef', 'lotId'] as const;
type EvidenceField = (typeof EVIDENCE_FIELDS)[number];

const evidenceBodySchema = z
  .object({
    docketDocumentId: z.string().uuid().nullable().optional(),
    batchRef: z.string().trim().max(120).nullable().optional(),
    lotId: z.string().uuid().nullable().optional(),
  })
  .strict();

const registerQuerySchema = z.object({
  supplier: z.string().trim().min(1).max(120).optional(),
  lotId: z.string().trim().min(1).max(128).optional(),
  linked: z.enum(['linked', 'unlinked']).optional(),
  from: z.string().trim().max(64).optional(),
  to: z.string().trim().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(DELIVERY_REGISTER_MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).optional(),
});

function parseOrBadRequest<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw AppError.fromZodError(result.error);
  }
  return result.data;
}

function parseDateBoundary(value: string | undefined, field: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw AppError.badRequest(`${field} must be a valid date`);
  }
  return parsed;
}

/**
 * `diary_deliveries` has no `project_id` — every row reaches a project only
 * through `daily_diaries` — so tenancy scoping is a join, and Postgres drives
 * from the diary side using the `diary_id`-leading index that
 * `@@unique([diaryId, requestKey])` yields.
 */
function buildRegisterWhere(projectId: string, query: z.infer<typeof registerQuerySchema>) {
  const from = parseDateBoundary(query.from, 'from');
  const to = parseDateBoundary(query.to, 'to');
  const dateRange = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  const lotFilter =
    query.linked === 'unlinked' ? null : query.linked === 'linked' ? { not: null } : query.lotId;

  return {
    diary: {
      projectId,
      ...(from || to ? { date: dateRange } : {}),
    },
    ...(query.supplier
      ? { supplier: { contains: query.supplier, mode: 'insensitive' as const } }
      : {}),
    ...(lotFilter !== undefined ? { lotId: lotFilter } : {}),
  };
}

// ---------------------------------------------------------------------------
// GET /api/lots/:lotId/deliveries — mounted at `/api/lots`
// ---------------------------------------------------------------------------

export const lotDeliveriesRouter = Router();
lotDeliveriesRouter.use(requireAuth);

lotDeliveriesRouter.get(
  '/:lotId/deliveries',
  asyncHandler(async (req: Request, res: Response) => {
    const lotId = parseDiaryRouteParam(req.params.lotId, 'lotId');

    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      select: { id: true, projectId: true },
    });
    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireInternalProjectAccess(req.user!, lot.projectId);

    const deliveries = await prisma.diaryDelivery.findMany({
      where: { lotId: lot.id },
      select: DELIVERY_SELECT,
      orderBy: [{ createdAt: 'desc' }],
      take: DELIVERY_REGISTER_MAX_LIMIT,
    });

    res.json({ deliveries });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/projects/:projectId/deliveries — mounted at `/api/projects`
// ---------------------------------------------------------------------------

export const projectDeliveriesRouter = Router();
projectDeliveriesRouter.use(requireAuth);

projectDeliveriesRouter.get(
  '/:projectId/deliveries',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseDiaryRouteParam(req.params.projectId, 'projectId');
    await requireInternalProjectAccess(req.user!, projectId);

    const query = parseOrBadRequest(registerQuerySchema, req.query);
    const limit = query.limit ?? DELIVERY_REGISTER_DEFAULT_LIMIT;
    const offset = query.offset ?? 0;

    const where = buildRegisterWhere(projectId, query);

    const [deliveries, total, unlinkedCount] = await Promise.all([
      prisma.diaryDelivery.findMany({
        where,
        select: DELIVERY_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: limit,
        skip: offset,
      }),
      prisma.diaryDelivery.count({ where }),
      prisma.diaryDelivery.count({ where: { diary: { projectId }, lotId: null } }),
    ]);

    const unlinkedItem = buildUnlinkedDeliveryItem(unlinkedCount);

    res.json({
      deliveries,
      total,
      limit,
      offset,
      hasMore: offset + deliveries.length < total,
      unlinkedCount,
      readiness: unlinkedItem ? [unlinkedItem] : [],
    });
  }),
);

// ---------------------------------------------------------------------------
// PATCH /api/deliveries/:deliveryId/evidence — mounted at `/api/deliveries`
// ---------------------------------------------------------------------------

export const deliveriesRouter = Router();
deliveriesRouter.use(requireAuth);

deliveriesRouter.patch(
  '/:deliveryId/evidence',
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const deliveryId = parseDiaryRouteParam(req.params.deliveryId, 'deliveryId');
    const body = parseOrBadRequest(evidenceBodySchema, req.body);

    const providedKeys = Object.keys(body) as Array<keyof typeof body>;
    if (providedKeys.length === 0) {
      throw AppError.badRequest('Provide at least one of docketDocumentId, batchRef or lotId');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const delivery = await tx.diaryDelivery.findUnique({
        where: { id: deliveryId },
        select: {
          id: true,
          lotId: true,
          docketDocumentId: true,
          batchRef: true,
          diary: { select: { id: true, projectId: true, status: true, lockedAt: true } },
        },
      });
      if (!delivery) {
        throw AppError.notFound('Delivery entry');
      }

      const { projectId, status: diaryStatus, lockedAt: diaryLockedAt } = delivery.diary;

      await requireEffectiveProjectRole(
        user,
        projectId,
        DELIVERY_EVIDENCE_EDITORS,
        'You do not have permission to edit delivery evidence for this project',
        { client: tx, excludeSubcontractorProjectMemberships: true, requireWritable: true },
      );

      // Both directions of the row-to-lot binding (§8). Without these,
      // `diary_deliveries` could point at another project's lot or another
      // project's document and reach that lot's issued folio.
      if (body.lotId) {
        await requireLotInProject(body.lotId, projectId, tx);
      }
      if (body.docketDocumentId) {
        const document = await tx.document.findFirst({
          where: { id: body.docketDocumentId, projectId },
          select: { id: true },
        });
        if (!document) {
          throw AppError.badRequest('Document does not belong to this project');
        }
      }

      const data: Partial<Record<EvidenceField, string | null>> = {};
      const changes: Record<string, unknown> = {
        // The edit deliberately bypassed the diary lock, so record the lock
        // state: this is the control that makes the bypass legible in the audit
        // log rather than invisible.
        diaryStatus,
        diaryLockedAt,
      };

      for (const field of EVIDENCE_FIELDS) {
        if (!(field in body)) {
          continue;
        }
        const next = body[field] ?? null;
        data[field] = next;
        changes[field] = { from: delivery[field], to: next };
      }

      // Concurrent delete (only possible while the diary is still draft) → 404,
      // with nothing partially written: it is all one transaction.
      const result = await tx.diaryDelivery.updateMany({ where: { id: deliveryId }, data });
      if (result.count === 0) {
        throw AppError.notFound('Delivery entry');
      }

      await writeAuditLogInTransaction(tx, {
        projectId,
        userId: user.id,
        entityType: 'diary_delivery',
        entityId: delivery.id,
        action: AuditAction.DELIVERY_EVIDENCE_UPDATED,
        changes,
      });

      return tx.diaryDelivery.findUnique({ where: { id: deliveryId }, select: DELIVERY_SELECT });
    });

    res.json(updated);
  }),
);
