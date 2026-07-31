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
 * **CIVOS records RECEIPT; it never accepts** (2026-07-31 restructure,
 * `docs/research/c5-surveyor-workflow-practice-2026-07-31.md` §4). There is no
 * accept route here and there is no accepted state, because acceptance in AU
 * civil is the hold-point release and the lot conformance — machinery CIVOS
 * already ships, which consumes this record as its evidence. A survey deemed
 * defective is `returned_for_correction` with a reason, and the corrected report
 * is a NEW record that supersedes it.
 *
 * The DB carries the invariants a route cannot be trusted with: the three
 * vocabularies, return-requires-a-reason, the receipt-actor pairing and no
 * self-supersession are all `CHECK` constraints (§5.2), asserted by raw SQL
 * in AT-172 because a route-level test of a `CHECK` proves nothing about the
 * `CHECK`. What lives here is what a constraint cannot see: the previous row
 * (the transition map), a join (the supersession identity checks), the report
 * gate and the surveyor gate.
 *
 * Everything is behind `C5_SURVEY_RECORDS_ENABLED`, fail-closed: absent ⇒ off.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AuditAction, writeAuditLogInTransaction } from '../../lib/auditLog.js';
import { buildSurveyNotReceivedItem } from '../../lib/evidenceReadiness/surveyItems.js';
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
  SURVEY_STATUSES_REQUIRING_SURVEYOR,
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

/**
 * The narrower set, for the two acts that judge a third party's deliverable:
 * returning it for correction, and superseding a record with a new revision.
 *
 * Named for what it does now that nothing here accepts. Recording RECEIPT is
 * not in this set — it is a filing act, and the party who does it is the
 * site/project engineer who requested the survey: MRWA routes the result back to
 * *"the Main Roads officer that requested the survey"*, and six independent AU
 * job ads put survey coordination in the site engineer's duty list while zero of
 * ~40 put it in a foreman's (research §1.3, §1.9).
 *
 * The return is the Project Manager's act in the published text — *"Any errors,
 * deficiencies or ambiguities identified by the Project Manager shall be
 * referred back to the Surveyor responsible for correction"* (TMR Surveying
 * Standards Part 1 §7.6.4).
 */
export const SURVEY_DECIDERS = ['owner', 'admin', 'project_manager', 'quality_manager'];

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
  receivedById: true,
  receivedAt: true,
  returnReason: true,
  supersededById: true,
  supersessionReason: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  lot: { select: { id: true, lotNumber: true } },
  reportDocument: { select: { id: true, filename: true, mimeType: true } },
  requestedBy: { select: { id: true, fullName: true } },
  receivedBy: { select: { id: true, fullName: true } },
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
    // Filing a record that already came back from the surveyor is a real
    // retrospective case, and the state is worthless without its reason.
    returnReason: optionalText(1000),
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
    returnReason: optionalText(1000),
  })
  .strict();

const reportSchema = z.object({ documentId: z.string().uuid() }).strict();
/**
 * Wave C5-c: `reason` is optional and free text. Optional because C5.2 shipped
 * without it and a required field would refuse every client that has not been
 * redeployed; free text because "why this survey was redone" has no vocabulary
 * short of inventing one.
 */
const supersedeSchema = z
  .object({ supersededById: z.string().uuid(), reason: optionalText(1000) })
  .strict();

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
      'A survey report must be attached before the survey can be recorded as received or returned for correction.',
      'SURVEY_REPORT_REQUIRED',
    );
  }
}

/**
 * The surveyor gate, inherited from the deleted `accepted` gate.
 *
 * The certifying party on an AU conformance report is the surveyor and nobody
 * else — the real artifact's signature block is `Surveyor / Date / Signature`,
 * and certification is registration-gated in every AU jurisdiction captured
 * (research §4.1). A report filed as arrived under nobody's name is not
 * evidence, so the name is required at `received`.
 *
 * The VERDICT is deliberately not required with it. `accepted` demanded one
 * because acceptance was a judgement that needed something to be a judgement
 * ABOUT; receipt is not. The one real conformance report in the corpus was 20%
 * within tolerance and 70% too high — a trim instruction, not a verdict
 * (research §3.3) — so demanding a verdict at arrival would push a transcriber
 * to invent one.
 */
function assertAttributable(status: string, surveyorName: string | null): void {
  if (SURVEY_STATUSES_REQUIRING_SURVEYOR.has(status) && !surveyorName) {
    throw AppError.badRequest(
      'Record the surveyor who performed the survey before filing their report.',
      { code: 'SURVEYOR_REQUIRED' },
    );
  }
}

