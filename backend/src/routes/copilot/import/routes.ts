/**
 * Wave B B1 — the Excel ITP import endpoints.
 *
 *   upload → parse → map → dry-run → review (ONE proposal) → apply → reconcile
 *
 * Apply and rollback are NOT here: they are the existing
 * `POST .../proposals/:id/decision` and `.../rollback` routes, running the
 * `import_itp_templates` handlers this module's import registers. One batch is
 * one proposal, so the whole decide/rollback/audit chain is inherited unchanged.
 */
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { AppError } from '../../../lib/AppError.js';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { prisma } from '../../../lib/prisma.js';
import { requireProjectRoleExcludingSubcontractors } from '../../../lib/projectAccess.js';
import { logError } from '../../../lib/serverLogger.js';
import { requireAuth } from '../../../middleware/authMiddleware.js';
import { parseProjectRouteParam } from '../../controlLines/validation.js';
import {
  sanitizeUploadFilename,
  getSafeStoredDocumentMimeType,
} from '../../documents/fileHelpers.js';
import { TEMPLATE_MANAGER_ROLES } from '../../itp/templateAccess.js';
import { createProposal } from '../proposalService.js';
import { assertBatchTransition, isTerminalImportBatchStatus } from './batchState.js';
import { parseExcelWorkbook, type ParsedGrid } from './excelParser.js';
// Importing this module registers the import_itp_templates apply/rollback handlers.
import { IMPORT_ITP_TEMPLATES_STAGE } from './itpTemplateImportExecutor.js';
import {
  computeItpImportDryRun,
  type DryRunResult,
  type TemplateResolution,
} from './itpImportDryRun.js';
import {
  assertImportUploadContent,
  importUpload,
  storeImportSource,
  IMPORT_SOURCE_DOCUMENT_TYPE,
} from './importSourceStorage.js';
import {
  assertAllowedFieldMap,
  BUILT_IN_PROFILES,
  deriveFieldMapFromHeaders,
  suggestBuiltInProfile,
  type FieldMapEntry,
} from './mappingProfiles.js';
import { buildReconciliationCsv, buildReconciliationReport } from './reconciliation.js';

const IMPORT_DENIED_MESSAGE = 'You do not have permission to import ITP templates';
const IMPORT_KIND = 'itp_template';
const IMPORT_SOURCE_FORMAT = 'excel';
const BATCH_LIST_LIMIT = 50;

/** `[WBR2-9]` §3.7 — `parseResult` is capped at 2 MB SERIALIZED, checked on the
 *  buffer BEFORE the write. Postgres would happily store a 200 MB jsonb value
 *  that then has to be read into memory on every review-pane load. */
export const MAX_PARSE_RESULT_BYTES = 2 * 1024 * 1024;

const resolutionSchema = z.object({
  activitySlug: z.string().trim().max(120).optional(),
  affirmSpec: z.boolean().optional(),
  skip: z.boolean().optional(),
  skipRows: z.array(z.number().int()).max(5_000).optional(),
});

const dryRunBodySchema = z.object({
  profileId: z.string().trim().max(200).optional(),
  fieldMap: z.unknown().optional(),
  saveProfileName: z.string().trim().min(1).max(120).optional(),
  saveProfileScope: z.enum(['project', 'company']).optional(),
  resolutions: z.record(resolutionSchema).optional(),
});

const proposalBodySchema = z.object({
  resolutions: z.record(resolutionSchema).optional(),
});

const importRouter = Router();

// Self-protecting, not merely protected by the parent copilot router: this
// router must be safe wherever it is mounted. `requireAuth` short-circuits when
// `req.user` is already set, so the parent's copy costs nothing.
importRouter.use(requireAuth);

async function requireImportAccess(projectId: string, user: Express.Request['user']) {
  await requireProjectRoleExcludingSubcontractors(
    projectId,
    user!,
    TEMPLATE_MANAGER_ROLES,
    IMPORT_DENIED_MESSAGE,
    { requireWritable: true },
  );
}

