/**
 * Wave B — the Excel import endpoints.
 *
 *   upload → parse → map → dry-run → review (ONE proposal) → apply → reconcile
 *
 * ONE router for every import kind: the pipeline is identical, and only the
 * handful of decisions in `importKinds.ts` differ (who may run it, which stage
 * its proposal registers under, how the dry run is computed). The kind is chosen
 * once at upload (`?kind=`) and read off the batch from then on, so no later call
 * can steer a batch into another kind's rules.
 *
 * Apply and rollback are NOT here: they are the existing
 * `POST .../proposals/:id/decision` and `.../rollback` routes, running the
 * stage handlers `importKinds.ts` registers. One batch is one proposal, so the
 * whole decide/rollback/audit chain is inherited unchanged.
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
import { getReadableProjects, TEMPLATE_MANAGER_ROLES } from '../../itp/templateAccess.js';
import { createProposal } from '../proposalService.js';
import { assertBatchTransition, isTerminalImportBatchStatus } from './batchState.js';
import type { DryRunResult } from './dryRunTypes.js';
import { parseExcelWorkbook, type ParsedGrid } from './excelParser.js';
// Importing this module registers every import stage's apply/rollback handlers.
import { requireImportKind, type ImportKindConfig } from './importKinds.js';
import {
  assertImportUploadContent,
  importSourceFormat,
  importUpload,
  storeImportSource,
  IMPORT_SOURCE_DOCUMENT_TYPE,
  UNSUPPORTED_SOURCE_MESSAGE,
} from './importSourceStorage.js';
import { extractPdfGrid } from './pdfExtraction.js';
import { parseWordDocument } from './wordParser.js';
import {
  assertAllowedFieldMap,
  BUILT_IN_PROFILES,
  deriveFieldMapFromHeaders,
  mergeFieldMapWithAliases,
  suggestBuiltInProfile,
  type FieldMapEntry,
} from './mappingProfiles.js';
import { buildReconciliationCsv, buildReconciliationReport } from './reconciliation.js';

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
  milestoneAs: z.enum(['hold_point', 'witness', 'standard']).optional(),
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

const fromMasterBodySchema = z.object({ masterBatchId: z.string().trim().min(1).max(200) });

const importRouter = Router();

// Self-protecting, not merely protected by the parent copilot router: this
// router must be safe wherever it is mounted. `requireAuth` short-circuits when
// `req.user` is already set, so the parent's copy costs nothing.
importRouter.use(requireAuth);

async function requireImportAccess(
  projectId: string,
  user: Express.Request['user'],
  config: ImportKindConfig,
) {
  await requireProjectRoleExcludingSubcontractors(
    projectId,
    user!,
    config.roles,
    config.deniedMessage,
    { requireWritable: true },
  );
}

/**
 * Load a batch and apply ITS kind's role list.
 *
 * Ordering matters and is the same rule the decide/rollback routes follow: the
 * kind is a property of the batch, so a project-membership gate runs FIRST —
 * otherwise a non-member would learn a batch id exists by watching 404 flip to
 * 403. `TEMPLATE_MANAGER_ROLES` is the union of every import kind's role list
 * (`LOT_CREATORS` is a strict subset), so that gate can never admit someone the
 * kind check would then reject on membership grounds.
 */
