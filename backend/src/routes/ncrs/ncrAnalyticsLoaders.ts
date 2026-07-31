/**
 * Wave G G5 — the database half of the NCR analytics
 * (`docs/plans/wave-g-execution-spec-2026-07-31.md` §5).
 *
 * Split out of the route so each of the three heavy sections is one named,
 * readable query plan rather than one 280-line handler, and so the lineage walk
 * has exactly one implementation — `ncrLearning.ts` needs the same walk to
 * compute a proposal's frozen evidence, and two copies would eventually
 * disagree about what a "root" is.
 *
 * The pure folding and capping lives next door in `ncrAnalyticsAggregation.ts`;
 * nothing here decides what a bucket means.
 */

import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import {
  ANALYTICS_LIST_LIMIT,
  MAX_LINEAGE_DEPTH,
  REPEAT_THRESHOLD,
  buildRecurringChecklistItems,
  buildRepeatOffenders,
  type ChecklistItemActivityPair,
  type ChecklistItemDetail,
  type ChecklistItemNcrGroup,
  type RecurringChecklistItem,
  type RepeatOffender,
} from './ncrAnalyticsAggregation.js';

/** `count` comes back from Postgres as a bigint; Number() is safe below 2^53. */
export function toCount(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * The `raised_at` range as SQL, reused by the raw queries.
 *
 * The caller's companion `Prisma.NCRWhereInput` and this fragment must express
 * the SAME range — they are two spellings of one filter, and a chart whose bars
 * came from different windows would be worse than no chart.
 */
export function raisedAtRange(startDate?: Date, endDate?: Date): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];
  if (startDate) clauses.push(Prisma.sql`AND n.raised_at >= ${startDate}`);
  if (endDate) clauses.push(Prisma.sql`AND n.raised_at <= ${endDate}`);
  return clauses.length ? Prisma.join(clauses, ' ') : Prisma.empty;
}

/**
 * Walks the `sourceChecklistItemId` lineage for a set of items, in bounded
 * breadth-first rounds rather than one query per item. Depth is capped by
 * MAX_LINEAGE_DEPTH; a chain longer than that resolves to where it got to,
 * which the pure resolver also handles.
 */
export async function loadLineagePointers(
  seedIds: readonly string[],
): Promise<Map<string, string | null>> {
  const pointers = new Map<string, string | null>();
  let frontier = [...new Set(seedIds)];

  for (let depth = 0; depth < MAX_LINEAGE_DEPTH && frontier.length > 0; depth += 1) {
    const rows = await prisma.iTPChecklistItem.findMany({
      where: { id: { in: frontier } },
      select: { id: true, sourceChecklistItemId: true },
    });

    const next: string[] = [];
    for (const row of rows) {
      pointers.set(row.id, row.sourceChecklistItemId);
      if (row.sourceChecklistItemId && !pointers.has(row.sourceChecklistItemId)) {
        next.push(row.sourceChecklistItemId);
      }
    }
    frontier = [...new Set(next)];
  }

  return pointers;
}

/**
 * Repeat offenders, named and capped ([GR-N4]).
 *
 * The cap is applied to the `groupBy` counts FIRST, and only then are names and
 * per-offender categories fetched — that ordering is what keeps the two extra
 * queries bounded no matter how many subcontractors a project has.
 */
export async function loadRepeatOffenders(
  projectId: string,
  where: Prisma.NCRWhereInput,
  counts: readonly { responsibleSubcontractorId: string | null; _count: { _all: number } }[],
): Promise<RepeatOffender[]> {
  const cappedIds = counts
    .filter((group) => group._count._all >= REPEAT_THRESHOLD && group.responsibleSubcontractorId)
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, ANALYTICS_LIST_LIMIT)
    .map((group) => group.responsibleSubcontractorId as string);

  if (cappedIds.length === 0) return [];

  const [companies, categoryGroups] = await Promise.all([
    prisma.subcontractorCompany.findMany({
      where: { id: { in: cappedIds }, projectId },
      select: { id: true, companyName: true },
    }),
    prisma.nCR.groupBy({
      by: ['responsibleSubcontractorId', 'category'],
      where: { ...where, responsibleSubcontractorId: { in: cappedIds } },
      _count: { _all: true },
    }),
  ]);

  return buildRepeatOffenders(
    counts.map((group) => ({
      subcontractorId: group.responsibleSubcontractorId,
      count: group._count._all,
    })),
    categoryGroups.map((group) => ({
      subcontractorId: group.responsibleSubcontractorId,
      category: group.category,
    })),
    new Map(companies.map((company) => [company.id, company.companyName])),
  );
}

/** One `GROUP BY (itp_checklist_item_id, responsible_subcontractor_id)` row. */
export interface ChecklistItemGroupRow {
  itpChecklistItemId: string | null;
  responsibleSubcontractorId: string | null;
  _count: { _all: number };
}

export interface RecurringItemsResult {
  items: RecurringChecklistItem[];
  /** Distinct linked checklist items observed in this project and range. */
  itemsObserved: number;
  /** How many of those have no lineage pointer — their own root (pre-G2 rows). */
  itemsWithoutLineage: number;
}

/**
 * Recurring checklist-item failures — the learning loop's input (§5.3).
 *
 * Project-scoped, deliberately: AT-G31 and §7 row 7 are binding on this
 * surface, so grouping on the resolved lineage root collapses a template and
 * its controlled copies WITHIN one project rather than reaching across tenants.
 */
export async function loadRecurringChecklistItems(
  projectId: string,
  range: Prisma.Sql,
  groups: readonly ChecklistItemGroupRow[],
): Promise<RecurringItemsResult> {
  const itemIds = [
    ...new Set(
      groups.map((group) => group.itpChecklistItemId).filter((id): id is string => Boolean(id)),
    ),
  ];

  if (itemIds.length === 0) {
    return { items: [], itemsObserved: 0, itemsWithoutLineage: 0 };
  }

  const [pointers, details, activityRows] = await Promise.all([
    loadLineagePointers(itemIds),
    prisma.iTPChecklistItem.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        description: true,
        templateId: true,
        template: { select: { name: true } },
      },
    }),
    prisma.$queryRaw<Array<{ item_id: string; slug: string | null }>>`
      SELECT DISTINCT n.itp_checklist_item_id AS item_id, l.activity_slug AS slug
      FROM ncrs n
      LEFT JOIN ncr_lots nl ON nl.ncr_id = n.id
      LEFT JOIN lots l ON l.id = nl.lot_id
      WHERE n.project_id = ${projectId}
        AND n.itp_checklist_item_id IS NOT NULL ${range}
    `,
  ]);

  const activityPairs: ChecklistItemActivityPair[] = activityRows.map((row) => ({
    checklistItemId: row.item_id,
    activitySlug: row.slug,
  }));
  const detailMap = new Map<string, ChecklistItemDetail>(
    details.map((item) => [
      item.id,
      {
        description: item.description,
        templateId: item.templateId,
        templateName: item.template?.name ?? '',
      },
    ]),
  );
  const countGroups: ChecklistItemNcrGroup[] = groups
    .filter((group) => group.itpChecklistItemId)
    .map((group) => ({
      checklistItemId: group.itpChecklistItemId as string,
      subcontractorId: group.responsibleSubcontractorId,
      count: group._count._all,
    }));

  return {
    items: buildRecurringChecklistItems(countGroups, activityPairs, pointers, detailMap),
    itemsObserved: itemIds.length,
    itemsWithoutLineage: itemIds.filter((id) => !pointers.get(id)).length,
  };
}
