/**
 * Wave B B2 — the lot-register dry run: what WOULD happen, computed before any
 * write, shown as counts before commit (spec §3.4).
 *
 * Pure — no I/O — so every safety rule is unit-testable without a database, the
 * same way the ITP dry run is.
 *
 * The unit here is one LOT per source row. That is the register's own grain, and
 * unlike the ITP importer there is no second level to drill into.
 *
 * This is the surface that replaces the shipped client-side CSV importer
 * (spec §2.5). The behaviours it deliberately does NOT inherit:
 *  - an unmappable or empty activity is BLOCKED, never defaulted to
 *    `earthworks_general` behind a warning the user can click past (§4.10d);
 *  - a `testScale`/`materialType` the project's governing spec does not use is
 *    BLOCKED here rather than thrown by `assertLotSufficiencyAttributes` mid-
 *    apply, so an imported register can never 500 and can never be silently
 *    dropped (D14.1);
 *  - nothing is written until a human accepts one reviewed proposal.
 */
import { foldActivityValue } from '../../../lib/activityTaxonomy.js';
import { AppError } from '../../../lib/AppError.js';
import { QUANTITY_UNITS } from '../../../lib/readiness/sufficiency/types.js';
import {
  assertLotSufficiencyAttributes,
  type LotSufficiencyAttributeProject,
} from '../../../lib/readiness/sufficiency/lotAttributeValidation.js';
import {
  MAX_BULK_LOTS,
  MAX_DESCRIPTION_LENGTH,
  MAX_LOT_NUMBER_LENGTH,
  MAX_SHORT_TEXT_LENGTH,
} from '../../lots/validation.js';
import {
  countDryRunRows,
  markWillImport,
  type DryRunResult,
  type DryRunRow,
  type DryRunRowRef,
} from './dryRunTypes.js';
import type { ParsedGrid } from './excelParser.js';
import { parseChainage, parseNumber } from './numberParsing.js';
import {
  applyTransform,
  resolveColumnIndexes,
  type FieldMapEntry,
  type ImportTransform,
  type LotImportTarget,
} from './mappingProfiles.js';

/** Spec §3.5: the register batch reuses the cap `bulkCreateLotsCoreSchema`
 *  already enforces. Past it the file is rejected with a split-it instruction —
 *  never silently truncated, never silently chunked. */
export const MAX_IMPORT_LOTS_PER_BATCH = MAX_BULK_LOTS;

/** `layer` rides the lot schema's short-text cap — the lots module's own `= 100`,
 *  NOT the exported constant of the same name and a different value (120) in
 *  `routes/itp/templateValidation.ts`. Grep by file. */
const MAX_LOT_SHORT_TEXT_LENGTH = MAX_SHORT_TEXT_LENGTH;

/** What the reviewer decided about one proposed lot. */
export interface LotResolution {
  /** Reviewer-picked canonical activity slug for an unrecognised activity. */
  activitySlug?: string;
  /** Exclude this lot from the batch entirely. */
  skip?: boolean;
}

/** One lot the batch would create, shaped for `bulkCreateLotsCoreSchema`. */
export interface ProposedLot {
  /** Ledger key, carried through the payload so reconciliation lines ids up. */
  key: string;
  lotNumber: string;
  description: string | null;
  activityType: string;
  chainageStart: number | null;
  chainageEnd: number | null;
  layer: string | null;
  testScale: string | null;
  materialType: string | null;
  quantityValue: number | null;
  quantityUnit: string | null;
  itpTemplateId: string | null;
}

export interface ExistingLot {
  id: string;
  lotNumber: string;
}

export interface LotRegisterDryRunInput {
  grid: ParsedGrid;
  fieldMap: FieldMapEntry[];
  /** Drives the sufficiency vocabulary check; the same object the write path uses. */
  project: LotSufficiencyAttributeProject;
  /** Lot numbers already in this project — the dedup pool. */
  existingLots: ExistingLot[];
  /** Project ITP templates an `itpTemplateName` column can name. */
  templates: { id: string; name: string }[];
  resolutions?: Record<string, LotResolution>;
}