async function loadBatch(projectId: string, batchId: string) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      sourceDocument: { select: { id: true, filename: true } },
      proposal: { select: { id: true, status: true, payload: true, appliedRecordIds: true } },
    },
  });
  if (!batch || batch.projectId !== projectId) {
    throw AppError.notFound('Import');
  }
  return batch;
}

function asGrid(value: unknown): ParsedGrid {
  const grid = value as ParsedGrid | null;
  if (!grid?.sheets?.length) {
    throw AppError.badRequest('This import has no parsed content. Upload the file again.', {
      code: 'IMPORT_NOT_PARSED',
    });
  }
  return grid;
}

/** Fail a batch with a reason a human can read, then rethrow. */
async function failBatch(batchId: string, status: string, reason: string): Promise<void> {
  if (isTerminalImportBatchStatus(status)) return;
  await prisma.importBatch
    .update({ where: { id: batchId }, data: { status: 'failed', failedReason: reason } })
    .catch((error) => logError('Could not mark import batch failed:', error));
}

// ---------------------------------------------------------------------------
// Upload → parse
// ---------------------------------------------------------------------------

importRouter.post(
  '/:projectId/copilot/imports',
  importUpload.single('file'),
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireImportAccess(projectId, req.user);

    if (!req.file) {
      throw AppError.badRequest('A spreadsheet is required.');
    }
    // Magic bytes are the authoritative gate; the multer filter above only gave
    // a cheap early rejection on a client-controlled name and MIME type.
    assertImportUploadContent(req.file);

    // Parse BEFORE persisting anything: a hostile or unreadable file leaves no
    // batch and no stored document behind.
    const grid = await parseExcelWorkbook(req.file.buffer);
    const serialized = JSON.stringify(grid);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_PARSE_RESULT_BYTES) {
      const rowCount = grid.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
      throw AppError.badRequest(
        `That workbook holds ${rowCount} rows across ${grid.sheets.length} sheets — too much to review in one import. Split it into smaller files.`,
        { code: 'IMPORT_PARSE_RESULT_TOO_LARGE' },
      );
    }

    const batch = await prisma.importBatch.create({
      data: {
        projectId,
        kind: IMPORT_KIND,
        sourceFormat: IMPORT_SOURCE_FORMAT,
        status: 'uploaded',
        createdById: req.user!.id,
      },
      select: { id: true },
    });

    try {
      const fileUrl = await storeImportSource(projectId, batch.id, req.file);
      const document = await prisma.document.create({
        data: {
          projectId,
          documentType: IMPORT_SOURCE_DOCUMENT_TYPE,
          filename: sanitizeUploadFilename(req.file.originalname),
          fileUrl,
          fileSize: req.file.size,
          mimeType: getSafeStoredDocumentMimeType(req.file),
          uploadedById: req.user!.id,
        },
        select: { id: true },
      });

      assertBatchTransition('uploaded', 'parsed');
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          status: 'parsed',
          sourceDocumentId: document.id,
          parseResult: grid as unknown as object,
        },
      });
    } catch (error) {
      await failBatch(batch.id, 'uploaded', 'The source file could not be stored.');
      throw error;
    }

    const headers = grid.sheets[0]?.headers ?? [];
    const suggested = suggestBuiltInProfile(headers);
    res.status(201).json({
      batch: { id: batch.id, status: 'parsed', kind: IMPORT_KIND },
      sheets: grid.sheets.map((sheet) => ({
        name: sheet.name,
        headers: sheet.headers,
        rowCount: sheet.rows.length,
      })),
      suggestedProfile: suggested ? { key: suggested.key, name: suggested.name } : null,
      // Best-effort starting point the reviewer corrects in the mapping step.
      suggestedFieldMap: suggested?.fieldMap ?? deriveFieldMapFromHeaders(headers),
    });
  }),
);

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

