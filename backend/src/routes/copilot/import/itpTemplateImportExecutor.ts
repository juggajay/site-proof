/**
 * Wave B B1 — the `import_itp_templates` stage handlers.
 *
 * Follows `lotBreakdownExecutor.ts`: apply re-validates the REVIEWED payload
 * with the same Zod schema the manual create route uses, writes inside the
 * deciding transaction, and returns grouped ids; rollback guards accumulated
 * work before deleting and names the blocker.
 *
 * The payload reaching apply may be an `editedPayload` the reviewer supplied, so
 * it is untrusted input: every §4.10 safety rule the dry run enforced is
 * RE-ASSERTED here. The batch id comes from `proposal.importBatchId`, never from
 * the payload, for the same reason.
 */
import type { AiProposal, Prisma } from '@prisma/client';
import { z } from 'zod';

import { foldActivityValue } from '../../../lib/activityTaxonomy.js';
import { AppError } from '../../../lib/AppError.js';
import { normalizeSpecSet } from '../../../lib/itpMatcher.js';
import {
  checklistItemSchema,
  createTemplateSchema,
  MAX_CHECKLIST_ITEMS,
} from '../../itp/templateValidation.js';
import {
  applyHandlers,
  rollbackHandlers,
  type AppliedRecordGroup,
  type ApplyContext,
} from '../proposalService.js';
import { assertBatchTransition } from './batchState.js';
import {
  MAX_IMPORT_CHECKLIST_ITEMS_PER_BATCH,
  MAX_IMPORT_TEMPLATES_PER_BATCH,
  templateDedupKey,
} from './itpImportDryRun.js';

export const IMPORT_ITP_TEMPLATES_STAGE = 'import_itp_templates';

const rowRefSchema = z.object({ sheet: z.string().max(200), rowIndex: z.number().int() });

const importedTemplateSchema = z.object({
  key: z.string().max(400),
  name: z.string(),
  description: z.string().nullable().optional(),
  activityType: z.string(),
  stateSpec: z.string().nullable().optional(),
  specificationReference: z.string().nullable().optional(),
  specAffirmed: z.boolean().default(false),
  sourceRowRefs: z.array(rowRefSchema).max(MAX_CHECKLIST_ITEMS).optional(),
  match: z
    .object({
      activitySlug: z.string(),
      foldConfidence: z.enum(['exact', 'family', 'none']),
      resolvedBy: z.enum(['source_column', 'reviewer']),
    })
    .optional(),
  checklistItems: z.array(checklistItemSchema).min(1).max(MAX_CHECKLIST_ITEMS),
});

export const importItpTemplatesPayloadSchema = z.object({
  batchId: z.string().uuid().optional(),
  templates: z.array(importedTemplateSchema).min(1).max(MAX_IMPORT_TEMPLATES_PER_BATCH),
});

export type ImportedTemplate = z.infer<typeof importedTemplateSchema>;