function normalizeLotNumber(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

interface RawLotRow {
  key: string;
  rowRef: { sheet: string; rowIndex: number };
  values: Partial<Record<LotImportTarget, string>>;
}

function collectRows(input: LotRegisterDryRunInput): {
  rows: RawLotRow[];
  unmapped: { sheet: string; headers: string[] }[];
  sheetsWithoutLotNumber: Set<string>;
} {
  const transforms = new Map<LotImportTarget, ImportTransform | undefined>(
    input.fieldMap.map((entry) => [
      entry.target as LotImportTarget,
      entry.transform as ImportTransform | undefined,
    ]),
  );

  const rows: RawLotRow[] = [];
  const unmapped: { sheet: string; headers: string[] }[] = [];
  const sheetsWithoutLotNumber = new Set<string>();

  for (const sheet of input.grid.sheets) {
    const indexes = resolveColumnIndexes<LotImportTarget>(input.fieldMap, sheet.headers);
    const claimed = new Set(indexes.values());
    const unmappedHeaders = sheet.headers.filter((_, index) => !claimed.has(index));
    if (unmappedHeaders.length > 0) unmapped.push({ sheet: sheet.name, headers: unmappedHeaders });
    if (!indexes.has('lotNumber')) sheetsWithoutLotNumber.add(sheet.name);

    sheet.rows.forEach((cells, offset) => {
      // +2: 1-based sheet rows, and the header row itself is row 1.
      const rowIndex = offset + 2;
      const values: Partial<Record<LotImportTarget, string>> = {};
      for (const [target, index] of indexes) {
        const value = applyTransform(transforms.get(target), cells[index] ?? '');
        if (value) values[target] = value;
      }
      rows.push({
        key: `lot:${sheet.name}#${rowIndex}`,
        rowRef: { sheet: sheet.name, rowIndex },
        values,
      });
    });
  }

  return { rows, unmapped, sheetsWithoutLotNumber };
}

/** Everything a stopped row contributes to its ledger entry. */
type Verdict = Pick<
  DryRunRow,
  | 'outcome'
  | 'reason'
  | 'detail'
  | 'overLength'
  | 'collidesWith'
  | 'duplicateOf'
  | 'activityFold'
  | 'proposedActivitySlug'
>;

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

function blocked(reason: DryRunRow['reason'], detail?: string): Verdict {
  return { outcome: 'blocked', reason, ...(detail ? { detail } : {}) };
}

/**
 * Is this row a lot at all, and is it a lot this project does not already have?
 * Returns the verdict that STOPS the row, or null to carry on.
 */
function judgeIdentity(
  row: RawLotRow,
  lotNumber: string,
  resolution: LotResolution,
  context: {
    sheetsWithoutLotNumber: Set<string>;
    numberOwners: Map<string, DryRunRowRef[]>;
    existingByNumber: Map<string, ExistingLot>;
  },
): Verdict | null {
  if (resolution.skip) return { outcome: 'skip' };
  if (context.sheetsWithoutLotNumber.has(row.rowRef.sheet)) {
    return blocked('unmapped_column');
  }
  // A register's trailing blank rows are not an error — they are just blank.
  if (!lotNumber) return { outcome: 'skip', reason: 'empty' };

  const overLength = firstOverLength([
    { field: 'lotNumber', value: lotNumber, max: MAX_LOT_NUMBER_LENGTH },
    { field: 'description', value: row.values.description, max: MAX_DESCRIPTION_LENGTH },
    { field: 'layer', value: row.values.layer, max: MAX_LOT_SHORT_TEXT_LENGTH },
  ]);
  if (overLength) return { outcome: 'blocked', reason: 'over_length', overLength };

  // Twins inside this file: the bulk schema refuses duplicate lot numbers
  // wholesale, so this must be resolved, not warned about.
  const owners = context.numberOwners.get(normalizeLotNumber(lotNumber)) ?? [];
  if (owners.length > 1) {
    return {
      outcome: 'needs_review',
      reason: 'slug_collision',
      collidesWith: owners.filter(
        (ref) => ref.sheet !== row.rowRef.sheet || ref.rowIndex !== row.rowRef.rowIndex,
      ),
    };
  }

  const duplicate = context.existingByNumber.get(normalizeLotNumber(lotNumber));
  if (duplicate) {
    return {
      outcome: 'skip',
      reason: 'duplicate',
      duplicateOf: { model: 'Lot', id: duplicate.id, matchedOn: 'lot number' },
    };
  }
  return null;
}

interface LotValues {
  activityType: string;
  fold: ReturnType<typeof foldActivityValue>;
  chainageStart: number | null;
  chainageEnd: number | null;
  testScale: string | null;
  materialType: string | null;
  quantityValue: number | null;
  quantityUnit: string | null;
}

/**
 * Can every cell this row carries actually be written? Returns the verdict that
 * STOPS the row, or the parsed values that go into the payload.
 *
 * The activity rule is the §2.5 defect closed: a value that folds to nothing —
 * INCLUDING an empty cell, where `createBulkLots` would otherwise write
 * 'Earthworks' — cannot be applied. Resolved or skipped only, never defaulted.
 */
function judgeValues(
  row: RawLotRow,
  lotNumber: string,
  resolution: LotResolution,
  project: LotSufficiencyAttributeProject,
): { verdict: Verdict } | { values: LotValues } {
  const rawActivity = resolution.activitySlug || row.values.activityType || '';
  const fold = foldActivityValue(rawActivity);
  if (fold.confidence === 'none') {
    return {
      verdict: {
        ...blocked(
          'unresolvable_activity',
          rawActivity
            ? `"${rawActivity}" is not an activity SiteProof recognises.`
            : 'This row has no activity.',
        ),
        activityFold: 'none',
      },
    };
  }

  const chainage = judgeChainage(row);
  if ('verdict' in chainage) return chainage;

  const quantity = judgeQuantity(row);
  if ('verdict' in quantity) return quantity;

  // D14.1: the SAME validator the write path runs, run here so its refusal is a
  // reviewable ledger row instead of a mid-apply throw.
  const testScale = row.values.testScale ?? null;
  const materialType = row.values.materialType ?? null;
  if (testScale || materialType) {
    try {
      assertLotSufficiencyAttributes(project, { testScale, materialType }, lotNumber);
    } catch (error) {
      return {
        verdict: blocked(
          'unsupported_attribute',
          error instanceof AppError ? error.message : 'That value cannot be used here.',
        ),
      };
    }
  }

  return {
    values: {
      // A family-level fold keeps the source text so the specific activity can be
      // chosen on the lot afterwards; `activitySlugForWrite` folds it on write.
      activityType: fold.confidence === 'exact' ? fold.slug : rawActivity,
      fold,
      ...chainage.chainage,
      testScale,
      materialType,
      ...quantity.quantity,
    },
  };
}

/** A chainage a register carries must be a pair of numbers in order, or nothing. */
function judgeChainage(
  row: RawLotRow,
):
  | { verdict: Verdict }
  | { chainage: { chainageStart: number | null; chainageEnd: number | null } } {
  const chainageStart = row.values.chainageStart ? parseChainage(row.values.chainageStart) : null;
  const chainageEnd = row.values.chainageEnd ? parseChainage(row.values.chainageEnd) : null;
  const unreadable =
    (row.values.chainageStart && chainageStart === null) ||
    (row.values.chainageEnd && chainageEnd === null);
  if (unreadable) {
    return {
      verdict: blocked(
        'invalid_value',
        'The chainage cells cannot be read as chainage. Use metres (1020) or stationing (CH 1+020).',
      ),
    };
  }
  if (chainageStart !== null && chainageEnd !== null && chainageStart > chainageEnd) {
    return {
      verdict: blocked(
        'invalid_value',
        `Chainage ${chainageStart} to ${chainageEnd} runs backwards.`,
      ),
    };
  }
  return { chainage: { chainageStart, chainageEnd } };
}

/** A quantity must be positive and its unit one SiteProof measures in. */
function judgeQuantity(
  row: RawLotRow,
):
  | { verdict: Verdict }
  | { quantity: { quantityValue: number | null; quantityUnit: string | null } } {
  const quantityValue = row.values.quantityValue ? parseNumber(row.values.quantityValue) : null;
  if (row.values.quantityValue && (quantityValue === null || quantityValue <= 0)) {
    return {
      verdict: blocked('invalid_value', `"${row.values.quantityValue}" is not a quantity.`),
    };
  }
  const quantityUnit = row.values.quantityUnit ?? null;
  if (quantityUnit && !(QUANTITY_UNITS as readonly string[]).includes(quantityUnit)) {
    return {
      verdict: blocked(
        'invalid_value',
        `"${quantityUnit}" is not a unit SiteProof uses. Valid units: ${QUANTITY_UNITS.join(', ')}.`,
      ),
    };
  }
  return { quantity: { quantityValue, quantityUnit } };
}

/**
 * Compute the dry run and the payload it would produce. Every rule enforced here
 * is re-asserted at apply, because the payload reaching apply may be an
 * `editedPayload` the reviewer supplied.
 */
export function computeLotRegisterDryRun(input: LotRegisterDryRunInput): {
  dryRun: DryRunResult;
  lots: ProposedLot[];
} {
  const resolutions = input.resolutions ?? {};
  const { rows: raw, unmapped, sheetsWithoutLotNumber } = collectRows(input);

  if (raw.length > MAX_IMPORT_LOTS_PER_BATCH) {
    throw AppError.badRequest(
      `That register holds ${raw.length} rows — more than the ${MAX_IMPORT_LOTS_PER_BATCH} lots an import can create at once. Split it into smaller files.`,
      { code: 'IMPORT_LOT_CAP_EXCEEDED' },
    );
  }

  const existingByNumber = new Map(
    input.existingLots.map((lot) => [normalizeLotNumber(lot.lotNumber), lot]),
  );
  const templateByName = new Map(
    input.templates.map((template) => [normalizeName(template.name), template]),
  );

  // Pass 1: intra-file twins are known before any row is judged against the DB.
  const numberOwners = new Map<string, DryRunRowRef[]>();
  for (const row of raw) {
    const lotNumber = row.values.lotNumber?.trim();
    if (!lotNumber) continue;
    const key = normalizeLotNumber(lotNumber);
    numberOwners.set(key, [...(numberOwners.get(key) ?? []), row.rowRef]);
  }
  const identityContext = { sheetsWithoutLotNumber, numberOwners, existingByNumber };

  const ledger: DryRunRow[] = [];
  const proposed: ProposedLot[] = [];

  for (const row of raw) {
    const resolution = resolutions[row.key] ?? {};
    const lotNumber = row.values.lotNumber?.trim() ?? '';
    const base: DryRunRow = {
      key: row.key,
      unit: 'lot',
      rowRef: row.rowRef,
      label: lotNumber || `${row.rowRef.sheet} row ${row.rowRef.rowIndex}`,
      outcome: 'create',
    };

    const identity = judgeIdentity(row, lotNumber, resolution, identityContext);
    if (identity) {
      ledger.push({ ...base, ...identity });
      continue;
    }

    const judged = judgeValues(row, lotNumber, resolution, input.project);
    if ('verdict' in judged) {
      ledger.push({ ...base, ...judged.verdict });
      continue;
    }
    const values = judged.values;

    // The register names an ITP: match it by name against this project's own
    // templates. Never created, never matched across projects.
    // ponytail: name match only. Activity-based auto-linking is matcher territory
    // (Wave 2) and would be an unreviewed Tier-A decision at 500-lot scale.
    const templateName = row.values.itpTemplateName?.trim();
    const template = templateName ? templateByName.get(normalizeName(templateName)) : undefined;
    if (templateName && !template) {
      ledger.push({
        ...base,
        outcome: 'needs_review',
        reason: 'template_not_found',
        detail: `No ITP called "${templateName}" in this project — the lot imports without one.`,
      });
    } else {
      ledger.push({
        ...base,
        outcome: values.fold.confidence === 'family' ? 'needs_review' : 'create',
        ...(values.fold.confidence === 'family' ? { reason: 'ambiguous_activity' as const } : {}),
        proposedActivitySlug: values.fold.slug,
        activityFold: values.fold.confidence,
      });
    }

    proposed.push({
      key: row.key,
      lotNumber,
      description: row.values.description ?? null,
      activityType: values.activityType,
      chainageStart: values.chainageStart,
      chainageEnd: values.chainageEnd,
      layer: row.values.layer ?? null,
      testScale: values.testScale,
      materialType: values.materialType,
      quantityValue: values.quantityValue,
      quantityUnit: values.quantityUnit,
      itpTemplateId: template?.id ?? null,
    });
  }

  // The CTA's number comes off the payload, not off the outcomes (§M10).
  const rows = markWillImport(
    ledger,
    proposed.map((lot) => lot.key),
  );
  const counts = countDryRunRows(rows);
  const unresolvedCollisions = rows.some((row) => row.reason === 'slug_collision');
  return {
    dryRun: {
      counts,
      rows,
      unmappedHeaders: unmapped,
      canApply: counts.blocked === 0 && !unresolvedCollisions && proposed.length > 0,
    },
    lots: proposed,
  };
}
