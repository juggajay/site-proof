/**
 * Wave C5.2 — the survey record's routes.
 * (`docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md` §4.5,
 * §7.1, §7.3, §8.)
 *
 * **CIVOS records a verdict; it never makes one** `[C5S-B1]`. Nothing here
 * computes, derives or infers a conformance result. `surveyorVerdict` is
 * transcribed from the report and every read surface is expected to render it
 * attributed — *"Surveyor's verdict: conforms — J. Smith, per report rev B"* —
 * never as a bare status chip that reads like CIVOS's own finding.
 *
 * The DB carries the invariants a route cannot be trusted with: the three
 * vocabularies, acceptance-requires-an-actor, acceptance-requires-a-verdict and
 * no self-supersession are all `CHECK` constraints (§5.2), asserted by raw SQL
 * in AT-172 because a route-level test of a `CHECK` proves nothing about the
 * `CHECK`. What lives here is what a constraint cannot see: the previous row
 * (the transition map), a join (the supersession identity checks) and the
 * report gate.
 *
 * Everything is behind `C5_SURVEY_RECORDS_ENABLED`, fail-closed: absent ⇒ off.
 * The five state names encode a claim about how a real job runs that no pilot
 * has confirmed, so they stay dark until one real conformance survey has
 * round-tripped `[C5S-B4]`.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AuditAction, writeAuditLogInTransaction } from '../../lib/auditLog.js';
import { buildSurveyNotAcceptedItem } from '../../lib/evidenceReadiness/surveyItems.js';
import { prisma } from '../../lib/prisma.js';
import { parseOrBadRequest } from '../../lib/zodParse.js';
import {
  requireEffectiveProjectRole,
  requireInternalProjectAccess,
} from '../../lib/projectAccess.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { parseDiaryRouteParam, requireLotInProject } from '../diary/diaryAccess.js';
import {
  NON_SUBSTANTIVE_SURVEY_EDIT_FIELDS,
  SURVEY_KINDS,
  SURVEY_STATUSES,
  SURVEY_STATUSES_REQUIRING_REPORT,
  SURVEY_TERMINAL_STATUSES,
  SURVEY_VERDICTS,
  VALID_SURVEY_TRANSITIONS,
  surveyRecordsEnabled,
} from './statusWorkflow.js';

/**
 * Route-local const arrays in the `FOLIO_ISSUERS` shape, not hierarchy checks.
 *
 * Foreman is deliberately absent from both — consistent with the shipped rule
 * that a foreman is not a lot setup manager. A foreman IS a delivery actor
 * (C5.1), because that is what a foreman already does today.
 *
 * Subcontractors appear in neither and are 403 on every C5 surface (DC5-3): a
 * survey record names a certifier and carries a verdict about a subcontractor's
 * own work, which has contractual weight and no pilot has asked for it. It is a
 * one-line change to add later and an unretractable disclosure to add now.
 */
export const SURVEY_CREATORS = [
  'owner',
  'admin',
  'project_manager',
  'site_engineer',
  'quality_manager',
];
export const SURVEY_ACCEPTORS = ['owner', 'admin', 'project_manager', 'quality_manager'];

export const SURVEY_REGISTER_MAX_LIMIT = 200;
const SURVEY_REGISTER_DEFAULT_LIMIT = 50;

const SURVEY_SELECT = {
  id: true,
  projectId: true,
  lotId: true,
  kind: true,
  status: true,
  requestedById: true,
  requestedAt: true,
  surveyorName: true,
  surveyorCompany: true,
  surveyorRegistration: true,
  surveyedAt: true,
  reportDocumentId: true,
  surveyorVerdict: true,
  verdictSourceNote: true,
  reviewedById: true,
  reviewedAt: true,
  acceptedById: true,
  acceptedAt: true,
  rejectionReason: true,
  supersededById: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  lot: { select: { id: true, lotNumber: true } },
  reportDocument: { select: { id: true, filename: true, mimeType: true } },
  requestedBy: { select: { id: true, fullName: true } },
  reviewedBy: { select: { id: true, fullName: true } },
  acceptedBy: { select: { id: true, fullName: true } },
} as const;

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

