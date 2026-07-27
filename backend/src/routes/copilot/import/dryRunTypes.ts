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
}

export interface DryRunCounts {
  willCreate: number;
  willUpdate: number;
  willSkip: number;
  needsReview: number;
  ambiguous: number;
  blocked: number;
}

export interface DryRunResult {
  counts: DryRunCounts;
  rows: DryRunRow[];
  unmappedHeaders: { sheet: string; headers: string[] }[];
  /** Apply is refused while this is false (blocked rows or unresolved twins). */
  canApply: boolean;
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
  };
}
