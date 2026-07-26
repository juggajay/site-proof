/**
 * Wave B B1 — the dry run: what WOULD happen, computed before any write, shown
 * as counts before commit (spec §3.4).
 *
 * Pure — no I/O — so every safety rule in §4.10 is unit-testable without a
 * database, the same way `routeTemplateMatch` is.
 *
 * The unit a reviewer decides on is a TEMPLATE (spec §4.6: accept-whole-template
 * with exception drill-in), so the ledger carries one entry per proposed
 * template plus an extra entry for any individual checklist row that is itself
 * blocked. Row-by-row entries for 1,000 clean checklist rows would drown the
 * exceptions the reviewer actually has to look at.
 */
import { foldActivityValue } from '../../../lib/activityTaxonomy.js';
import { AppError } from '../../../lib/AppError.js';
import { normalizeSpecSet } from '../../../lib/itpMatcher.js';
import {
  MAX_CHECKLIST_ITEM_DESCRIPTION_LENGTH,
  MAX_SHORT_TEXT_LENGTH,
  MAX_TEMPLATE_DESCRIPTION_LENGTH,
  MAX_TEMPLATE_NAME_LENGTH,
} from '../../itp/templateValidation.js';
import type { ParsedGrid } from './excelParser.js';
import {
  applyTransform,
  resolveColumnIndexes,
  type FieldMapEntry,
  type ImportTransform,
  type ItpImportTarget,
} from './mappingProfiles.js';

/** Batch caps (spec §3.5). A file past a cap is rejected with a split-the-file
 *  instruction — never silently truncated, never silently chunked. */
export const MAX_IMPORT_TEMPLATES_PER_BATCH = 200;
export const MAX_IMPORT_CHECKLIST_ITEMS_PER_BATCH = 5_000;

export type DryRunOutcome = 'create' | 'update' | 'skip' | 'needs_review' | 'blocked';

export type DryRunReason =
  | 'duplicate'
  | 'slug_collision'
  | 'unmapped_column'
  | 'ambiguous_activity'
  | 'unresolvable_activity'
  | 'over_length'
  | 'state_spec_conflict'
  | 'low_confidence'
  | 'empty';

export interface DryRunRowRef {
  sheet: string;
  rowIndex: number;
}

export interface DryRunRow {
  /** Stable handle the reviewer's resolutions key off. */
  key: string;
  unit: 'template' | 'checklist_row';
  rowRef: DryRunRowRef;
  label: string;
  outcome: DryRunOutcome;
  reason?: DryRunReason;
  duplicateOf?: { model: string; id: string; matchedOn: string };
  collidesWith?: DryRunRowRef[];
  overLength?: { field: string; length: number; max: number };
  proposedActivitySlug?: string;
  activityFold?: 'exact' | 'family' | 'none';
  declaredStateSpec?: string | null;
  specAffirmed?: boolean;
  checklistItemCount?: number;
}

export interface DryRunCounts {
  willCreate: number;
  willUpdate: number;
  willSkip: number;
  needsReview: number;
  ambiguous: number;
  blocked: number;
}

/** One template the batch would create, ready to become proposal payload. */
export interface ProposedTemplate {
  key: string;
  name: string;
  description: string | null;
  activityType: string;
  stateSpec: string | null;
  specificationReference: string | null;
  specAffirmed: boolean;
  sourceRowRefs: DryRunRowRef[];
  /** Wave-2 per-match audit citation — immutable once it lands in `payload`. */
  match: {
    activitySlug: string;
    foldConfidence: 'exact' | 'family' | 'none';
    resolvedBy: 'source_column' | 'reviewer';
  };
  checklistItems: {
    description: string;
    acceptanceCriteria?: string | null;
    pointType?: string;
    responsibleParty?: string;
    evidenceRequired?: string;
    testType?: string | null;
  }[];
}

export interface DryRunResult {
  counts: DryRunCounts;
  rows: DryRunRow[];
  unmappedHeaders: { sheet: string; headers: string[] }[];
  /** Apply is refused while this is false (blocked rows or unresolved twins). */
  canApply: boolean;
}

/** What the reviewer decided about one proposed template. */
export interface TemplateResolution {
  /** Reviewer-picked canonical activity slug for an unresolvable activity. */
  activitySlug?: string;
  /** Explicit per-template affirmation of a contradicting spec set. */
  affirmSpec?: boolean;
  /** Exclude this template from the batch entirely. */
  skip?: boolean;
  /** Source row indexes to exclude (e.g. an over-length checklist row). */
  skipRows?: number[];
}

export interface ExistingTemplate {
  id: string;
  name: string;
  activityType: string | null;
}

