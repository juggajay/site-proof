import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { dateKeyToUtcDayNumber, formatDateKey, DEFAULT_APP_TIME_ZONE } from '@/lib/localDate';

export interface LotStatusEvent {
  at: string; // ISO instant
  from: string | null;
  to: string;
}

export interface LotTimeline {
  lotId: string;
  createdAt: string; // ISO
  currentStatus: string;
  events: LotStatusEvent[];
}

export interface StatusTimeline {
  earliest: string | null;
  lots: LotTimeline[];
}

// Lazily fetched only when History mode first opens. One key = one shape: every
// consumer resolves this identical StatusTimeline object.
export function useLotStatusTimeline(projectId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.lotStatusTimeline(projectId ?? ''),
    queryFn: () => {
      if (!projectId) throw new Error('Project not found');
      return apiFetch<StatusTimeline>(
        `/api/projects/${encodeURIComponent(projectId)}/lots/status-timeline`,
      );
    },
    enabled: enabled && !!projectId,
    // History is a slow-moving audit read; keep it around while the panel is open.
    cacheTime: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Inverse of dateKeyToUtcDayNumber: a UTC day-number back to a YYYY-MM-DD key.
// Built from UTC parts (never toISOString().slice — CI bans that for user dates).
export function dayNumberToDateKey(dayNumber: number): string {
  const d = new Date(dayNumber * DAY_MS);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Whole days between two date keys (b - a), or 0 if either is unparseable.
export function dateKeySpan(a: string, b: string): number {
  const an = dateKeyToUtcDayNumber(a);
  const bn = dateKeyToUtcDayNumber(b);
  if (an === null || bn === null) return 0;
  return bn - an;
}

/**
 * A lot's status as of end-of-day `dateKey` (Sydney), or null if the lot did not
 * yet exist then (hide the polygon). Replays events in order: start from the
 * earliest known state (first event's `from`, else currentStatus when there are
 * no events) and apply every event whose Sydney date is on or before `dateKey`.
 *
 * Instants are compared by their Sydney date key, so "end of day D" needs no
 * timezone-offset arithmetic — YYYY-MM-DD keys sort lexicographically.
 */
export function lotStatusAtDate(
  lot: LotTimeline,
  dateKey: string,
  timeZone: string = DEFAULT_APP_TIME_ZONE,
): string | null {
  const createdKey = formatDateKey(new Date(lot.createdAt), timeZone);
  if (createdKey > dateKey) return null; // not created as of D

  let status = lot.events.length > 0 ? lot.events[0].from : lot.currentStatus;
  for (const ev of lot.events) {
    if (formatDateKey(new Date(ev.at), timeZone) <= dateKey) {
      status = ev.to;
    } else {
      break; // events are sorted ascending
    }
  }
  return status;
}

// lotId → historical status for every lot visible as of `dateKey`. Lots not yet
// created (or with a null starting status) are omitted so callers hide them.
export function historicalStatusByLot(
  timeline: StatusTimeline,
  dateKey: string,
  timeZone: string = DEFAULT_APP_TIME_ZONE,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const lot of timeline.lots) {
    const status = lotStatusAtDate(lot, dateKey, timeZone);
    if (status !== null) out.set(lot.lotId, status);
  }
  return out;
}
