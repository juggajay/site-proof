import type {
  HoldPoint,
  HoldPointLotOption,
  HoldPointSortDirection,
  HoldPointSortField,
  HoldPointStats,
  StatusFilter,
} from './types';
import { isNoticeExpired, isOverdue } from './components/holdPointTableUtils';

export interface HoldPointChartData {
  releasesOverTime: { date: string; releases: number }[];
  avgTimeToRelease: number;
}

// --- URL filter/sort param parsing (filters are URL-persisted, LotsPage idiom) ---

const STATUS_FILTER_VALUES: readonly StatusFilter[] = [
  'all',
  'pending',
  'notified',
  'released',
  'notice-expired',
];

const SORT_FIELD_VALUES: readonly HoldPointSortField[] = [
  'lot',
  'status',
  'notified',
  'scheduled',
  'released',
];

export function parseStatusFilterParam(value: string | null): StatusFilter {
  return STATUS_FILTER_VALUES.includes(value as StatusFilter) ? (value as StatusFilter) : 'all';
}

export function parseSortFieldParam(value: string | null): HoldPointSortField {
  return SORT_FIELD_VALUES.includes(value as HoldPointSortField)
    ? (value as HoldPointSortField)
    : 'lot';
}

export function parseSortDirectionParam(value: string | null): HoldPointSortDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

// --- Register filtering & sorting (client-side over the full cached register) ---

export function filterHoldPoints(
  holdPoints: HoldPoint[],
  statusFilter: StatusFilter,
  searchQuery: string,
  referenceDate: Date | string = new Date(),
  selectedLotId = 'all',
): HoldPoint[] {
  const query = searchQuery.trim().toLowerCase();

  return holdPoints.filter((hp) => {
    if (selectedLotId !== 'all' && hp.lotId !== selectedLotId) {
      return false;
    }

    if (statusFilter === 'notice-expired') {
      if (!isNoticeExpired(hp, referenceDate)) return false;
    } else if (statusFilter !== 'all' && hp.status !== statusFilter) {
      return false;
    }

    if (query) {
      const matchesLotNumber = hp.lotNumber.toLowerCase().includes(query);
      const matchesDescription = (hp.description || '').toLowerCase().includes(query);
      if (!matchesLotNumber && !matchesDescription) return false;
    }

    return true;
  });
}

export function buildHoldPointLotOptions(holdPoints: HoldPoint[]): HoldPointLotOption[] {
  const optionsByLotId = new Map<string, HoldPointLotOption>();

  holdPoints.forEach((hp) => {
    const existing = optionsByLotId.get(hp.lotId);
    if (existing) {
      existing.holdPointCount += 1;
      return;
    }

    optionsByLotId.set(hp.lotId, {
      lotId: hp.lotId,
      lotNumber: hp.lotNumber,
      holdPointCount: 1,
    });
  });

  return [...optionsByLotId.values()].sort((a, b) => {
    const byLotNumber = a.lotNumber.localeCompare(b.lotNumber);
    return byLotNumber !== 0 ? byLotNumber : a.lotId.localeCompare(b.lotId);
  });
}

// Lot-register order (the server's order for this list): lot number, then
// ITP sequence. Used as the default sort and as the tie-breaker for the rest.
function compareLotOrder(a: HoldPoint, b: HoldPoint): number {
  if (a.lotNumber !== b.lotNumber) return a.lotNumber.localeCompare(b.lotNumber);
  return a.sequenceNumber - b.sequenceNumber;
}

function getSortTimestamp(value: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * Sort a (filtered) register slice. Returns a new array — never mutates.
 *
 * Date columns ('notified', 'scheduled', 'released') sort missing values last
 * regardless of direction, so "Notified asc" is the chase ordering: the hold
 * point that has been awaiting release the longest is on top and never hidden
 * behind never-notified rows.
 */
export function sortHoldPoints(
  holdPoints: HoldPoint[],
  sortField: HoldPointSortField,
  sortDirection: HoldPointSortDirection,
): HoldPoint[] {
  const direction = sortDirection === 'desc' ? -1 : 1;

  const compareByField = (a: HoldPoint, b: HoldPoint): number => {
    switch (sortField) {
      case 'lot':
        return direction * compareLotOrder(a, b);
      case 'status':
        return direction * a.status.localeCompare(b.status);
      case 'notified':
      case 'scheduled':
      case 'released': {
        const fieldKey = {
          notified: 'notificationSentAt',
          scheduled: 'scheduledDate',
          released: 'releasedAt',
        } as const;
        const aTime = getSortTimestamp(a[fieldKey[sortField]]);
        const bTime = getSortTimestamp(b[fieldKey[sortField]]);
        if (aTime === null && bTime === null) return 0;
        if (aTime === null) return 1;
        if (bTime === null) return -1;
        return direction * (aTime - bTime);
      }
    }
  };

  return [...holdPoints].sort((a, b) => {
    const byField = compareByField(a, b);
    return byField !== 0 ? byField : compareLotOrder(a, b);
  });
}

export function buildHoldPointStats(
  holdPoints: HoldPoint[],
  referenceDate = new Date(),
): HoldPointStats {
  const weekAgo = new Date(referenceDate);
  weekAgo.setDate(weekAgo.getDate() - 7);

  return {
    total: holdPoints.length,
    pending: holdPoints.filter((hp) => hp.status === 'pending').length,
    notified: holdPoints.filter((hp) => hp.status === 'notified').length,
    releasedThisWeek: holdPoints.filter((hp) => {
      if (hp.status !== 'released' || !hp.releasedAt) return false;
      const releasedDate = new Date(hp.releasedAt);
      return releasedDate >= weekAgo;
    }).length,
    overdue: holdPoints.filter((hp) => isOverdue(hp)).length,
  };
}

export function buildHoldPointChartData(
  holdPoints: HoldPoint[],
  referenceDate = new Date(),
): HoldPointChartData {
  const releasesOverTime: { date: string; releases: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(referenceDate);
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const releases = holdPoints.filter((hp) => {
      if (!hp.releasedAt) return false;
      const releasedDate = new Date(hp.releasedAt);
      return releasedDate >= dayStart && releasedDate <= dayEnd;
    }).length;
    releasesOverTime.push({ date: dateStr, releases });
  }

  const releasedHPs = holdPoints.filter(
    (hp) => hp.status === 'released' && hp.notificationSentAt && hp.releasedAt,
  );
  let avgTimeToRelease = 0;
  if (releasedHPs.length > 0) {
    const totalHours = releasedHPs.reduce((sum, hp) => {
      const notified = new Date(hp.notificationSentAt!).getTime();
      const released = new Date(hp.releasedAt!).getTime();
      return sum + (released - notified) / (1000 * 60 * 60);
    }, 0);
    avgTimeToRelease = Math.round(totalHours / releasedHPs.length);
  }

  return { releasesOverTime, avgTimeToRelease };
}
