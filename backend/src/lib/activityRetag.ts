import { foldActivityValue, isCanonicalActivitySlug } from './activityTaxonomy.js';

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

// ---------------------------------------------------------------------------
// Seeder-name-driven re-tag (W2-PR1.5)
//
// Seeders skip templates that already exist by name, so the ~110 seeded rows
// in prod kept their family-level activityType when #1496 re-tagged the seeder
// FILES. The value alone can't decide those rows ('drainage' spans four
// slugs) — but the template NAME can: each seeder template name maps to
// exactly one canonical slug in its seeder file. This mode parses those files
// as data (running them would seed) and re-tags GLOBAL rows by exact name.
// ---------------------------------------------------------------------------

export interface SeederTemplateTag {
  name: string;
  activityType: string;
}

/**
 * Extract `{ name, activityType }` pairs from a seeder file's source. Template
 * objects open with `name: '...'` and carry `activityType: '...'` a couple of
 * lines later; checklist items have neither key as a string literal, and the
 * Prisma create block references `templateFields.name` (not a literal), so the
 * literal-pair regex only ever binds inside one template object. Parsed tags
 * must be canonical to produce a pair; a deliberate family-level tag (e.g. the
 * Warm Mix/RAP templates kept at 'asphalt' because they span asphalt types) is
 * SKIPPED — the name can't improve on a judgment the seeder already declined
 * to make. Anything else (typo, unknown slug) throws: bad data, don't plan.
 */
export function extractSeederTemplateTags(source: string, fileLabel: string): SeederTemplateTag[] {
  const pairs: SeederTemplateTag[] = [];
  // Explicit template-object shape: name, then an optional description string
  // (any length), then activityType. No arbitrary distance window — a
  // structure change in the seeders fails loudly via the zero-pairs guard.
  const re =
    /name:\s*'((?:[^'\\]|\\.)+)',\s*(?:description:\s*'(?:[^'\\]|\\.)*',\s*)?activityType:\s*'([a-z0-9_]+)'/g;
  for (const match of source.matchAll(re)) {
    const name = match[1].replace(/\\'/g, "'");
    const activityType = match[2];
    if (!isCanonicalActivitySlug(activityType)) {
      if (foldActivityValue(activityType).confidence === 'family') continue; // deliberate
      throw new Error(
        `${fileLabel}: template "${name}" has unknown activityType "${activityType}" — fix the seeder before re-tagging from it.`,
      );
    }
    pairs.push({ name, activityType });
  }
  if (pairs.length === 0) {
    throw new Error(
      `${fileLabel}: no template name/activityType pairs found — parser or file changed shape.`,
    );
  }
  return pairs;
}

/**
 * Merge per-file tags into one name → slug map. A name appearing twice with
 * DIFFERENT slugs is an error (the name is our only key); the same slug twice
 * is fine (idempotent).
 */
export function buildSeederNameMap(tagsByFile: SeederTemplateTag[][]): Map<string, string> {
  const map = new Map<string, string>();
  for (const tags of tagsByFile) {
    for (const tag of tags) {
      const existing = map.get(tag.name);
      if (existing && existing !== tag.activityType) {
        throw new Error(
          `Seeder template name "${tag.name}" maps to both "${existing}" and "${tag.activityType}" — names must be unique to re-tag by name.`,
        );
      }
      map.set(tag.name, tag.activityType);
    }
  }
  return map;
}

/**
 * Plan name-driven re-tags. GLOBAL rows only (projectId null — project copies
 * are user-owned), exact name match required, and rows whose stored value is
 * already a canonical slug are left alone even if it differs from the seeder
 * (someone chose it deliberately).
 */
export function computeSeededRetagPlan(
  rows: TemplateRow[],
  nameMap: Map<string, string>,
): RetagPlan {
  const actions: RetagAction[] = [];
  for (const row of rows) {
    if (row.projectId !== null) continue;
    const target = nameMap.get(row.name);
    if (!target) continue;
    const current = row.activityType ?? '';
    if (current === target) continue;
    if (isCanonicalActivitySlug(current)) continue; // deliberate choice — keep
    actions.push({ id: row.id, name: row.name, projectId: null, from: current, to: target });
  }
  return { actions, skipped: rows.length - actions.length };
}