async function loadBatchForKind(projectId: string, batchId: string, user: Express.Request['user']) {
  await requireProjectRoleExcludingSubcontractors(
    projectId,
    user!,
    TEMPLATE_MANAGER_ROLES,
    'You do not have permission to import into this project',
    { requireWritable: true },
  );
  const batch = await loadBatch(projectId, batchId);
  await requireImportAccess(projectId, user, requireImportKind(batch.kind));
  return batch;
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

/** One reader per accepted format, all emitting the SAME normalized grid. */
const READERS: Record<string, (file: Express.Multer.File, kind: string) => Promise<ParsedGrid>> = {
  excel: (file, kind) => parseExcelWorkbook(file.buffer, kind),
  // A PDF has no grid to parse, so the model reads one out of it (§6-B2).
  pdf: (file, kind) => extractPdfGrid(file, kind),
  // A Word ITP is a table, so the tables are parsed — in a worker (§6-B3, §8.4).
  word: (file, kind) => parseWordDocument(file.buffer, kind),
};

/** Gate an uploaded file and read it into the normalized grid. */
async function readSourceFile(
  file: Express.Multer.File,
  kind: string,
): Promise<{ grid: ParsedGrid; sourceFormat: string }> {
  // Magic bytes are the authoritative gate; the multer filter only gave a cheap
  // early rejection on a client-controlled name and MIME type.
  assertImportUploadContent(file);
  // Re-derived rather than carried from the filter, so the reader that runs and
  // the format recorded on the batch can never disagree.
  const sourceFormat = importSourceFormat(file.originalname);
  const read = sourceFormat ? READERS[sourceFormat] : undefined;
  if (!sourceFormat || !read) {
    throw AppError.badRequest(UNSUPPORTED_SOURCE_MESSAGE);
  }

  const grid = await read(file, kind);
  assertGridWithinParseResultCap(grid);
  return { grid, sourceFormat };
}

function assertGridWithinParseResultCap(grid: ParsedGrid): void {
  const serialized = JSON.stringify(grid);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_PARSE_RESULT_BYTES) {
    const rowCount = grid.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
    throw AppError.badRequest(
      `That file holds ${rowCount} rows across ${grid.sheets.length} sheets — too much to review in one import. Split it into smaller files.`,
      { code: 'IMPORT_PARSE_RESULT_TOO_LARGE' },
    );
  }
}

importRouter.post(
  '/:projectId/copilot/imports',
  importUpload.single('file'),
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const config = requireImportKind(req.query.kind);
    await requireImportAccess(projectId, req.user, config);

    if (!req.file) {
      throw AppError.badRequest('A file is required.');
    }
    // Read BEFORE persisting anything: a hostile or unreadable file leaves no
    // batch and no stored document behind.
    const { grid, sourceFormat } = await readSourceFile(req.file, config.kind);

    const batch = await prisma.importBatch.create({
      data: {
        projectId,
        kind: config.kind,
        sourceFormat,
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
    const suggested = suggestBuiltInProfile(headers, config.kind);
    res.status(201).json({
      batch: { id: batch.id, status: 'parsed', kind: config.kind },
      sheets: grid.sheets.map((sheet) => ({
        name: sheet.name,
        headers: sheet.headers,
        rowCount: sheet.rows.length,
      })),
      suggestedProfile: suggested ? { key: suggested.key, name: suggested.name } : null,
      // Best-effort starting point the reviewer corrects in the mapping step.
      // A suggested profile is filled out with alias-derived entries for any
      // target its own fieldMap leaves unresolved against these headers (e.g.
      // the CivilPro CSV spells pointType as "Check Type", which the grid
      // profile does not carry but the alias table resolves).
      suggestedFieldMap: suggested
        ? mergeFieldMapWithAliases(suggested.fieldMap, headers, config.kind)
        : deriveFieldMapFromHeaders(headers, config.kind),
    });
  }),
);

// ---------------------------------------------------------------------------
// Corporate master -> project-controlled copy (§4.5)
//
// A corporate master is simply an ITP import that has been APPLIED somewhere.
// Rolling it out to another project re-runs that batch's parsed grid against the
// target, so the copy arrives through the same dry run, the same review, the
// same one proposal and the same rollback as any other import — and the dry run
// answers "what would this change here" by diffing every template that already
// exists against the project's controlled copy (§4.5, `diffChecklistItems`).
//
// ponytail: no `isCorporateMaster` flag and no schema change. A flag would add a
// migration and a toggle without adding a capability — every applied ITP import
// IS a set the contractor decided was right, which is what "master" means.
// ---------------------------------------------------------------------------

function requireCorporateMasterKind(config: ImportKindConfig): void {
  if (!config.corporateMaster) {
    throw AppError.badRequest('Only ITP imports can be used as a corporate master.', {
      code: 'IMPORT_MASTER_KIND_UNSUPPORTED',
    });
  }
}

importRouter.get(
  '/:projectId/copilot/import-masters',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const config = requireImportKind(req.query.kind);
    requireCorporateMasterKind(config);
    await requireImportAccess(projectId, req.user, config);

    // Only projects this user can already read — a master never widens access.
    const readable = await getReadableProjects(req.user!);
    const otherProjectIds = readable
      .filter((project) => project.id !== projectId)
      .map((project) => project.id);
    if (otherProjectIds.length === 0) {
      res.json({ masters: [] });
      return;
    }

    const batches = await prisma.importBatch.findMany({
      where: { projectId: { in: otherProjectIds }, kind: config.kind, status: 'applied' },
      orderBy: { updatedAt: 'desc' },
      take: BATCH_LIST_LIMIT,
      select: {
        id: true,
        sourceFormat: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
        sourceDocument: { select: { filename: true } },
        proposal: { select: { payload: true } },
      },
    });

    res.json({
      masters: batches.map((batch) => ({
        id: batch.id,
        projectId: batch.project.id,
        projectName: batch.project.name,
        sourceFileName: batch.sourceDocument?.filename ?? null,
        sourceFormat: batch.sourceFormat,
        appliedAt: batch.updatedAt.toISOString(),
        templateCount: config.storedPayloadKeys(batch.proposal?.payload ?? null).length,
      })),
    });
  }),
);

