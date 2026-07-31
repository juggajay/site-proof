/**
 * Wave G G5 — the pure half of the NCR analytics
 * (`docs/plans/wave-g-execution-spec-2026-07-31.md` §5.1–§5.3).
 *
 * Every function here takes already-grouped rows and returns render-ready
 * buckets. Nothing imports Prisma, so the shapes the charts depend on are
 * unit-testable without a database — and the route stays a query plan plus a
 * response assembly.
 *
 * Three properties this module exists to guarantee:
 *
 *  1. **Every bucket is capped.** [GR-N4]: `repeatIssues` sliced to 10 while
 *     `repeatOffenders` was unbounded AND carried an unbounded `ncrIds: string[]`
 *     per entry, on the exact surface §8 P4 targets. Both are capped here, from
 *     one constant, and offenders carry counts rather than id arrays.
 *  2. **Nothing is silently dropped.** An NCR whose lot has no `activitySlug`
 *     lands in an explicit `not_classified` bucket (AT-G28); an off-vocabulary
 *     category folds to `other` (AT-G27) rather than becoming its own slice of
 *     a pie chart nobody can read.
 *  3. **Item identity is never guessed from text.** Checklist-item recurrence
 *     groups on the RESOLVED ROOT of the `sourceChecklistItemId` chain
 *     (spec §2.2(c) [GR-A3]), so a template and its controlled copy inside the
 *     same project count as one requirement. An item with a null pointer is its
 *     own root and is reported as such. Two items with the same description are
 *     NOT merged — that would manufacture a trend.
 */

import {
  foldNcrCategory,
  foldNcrRootCause,
  ncrCategoryLabel,
  ncrRootCauseLabel,
} from '../../lib/ncrVocabulary.js';

/** One cap for every list in this response. */
export const ANALYTICS_LIST_LIMIT = 10;

/** A group is a "repeat" at two or more occurrences (shipped threshold). */
export const REPEAT_THRESHOLD = 2;

/** Longest `sourceChecklistItemId` chain walked before giving up (cycle guard). */
export const MAX_LINEAGE_DEPTH = 20;

export const ACTIVITY_NOT_CLASSIFIED = 'not_classified';
export const ACTIVITY_NOT_CLASSIFIED_LABEL = 'Activity not classified';

/** The chart shape the shipped response already used: `{ name, value, percentage }`. */
export interface ChartDatum {
  /** Canonical (folded) key — what to filter the register by. */
  key: string;
  /** Human label. */
  name: string;
  value: number;
  percentage: number;
}

export interface GroupedCount {
  value: string | null;
  count: number;
}

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

/**
 * Collapses grouped raw values through a fold, sums the collisions, and sorts
 * biggest-first. Folding AFTER the SQL grouping is what keeps the query a plain
 * `GROUP BY` while still making 'Workmanship', 'workmanship ' and
 * 'Concrete finish (legacy)' land where spec §5.2 says they land.
 */