importRouter.get(
  '/:projectId/copilot/imports-profiles',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireImportAccess(projectId, req.user);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });
    const saved = await prisma.importMappingProfile.findMany({
      where: {
        kind: IMPORT_KIND,
        OR: [{ projectId }, ...(project?.companyId ? [{ companyId: project.companyId }] : [])],
      },
      orderBy: { updatedAt: 'desc' },
      take: BATCH_LIST_LIMIT,
      select: { id: true, name: true, fieldMap: true, isBuiltIn: true },
    });

    res.json({
      builtIn: BUILT_IN_PROFILES.filter((profile) => profile.kind === IMPORT_KIND).map(
        (profile) => ({
          key: profile.key,
          name: profile.name,
          fieldMap: profile.fieldMap,
        }),
      ),
      saved,
    });
  }),
);

// ---------------------------------------------------------------------------
// Map + dry run (one call — mapping without an immediate dry run has no use,
// and re-calling it IS the spec's re-map loop: dry_run -> mapped -> dry_run)
// ---------------------------------------------------------------------------

async function resolveFieldMap(
  projectId: string,
  body: z.infer<typeof dryRunBodySchema>,
): Promise<{ fieldMap: FieldMapEntry[]; profileId: string | null }> {
  if (body.fieldMap !== undefined) {
    return { fieldMap: assertAllowedFieldMap(body.fieldMap, IMPORT_KIND), profileId: null };
  }
  if (!body.profileId) {
    throw AppError.badRequest('Choose a mapping profile or map the columns.');
  }

  const builtIn = BUILT_IN_PROFILES.find((profile) => profile.key === body.profileId);
  if (builtIn) {
    // Re-validated even though we authored it — one gate, no exceptions.
    return { fieldMap: assertAllowedFieldMap(builtIn.fieldMap, IMPORT_KIND), profileId: null };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });
  const saved = await prisma.importMappingProfile.findUnique({ where: { id: body.profileId } });
  const visible =
    saved &&
    saved.kind === IMPORT_KIND &&
    (saved.projectId === projectId ||
      (saved.companyId !== null && saved.companyId === project?.companyId));
  if (!visible) {
    throw AppError.notFound('Mapping profile');
  }
  // THE time-of-use check: a fieldMap saved under one version of the allow-list
  // must not be able to write a field a later version forbids.
  return { fieldMap: assertAllowedFieldMap(saved.fieldMap, IMPORT_KIND), profileId: saved.id };
}

async function runDryRun(
  projectId: string,
  grid: ParsedGrid,
  fieldMap: FieldMapEntry[],
  resolutions: Record<string, TemplateResolution> | undefined,
) {
  const [project, existingTemplates] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { specificationSet: true } }),
    prisma.iTPTemplate.findMany({
      where: { projectId },
      select: { id: true, name: true, activityType: true },
    }),
  ]);

  return computeItpImportDryRun({
    grid,
    fieldMap,
    projectSpecificationSet: project?.specificationSet ?? null,
    existingTemplates,
    resolutions,
  });
}

importRouter.post(
  '/:projectId/copilot/imports/:batchId/dry-run',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const batchId = parseProjectRouteParam(req.params.batchId, 'batchId');
    await requireImportAccess(projectId, req.user);

    const body = dryRunBodySchema.safeParse(req.body);
    if (!body.success) {
      throw AppError.fromZodError(body.error);
    }

    const batch = await loadBatch(projectId, batchId);
    assertBatchTransition(batch.status, 'mapped');

    const { fieldMap, profileId } = await resolveFieldMap(projectId, body.data);
    const grid = asGrid(batch.parseResult);

    let savedProfileId = profileId;
    if (body.data.saveProfileName) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { companyId: true },
      });
      const created = await prisma.importMappingProfile.create({
        data: {
          name: body.data.saveProfileName,
          kind: IMPORT_KIND,
          sourceFormat: IMPORT_SOURCE_FORMAT,
          fieldMap: fieldMap as unknown as object,
          // Company scope is the point (§9-D9): a contractor with eight
          // projects maps their standard sheet once, not eight times.
          projectId: body.data.saveProfileScope === 'company' ? null : projectId,
          companyId: body.data.saveProfileScope === 'company' ? (project?.companyId ?? null) : null,
        },
        select: { id: true },
      });
      savedProfileId = created.id;
    }

    // Re-mapping clears the previous dry run before re-deriving it.
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: 'mapped', mappingProfileId: savedProfileId, dryRun: Prisma.DbNull },
    });

    let result;
    try {
      result = await runDryRun(projectId, grid, fieldMap, body.data.resolutions);
    } catch (error) {
      await failBatch(
        batch.id,
        'mapped',
        error instanceof AppError ? error.message : 'The dry run could not be completed.',
      );
      throw error;
    }

    assertBatchTransition('mapped', 'dry_run');
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: 'dry_run',
        // The effective map travels WITH the dry run, so the review step never
        // asks the reviewer to re-send a mapping they already made.
        dryRun: { ...result.dryRun, fieldMap } as unknown as object,
      },
    });

    res.json({ batch: { id: batch.id, status: 'dry_run' }, dryRun: result.dryRun });
  }),
);