importRouter.post(
  '/:projectId/copilot/imports/from-master',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const body = fromMasterBodySchema.safeParse(req.body ?? {});
    if (!body.success) {
      throw AppError.fromZodError(body.error);
    }

    const config = requireImportKind(req.query.kind);
    requireCorporateMasterKind(config);
    await requireImportAccess(projectId, req.user, config);

    const master = await prisma.importBatch.findUnique({
      where: { id: body.data.masterBatchId },
      select: {
        id: true,
        kind: true,
        status: true,
        projectId: true,
        sourceFormat: true,
        parseResult: true,
        sourceDocument: {
          select: { filename: true, fileUrl: true, fileSize: true, mimeType: true },
        },
      },
    });
    if (!master || master.kind !== config.kind || master.status !== 'applied') {
      throw AppError.notFound('Corporate master');
    }
    if (master.projectId === projectId) {
      throw AppError.badRequest('That import already belongs to this project.');
    }
    // The SOURCE project's own guard, not merely the target's: rolling a master
    // out must never be a way to read a project the user cannot open. It answers
    // 404, not 403 — otherwise the two replies tell an outsider which batch ids
    // exist, the same existence-leak rule the decide route follows (§4.9).
    try {
      await requireImportAccess(master.projectId, req.user, config);
    } catch {
      throw AppError.notFound('Corporate master');
    }

    const grid = asGrid(master.parseResult);

    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.importBatch.create({
        data: {
          projectId,
          kind: config.kind,
          sourceFormat: master.sourceFormat,
          status: 'parsed',
          createdById: req.user!.id,
          parseResult: grid as unknown as object,
        },
        select: { id: true },
      });

      // The source file travels with the master as this project's OWN provenance
      // row, pointing at the same stored object. A cross-project Document id on
      // the batch would be a tenant-isolation hole; a project-scoped copy is not,
      // and `import_source` keeps it out of the client-visible register (§4.11).
      if (master.sourceDocument) {
        const document = await tx.document.create({
          data: {
            projectId,
            documentType: IMPORT_SOURCE_DOCUMENT_TYPE,
            filename: master.sourceDocument.filename,
            fileUrl: master.sourceDocument.fileUrl,
            fileSize: master.sourceDocument.fileSize,
            mimeType: master.sourceDocument.mimeType,
            uploadedById: req.user!.id,
          },
          select: { id: true },
        });
        await tx.importBatch.update({
          where: { id: created.id },
          data: { sourceDocumentId: document.id },
        });
      }
      return created;
    });

    const headers = grid.sheets[0]?.headers ?? [];
    const suggested = suggestBuiltInProfile(headers, config.kind);
    res.status(201).json({
      batch: { id: batch.id, status: 'parsed', kind: config.kind },
      sheets: grid.sheets.map((sheet) => ({
        name: sheet.name,
        headers: sheet.headers,
        rowCount: sheet.rows.length,
      })),
      suggestedProfile: suggested ? { key: suggested.key, name: suggested.name } : null,
      suggestedFieldMap: suggested
        ? mergeFieldMapWithAliases(suggested.fieldMap, headers, config.kind)
        : deriveFieldMapFromHeaders(headers, config.kind),
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
    const config = requireImportKind(req.query.kind);
    await requireImportAccess(projectId, req.user, config);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });
    const saved = await prisma.importMappingProfile.findMany({
      where: {
        kind: config.kind,
        OR: [{ projectId }, ...(project?.companyId ? [{ companyId: project.companyId }] : [])],
      },
      orderBy: { updatedAt: 'desc' },
      take: BATCH_LIST_LIMIT,
      select: { id: true, name: true, fieldMap: true, isBuiltIn: true },
    });

    res.json({
      builtIn: BUILT_IN_PROFILES.filter((profile) => profile.kind === config.kind).map(
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
  config: ImportKindConfig,
  body: z.infer<typeof dryRunBodySchema>,
): Promise<{ fieldMap: FieldMapEntry[]; profileId: string | null }> {
  if (body.fieldMap !== undefined) {
    return { fieldMap: assertAllowedFieldMap(body.fieldMap, config.kind), profileId: null };
  }
  if (!body.profileId) {
    throw AppError.badRequest('Choose a mapping profile or map the columns.');
  }

  const builtIn = BUILT_IN_PROFILES.find(
    (profile) => profile.key === body.profileId && profile.kind === config.kind,
  );
  if (builtIn) {
    // Re-validated even though we authored it — one gate, no exceptions.
    return { fieldMap: assertAllowedFieldMap(builtIn.fieldMap, config.kind), profileId: null };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });
  const saved = await prisma.importMappingProfile.findUnique({ where: { id: body.profileId } });
  const visible =
    saved &&
    saved.kind === config.kind &&
    (saved.projectId === projectId ||
      (saved.companyId !== null && saved.companyId === project?.companyId));
  if (!visible) {
    throw AppError.notFound('Mapping profile');
  }
  // THE time-of-use check: a fieldMap saved under one version of the allow-list
  // must not be able to write a field a later version forbids.
  return { fieldMap: assertAllowedFieldMap(saved.fieldMap, config.kind), profileId: saved.id };
}

importRouter.post(
  '/:projectId/copilot/imports/:batchId/dry-run',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const batchId = parseProjectRouteParam(req.params.batchId, 'batchId');

    const body = dryRunBodySchema.safeParse(req.body);
    if (!body.success) {
      throw AppError.fromZodError(body.error);
    }

    // The kind is the BATCH's, never the caller's: no later call can steer a
    // batch into another kind's rules or another kind's role list.
    const batch = await loadBatchForKind(projectId, batchId, req.user);
    const config = requireImportKind(batch.kind);
    assertBatchTransition(batch.status, 'mapped');

    const { fieldMap, profileId } = await resolveFieldMap(projectId, config, body.data);
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
          kind: config.kind,
          sourceFormat: batch.sourceFormat,
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
      result = await config.runDryRun(projectId, grid, fieldMap, body.data.resolutions);
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

    const body = proposalBodySchema.safeParse(req.body ?? {});
    if (!body.success) {
      throw AppError.fromZodError(body.error);
    }

    const batch = await loadBatchForKind(projectId, batchId, req.user);
    const config = requireImportKind(batch.kind);
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
    const fieldMap = assertAllowedFieldMap(storedDryRun.fieldMap, config.kind);

    const result = await config.runDryRun(projectId, grid, fieldMap, body.data.resolutions);
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
          stage: config.stage,
          requestedById: req.user!.id,
          model: 'deterministic',
          sourceRefs: [
            {
              documentId: batch.sourceDocumentId ?? undefined,
              fileName: batch.sourceDocument?.filename,
              note: config.sourceNote,
            },
          ],
          payload: { batchId: batch.id, ...result.payload },
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
      itemCount: result.itemCount,
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
    const config = requireImportKind(req.query.kind);
    await requireImportAccess(projectId, req.user, config);

    const batches = await prisma.importBatch.findMany({
      where: { projectId, kind: config.kind },
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

    const batch = await loadBatchForKind(projectId, batchId, req.user);
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

    const batch = await loadBatchForKind(projectId, batchId, req.user);
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

    const batch = await loadBatchForKind(projectId, batchId, req.user);
    const config = requireImportKind(batch.kind);
    const applied = (batch.proposal?.appliedRecordIds ?? []) as { model: string; ids: string[] }[];

    const report = buildReconciliationReport({
      batchId: batch.id,
      status: batch.status,
      failedReason: batch.failedReason,
      sourceFileName: batch.sourceDocument?.filename ?? null,
      sourceDocumentId: batch.sourceDocumentId,
      dryRun: (batch.dryRun ?? null) as DryRunResult | null,
      createdRecordIds: applied.find((group) => group.model === config.appliedModel)?.ids ?? [],
      appliedItemKeys: config.storedPayloadKeys(batch.proposal?.payload ?? null),
    });

    if (req.query.format === 'csv') {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, company: { select: { name: true, abn: true } } },
      });
      const csv = buildReconciliationCsv(report, config.reconciliationTitle, {
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