/**
 * The return reason, at the route. The DB refuses a reasonless return; this
 * refuses it earlier and says why.
 *
 * Six distinct return triggers are evidenced — format, wrong method for the
 * specified accuracy, missing coverage, wrong datum, wrong design surface,
 * content mismatch — and each demands a different fix from the surveyor, who
 * has one business day to action it (research §5.3, §5.6). "Returned" with no
 * reason is a message that cannot be acted on.
 */
/**
 * The transition map, plus the two things it cannot say on its own.
 *
 * A superseded record is history: its state is what it was when it was
 * replaced, and moving it would rewrite what the successor was written against.
 *
 * And the map's one dead end is not a dead end in the WORKFLOW. The AU idiom for
 * a redo is a new, cross-referenced artifact (MRTS50 cl. 7.2), so the corrected
 * report is a new record that supersedes this one. A bare "no transitions
 * allowed" would read as "this record is finished", which it is not — hence the
 * hint.
 */
function assertTransitionAllowed(
  record: { status: string; supersededById: string | null },
  status: string,
): void {
  if (record.supersededById) {
    throw AppError.badRequest('A superseded survey record cannot change state.', {
      code: 'SURVEY_SUPERSEDED_IMMUTABLE',
    });
  }

  const allowed = VALID_SURVEY_TRANSITIONS[record.status] ?? [];
  if (allowed.includes(status)) {
    return;
  }

  throw AppError.badRequest(`Cannot move a survey from ${record.status} to ${status}`, {
    code: 'INVALID_SURVEY_TRANSITION',
    from: record.status,
    allowedTransitions: allowed,
    ...(record.status === 'returned_for_correction'
      ? { hint: 'File the corrected report as a new survey record and supersede this one.' }
      : {}),
  });
}

