/**
 * Data + pure helpers for the lot inspector (Wave 2).
 *
 * Every hook reuses an existing endpoint under its established query key and
 * cached SHAPE (holdPoints caches `HoldPoint[]` like HoldPointsPage;
 * itpInstanceByLot caches the `{ instance }` envelope like useLotItpTestItems;
 * lotReadiness caches the `{ readiness }` envelope like LotDetailPage) — so the
 * inspector shares caches with the pages instead of forking them. The one NEW
 * read is the status-events ledger.
 */

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { formatActivityLabel } from '@/lib/activityTaxonomy';
import { formatStatusLabel } from '@/lib/statusLabels';
import { fetchAllProjectHoldPoints } from '@/pages/holdpoints/holdPointsApi';
import type { HoldPoint } from '@/pages/holdpoints/types';
import type { ITPInstance, ITPAttachmentDocument } from '@/pages/lots/types';
import type { LotEvidenceReadiness } from '@/types/evidenceReadiness';
import type { ProjectLotGeometry } from './lotMapData';

// ── The one NEW read: the LotStatusEvent ledger (#1800) ─────────────────────
// NOT the audit-derived useLotStatusTimeline — that read misses NCR-driven
// transitions (five write sites never wrote audit rows). The ledger is the
// complete record.

export interface LotStatusEventRow {
  fromStatus: string | null;
  toStatus: string;
  /** ISO — when the transition happened; backfilled rows carry the audit time. */
  effectiveAt: string;
  recordedAt: string;
  source: string; // 'user' | 'system' | 'import' | 'backfill'
}

export function useLotStatusEvents(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lotStatusEvents(lotId ?? ''),
    queryFn: () =>
      apiFetch<{ events: LotStatusEventRow[] }>(
        `/api/lots/${encodeURIComponent(lotId!)}/status-events`,
      ),
    enabled: Boolean(lotId),
  });
}

// ── Reused reads, established keys and shapes ───────────────────────────────

export function useLotReadiness(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lotReadiness(lotId ?? ''),
    queryFn: () =>
      apiFetch<{ readiness: LotEvidenceReadiness }>(
        `/api/lots/${encodeURIComponent(lotId!)}/readiness`,
      ),
    enabled: Boolean(lotId),
  });
}

/** Project-scoped and cached, so switching lots costs nothing (filter client-side). */
export function useProjectHoldPoints(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.holdPoints(projectId ?? ''),
    queryFn: () => fetchAllProjectHoldPoints(projectId!),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useLotItpInstance(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.itpInstanceByLot(lotId ?? ''),
    queryFn: () =>
      apiFetch<{ instance: ITPInstance | null }>(
        `/api/itp/instances/lot/${encodeURIComponent(lotId!)}`,
      ),
    enabled: Boolean(lotId),
  });
}

// ── Pure helpers (tested in lotInspectorData.test.ts) ───────────────────────

/**
 * The walking order of the job: control line, then chainage, then lot number.
 * Lots with no control line sort last (grouped), so next/prev never jumps off
 * the alignment mid-walk.
 */
export function orderGeometriesAlongAlignment(
  geometries: ProjectLotGeometry[],
): ProjectLotGeometry[] {
  return [...geometries].sort((a, b) => {
    const aLine = a.controlLineId ?? '￿';
    const bLine = b.controlLineId ?? '￿';
    if (aLine !== bLine) return aLine < bLine ? -1 : 1;
    const aCh = a.chainageStart ?? Number.MAX_SAFE_INTEGER;
    const bCh = b.chainageStart ?? Number.MAX_SAFE_INTEGER;
    if (aCh !== bCh) return aCh - bCh;
    return a.lotNumber.localeCompare(b.lotNumber, undefined, { numeric: true });
  });
}

export function neighbouringLotIds(
  geometries: ProjectLotGeometry[],
  lotId: string,
): { prevId: string | null; nextId: string | null } {
  const ordered = orderGeometriesAlongAlignment(geometries);
  const index = ordered.findIndex((g) => g.lotId === lotId);
  if (index === -1) return { prevId: null, nextId: null };
  return {
    prevId: ordered[index - 1]?.lotId ?? null,
    nextId: ordered[index + 1]?.lotId ?? null,
  };
}

/**
 * Client-side find over the already-loaded geometries: lot number, activity,
 * status words, or a bare chainage number that falls inside a lot's extent.
 */
export function searchLotGeometries(
  geometries: ProjectLotGeometry[],
  rawQuery: string,
  limit = 6,
): ProjectLotGeometry[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];
  const asNumber = Number(query.replace(/,/g, ''));
  const isNumeric = query !== '' && Number.isFinite(asNumber);

  const matches = orderGeometriesAlongAlignment(geometries).filter((g) => {
    if (g.lotNumber.toLowerCase().includes(query)) return true;
    if ((g.activityType ?? '').toLowerCase().includes(query)) return true;
    if (
      formatActivityLabel(g.activityType ?? '')
        .toLowerCase()
        .includes(query)
    )
      return true;
    if (formatStatusLabel(g.status).toLowerCase().includes(query)) return true;
    if (
      isNumeric &&
      g.chainageStart != null &&
      g.chainageEnd != null &&
      asNumber >= g.chainageStart &&
      asNumber <= g.chainageEnd
    ) {
      return true;
    }
    return false;
  });
  return matches.slice(0, limit);
}

/** How the footprint got onto the map — LotGeometry.kind, in words. */
export function provenanceLabel(kind: string): string {
  if (kind === 'chainage_offset') return 'From chainage';
  if (kind === 'drawn') return 'Drawn on map';
  if (kind === 'point') return 'Point marker';
  return kind.replace(/_/g, ' ');
}

/** Same rule as the readiness engine's unreleased count: everything not released. */
export function openHoldPointsForLot(
  holdPoints: HoldPoint[] | undefined,
  lotId: string,
): HoldPoint[] {
  return (holdPoints ?? []).filter((hp) => hp.lotId === lotId && hp.status !== 'released');
}

export function daysOpen(createdAtIso: string, now = Date.now()): number {
  const created = Date.parse(createdAtIso);
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((now - created) / 86_400_000));
}

/** Latest completion photos across the lot's ITP checklist, newest first. */
export function completionPhotos(
  instance: ITPInstance | null | undefined,
  limit = 6,
): ITPAttachmentDocument[] {
  if (!instance) return [];
  const documents = instance.completions.flatMap((completion) =>
    (completion.attachments ?? []).map((attachment) => attachment.document),
  );
  documents.sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
  return documents.slice(0, limit);
}