export interface DryRunInput {
  grid: ParsedGrid;
  fieldMap: FieldMapEntry[];
  projectSpecificationSet: string | null;
  /** Project-scoped templates already in this project — the dedup pool. */
  existingTemplates: ExistingTemplate[];
  resolutions?: Record<string, TemplateResolution>;
}

/** Dedup identity: normalized name + folded activity slug, scoped to the
 *  project. `stateSpec` is deliberately NOT part of the key (spec §9-D2). */
export function templateDedupKey(name: string, activitySlug: string): string {
  return `${name.trim().toLowerCase().replace(/\s+/g, ' ')}::${activitySlug}`;
}

interface RawTemplate {
  key: string;
  name: string;
  description: string | null;
  rawActivity: string;
  stateSpec: string | null;
  specificationReference: string | null;
  firstRowRef: DryRunRowRef;
  rows: { rowRef: DryRunRowRef; values: Partial<Record<ItpImportTarget, string>> }[];
}

function readRow(
  indexes: Map<ItpImportTarget, number>,
  transforms: Map<ItpImportTarget, ImportTransform | undefined>,
  cells: string[],
): Partial<Record<ItpImportTarget, string>> {
  const values: Partial<Record<ItpImportTarget, string>> = {};
  for (const [target, index] of indexes) {
    const raw = cells[index] ?? '';
    const value = applyTransform(transforms.get(target), raw);
    if (value) values[target] = value;
  }
  return values;
}

/** Group a sheet's rows into templates. A mapped `templateName` column groups
 *  by its value; without one the SHEET is the template — the near-universal AU
 *  layout of one ITP per tab. */
function collectTemplates(input: DryRunInput): {
  templates: RawTemplate[];
  unmapped: { sheet: string; headers: string[] }[];
  unmappedDescriptionSheets: Set<string>;
} {
  const templates: RawTemplate[] = [];
  const unmapped: { sheet: string; headers: string[] }[] = [];
  const unmappedDescriptionSheets = new Set<string>();

  const transforms = new Map<ItpImportTarget, ImportTransform | undefined>(
    input.fieldMap.map((entry) => [
      entry.target as ItpImportTarget,
      entry.transform as ImportTransform | undefined,
    ]),
  );

  for (const sheet of input.grid.sheets) {
    const indexes = resolveColumnIndexes(input.fieldMap, sheet.headers);
    const claimed = new Set(indexes.values());
    const unmappedHeaders = sheet.headers.filter((_, index) => !claimed.has(index));
    if (unmappedHeaders.length > 0) unmapped.push({ sheet: sheet.name, headers: unmappedHeaders });

    if (!indexes.has('description')) {
      unmappedDescriptionSheets.add(sheet.name);
    }

    const bySheetKey = new Map<string, RawTemplate>();
    sheet.rows.forEach((cells, offset) => {
      // +2: 1-based sheet rows, and the header row itself is row 1.
      const rowRef: DryRunRowRef = { sheet: sheet.name, rowIndex: offset + 2 };
      const values = readRow(indexes, transforms, cells);
      const groupName = values.templateName?.trim() || sheet.name;
      const groupKey = `${sheet.name}::${groupName}`;

      let template = bySheetKey.get(groupKey);
      if (!template) {
        template = {
          key: groupKey,
          name: groupName,
          description: null,
          rawActivity: '',
          stateSpec: null,
          specificationReference: null,
          firstRowRef: rowRef,
          rows: [],
        };
        bySheetKey.set(groupKey, template);
        templates.push(template);
      }

      // Template-level attributes take the first non-empty value they see.
      template.description ||= values.templateDescription ?? null;
      template.rawActivity ||= values.activityType ?? '';
      template.stateSpec ||= values.stateSpec ?? null;
      template.specificationReference ||= values.specificationReference ?? null;

      if (values.description) template.rows.push({ rowRef, values });
    });
  }

  return { templates, unmapped, unmappedDescriptionSheets };
}

interface LengthCheck {
  field: string;
  value: string | null | undefined;
  max: number;
}

function firstOverLength(
  checks: LengthCheck[],
): { field: string; length: number; max: number } | null {
  for (const check of checks) {
    if (check.value && check.value.length > check.max) {
      return { field: check.field, length: check.value.length, max: check.max };
    }
  }
  return null;
}

/**
 * Compute the dry run and the payload it would produce. Every §4.10 rule is
 * enforced here and re-asserted at apply.
 */