// ---------------------------------------------------------------------------
// Send to review — creates the ONE proposal for this batch
// ---------------------------------------------------------------------------

importRouter.post(
  '/:projectId/copilot/imports/:batchId/proposal',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const batchId = parseProjectRouteParam(req.params.batchId, 'batchId');
    await requireImportAccess(projectId, req.user);

    const body = proposalBodySchema.safeParse(req.body ?? {});
    if (!body.success) {
      throw AppError.fromZodError(body.error);
    }

    const batch = await loadBatch(projectId, batchId);
    assertBatchTransition(batch.status, 'review');
    if (batch.proposal) {
      throw AppError.badRequest('This import already has a proposal awaiting review.', {
        code: 'IMPORT_PROPOSAL_EXISTS',
      });
    }
    const storedDryRun = batch.dryRun as { fieldMap?: unknown } | null;
    if (!storedDryRun?.fieldMap) {
      throw AppError.badRequest('Run the dry run before sending this import to review.');
    }

    const grid = asGrid(batch.parseResult);
    // Re-validated at the point of use, not just when it was saved: a stored
    // field map is DB JSON that outlives the validation that admitted it.
    const fieldMap = assertAllowedFieldMap(storedDryRun.fieldMap, IMPORT_KIND);

    const result = await runDryRun(projectId, grid, fieldMap, body.data.resolutions);
    if (!result.dryRun.canApply) {
      throw AppError.badRequest(
        `${result.dryRun.counts.blocked} row(s) must be resolved or skipped before this import can be applied.`,
        { code: 'IMPORT_HAS_BLOCKED_ROWS' },
      );
    }

    const proposal = await prisma.$transaction(async (tx) => {
      const created = await createProposal(
        {
          projectId,
          stage: IMPORT_ITP_TEMPLATES_STAGE,
          requestedById: req.user!.id,
          model: 'deterministic',
          sourceRefs: [
            {
              documentId: batch.sourceDocumentId ?? undefined,
              fileName: batch.sourceDocument?.filename,
              note: 'Imported from spreadsheet',
            },
          ],
          payload: { batchId: batch.id, templates: result.templates },
        },
        tx,
      );
      // @unique on importBatchId makes one-proposal-per-batch a DB invariant.
      await tx.aiProposal.update({ where: { id: created.id }, data: { importBatchId: batch.id } });
      await tx.importBatch.update({
        where: { id: batch.id },
        data: { status: 'review', dryRun: { ...result.dryRun, fieldMap } as unknown as object },
      });
      return created;
    });

    res.status(201).json({
      proposalId: proposal.id,
      batch: { id: batch.id, status: 'review' },
      dryRun: result.dryRun,
      templateCount: result.templates.length,
    });
  }),
);

// ---------------------------------------------------------------------------
// Read / cancel / reconcile
// ---------------------------------------------------------------------------