// Deliberately absent from every body: any coordinate, level, deviation or
// tolerance field. AT-172 asserts by grep that no such identifier exists here.
const surveyBodyShape = {
  surveyorName: optionalText(200),
  surveyorCompany: optionalText(200),
  surveyorRegistration: optionalText(120),
  surveyedAt: z.string().datetime().nullable().optional(),
  surveyorVerdict: z
    .enum(SURVEY_VERDICTS as [string, ...string[]])
    .nullable()
    .optional(),
  verdictSourceNote: optionalText(500),
  notes: optionalText(2000),
};

const createSurveySchema = z
  .object({
    kind: z.enum(SURVEY_KINDS as [string, ...string[]]),
    // `[C5R-A2]`: creation at an explicit non-default status, subject to the
    // same gates. A user filing one PDF must not click three buttons.
    status: z.enum(SURVEY_STATUSES as [string, ...string[]]).optional(),
    reportDocumentId: z.string().uuid().nullable().optional(),
    ...surveyBodyShape,
  })
  .strict();

const patchSurveySchema = z
  .object({
    lotId: z.string().uuid().nullable().optional(),
    ...surveyBodyShape,
  })
  .strict();

const statusSchema = z
  .object({
    status: z.enum(SURVEY_STATUSES as [string, ...string[]]),
    rejectionReason: optionalText(1000),
  })
  .strict();

const reportSchema = z.object({ documentId: z.string().uuid() }).strict();
const supersedeSchema = z.object({ supersededById: z.string().uuid() }).strict();

const registerQuerySchema = z.object({
  status: z.enum(SURVEY_STATUSES as [string, ...string[]]).optional(),
  kind: z.enum(SURVEY_KINDS as [string, ...string[]]).optional(),
  lotId: z.string().trim().min(1).max(128).optional(),
  includeSuperseded: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(SURVEY_REGISTER_MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).optional(),
});

/**
 * Fail-closed: with the flag off, no C5.2 route exists at all.
 *
 * PER-ROUTE, never `router.use(...)`. A router-level `use` runs for EVERY
 * request routed into the mount path, not only the paths this router declares —
 * so mounting it at `/api/lots` and refusing router-wide would 404 the entire
 * lots API whenever the flag is off. Caught by the E2E suite, and pinned by the
 * `createServerApp` test in `surveyFlagMounting.db.test.ts`.
 */
function requireSurveyFlag(_req: Request, _res: Response, next: (err?: unknown) => void) {
  if (!surveyRecordsEnabled()) {
    next(AppError.notFound('Survey records'));
    return;
  }
  next();
}

type SurveyMutationTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * The report gate — the analogue of C2's `CERTIFICATE_REQUIRED`, and route-level
 * for the same reason C2's is: a `CHECK` cannot see the row being replaced.
 */
function assertReportPresentFor(status: string, reportDocumentId: string | null): void {
  if (SURVEY_STATUSES_REQUIRING_REPORT.has(status) && !reportDocumentId) {
    throw new AppError(
      400,
      'A survey report must be attached before the survey can be recorded as received.',
      'SURVEY_REPORT_REQUIRED',
    );
  }
}

/**
 * `[C5S-B1]`, at the route. The DB refuses an accepted row without an actor and
 * a verdict; this refuses it earlier and says why. "A human looked" is the
 * requirement — `'not_stated'` is a legitimate verdict.
 */
function assertAcceptable(record: { surveyorName: string | null; surveyorVerdict: string | null }) {
  if (!record.surveyorName) {
    throw AppError.badRequest(
      'A survey cannot be accepted without the surveyor who performed it.',
      { code: 'SURVEYOR_REQUIRED' },
    );
  }
  if (!record.surveyorVerdict) {
    throw AppError.badRequest(
      "A survey cannot be accepted without the surveyor's stated verdict (use 'not_stated' if the report gave none).",
      { code: 'SURVEYOR_VERDICT_REQUIRED' },
    );
  }
}

/**
 * Creating at a non-default status must pass exactly the gates the transition
 * route applies — otherwise the short path [C5R-A2] opens is a hole around the
 * report requirement, the acceptor role set and [C5S-B1].
 */