export function computeItpImportDryRun(input: DryRunInput): {
  dryRun: DryRunResult;
  templates: ProposedTemplate[];
} {
  const resolutions = input.resolutions ?? {};
  const { templates: raw, unmapped, unmappedDescriptionSheets } = collectTemplates(input);

  if (raw.length > MAX_IMPORT_TEMPLATES_PER_BATCH) {
    throw AppError.badRequest(
      `That file holds ${raw.length} ITPs — more than the ${MAX_IMPORT_TEMPLATES_PER_BATCH} an import can apply at once. Split it into smaller files.`,
      { code: 'IMPORT_TEMPLATE_CAP_EXCEEDED' },
    );
  }
  const totalRows = raw.reduce((sum, template) => sum + template.rows.length, 0);
  if (totalRows > MAX_IMPORT_CHECKLIST_ITEMS_PER_BATCH) {
    throw AppError.badRequest(
      `That file holds ${totalRows} checklist rows — more than the ${MAX_IMPORT_CHECKLIST_ITEMS_PER_BATCH} an import can apply at once. Split it into smaller files.`,
      { code: 'IMPORT_CHECKLIST_CAP_EXCEEDED' },
    );
  }

  const projectSpec = normalizeSpecSet(input.projectSpecificationSet);
  const existingByKey = new Map<string, ExistingTemplate>();
  for (const template of input.existingTemplates) {
    const fold = foldActivityValue(template.activityType);
    existingByKey.set(templateDedupKey(template.name, fold.slug), template);
  }

  // Pass 1: resolve identity so intra-batch collisions are known before any row
  // is judged against the database.
  const identities = raw.map((template) => {
    const resolution = resolutions[template.key] ?? {};
    const resolvedBy: 'source_column' | 'reviewer' = resolution.activitySlug
      ? 'reviewer'
      : 'source_column';
    const fold = foldActivityValue(resolution.activitySlug || template.rawActivity);
    return { template, resolution, fold, resolvedBy };
  });

  const keyOwners = new Map<string, DryRunRowRef[]>();
  for (const { template, fold } of identities) {
    if (fold.confidence === 'none') continue;
    const key = templateDedupKey(template.name, fold.slug);
    keyOwners.set(key, [...(keyOwners.get(key) ?? []), template.firstRowRef]);
  }

  const rows: DryRunRow[] = [];
  const proposed: ProposedTemplate[] = [];

  for (const { template, resolution, fold, resolvedBy } of identities) {
    const base: DryRunRow = {
      key: template.key,
      unit: 'template',
      rowRef: template.firstRowRef,
      label: template.name,
      outcome: 'create',
      checklistItemCount: template.rows.length,
      declaredStateSpec: template.stateSpec,
    };

    if (resolution.skip) {
      rows.push({ ...base, outcome: 'skip' });
      continue;
    }

    if (unmappedDescriptionSheets.has(template.firstRowRef.sheet)) {
      rows.push({
        ...base,
        outcome: 'blocked',
        reason: 'unmapped_column',
      });
      continue;
    }

    const keptRows = template.rows.filter(
      (row) => !(resolution.skipRows ?? []).includes(row.rowRef.rowIndex),
    );

    if (keptRows.length === 0) {
      rows.push({ ...base, outcome: 'skip', reason: 'empty', checklistItemCount: 0 });
      continue;
    }

    // (d) Unresolvable activities cannot be applied — resolved or skipped only,
    // never defaulted to a fallback slug.
    if (fold.confidence === 'none') {
      rows.push({
        ...base,
        outcome: 'blocked',
        reason: 'unresolvable_activity',
        activityFold: 'none',
      });
      continue;
    }

    // (c) Over-length cells are rejected and flagged, never truncated.
    const templateOverLength = firstOverLength([
      { field: 'name', value: template.name, max: MAX_TEMPLATE_NAME_LENGTH },
      { field: 'description', value: template.description, max: MAX_TEMPLATE_DESCRIPTION_LENGTH },
      {
        field: 'specificationReference',
        value: template.specificationReference,
        max: MAX_SHORT_TEXT_LENGTH,
      },
      { field: 'stateSpec', value: template.stateSpec, max: MAX_SHORT_TEXT_LENGTH },
    ]);
    if (templateOverLength) {
      rows.push({
        ...base,
        outcome: 'blocked',
        reason: 'over_length',
        overLength: templateOverLength,
      });
      continue;
    }

    const overLengthRows = keptRows
      .map((row) => ({
        row,
        over: firstOverLength([
          {
            field: 'description',
            value: row.values.description,
            max: MAX_CHECKLIST_ITEM_DESCRIPTION_LENGTH,
          },
          {
            field: 'acceptanceCriteria',
            value: row.values.acceptanceCriteria,
            max: MAX_TEMPLATE_DESCRIPTION_LENGTH,
          },
          { field: 'pointType', value: row.values.pointType, max: MAX_SHORT_TEXT_LENGTH },
          {
            field: 'responsibleParty',
            value: row.values.responsibleParty,
            max: MAX_SHORT_TEXT_LENGTH,
          },
          {
            field: 'evidenceRequired',
            value: row.values.evidenceRequired,
            max: MAX_SHORT_TEXT_LENGTH,
          },
          { field: 'testType', value: row.values.testType, max: MAX_SHORT_TEXT_LENGTH },
        ]),
      }))
      .filter(
        (
          entry,
        ): entry is {
          row: (typeof keptRows)[number];
          over: NonNullable<ReturnType<typeof firstOverLength>>;
        } => entry.over !== null,
      );

    if (overLengthRows.length > 0) {
      for (const entry of overLengthRows) {
        rows.push({
          key: `row:${entry.row.rowRef.sheet}#${entry.row.rowRef.rowIndex}`,
          unit: 'checklist_row',
          rowRef: entry.row.rowRef,
          label: (entry.row.values.description ?? '').slice(0, 80),
          outcome: 'blocked',
          reason: 'over_length',
          overLength: entry.over,
        });
      }
      rows.push({
        ...base,
        outcome: 'blocked',
        reason: 'over_length',
        overLength: overLengthRows[0].over,
      });
      continue;
    }

    // (a) A declared spec set that contradicts the project's hard-fails unless
    // the reviewer explicitly affirms it. A blank declared spec is not a
    // conflict — it is merely unaffirmed (rule b).
    const declaredSpec = normalizeSpecSet(template.stateSpec);
    const conflicts = Boolean(declaredSpec && projectSpec && declaredSpec !== projectSpec);
    if (conflicts && !resolution.affirmSpec) {
      rows.push({ ...base, outcome: 'blocked', reason: 'state_spec_conflict' });
      continue;
    }

    const dedupKey = templateDedupKey(template.name, fold.slug);

    // Intra-batch twins: two rows IN THIS FILE resolving to the same identity.
    const owners = keyOwners.get(dedupKey) ?? [];
    if (owners.length > 1) {
      rows.push({
        ...base,
        outcome: 'needs_review',
        reason: 'slug_collision',
        collidesWith: owners.filter(
          (ref) =>
            ref.sheet !== template.firstRowRef.sheet ||
            ref.rowIndex !== template.firstRowRef.rowIndex,
        ),
        proposedActivitySlug: fold.slug,
        activityFold: fold.confidence,
      });
      continue;
    }

    const duplicate = existingByKey.get(dedupKey);
    if (duplicate) {
      rows.push({
        ...base,
        outcome: 'skip',
        reason: 'duplicate',
        duplicateOf: {
          model: 'ITPTemplate',
          id: duplicate.id,
          matchedOn: 'name + activity',
        },
        proposedActivitySlug: fold.slug,
        activityFold: fold.confidence,
      });
      continue;
    }

    const specAffirmed = Boolean(resolution.affirmSpec);
    rows.push({
      ...base,
      outcome: fold.confidence === 'family' ? 'needs_review' : 'create',
      ...(fold.confidence === 'family' ? { reason: 'ambiguous_activity' as const } : {}),
      proposedActivitySlug: fold.slug,
      activityFold: fold.confidence,
      specAffirmed,
    });

    proposed.push({
      key: template.key,
      name: template.name,
      description: template.description,
      activityType: fold.slug,
      stateSpec: template.stateSpec,
      specificationReference: template.specificationReference,
      specAffirmed,
      sourceRowRefs: keptRows.map((row) => row.rowRef),
      match: { activitySlug: fold.slug, foldConfidence: fold.confidence, resolvedBy },
      checklistItems: keptRows.map((row) => ({
        description: row.values.description as string,
        acceptanceCriteria: row.values.acceptanceCriteria ?? null,
        ...(row.values.pointType ? { pointType: row.values.pointType } : {}),
        ...(row.values.responsibleParty ? { responsibleParty: row.values.responsibleParty } : {}),
        ...(row.values.evidenceRequired ? { evidenceRequired: row.values.evidenceRequired } : {}),
        testType: row.values.testType ?? null,
      })),
    });
  }

  const counts: DryRunCounts = {
    willCreate: rows.filter((row) => row.outcome === 'create').length,
    willUpdate: rows.filter((row) => row.outcome === 'update').length,
    willSkip: rows.filter((row) => row.outcome === 'skip').length,
    needsReview: rows.filter((row) => row.outcome === 'needs_review').length,
    ambiguous: rows.filter((row) => row.reason === 'ambiguous_activity').length,
    blocked: rows.filter((row) => row.outcome === 'blocked').length,
  };

  // A batch with unresolved intra-batch twins cannot be applied either —
  // silently importing one of two identically-named ITPs is the kind of error a
  // contractor finds six months later, in an audit.
  const unresolvedCollisions = rows.some((row) => row.reason === 'slug_collision');
  const applicable = proposed.length > 0;

  return {
    dryRun: {
      counts,
      rows,
      unmappedHeaders: unmapped,
      canApply: counts.blocked === 0 && !unresolvedCollisions && applicable,
    },
    templates: proposed,
  };
}