importRouter.get(
  '/:projectId/copilot/imports',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireImportAccess(projectId, req.user);

    const batches = await prisma.importBatch.findMany({
      where: { projectId, kind: IMPORT_KIND },
      orderBy: { createdAt: 'desc' },
      take: BATCH_LIST_LIMIT,
      select: {
        id: true,
        kind: true,
        status: true,
        failedReason: true,
        createdAt: true,
        sourceDocument: { select: { filename: true } },
        proposal: { select: { id: true, status: true } },
      },
    });

    res.json({
      batches: batches.map((batch) => ({
        id: batch.id,
        kind: batch.kind,
        status: batch.status,
        failedReason: batch.failedReason,
        createdAt: batch.createdAt.toISOString(),
        sourceFileName: batch.sourceDocument?.filename ?? null,
        proposalId: batch.proposal?.id ?? null,
        proposalStatus: batch.proposal?.status ?? null,
      })),
    });
  }),
);

importRouter.get(
  '/:projectId/copilot/imports/:batchId',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const batchId = parseProjectRouteParam(req.params.batchId, 'batchId');
    await requireImportAccess(projectId, req.user);

    const batch = await loadBatch(projectId, batchId);
    res.json({
      batch: {
        id: batch.id,
        kind: batch.kind,
        status: batch.status,
        failedReason: batch.failedReason,
        createdAt: batch.createdAt.toISOString(),
        sourceFileName: batch.sourceDocument?.filename ?? null,
        sourceAvailable: Boolean(batch.sourceDocumentId),
        mappingProfileId: batch.mappingProfileId,
        proposalId: batch.proposal?.id ?? null,
        proposalStatus: batch.proposal?.status ?? null,
      },
      // The source pane renders this grid beside the proposal.
      grid: batch.parseResult,
      dryRun: batch.dryRun,
    });
  }),
);

importRouter.post(
  '/:projectId/copilot/imports/:batchId/cancel',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const batchId = parseProjectRouteParam(req.params.batchId, 'batchId');
    await requireImportAccess(projectId, req.user);

    const batch = await loadBatch(projectId, batchId);
    assertBatchTransition(batch.status, 'cancelled');
    await prisma.importBatch.update({
      where: { id: batch.id },
      // parseResult and dryRun are reproducible from the source, so a cancelled
      // batch stops holding them. The source Document is KEPT — it is a file the
      // contractor uploaded, and deleting user files is not a decision an
      // importer gets to make.
      data: { status: 'cancelled', parseResult: Prisma.DbNull, dryRun: Prisma.DbNull },
    });

    res.json({ batch: { id: batch.id, status: 'cancelled' } });
  }),
);

importRouter.get(
  '/:projectId/copilot/imports/:batchId/reconciliation',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const batchId = parseProjectRouteParam(req.params.batchId, 'batchId');
    await requireImportAccess(projectId, req.user);

    const batch = await loadBatch(projectId, batchId);
    const payload = (batch.proposal?.payload ?? null) as { templates?: { key: string }[] } | null;
    const applied = (batch.proposal?.appliedRecordIds ?? []) as { model: string; ids: string[] }[];

    const report = buildReconciliationReport({
      batchId: batch.id,
      status: batch.status,
      failedReason: batch.failedReason,
      sourceFileName: batch.sourceDocument?.filename ?? null,
      sourceDocumentId: batch.sourceDocumentId,
      dryRun: (batch.dryRun ?? null) as DryRunResult | null,
      createdRecordIds: applied.find((group) => group.model === 'ITPTemplate')?.ids ?? [],
      appliedTemplateKeys: (payload?.templates ?? []).map((template) => template.key),
    });

    if (req.query.format === 'csv') {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, company: { select: { name: true, abn: true } } },
      });
      const csv = buildReconciliationCsv(report, {
        companyName: project?.company?.name,
        abn: project?.company?.abn,
        projectName: project?.name,
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="import-reconciliation-${batch.id}.csv"`,
      );
      res.send(csv);
      return;
    }

    res.json({ reconciliation: report });
  }),
);

export { importRouter };