async function assertCreationGates(
  tx: SurveyMutationTx,
  user: { id: string },
  projectId: string,
  status: string,
  reportDocumentId: string | null,
  body: { surveyorName?: string | null; surveyorVerdict?: string | null },
): Promise<void> {
  if (SURVEY_TERMINAL_STATUSES.has(status)) {
    await requireEffectiveProjectRole(
      user,
      projectId,
      SURVEY_ACCEPTORS,
      'You do not have permission to accept or reject surveys',
      { client: tx, excludeSubcontractorProjectMemberships: true, requireWritable: true },
    );
  }
  if (reportDocumentId) {
    await assertDocumentInProject(tx, reportDocumentId, projectId);
  }
  assertReportPresentFor(status, reportDocumentId);
  if (status === 'accepted') {
    assertAcceptable({
      surveyorName: body.surveyorName ?? null,
      surveyorVerdict: body.surveyorVerdict ?? null,
    });
  }
}

/**
 * Who did it and when, stamped by the state being entered. `accepted_by` and
 * `accepted_at` are not decoration: the DB refuses an accepted row without both
 * (`survey_records_accepted_requires_actor_check`).
 */
function statusStamp(
  status: string,
  userId: string,
  rejectionReason: string | null,
): Record<string, unknown> {
  const now = new Date();
  if (status === 'received') return { reviewedById: userId, reviewedAt: now };
  if (status === 'accepted') return { acceptedById: userId, acceptedAt: now };
  if (status === 'rejected') return { rejectionReason };
  return {};
}

/** An accepted record is closed to everything but the non-substantive list. */
function assertEditableWhenAccepted(status: string, providedKeys: string[]): void {
  if (status !== 'accepted') {
    return;
  }
  const substantive = providedKeys.filter(
    (key) => !NON_SUBSTANTIVE_SURVEY_EDIT_FIELDS.includes(key),
  );
  if (substantive.length > 0) {
    throw AppError.badRequest('An accepted survey record cannot be edited.', {
      code: 'SURVEY_ACCEPTED_IMMUTABLE',
      fields: substantive,
    });
  }
}

function toDateOrNull(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

/**
 * The optional attribution and verdict fields, normalised to explicit nulls in
 * one place. Absent and explicitly-null mean the same thing on a create: "not
 * recorded" — a first-class state here, never a gap to backfill.
 */
const SURVEY_OPTIONAL_TEXT_FIELDS = [
  'surveyorName',
  'surveyorCompany',
  'surveyorRegistration',
  'surveyorVerdict',
  'verdictSourceNote',
  'notes',
] as const;

function normalizeSurveyFields(body: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const field of SURVEY_OPTIONAL_TEXT_FIELDS) {
    normalized[field] = body[field] ?? null;
  }
  normalized.surveyedAt = toDateOrNull(body.surveyedAt as string | null | undefined) ?? null;
  return normalized;
}

async function loadSurveyOr404(tx: SurveyMutationTx | typeof prisma, id: string) {
  const record = await tx.surveyRecord.findUnique({
    where: { id },
    select: {
      id: true,
      projectId: true,
      lotId: true,
      kind: true,
      status: true,
      surveyorName: true,
      surveyorVerdict: true,
      reportDocumentId: true,
      supersededById: true,
    },
  });
  if (!record) {
    throw AppError.notFound('Survey record');
  }
  return record;
}

async function auditSurvey(
  tx: SurveyMutationTx,
  record: { id: string; projectId: string },
  userId: string,
  action: string,
  changes: Record<string, unknown>,
) {
  await writeAuditLogInTransaction(tx, {
    projectId: record.projectId,
    userId,
    entityType: 'survey_record',
    entityId: record.id,
    action,
    changes,
  });
}

// ---------------------------------------------------------------------------
// /api/lots — POST /:lotId/surveys, GET /:lotId/surveys
// ---------------------------------------------------------------------------

export const lotSurveysRouter = Router();
lotSurveysRouter.use(requireAuth);