export function foldGroupedCounts(
  rows: readonly GroupedCount[],
  fold: (value: string | null) => string,
  label: (folded: string) => string,
  total: number,
): ChartDatum[] {
  const summed = new Map<string, number>();
  for (const row of rows) {
    const key = fold(row.value);
    summed.set(key, (summed.get(key) ?? 0) + row.count);
  }

  return [...summed.entries()]
    .map(([key, value]) => ({ key, name: label(key), value, percentage: percentage(value, total) }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
}

export function foldCategoryCounts(rows: readonly GroupedCount[], total: number): ChartDatum[] {
  return foldGroupedCounts(rows, foldNcrCategory, ncrCategoryLabel, total);
}

export function foldRootCauseCounts(rows: readonly GroupedCount[], total: number): ChartDatum[] {
  return foldGroupedCounts(rows, foldNcrRootCause, ncrRootCauseLabel, total);
}

/**
 * Spec §5.2 gap 2 (AT-G28). `Lot.activitySlug` is nullable — the activity fold
 * resolves only to family level for some lots — and an NCR may carry no lot at
 * all. Both land in ONE explicit bucket rather than being dropped from the
 * chart, because "we do not know" is a finding about the data, not an absence.
 *
 * An NCR spanning lots of two activities is counted once in each; the caller's
 * query does the `COUNT(DISTINCT ncr)` per slug, and the total across buckets
 * may therefore exceed the NCR count. `percentage` is against the NCR total
 * regardless, so a bucket reads as "x% of NCRs touched this activity".
 */
export function buildActivityBuckets(rows: readonly GroupedCount[], total: number): ChartDatum[] {
  const summed = new Map<string, number>();
  for (const row of rows) {
    const key = row.value?.trim() ? row.value.trim() : ACTIVITY_NOT_CLASSIFIED;
    summed.set(key, (summed.get(key) ?? 0) + row.count);
  }

  return [...summed.entries()]
    .map(([key, value]) => ({
      key,
      name: key === ACTIVITY_NOT_CLASSIFIED ? ACTIVITY_NOT_CLASSIFIED_LABEL : key,
      value,
      percentage: percentage(value, total),
    }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
}

// ---------------------------------------------------------------------------
// Repeat issues (category × root cause)
// ---------------------------------------------------------------------------

export interface RepeatIssue {
  category: string;
  categoryLabel: string;
  rootCause: string;
  rootCauseLabel: string;
  count: number;
}

export function buildRepeatIssues(
  rows: readonly { category: string | null; rootCauseCategory: string | null; count: number }[],
): RepeatIssue[] {
  const grouped = new Map<string, RepeatIssue>();
  for (const row of rows) {
    const category = foldNcrCategory(row.category);
    const rootCause = foldNcrRootCause(row.rootCauseCategory);
    const key = `${category}::${rootCause}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += row.count;
      continue;
    }
    grouped.set(key, {
      category,
      categoryLabel: ncrCategoryLabel(category),
      rootCause,
      rootCauseLabel: ncrRootCauseLabel(rootCause),
      count: row.count,
    });
  }

  return [...grouped.values()]
    .filter((group) => group.count >= REPEAT_THRESHOLD)
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
    .slice(0, ANALYTICS_LIST_LIMIT);
}

// ---------------------------------------------------------------------------
// Repeat offenders (subcontractor)
// ---------------------------------------------------------------------------

export interface RepeatOffender {
  subcontractorId: string;
  subcontractorName: string;
  ncrCount: number;
  /** Distinct folded categories, capped — not the full id list the old shape returned. */
  categories: string[];
  categoryCount: number;
}

/**
 * [GR-N4]: capped symmetrically with `repeatIssues`, and carrying counts rather
 * than the unbounded `ncrIds: string[]` the shipped shape returned per entry.
 *
 * `subcontractorName` closes AT-G26's other half — the shipped response returned
 * bare ids, which is unrenderable without a second round trip the caller has no
 * way to authorise.
 */
export function buildRepeatOffenders(
  counts: readonly { subcontractorId: string | null; count: number }[],
  categoryPairs: readonly { subcontractorId: string | null; category: string | null }[],
  names: ReadonlyMap<string, string>,
): RepeatOffender[] {
  const byCategory = new Map<string, Set<string>>();
  for (const pair of categoryPairs) {
    if (!pair.subcontractorId) continue;
    const set = byCategory.get(pair.subcontractorId) ?? new Set<string>();
    set.add(foldNcrCategory(pair.category));
    byCategory.set(pair.subcontractorId, set);
  }

  return counts
    .filter(
      (row): row is { subcontractorId: string; count: number } =>
        Boolean(row.subcontractorId) && row.count >= REPEAT_THRESHOLD,
    )
    .sort((a, b) => b.count - a.count || a.subcontractorId.localeCompare(b.subcontractorId))
    .slice(0, ANALYTICS_LIST_LIMIT)
    .map((row) => {
      const categories = [...(byCategory.get(row.subcontractorId) ?? new Set<string>())].sort();
      return {
        subcontractorId: row.subcontractorId,
        // A subcontractor company row can be deleted while its NCRs remain
        // (`onDelete: SetNull` is on the NCR side, so the id survives). Say so
        // rather than rendering a bare uuid.
        subcontractorName: names.get(row.subcontractorId) ?? 'Removed subcontractor',
        ncrCount: row.count,
        categories: categories.slice(0, ANALYTICS_LIST_LIMIT),
        categoryCount: categories.length,
      };
    });
}

// ---------------------------------------------------------------------------
// Recurring checklist items — the learning loop's input
// ---------------------------------------------------------------------------

/**
 * Walks `sourceChecklistItemId` to the root of the lineage chain.
 *
 * `pointers` maps an item id to its IMMEDIATE parent (what
 * `routes/itp/templates.ts` writes on clone), or null for a root. An id absent
 * from the map is its own root — that is every row created before G2, and the
 * caller reports how much of the corpus that is rather than implying full
 * coverage.
 *
 * Cycle-safe: a chain that revisits an id, or exceeds MAX_LINEAGE_DEPTH, stops
 * and returns the last id it reached. A lineage cycle is impossible through the
 * clone path, but this resolves data, not a proof.
 */
export function resolveChecklistItemRoot(
  itemId: string,
  pointers: ReadonlyMap<string, string | null>,
): string {
  const seen = new Set<string>([itemId]);
  let current = itemId;

  for (let depth = 0; depth < MAX_LINEAGE_DEPTH; depth += 1) {
    const parent = pointers.get(current);
    if (!parent || seen.has(parent)) return current;
    seen.add(parent);
    current = parent;
  }

  return current;
}

export interface RecurringChecklistItem {
  /** The resolved root id — stable across controlled copies of one requirement. */
  rootChecklistItemId: string;
  description: string;
  templateId: string;
  templateName: string;
  ncrCount: number;
  subcontractorCount: number;
  activitySlugs: string[];
  /** Every project-local item id that folded into this root, capped. */
  checklistItemIds: string[];
}

/**
 * One `GROUP BY (itp_checklist_item_id, responsible_subcontractor_id)` row.
 * Grouped rather than per-NCR so the query stays bounded by distinct pairs —
 * the shape §8 P4 needs and the reason the route no longer loads every NCR.
 */
export interface ChecklistItemNcrGroup {
  checklistItemId: string;
  subcontractorId: string | null;
  count: number;
}

/** One distinct `(checklist item, lot activity)` pair. */
export interface ChecklistItemActivityPair {
  checklistItemId: string;
  activitySlug: string | null;
}

export interface ChecklistItemDetail {
  description: string;
  templateId: string;
  templateName: string;
}

/**
 * Groups NCRs by the resolved root checklist item.
 *
 * **Project-scoped, deliberately.** Spec §5.3 motivates root resolution with a
 * cross-project claim ("failed 7 times across 3 subcontractors"), but AT-G31 and
 * §7 row 7 are the binding constraints on this surface: project B's NCRs never
 * appear in project A's trends. Root resolution still earns its place inside one
 * project — a project that cloned a corporate master into two controlled copies
 * has two ids for one requirement — and it makes the counts portable if a
 * company-wide surface is ever built. The route says which of the two it is.
 */
export function buildRecurringChecklistItems(
  rows: readonly ChecklistItemNcrGroup[],
  activityPairs: readonly ChecklistItemActivityPair[],
  pointers: ReadonlyMap<string, string | null>,
  details: ReadonlyMap<string, ChecklistItemDetail>,
): RecurringChecklistItem[] {
  const grouped = new Map<
    string,
    {
      ncrCount: number;
      subcontractors: Set<string>;
      activities: Set<string>;
      itemIds: Set<string>;
    }
  >();

  const emptyBucket = () => ({
    ncrCount: 0,
    subcontractors: new Set<string>(),
    activities: new Set<string>(),
    itemIds: new Set<string>(),
  });

  for (const row of rows) {
    const root = resolveChecklistItemRoot(row.checklistItemId, pointers);
    const bucket = grouped.get(root) ?? emptyBucket();
    bucket.ncrCount += row.count;
    if (row.subcontractorId) bucket.subcontractors.add(row.subcontractorId);
    bucket.itemIds.add(row.checklistItemId);
    grouped.set(root, bucket);
  }

  for (const pair of activityPairs) {
    const root = resolveChecklistItemRoot(pair.checklistItemId, pointers);
    // Only annotate roots the counts already produced; an activity pair with no
    // matching count row would otherwise invent a zero-NCR group.
    const bucket = grouped.get(root);
    if (!bucket) continue;
    bucket.activities.add(pair.activitySlug?.trim() || ACTIVITY_NOT_CLASSIFIED);
  }

  return [...grouped.entries()]
    .filter(([, bucket]) => bucket.ncrCount >= REPEAT_THRESHOLD)
    .sort(([aId, a], [bId, b]) => b.ncrCount - a.ncrCount || aId.localeCompare(bId))
    .slice(0, ANALYTICS_LIST_LIMIT)
    .map(([rootId, bucket]) => {
      // Prefer the root's own detail; fall back to any local copy, because a
      // root that lives in the GLOBAL library is not readable through a
      // project-scoped detail fetch.
      const localId = [...bucket.itemIds][0];
      const detail = details.get(rootId) ?? (localId ? details.get(localId) : undefined);
      return {
        rootChecklistItemId: rootId,
        description: detail?.description ?? 'Checklist item no longer available',
        templateId: detail?.templateId ?? '',
        templateName: detail?.templateName ?? '',
        ncrCount: bucket.ncrCount,
        subcontractorCount: bucket.subcontractors.size,
        activitySlugs: [...bucket.activities].sort(),
        checklistItemIds: [...bucket.itemIds].sort().slice(0, ANALYTICS_LIST_LIMIT),
      };
    });
}