applyHandlers[IMPORT_ITP_TEMPLATES_STAGE] = async (
  tx: Prisma.TransactionClient,
  proposal: AiProposal,
  effectivePayload: unknown,
  context: ApplyContext,
): Promise<AppliedRecordGroup[]> => {
  const parsed = importItpTemplatesPayloadSchema.safeParse(effectivePayload);
  if (!parsed.success) {
    throw AppError.fromZodError(parsed.error);
  }
  const { templates } = parsed.data;

  const totalItems = templates.reduce((sum, template) => sum + template.checklistItems.length, 0);
  if (totalItems > MAX_IMPORT_CHECKLIST_ITEMS_PER_BATCH) {
    throw AppError.badRequest(
      `This import holds ${totalItems} checklist rows — more than the ${MAX_IMPORT_CHECKLIST_ITEMS_PER_BATCH} an import can apply at once. Split the file.`,
      { code: 'IMPORT_CHECKLIST_CAP_EXCEEDED' },
    );
  }

  const project = await tx.project.findUnique({
    where: { id: proposal.projectId },
    select: { specificationSet: true },
  });
  const projectSpec = normalizeSpecSet(project?.specificationSet ?? null);

  // Dedup identities already in the project. A row that became a duplicate
  // between the dry run and the accept must not create a silent twin.
  const existing = await tx.iTPTemplate.findMany({
    where: { projectId: proposal.projectId },
    select: { id: true, name: true, activityType: true },
  });
  const takenKeys = new Set(
    existing.map((template) =>
      templateDedupKey(template.name, foldActivityValue(template.activityType).slug),
    ),
  );

  const affirmedAt = new Date();
  const createdIds: string[] = [];
  const batchKeys = new Set<string>();

  for (const template of templates) {
    // The SAME schema the manual POST /templates route validates against.
    const validated = createTemplateSchema.safeParse({
      projectId: proposal.projectId,
      name: template.name,
      description: template.description ?? undefined,
      activityType: template.activityType,
      stateSpec: template.stateSpec ?? undefined,
      specificationReference: template.specificationReference ?? undefined,
      checklistItems: template.checklistItems,
    });
    if (!validated.success) {
      throw AppError.fromZodError(validated.error);
    }

    // (d) Unresolvable activities cannot be applied — never defaulted.
    const fold = foldActivityValue(validated.data.activityType);
    if (fold.confidence === 'none') {
      throw AppError.badRequest(
        `"${template.name}" has no recognised activity. Pick an activity for it or leave it out of this import.`,
        { code: 'IMPORT_ACTIVITY_UNRESOLVABLE' },
      );
    }

    // (a) A contradicting specification set needs an explicit affirmation.
    const declaredSpec = normalizeSpecSet(validated.data.stateSpec ?? null);
    if (declaredSpec && projectSpec && declaredSpec !== projectSpec && !template.specAffirmed) {
      throw AppError.badRequest(
        `"${template.name}" declares ${template.stateSpec} but this project is ${project?.specificationSet}. Affirm it or leave it out of this import.`,
        { code: 'IMPORT_STATE_SPEC_CONFLICT' },
      );
    }

    const key = templateDedupKey(validated.data.name, fold.slug);
    if (batchKeys.has(key) || takenKeys.has(key)) {
      throw AppError.badRequest(
        `"${template.name}" would duplicate a template that already exists in this project. Re-run the dry run.`,
        { code: 'IMPORT_TEMPLATE_DUPLICATE' },
      );
    }
    batchKeys.add(key);

    const created = await tx.iTPTemplate.create({
      data: {
        // Imports are ALWAYS private-tenant: projectId set, never null (null is
        // the shared/global library scope).
        projectId: proposal.projectId,
        name: validated.data.name,
        description: validated.data.description || null,
        activityType: validated.data.activityType,
        stateSpec: validated.data.stateSpec || null,
        specificationReference: validated.data.specificationReference || null,
        // `[WBR2-6]`: only rows the reviewer affirmed reach Tier-A auto-fill.
        specAffirmedAt: template.specAffirmed ? affirmedAt : null,
        specAffirmedById: template.specAffirmed ? context.userId : null,
        checklistItems: {
          create: (validated.data.checklistItems ?? []).map((item, index) => ({
            description: item.description,
            sequenceNumber: index + 1,
            pointType: item.pointType || (item.isHoldPoint ? 'hold_point' : 'standard'),
            responsibleParty: item.responsibleParty || item.category || 'contractor',
            evidenceRequired: item.evidenceRequired || 'none',
            acceptanceCriteria: item.acceptanceCriteria || null,
            testType: item.testType || null,
          })),
        },
      },
      select: { id: true },
    });
    createdIds.push(created.id);
  }

  if (proposal.importBatchId) {
    const batch = await tx.importBatch.findUnique({
      where: { id: proposal.importBatchId },
      select: { status: true },
    });
    if (batch) {
      assertBatchTransition(batch.status, 'applied');
      await tx.importBatch.update({
        where: { id: proposal.importBatchId },
        data: { status: 'applied' },
      });
    }
  }

  return [{ model: 'ITPTemplate', ids: createdIds }];
};

/**
 * Refuse rollback if an imported template has accumulated real work — deleting
 * it would take lot assignments and inspection evidence with it. Names the
 * blocker, exactly as `assertCreatedLotsHaveNoProgress` does.
 */
async function assertImportedTemplatesHaveNoWork(
  tx: Prisma.TransactionClient,
  templateIds: string[],
): Promise<void> {
  if (templateIds.length === 0) return;

  const inUse = await tx.iTPTemplate.findMany({
    where: {
      id: { in: templateIds },
      OR: [{ itpInstances: { some: {} } }, { lots: { some: {} } }],
    },
    select: { id: true, name: true },
  });
  if (inUse.length === 0) return;

  const sample = inUse
    .slice(0, 5)
    .map((template) => template.name)
    .join(', ');
  throw new AppError(
    400,
    `Cannot undo — ${inUse.length} imported ITP(s) are already in use on lots: ${sample}. ` +
      `Remove them from those lots before rolling this import back.`,
    'IMPORTED_TEMPLATES_IN_USE',
  );
}

rollbackHandlers[IMPORT_ITP_TEMPLATES_STAGE] = async (
  tx: Prisma.TransactionClient,
  proposal: AiProposal,
  groups: AppliedRecordGroup[],
): Promise<void> => {
  const templateIds = groups.find((group) => group.model === 'ITPTemplate')?.ids ?? [];

  await assertImportedTemplatesHaveNoWork(tx, templateIds);
  if (templateIds.length > 0) {
    // Checklist items cascade with the template (schema onDelete: Cascade).
    await tx.iTPTemplate.deleteMany({ where: { id: { in: templateIds } } });
  }

  if (proposal.importBatchId) {
    const batch = await tx.importBatch.findUnique({
      where: { id: proposal.importBatchId },
      select: { status: true },
    });
    if (batch) {
      assertBatchTransition(batch.status, 'rolled_back');
      await tx.importBatch.update({
        where: { id: proposal.importBatchId },
        data: { status: 'rolled_back' },
      });
    }
  }
};