lotSurveysRouter.post(
  '/:lotId/surveys',
  requireSurveyFlag,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const lotId = parseDiaryRouteParam(req.params.lotId, 'lotId');
    const body = parseOrBadRequest(createSurveySchema, req.body);

    const created = await prisma.$transaction(async (tx) => {
      const lot = await tx.lot.findUnique({
        where: { id: lotId },
        select: { id: true, projectId: true },
      });
      if (!lot) {
        throw AppError.notFound('Lot');
      }

      // `[C5R-A4]`: `project_id` is DERIVED FROM THE LOT and never read from the
      // body. Without this, `survey_records` carries a project and a lot with
      // nothing tying them, and another project's survey could reach a lot's
      // issued folio.
      const projectId = lot.projectId;

      await requireEffectiveProjectRole(
        user,
        projectId,
        SURVEY_CREATORS,
        'You do not have permission to record surveys for this project',
        { client: tx, excludeSubcontractorProjectMemberships: true, requireWritable: true },
      );

      const status = body.status ?? 'requested';
      const reportDocumentId = body.reportDocumentId ?? null;
      await assertCreationGates(tx, user, projectId, status, reportDocumentId, body);

      const record = await tx.surveyRecord.create({
        data: {
          ...normalizeSurveyFields(body),
          projectId,
          lotId: lot.id,
          kind: body.kind,
          status,
          requestedById: user.id,
          requestedAt: new Date(),
          reportDocumentId,
          ...statusStamp(status, user.id, null),
        },
        select: SURVEY_SELECT,
      });

      await auditSurvey(tx, record, user.id, AuditAction.SURVEY_RECORD_CREATED, {
        kind: record.kind,
        status: record.status,
        lotId: record.lotId,
      });

      return record;
    });

    res.status(201).json(created);
  }),
);

lotSurveysRouter.get(
  '/:lotId/surveys',
  requireSurveyFlag,
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

    const surveys = await prisma.surveyRecord.findMany({
      // Reads default to the current revision — the `Drawing` convention.
      where: { lotId: lot.id, supersededById: null },
      select: SURVEY_SELECT,
      orderBy: [{ createdAt: 'desc' }],
      take: SURVEY_REGISTER_MAX_LIMIT,
    });

    const notAccepted = surveys.filter((survey) => survey.status !== 'accepted').length;
    const item = buildSurveyNotAcceptedItem(notAccepted);

    res.json({ surveys, readiness: item ? [item] : [] });
  }),
);

// ---------------------------------------------------------------------------
// /api/projects — GET /:projectId/surveys
// ---------------------------------------------------------------------------

export const projectSurveysRouter = Router();
projectSurveysRouter.use(requireAuth);

projectSurveysRouter.get(
  '/:projectId/surveys',
  requireSurveyFlag,
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseDiaryRouteParam(req.params.projectId, 'projectId');
    await requireInternalProjectAccess(req.user!, projectId);

    const query = parseOrBadRequest(registerQuerySchema, req.query);
    const limit = query.limit ?? SURVEY_REGISTER_DEFAULT_LIMIT;
    const offset = query.offset ?? 0;

    const where = {
      projectId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.lotId ? { lotId: query.lotId } : {}),
      ...(query.includeSuperseded === 'true' ? {} : { supersededById: null }),
    };

    const [surveys, total] = await Promise.all([
      prisma.surveyRecord.findMany({
        where,
        select: SURVEY_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: limit,
        skip: offset,
      }),
      prisma.surveyRecord.count({ where }),
    ]);

    res.json({
      surveys,
      total,
      limit,
      offset,
      hasMore: offset + surveys.length < total,
    });
  }),
);

// ---------------------------------------------------------------------------
// /api/surveys — GET /:id, PATCH /:id, POST /:id/status, /report, /supersede
// ---------------------------------------------------------------------------

export const surveysRouter = Router();
surveysRouter.use(requireAuth);

async function assertDocumentInProject(
  tx: SurveyMutationTx,
  documentId: string,
  projectId: string,
): Promise<void> {
  const document = await tx.document.findFirst({
    where: { id: documentId, projectId },
    select: { id: true },
  });
  if (!document) {
    throw AppError.badRequest('Document does not belong to this project');
  }
}

