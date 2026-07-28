/**
 * Wave B — the ledger shape every import kind produces (spec §3.4).
 *
 * Extracted in B2 so the lot-register dry run and the ITP dry run emit the SAME
 * rows, counts and `canApply` contract, and so one review surface and one
 * reconciliation report can render either. `itpImportDryRun.ts` re-exports these
 * verbatim, so B1's imports are unchanged.
 */

export type DryRunOutcome = 'create' | 'update' | 'skip' | 'needs_review' | 'blocked';

export type DryRunReason =
  | 'duplicate'
  | 'slug_collision'
  | 'unmapped_column'
  | 'ambiguous_activity'
  | 'unresolvable_activity'
  | 'over_length'
  | 'state_spec_conflict'
  | 'milestone_point_type'
  | 'low_confidence'
  | 'empty'
  // B2, lot registers:
  /** A cell the schema cannot parse at all — a chainage that is not a number, a
   *  quantity unit outside the vocabulary, an end before its start. */
  | 'invalid_value'
  /** A `testScale`/`materialType` the project's governing spec does not use.
   *  Caught at dry run so the sufficiency validator can never 500 an apply. */
  | 'unsupported_attribute'
  /** The register names an ITP this project does not have. */
  | 'template_not_found';

export interface DryRunRowRef {
  sheet: string;
  rowIndex: number;
}

/**
 * B3 §4.5 — what a corporate master would change in the project's controlled
 * copy. Present only on a `duplicate` row whose content actually differs, so the
 * reviewer SEES the difference instead of the import silently overwriting the
 * project's copy or silently skipping a real revision.
 */
export interface ChecklistDiff {
  added: number;
  removed: number;
  changed: number;
  /** Capped sample, so the stored ledger stays inside the §3.7 byte budget. */
  items: { change: 'added' | 'removed' | 'changed'; description: string }[];
}

export interface DryRunRow {
  /** Stable handle the reviewer's resolutions key off. */
  key: string;
  unit: 'template' | 'checklist_row' | 'lot';
  rowRef: DryRunRowRef;
  label: string;
  outcome: DryRunOutcome;
  reason?: DryRunReason;
  /** Free text the reviewer needs and the reason code cannot carry — e.g. the
   *  validator's own "valid scales are …" message. */
  detail?: string;
  duplicateOf?: { model: string; id: string; matchedOn: string };
  /** Set with `reason: 'duplicate'` when the project's copy differs (§4.5). */
  diff?: ChecklistDiff;
  collidesWith?: DryRunRowRef[];
  overLength?: { field: string; length: number; max: number };
  proposedActivitySlug?: string;
  activityFold?: 'exact' | 'family' | 'none';
  declaredStateSpec?: string | null;
  specAffirmed?: boolean;
  checklistItemCount?: number;
  /** This row really is in the payload Apply would write. Derived from the
   *  payload, never from the outcome — see `markWillImport`. */
  willImport?: boolean;
  /** For a `checklist_row` entry, the ledger key of the template it belongs to.
   *  That is the key a `skipRows` resolution has to be written against, so
   *  without it the review surface cannot offer the skip its own message
   *  recommends. */
  parentKey?: string;
}

export interface DryRunCounts {
  willCreate: number;
  willUpdate: number;
  willSkip: number;
  needsReview: number;
  ambiguous: number;
  blocked: number;
  /**
   * How many records Apply would actually create — the Apply CTA's number.
   *
   * NOT derivable from the outcomes: a `needs_review` row may or may not be in
   * the payload depending on WHY it needs review (an ambiguous activity still
   * imports; a duplicate or an unresolved twin does not). The CTA used to add
   * up the outcomes it believed meant "creates", and every reason added since
   * that could both need review AND import — `template_not_found` — was left
   * out of the number while its lot was still written.
   */
  willImport: number;
}

export interface DryRunResult {
  counts: DryRunCounts;
  rows: DryRunRow[];
  unmappedHeaders: { sheet: string; headers: string[] }[];
  /** Apply is refused while this is false (blocked rows or unresolved twins). */
  canApply: boolean;
}

/**
 * Flag the ledger rows that are really in the payload, by pairing the ledger's
 * own keys with the payload's. One place, for every import kind: a new
 * outcome/reason combination cannot silently fall out of the count, because the
 * count is read off the payload rather than guessed from the outcome.
 */
export function markWillImport(rows: DryRunRow[], proposedKeys: string[]): DryRunRow[] {
  const proposed = new Set(proposedKeys);
  return rows.map((row) => (proposed.has(row.key) ? { ...row, willImport: true } : row));
}

/** The counts block, derived from the rows so the two can never disagree. */
export function countDryRunRows(rows: DryRunRow[]): DryRunCounts {
  return {
    willCreate: rows.filter((row) => row.outcome === 'create').length,
    willUpdate: rows.filter((row) => row.outcome === 'update').length,
    willSkip: rows.filter((row) => row.outcome === 'skip').length,
    needsReview: rows.filter((row) => row.outcome === 'needs_review').length,
    ambiguous: rows.filter((row) => row.reason === 'ambiguous_activity').length,
    blocked: rows.filter((row) => row.outcome === 'blocked').length,
    willImport: rows.filter((row) => row.willImport).length,
  };
}
