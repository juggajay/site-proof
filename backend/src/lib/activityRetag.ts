import { foldActivityValue } from './activityTaxonomy.js';

// Pure planning logic for the operator-gated ITPTemplate activity re-tag
// (scripts/retag-template-activities.ts). Kept here so it is unit-testable and
// so the CLI stays a thin I/O shell.

export interface TemplateRow {
  id: string;
  name: string;
  projectId: string | null;
  activityType: string | null;
}

export interface RetagAction {
  id: string;
  name: string;
  projectId: string | null;
  from: string;
  to: string;
}

export interface RetagPlan {
  actions: RetagAction[];
  /** Rows left untouched: value folds to a family / none, or is already canonical. */
  skipped: number;
}

/**
 * Pick only the rows whose activityType folds to an EXACT canonical slug that
 * differs from what's stored. Family-level folds ('drainage', 'structural', …),
 * unclassifiable values, empty values, and already-canonical values are all
 * skipped — this never guesses and never produces a no-op write.
 */
export function computeRetagPlan(rows: TemplateRow[]): RetagPlan {
  const actions: RetagAction[] = [];
  for (const row of rows) {
    const current = row.activityType ?? '';
    const fold = foldActivityValue(current);
    if (fold.confidence !== 'exact') continue; // family / none — never guess
    if (fold.slug === current) continue; // already canonical — no-op
    actions.push({
      id: row.id,
      name: row.name,
      projectId: row.projectId,
      from: current,
      to: fold.slug,
    });
  }
  return { actions, skipped: rows.length - actions.length };
}