/**
 * `[C5R-A5]`, the null-lot rule. There is deliberately no LOT-scoped by-id
 * route, so there is no second hop for `assertBelongsToLot` to guard: the row
 * is loaded by its own id and authorised against its OWN `projectId`, which is
 * derived from the lot at write time and re-validated on every lot change.
 * A record with `lot_id IS NULL` is therefore legitimately returned here and by
 * the project register, and is simply absent from the lot-scoped list.
 */
surveysRouter.get(
  '/:surveyId',
  requireSurveyFlag,
  asyncHandler(async (req: Request, res: Response) => {
    const surveyId = parseDiaryRouteParam(req.params.surveyId, 'surveyId');
    const record = await prisma.surveyRecord.findUnique({
      where: { id: surveyId },
      select: SURVEY_SELECT,
    });
    if (!record) {
      throw AppError.notFound('Survey record');
    }
    await requireInternalProjectAccess(req.user!, record.projectId);
    res.json(record);
  }),
);

surveysRouter.patch(
  '/:surveyId',
  requireSurveyFlag,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const surveyId = parseDiaryRouteParam(req.params.surveyId, 'surveyId');
    const body = parseOrBadRequest(patchSurveySchema, req.body);
    const providedKeys = Object.keys(body);
    if (providedKeys.length === 0) {
      throw AppError.badRequest('Provide at least one field to update');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const record = await loadSurveyOr404(tx, surveyId);
      await requireEffectiveProjectRole(
        user,
        record.projectId,
        SURVEY_CREATORS,
        'You do not have permission to edit surveys for this project',
        { client: tx, excludeSubcontractorProjectMemberships: true, requireWritable: true },
      );

      assertEditableWhenAccepted(record.status, providedKeys);

      // `[C5R-A4]`, write side: a changed lot is re-validated against the
      // record's own project.
      if (body.lotId) {
        await requireLotInProject(body.lotId, record.projectId, tx);
      }

      const data: Record<string, unknown> = {};
      const changes: Record<string, unknown> = {};
      for (const key of providedKeys) {
        const next =
          key === 'surveyedAt'
            ? (toDateOrNull(body.surveyedAt) ?? null)
            : ((body as Record<string, unknown>)[key] ?? null);
        data[key] = next;
        changes[key] = next;
      }

      const next = await tx.surveyRecord.update({
        where: { id: surveyId },
        data,
        select: SURVEY_SELECT,
      });
      await auditSurvey(tx, record, user.id, AuditAction.SURVEY_RECORD_UPDATED, changes);
      return next;
    });

    res.json(updated);
  }),
);

surveysRouter.post(
  '/:surveyId/report',
  requireSurveyFlag,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const surveyId = parseDiaryRouteParam(req.params.surveyId, 'surveyId');
    // `[C5R-A6]`: `{ documentId }`, NOT a file. C5 adds no upload route and no
    // thirteenth multer config — the report is uploaded through the shipped
    // document path, which already runs magic-byte validation.
    const { documentId } = parseOrBadRequest(reportSchema, req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const record = await loadSurveyOr404(tx, surveyId);
      await requireEffectiveProjectRole(
        user,
        record.projectId,
        SURVEY_CREATORS,
        'You do not have permission to edit surveys for this project',
        { client: tx, excludeSubcontractorProjectMemberships: true, requireWritable: true },
      );
      assertEditableWhenAccepted(record.status, ['reportDocumentId']);
      await assertDocumentInProject(tx, documentId, record.projectId);

      const next = await tx.surveyRecord.update({
        where: { id: surveyId },
        data: { reportDocumentId: documentId },
        select: SURVEY_SELECT,
      });
      await auditSurvey(tx, record, user.id, AuditAction.SURVEY_RECORD_UPDATED, {
        reportDocumentId: { from: record.reportDocumentId, to: documentId },
      });
      return next;
    });

    res.json(updated);
  }),
);

