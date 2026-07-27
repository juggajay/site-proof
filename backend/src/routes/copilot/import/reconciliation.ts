/**
 * Wave B — the reconciliation report: what imported (with new ids), what was
 * skipped and why, what was blocked (spec §3.6).
 *
 * The CSV goes through `csvSafe.ts`, so a reconciliation row carrying a leading
 * `=` from a hostile source file cannot become a live formula in the
 * contractor's Excel.
 */
import {
  buildCsv,
  buildCsvBrandingRows,
  type CsvBrandingContext,
  type CsvCell,
} from '../../../lib/csvSafe.js';
import type { DryRunResult, DryRunRow } from './dryRunTypes.js';

export interface ReconciliationEntry extends DryRunRow {
  /** Id of the record this row created, when it created one. */
  createdId?: string;
}

export interface ReconciliationReport {
  batchId: string;
  status: string;
  failedReason: string | null;
  sourceFileName: string | null;
  /** Provenance degrades, it does not crash: an applied batch whose source
   *  document is gone still renders. */
  sourceAvailable: boolean;
  counts: DryRunResult['counts'];
  entries: ReconciliationEntry[];
  createdRecordIds: string[];
}

export interface ReconciliationInput {
  batchId: string;
  status: string;
  failedReason: string | null;
  sourceFileName: string | null;
  sourceDocumentId: string | null;
  dryRun: DryRunResult | null;
  /** Ids the apply handler created, in the order the payload listed them. */
  createdRecordIds: string[];
  /** Ledger keys in payload order, so ids line up with ledger entries. */
  appliedItemKeys: string[];
}

export function buildReconciliationReport(input: ReconciliationInput): ReconciliationReport {
  const idByKey = new Map<string, string>();
  input.appliedItemKeys.forEach((key, index) => {
    const id = input.createdRecordIds[index];
    if (id) idByKey.set(key, id);
  });

  const rows = input.dryRun?.rows ?? [];
  return {
    batchId: input.batchId,
    status: input.status,
    failedReason: input.failedReason,
    sourceFileName: input.sourceFileName,
    sourceAvailable: Boolean(input.sourceDocumentId),
    counts: input.dryRun?.counts ?? {
      willCreate: 0,
      willUpdate: 0,
      willSkip: 0,
      needsReview: 0,
      ambiguous: 0,
      blocked: 0,
    },
    entries: rows.map((row) => {
      const createdId = idByKey.get(row.key);
      return createdId ? { ...row, createdId } : row;
    }),
    createdRecordIds: input.createdRecordIds,
  };
}

/** Human-readable detail for a ledger row: the "why" column. */
function entryDetail(entry: ReconciliationEntry): string {
  // A reason code the dry run could not say in a code alone — the sufficiency
  // validator's own wording, a backwards chainage, an unknown unit.
  if (entry.detail) return entry.detail;
  if (entry.overLength) {
    return `${entry.overLength.field} is ${entry.overLength.length} characters (max ${entry.overLength.max})`;
  }
  if (entry.duplicateOf) {
    return `matches existing ${entry.duplicateOf.model} on ${entry.duplicateOf.matchedOn}`;
  }
  if (entry.collidesWith?.length) {
    return `also appears at ${entry.collidesWith
      .map((ref) => `${ref.sheet} row ${ref.rowIndex}`)
      .join('; ')}`;
  }
  if (entry.reason === 'state_spec_conflict') {
    return `declares ${entry.declaredStateSpec ?? 'a different specification'}`;
  }
  if (entry.reason === 'unresolvable_activity') {
    return 'no recognised activity';
  }
  if (entry.reason === 'unmapped_column') {
    return 'no column is mapped to the checklist description';
  }
  return '';
}

export function buildReconciliationCsv(
  report: ReconciliationReport,
  title: string,
  branding: CsvBrandingContext | null | undefined,
): string {
  const rows: CsvCell[][] = [
    ...buildCsvBrandingRows(title, branding),
    [`# Source file: ${report.sourceFileName ?? 'source file no longer available'}`],
    ['Sheet', 'Row', 'Unit', 'Name', 'Outcome', 'Reason', 'Detail', 'Created ID'],
    ...report.entries.map((entry) => [
      entry.rowRef.sheet,
      entry.rowRef.rowIndex,
      entry.unit,
      entry.label,
      entry.outcome,
      entry.reason ?? '',
      entryDetail(entry),
      entry.createdId ?? '',
    ]),
  ];
  return buildCsv(rows);
}