function assertReturnReason(status: string, returnReason: string | null): void {
  if (status === 'returned_for_correction' && !returnReason?.trim()) {
    throw AppError.badRequest(
      'Say what has to be corrected — the surveyor is being asked to fix something specific.',
      { code: 'SURVEY_RETURN_REASON_REQUIRED' },
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
  body: { surveyorName?: string | null; returnReason?: string | null },
): Promise<void> {
  if (status === 'returned_for_correction') {
    await requireEffectiveProjectRole(
      user,
      projectId,
      SURVEY_DECIDERS,
      'You do not have permission to return surveys for correction',
      { client: tx, excludeSubcontractorProjectMemberships: true, requireWritable: true },
    );
  }
  if (reportDocumentId) {
    await assertDocumentInProject(tx, reportDocumentId, projectId);
  }
  assertReportPresentFor(status, reportDocumentId);
  assertAttributable(status, body.surveyorName ?? null);
  assertReturnReason(status, body.returnReason ?? null);
}

/**
 * Who did it and when, stamped by the state being entered. `received_by` and
 * `received_at` move together or not at all
 * (`survey_records_received_actor_check`), and a return carries its reason.
 */
function statusStamp(
  status: string,
  userId: string,
  returnReason: string | null,
): Record<string, unknown> {
  const now = new Date();
  if (status === 'received') return { receivedById: userId, receivedAt: now };
  if (status === 'returned_for_correction') return { returnReason };
  return {};
}

/**
 * A SUPERSEDED record is closed to everything but the non-substantive list.
 *
 * This is where the immutability rule lives now that nothing is accepted, and
 * it is aimed at the right row: a superseded record is the evidence that the
 * first result was wrong, and the record that replaced it was written against
 * exactly what this one says. C5.2 froze `accepted` records and left superseded
 * ones editable, which had it backwards — the history was the mutable half.
 *
 * The CURRENT record stays editable in every state. Correcting a mistyped
 * surveyor name on a live record is filing hygiene; changing what a record said
 * after another record replaced it is rewriting history.
 */
function assertEditableWhenSuperseded(supersededById: string | null, providedKeys: string[]): void {
  if (!supersededById) {
    return;
  }
  const substantive = providedKeys.filter(
    (key) => !NON_SUBSTANTIVE_SURVEY_EDIT_FIELDS.includes(key),
  );
  if (substantive.length > 0) {
    throw AppError.badRequest('A superseded survey record cannot be edited.', {
      code: 'SURVEY_SUPERSEDED_IMMUTABLE',
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
          // Who filed it, always — it is what the folio's attribution falls back
          // to. WHEN it was requested, only if it was: a record created straight
          // at `received` is the retrospective case the short path exists for
          // (research §1.5 — the contractual trigger is a lot state, not a
          // person), and stamping a request date on it invents a request.
          requestedById: user.id,
          requestedAt: status === 'requested' ? new Date() : null,
          reportDocumentId,
          ...statusStamp(status, user.id, body.returnReason ?? null),
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

    // Wave C5-c. `includeSuperseded=true` opts INTO the prior revisions, in the
    // project register's existing shape (`registerQuerySchema`) rather than a
    // second spelling of the same idea. The lot page asks for them so it can
    // group each prior revision under the record that replaced it — a
    // supersession chain the reader can only see one end of is not a chain.
    const { includeSuperseded } = parseOrBadRequest(
      registerQuerySchema.pick({ includeSuperseded: true }),
      req.query,
    );

    const surveys = await prisma.surveyRecord.findMany({
      // Reads still DEFAULT to the current revision — the `Drawing` convention.
      where: { lotId: lot.id, ...(includeSuperseded === 'true' ? {} : { supersededById: null }) },
      select: SURVEY_SELECT,
      orderBy: [{ createdAt: 'desc' }],
      take: SURVEY_REGISTER_MAX_LIMIT,
    });

    // Readiness counts CURRENT records only, whatever the caller asked to see.
    // Without the `supersededById === null` filter, opting into the history
    // would inflate the lot's own warning with records that were replaced
    // precisely so they would stop counting.
    //
    // The signal is ARRIVAL: a record that is not `received` is a report the lot
    // is still waiting on, whether nobody has done it yet (`requested`) or it
    // came back wrong (`returned_for_correction`). What happens to a received
    // report afterwards is the hold point's business, not this warning's.
    const notReceived = surveys.filter(
      (survey) => survey.supersededById === null && survey.status !== 'received',
    ).length;
    const item = buildSurveyNotReceivedItem(notReceived);

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

      assertEditableWhenSuperseded(record.supersededById, providedKeys);

      // The surveyor cannot be erased off a record that has already been filed
      // as arrived — that would leave evidence attributed to nobody, which the
      // status gate refused on the way in.
      if (providedKeys.includes('surveyorName')) {
        assertAttributable(record.status, body.surveyorName ?? null);
      }

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
      assertEditableWhenSuperseded(record.supersededById, ['reportDocumentId']);
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
    const { status, returnReason } = parseOrBadRequest(statusSchema, req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const record = await loadSurveyOr404(tx, surveyId);

      // The split at `testResults/workflowRoutes.ts`: judging a third party's
      // deliverable defective needs the higher set, filing its arrival does not.
      const decisive = status === 'returned_for_correction';
      await requireEffectiveProjectRole(
        user,
        record.projectId,
        decisive ? SURVEY_DECIDERS : SURVEY_CREATORS,
        decisive
          ? 'You do not have permission to return surveys for correction'
          : 'You do not have permission to update survey status',
        { client: tx, excludeSubcontractorProjectMemberships: true, requireWritable: true },
      );

      assertTransitionAllowed(record, status);

      assertReportPresentFor(status, record.reportDocumentId);
      assertAttributable(status, record.surveyorName);
      assertReturnReason(status, returnReason ?? null);

      const next = await tx.surveyRecord.update({
        where: { id: surveyId },
        data: { status, ...statusStamp(status, user.id, returnReason ?? null) },
        select: SURVEY_SELECT,
      });

      await auditSurvey(tx, record, user.id, AuditAction.SURVEY_RECORD_STATUS_CHANGED, {
        status: { from: record.status, to: status },
        returnReason: returnReason ?? null,
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
    const { supersededById, reason } = parseOrBadRequest(supersedeSchema, req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const record = await loadSurveyOr404(tx, surveyId);
      await requireEffectiveProjectRole(
        user,
        record.projectId,
        SURVEY_DECIDERS,
        'You do not have permission to supersede surveys for this project',
        { client: tx, excludeSubcontractorProjectMemberships: true, requireWritable: true },
      );

      if (record.supersededById) {
        throw AppError.badRequest('Only the current survey revision can be superseded');
      }
      await assertSupersedingSurvey(tx, record, supersededById);

      const next = await tx.surveyRecord.update({
        where: { id: surveyId },
        data: { supersededById, supersessionReason: reason ?? null },
        select: SURVEY_SELECT,
      });
      await auditSurvey(tx, record, user.id, AuditAction.SURVEY_RECORD_SUPERSEDED, {
        supersededById: { from: null, to: supersededById },
        supersessionReason: reason ?? null,
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