surveysRouter.post(
  '/:surveyId/status',
  requireSurveyFlag,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const surveyId = parseDiaryRouteParam(req.params.surveyId, 'surveyId');
    const { status, rejectionReason } = parseOrBadRequest(statusSchema, req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const record = await loadSurveyOr404(tx, surveyId);

      // The split at `testResults/workflowRoutes.ts`: acceptance and rejection
      // need the higher set, everything else the creator set.
      const decisive = status === 'accepted' || status === 'rejected';
      await requireEffectiveProjectRole(
        user,
        record.projectId,
        decisive ? SURVEY_ACCEPTORS : SURVEY_CREATORS,
        decisive
          ? 'You do not have permission to accept or reject surveys'
          : 'You do not have permission to update survey status',
        { client: tx, excludeSubcontractorProjectMemberships: true, requireWritable: true },
      );

      const allowed = VALID_SURVEY_TRANSITIONS[record.status] ?? [];
      if (!allowed.includes(status)) {
        throw AppError.badRequest(`Cannot move a survey from ${record.status} to ${status}`, {
          code: 'INVALID_SURVEY_TRANSITION',
          from: record.status,
          allowedTransitions: allowed,
        });
      }

      assertReportPresentFor(status, record.reportDocumentId);
      if (status === 'accepted') {
        assertAcceptable(record);
      }

      const next = await tx.surveyRecord.update({
        where: { id: surveyId },
        data: { status, ...statusStamp(status, user.id, rejectionReason ?? null) },
        select: SURVEY_SELECT,
      });

      await auditSurvey(tx, record, user.id, AuditAction.SURVEY_RECORD_STATUS_CHANGED, {
        status: { from: record.status, to: status },
        rejectionReason: rejectionReason ?? null,
      });
      return next;
    });

    res.json(updated);
  }),
);

surveysRouter.post(
  '/:surveyId/supersede',
  requireSurveyFlag,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const surveyId = parseDiaryRouteParam(req.params.surveyId, 'surveyId');
    const { supersededById } = parseOrBadRequest(supersedeSchema, req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const record = await loadSurveyOr404(tx, surveyId);
      await requireEffectiveProjectRole(
        user,
        record.projectId,
        SURVEY_ACCEPTORS,
        'You do not have permission to supersede surveys for this project',
        { client: tx, excludeSubcontractorProjectMemberships: true, requireWritable: true },
      );

      if (record.supersededById) {
        throw AppError.badRequest('Only the current survey revision can be superseded');
      }
      await assertSupersedingSurvey(tx, record, supersededById);

      const next = await tx.surveyRecord.update({
        where: { id: surveyId },
        data: { supersededById },
        select: SURVEY_SELECT,
      });
      await auditSurvey(tx, record, user.id, AuditAction.SURVEY_RECORD_SUPERSEDED, {
        supersededById: { from: null, to: supersededById },
      });
      return next;
    });

    res.json(updated);
  }),
);

/**
 * `[C5R-A3]` — FIVE checks, not three.
 *
 * `Drawing`'s guard is meaningful because of its `drawingNumber` comparison:
 * the chain is scoped to one drawing IDENTITY. `SurveyRecord` has no identity
 * column — no `surveyNumber`, no reference — so a not-self / same-project /
 * target-current guard alone would let a `set_out` record on lot A supersede a
 * `conformance` record on lot B. `(lot_id, kind)` IS the identity here; a
 * nullable free-text reference column was considered and rejected because it
 * would be empty on every real record.
 */
async function assertSupersedingSurvey(
  tx: SurveyMutationTx,
  record: { id: string; projectId: string; lotId: string | null; kind: string },
  supersededById: string,
): Promise<void> {
  if (supersededById === record.id) {
    throw AppError.badRequest('supersededById must reference another survey record');
  }

  const superseding = await tx.surveyRecord.findFirst({
    where: { id: supersededById, projectId: record.projectId },
    select: { id: true, lotId: true, kind: true, supersededById: true },
  });
  if (!superseding) {
    throw AppError.badRequest('supersededById must reference a survey in the same project');
  }
  if (superseding.lotId !== record.lotId) {
    throw AppError.badRequest('supersededById must reference a survey on the same lot');
  }
  if (superseding.kind !== record.kind) {
    throw AppError.badRequest('supersededById must reference a survey of the same kind');
  }
  if (superseding.supersededById) {
    throw AppError.badRequest('supersededById must reference a current survey revision');
  }
}
