import type { NCR } from './types';

export type NcrSortDirection = 'asc' | 'desc';

/** Register columns that can be ordered (the `?sort=` URL values). */
export const NCR_SORT_FIELDS = ['raised', 'due', 'severity', 'status'] as const;
export type NcrSortField = (typeof NCR_SORT_FIELDS)[number];

export function isNcrSortField(value: string): value is NcrSortField {
  return (NCR_SORT_FIELDS as readonly string[]).includes(value);
}

/** Lifecycle order, not alphabetical: an ascending status sort walks the NCR workflow. */
const STATUS_RANK: Record<string, number> = {
  open: 0,
  investigating: 1,
  rectification: 2,
  verification: 3,
  closed: 4,
  closed_concession: 5,
};

const SEVERITY_RANK: Record<string, number> = {
  minor: 0,
  major: 1,
};

function compareNcrs(a: NCR, b: NCR, field: NcrSortField): number {
  switch (field) {
    case 'raised':
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    case 'due':
      // Callers route undated NCRs around this comparator, so both are dated here.
      return new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime();
    case 'severity':
      return (SEVERITY_RANK[a.severity] ?? -1) - (SEVERITY_RANK[b.severity] ?? -1);
    case 'status': {
      const aRank = STATUS_RANK[a.status];
      const bRank = STATUS_RANK[b.status];
      if (aRank !== undefined && bRank !== undefined) return aRank - bRank;
      if (aRank !== undefined) return -1;
      if (bRank !== undefined) return 1;
      return a.status.localeCompare(b.status);
    }
  }
}

/**
 * Return a sorted copy of the register. An empty/unknown `sortField` preserves
 * the server order, so existing URLs behave exactly as before.
 * NCRs without a due date always sort after dated ones — in either direction —
 * so actionable deadlines stay at the top.
 */
export function sortNcrs(ncrs: NCR[], sortField: string, sortDirection: NcrSortDirection): NCR[] {
  if (!isNcrSortField(sortField)) return ncrs;
  const factor = sortDirection === 'desc' ? -1 : 1;
  return [...ncrs].sort((a, b) => {
    if (sortField === 'due' && (!a.dueDate || !b.dueDate)) {
      if (!a.dueDate && !b.dueDate) return 0;
      return a.dueDate ? -1 : 1;
    }
    return factor * compareNcrs(a, b, sortField);
  });
}

/**
 * Next `?sort=`/`?dir=` pair after clicking a column header: a new column
 * sorts ascending, clicking the active column again flips the direction
 * (same idiom as the lot register).
 */
export function nextSortParams(
  currentField: string,
  currentDirection: NcrSortDirection,
  clickedField: NcrSortField,
): { sort: NcrSortField; dir: NcrSortDirection } {
  if (currentField === clickedField) {
    return { sort: clickedField, dir: currentDirection === 'asc' ? 'desc' : 'asc' };
  }
  return { sort: clickedField, dir: 'asc' };
}
