// The lot register as a work queue: ageing, curated grouping, shipped presets.
// Pure helpers only — LotTable and LotsPage own the rendering and the state.
import { formatActivityLabel } from '@/lib/activityTaxonomy';
import { formatStatusLabel } from '@/lib/statusLabels';
import { parseJsonPreference } from '@/lib/storagePreferences';
import { STATUS_OPTIONS } from './lotFilterConfig';
import type { Lot } from '../lotsPageTypes';

const MS_PER_DAY = 86_400_000;

/**
 * Days the lot has been open: created -> conformed, or created -> now while it
 * is still live. `createdAt` and `conformedAt` are the only lifecycle dates the
 * GET /api/lots list payload carries, so this is the whole ageing story the
 * register can tell without a backend change.
 */
export function lotDaysOpen(lot: Lot, now: number = Date.now()): number | null {
  if (!lot.createdAt) return null;
  const opened = new Date(lot.createdAt).getTime();
  if (Number.isNaN(opened)) return null;

  const conformed = lot.conformedAt ? new Date(lot.conformedAt).getTime() : NaN;
  const closed = Number.isNaN(conformed) ? now : conformed;
  return Math.max(0, Math.floor((closed - opened) / MS_PER_DAY));
}

// =============================================================================
// Group by — a curated field list, never a drag-to-group bar. The user picks
// from four fields we know read well as bands; nobody has to know the schema.
// =============================================================================

export const LOT_GROUP_BY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'status', label: 'Status' },
  { value: 'activityType', label: 'Activity Type' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'areaZone', label: 'Area' },
] as const;

export type LotGroupBy = 'status' | 'activityType' | 'subcontractor' | 'areaZone';

const GROUP_BY_VALUES = new Set<string>(
  LOT_GROUP_BY_OPTIONS.map((option) => option.value).filter(Boolean),
);

export function parseLotGroupBy(raw: string | null | undefined): LotGroupBy | null {
  return raw && GROUP_BY_VALUES.has(raw) ? (raw as LotGroupBy) : null;
}

const EMPTY_GROUP_LABELS: Record<LotGroupBy, string> = {
  status: 'No status',
  activityType: 'No activity type',
  subcontractor: 'Unassigned',
  areaZone: 'No area',
};

function rawGroupValue(lot: Lot, groupBy: LotGroupBy): string | null {
  switch (groupBy) {
    case 'status':
      return lot.status || null;
    case 'activityType':
      return lot.activityType || null;
    case 'subcontractor':
      return lot.assignedSubcontractor?.companyName || null;
    case 'areaZone':
      return lot.areaZone || null;
  }
}

export function lotGroupKey(lot: Lot, groupBy: LotGroupBy): string {
  // Namespaced so a collapsed "Status: Conformed" band does not also collapse an
  // identically named band under a different grouping.
  return `${groupBy}:${rawGroupValue(lot, groupBy) ?? ''}`;
}

export function lotGroupLabel(lot: Lot, groupBy: LotGroupBy): string {
  const raw = rawGroupValue(lot, groupBy);
  if (!raw) return EMPTY_GROUP_LABELS[groupBy];
  if (groupBy === 'status') return formatStatusLabel(raw);
  if (groupBy === 'activityType') return formatActivityLabel(raw) || raw;
  return raw;
}

const STATUS_RANK = new Map(STATUS_OPTIONS.map((option, index) => [option.value, index]));

/**
 * Sort key that fixes band order: statuses follow the workflow order the filter
 * menu already uses, everything else is alphabetical, and the "none" bucket
 * always lands last.
 */
export function lotGroupSortKey(lot: Lot, groupBy: LotGroupBy): string {
  const raw = rawGroupValue(lot, groupBy);
  if (!raw) return '￿';
  if (groupBy === 'status') {
    const rank = STATUS_RANK.get(raw);
    return rank === undefined ? `99:${raw}` : `${String(rank).padStart(2, '0')}:${raw}`;
  }
  return lotGroupLabel(lot, groupBy).toLowerCase();
}

/** Band counts come from the whole filtered register, not the loaded page. */
export function countLotGroups(lots: Lot[], groupBy: LotGroupBy): Map<string, number> {
  const counts = new Map<string, number>();
  for (const lot of lots) {
    const key = lotGroupKey(lot, groupBy);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export type LotRegisterRow =
  | { kind: 'band'; key: string; label: string; count: number; collapsed: boolean }
  | { kind: 'lot'; lot: Lot };

/**
 * Flatten the displayed lots into the row list the table virtualizes. Callers
 * pass lots already sorted group-first (see useLotsData), so a band opens each
 * time the group key changes.
 */
export function buildLotRegisterRows({
  displayedLots,
  groupBy,
  groupCounts,
  collapsedGroups,
}: {
  displayedLots: Lot[];
  groupBy: LotGroupBy | null;
  groupCounts: Map<string, number>;
  collapsedGroups: Set<string>;
}): LotRegisterRow[] {
  if (!groupBy) return displayedLots.map((lot) => ({ kind: 'lot', lot }));

  const rows: LotRegisterRow[] = [];
  let currentKey: string | null = null;
  let currentCollapsed = false;

  for (const lot of displayedLots) {
    const key = lotGroupKey(lot, groupBy);
    if (key !== currentKey) {
      currentKey = key;
      currentCollapsed = collapsedGroups.has(key);
      rows.push({
        kind: 'band',
        key,
        label: lotGroupLabel(lot, groupBy),
        count: groupCounts.get(key) ?? 0,
        collapsed: currentCollapsed,
      });
    }
    if (!currentCollapsed) rows.push({ kind: 'lot', lot });
  }

  return rows;
}

export const COLLAPSED_GROUPS_STORAGE_KEY = 'siteproof_lot_collapsed_groups';

export function parseCollapsedGroupsPreference(raw: string | null): Set<string> {
  const keys = parseJsonPreference<string[]>(raw, [], (value) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : null,
  );
  return new Set(keys);
}

// =============================================================================
// Preset views — code-defined entries in the existing Views menu, so a useful
// register is one click away instead of something each user has to build.
// =============================================================================

export interface LotPresetView {
  id: string;
  name: string;
  /** Filter querystring without a leading '?'; empty clears every filter. */
  query: string;
}

export const LOT_PRESET_VIEWS: LotPresetView[] = [
  { id: 'all', name: 'All', query: '' },
  {
    id: 'open',
    name: 'Open',
    query: 'status=not_started,in_progress,awaiting_test,hold_point,ncr_raised',
  },
  {
    id: 'needs-attention',
    name: 'Needs attention',
    query: 'status=ncr_raised,hold_point&group=status',
  },
  // "Recently updated" would need an `updatedAt` the list payload does not
  // carry; newest-opened first is the same question the register can answer.
  { id: 'recently-opened', name: 'Recently opened', query: 'sort=daysOpen&dir=asc' },
];

/**
 * The preset a role lands on when it opens the register with no filters of its
 * own. Quality managers work a queue of blocked lots, so that is their register.
 */
export function roleDefaultLotPreset(actualRole: string | null | undefined): LotPresetView | null {
  if (actualRole !== 'quality_manager') return null;
  return LOT_PRESET_VIEWS.find((preset) => preset.id === 'needs-attention') ?? null;
}
