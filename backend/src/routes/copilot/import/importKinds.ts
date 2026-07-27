/**
 * Wave B B2 — what differs between one import kind and another.
 *
 * The pipeline (upload → parse → map → dry-run → one proposal → apply →
 * reconcile → rollback) is identical for every kind, so `routes.ts` stays one
 * router and dispatches the handful of kind-specific decisions through here:
 * who may run it, which stage its proposal registers under, how the dry run is
 * computed, and which model its applied ids belong to.
 *
 * Importing this module registers BOTH stages' apply/rollback handlers.
 */
import { prisma } from '../../../lib/prisma.js';
import { AppError } from '../../../lib/AppError.js';
import { TEMPLATE_MANAGER_ROLES } from '../../itp/templateAccess.js';
import { LOT_CREATORS } from '../../lots/roles.js';
import type { DryRunResult } from './dryRunTypes.js';
import type { ParsedGrid } from './excelParser.js';
import { computeItpImportDryRun, type TemplateResolution } from './itpImportDryRun.js';
import { IMPORT_ITP_TEMPLATES_STAGE } from './itpTemplateImportExecutor.js';
import { computeLotRegisterDryRun, type LotResolution } from './lotRegisterDryRun.js';
import { IMPORT_LOT_REGISTER_STAGE } from './lotRegisterImportExecutor.js';
import type { FieldMapEntry } from './mappingProfiles.js';

export type ImportResolution = TemplateResolution & LotResolution;

export interface ImportDryRunOutput {
  dryRun: DryRunResult;
  /** The proposal payload this dry run would produce, ledger keys included. */
  payload: Record<string, unknown>;
  /** Ledger keys in payload order, so reconciliation lines created ids up. */
  payloadKeys: string[];
  /** How many records the batch would create — the Apply CTA's number. */
  itemCount: number;
}

export interface ImportKindConfig {
  kind: string;
  /** NOTE: there is deliberately no `sourceFormat` here. Every kind reads from
   *  every accepted format (B2 added PDF beside Excel), so the format is a
   *  property of the uploaded FILE and lives on the batch. */
  stage: string;
  roles: readonly string[];
  deniedMessage: string;
  /** Copy for the proposal's `sourceRefs` note and the reconciliation heading. */
  sourceNote: string;
  reconciliationTitle: string;
  /** The `AppliedRecordGroup.model` whose ids the reconciliation reports. */
  appliedModel: string;
  /**
   * B3 §4.5: whether an applied batch of this kind can be rolled out to another
   * project as a corporate master. ITP sets are company standards; a lot
   * register describes one project's ground and never travels.
   */
  corporateMaster: boolean;
  /** Ledger keys read back out of the STORED payload, in the order the apply
   *  handler created records, so reconciliation can pair keys with new ids. */
  storedPayloadKeys(payload: unknown): string[];
  runDryRun(
    projectId: string,
    grid: ParsedGrid,
    fieldMap: FieldMapEntry[],
    resolutions: Record<string, ImportResolution> | undefined,
  ): Promise<ImportDryRunOutput>;
}

const ITP_TEMPLATE_KIND: ImportKindConfig = {
  kind: 'itp_template',
  stage: IMPORT_ITP_TEMPLATES_STAGE,
  roles: TEMPLATE_MANAGER_ROLES,
  deniedMessage: 'You do not have permission to import ITP templates',
  sourceNote: 'Imported from an ITP document',
  reconciliationTitle: 'ITP import reconciliation',
  appliedModel: 'ITPTemplate',
  corporateMaster: true,
  storedPayloadKeys(payload) {
    const templates = (payload as { templates?: { key?: string }[] } | null)?.templates ?? [];
    return templates.map((template) => template.key ?? '');
  },
  async runDryRun(projectId, grid, fieldMap, resolutions) {
    const [project, existingTemplates] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId }, select: { specificationSet: true } }),
      prisma.iTPTemplate.findMany({
        where: { projectId },
        select: {
          id: true,
          name: true,
          activityType: true,
          // The project's controlled copy, for the corporate-master diff (§4.5).
          checklistItems: {
            orderBy: { sequenceNumber: 'asc' },
            select: { description: true, acceptanceCriteria: true, pointType: true },
          },
        },
      }),
    ]);

    const result = computeItpImportDryRun({
      grid,
      fieldMap,
      projectSpecificationSet: project?.specificationSet ?? null,
      existingTemplates,
      resolutions,
    });
    return {
      dryRun: result.dryRun,
      payload: { templates: result.templates },
      payloadKeys: result.templates.map((template) => template.key),
      itemCount: result.templates.length,
    };
  },
};

const LOT_REGISTER_KIND: ImportKindConfig = {
  kind: 'lot_register',
  stage: IMPORT_LOT_REGISTER_STAGE,
  // A quality manager is not a lot setup manager — the same call `lot_breakdown`
  // already makes, and the reason the stage-role map exists.
  roles: LOT_CREATORS,
  deniedMessage: 'You do not have permission to import lots',
  sourceNote: 'Imported from lot register',
  reconciliationTitle: 'Lot register import reconciliation',
  appliedModel: 'Lot',
  corporateMaster: false,
  storedPayloadKeys(payload) {
    const lots = (payload as { lots?: { key?: string }[] } | null)?.lots ?? [];
    return lots.map((lot) => lot.key ?? '');
  },
  async runDryRun(projectId, grid, fieldMap, resolutions) {
    const [project, existingLots, templates] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { state: true, specificationSet: true },
      }),
      prisma.lot.findMany({ where: { projectId }, select: { id: true, lotNumber: true } }),
      prisma.iTPTemplate.findMany({ where: { projectId }, select: { id: true, name: true } }),
    ]);

    const result = computeLotRegisterDryRun({
      grid,
      fieldMap,
      project: project ?? { state: null, specificationSet: null },
      existingLots,
      templates,
      resolutions,
    });
    return {
      dryRun: result.dryRun,
      // Shaped for `bulkCreateLotsCoreSchema`; the per-lot `key` is extra and is
      // stripped on validation, but survives in the immutable stored payload.
      payload: { lots: result.lots },
      payloadKeys: result.lots.map((lot) => lot.key),
      itemCount: result.lots.length,
    };
  },
};

export const IMPORT_KINDS: Record<string, ImportKindConfig> = {
  [ITP_TEMPLATE_KIND.kind]: ITP_TEMPLATE_KIND,
  [LOT_REGISTER_KIND.kind]: LOT_REGISTER_KIND,
};

/** `test_register` is RESERVED and deliberately unimplemented until the Wave C
 *  sample/test model is final — it resolves to nothing here on purpose. */
export function requireImportKind(value: unknown): ImportKindConfig {
  const kind = typeof value === 'string' && value ? value : ITP_TEMPLATE_KIND.kind;
  const config = IMPORT_KINDS[kind];
  if (!config) {
    throw AppError.badRequest(`Imports of kind "${kind}" are not supported yet.`, {
      code: 'IMPORT_KIND_UNSUPPORTED',
    });
  }
  return config;
}
