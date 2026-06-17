/**
 * photosShellState.ts — Pure state derivation for the foreman shell Photos surface.
 *
 * SINGLE SOURCE OF TRUTH for the surface's:
 *   - the unified PhotoItem shape that merges server documents (filed/unfiled)
 *     with captured-but-not-yet-uploaded OFFLINE pending photos, so a just-taken
 *     photo is NEVER invisible while it waits to sync,
 *   - "unfiled" detection (no lot link),
 *   - the All / Unfiled filter list + semantics,
 *   - the recent-first ordering of the merged set (pending photos float to the
 *     top because they are the most recent capture and the foreman needs to see
 *     them land).
 *
 * Every function here is pure — no React, no fetch — so the screens stay thin and
 * these decisions are exhaustively unit-tested. The re-file ENDPOINT and PATCH
 * body are NOT redefined here; those live in usePhotoRefile, reusing the existing
 * PATCH /api/documents/:id path verbatim.
 *
 * Lot-scoped photos already live on the lot hub, so this surface deliberately
 * offers only All + Unfiled (no per-lot filter) — research doc 14 §photo pipeline.
 */

// ── Source rows (subset of the shapes the hooks already produce) ──────────────

/** A photo Document row from GET /api/documents/:projectId (documentType='photo'). */
export interface ServerPhotoDoc {
  id: string;
  documentType: string;
  filename: string;
  fileUrl: string;
  mimeType: string | null;
  caption: string | null;
  uploadedAt: string;
  /** Direct lot link — null when the photo was never filed to a lot. */
  lotId: string | null;
  /** Included lot relation (when filed). */
  lot: { id: string; lotNumber: string; description?: string | null } | null;
  gpsLatitude: number | string | null;
  gpsLongitude: number | string | null;
}

/** A captured-but-not-yet-uploaded photo from the offline store (getPendingPhotos). */
export interface OfflinePendingPhoto {
  id: string;
  lotId?: string;
  fileName: string;
  mimeType: string;
  /** Base64 data URL of the compressed image — renders directly, no network. */
  dataUrl: string;
  caption?: string;
  capturedAt: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  /** 'pending' = still waiting to upload; 'error' = last upload attempt failed. */
  syncStatus: 'synced' | 'pending' | 'error';
}

// ── Unified item the grid + detail render ─────────────────────────────────────

export type PhotoSyncState = 'synced' | 'uploading' | 'error';

export interface PhotoItem {
  /** Stable key: server document id, or the local offline photo id. */
  id: string;
  /** 'server' = uploaded Document; 'pending' = local offline capture. */
  source: 'server' | 'pending';
  /** Stored fileUrl locator for server rows, or a local data URL for pending offline photos. */
  src: string;
  /** Server document id, present only for source='server' (drives re-file). */
  documentId: string | null;
  caption: string | null;
  /** ISO capture/upload timestamp used for ordering + the mono date. */
  takenAt: string;
  /** True when the photo has no lot link (the surface's reason for being). */
  unfiled: boolean;
  /** Lot label when filed (e.g. "LOT-014"); null when unfiled. */
  lotLabel: string | null;
  lotId: string | null;
  /** Whether GPS is present (drives the detail GPS chip). */
  hasGps: boolean;
  gps: { lat: number; lng: number } | null;
  /** Sync state — 'uploading'/'error' only for pending offline captures. */
  syncState: PhotoSyncState;
}

// ── Filters ───────────────────────────────────────────────────────────────────

export type PhotoFilterKey = 'all' | 'unfiled';

export interface PhotoFilter {
  key: PhotoFilterKey;
  label: string;
}

export const PHOTO_FILTERS: PhotoFilter[] = [
  { key: 'all', label: 'All' },
  { key: 'unfiled', label: 'Unfiled' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(n) ? n : null;
}

/** A server photo doc is "unfiled" when it has no lot link. */
export function isUnfiledServerPhoto(doc: Pick<ServerPhotoDoc, 'lotId' | 'lot'>): boolean {
  return !doc.lotId && !doc.lot;
}

function serverDocToItem(doc: ServerPhotoDoc): PhotoItem {
  const lat = toFiniteNumber(doc.gpsLatitude);
  const lng = toFiniteNumber(doc.gpsLongitude);
  const hasGps = lat !== null && lng !== null;
  const unfiled = isUnfiledServerPhoto(doc);
  return {
    id: doc.id,
    source: 'server',
    src: doc.fileUrl,
    documentId: doc.id,
    caption: doc.caption,
    takenAt: doc.uploadedAt,
    unfiled,
    lotLabel: doc.lot?.lotNumber ?? null,
    lotId: doc.lotId ?? doc.lot?.id ?? null,
    hasGps,
    gps: hasGps ? { lat: lat as number, lng: lng as number } : null,
    syncState: 'synced',
  };
}

function pendingToItem(photo: OfflinePendingPhoto): PhotoItem {
  const lat = toFiniteNumber(photo.gpsLatitude ?? null);
  const lng = toFiniteNumber(photo.gpsLongitude ?? null);
  const hasGps = lat !== null && lng !== null;
  return {
    id: photo.id,
    source: 'pending',
    src: photo.dataUrl,
    documentId: null,
    caption: photo.caption ?? null,
    takenAt: photo.capturedAt,
    // A pending capture without a lot link is unfiled too — but it can't be
    // re-filed until it has uploaded (no server id yet), so the screen disables
    // the action on pending items.
    unfiled: !photo.lotId,
    lotLabel: null,
    lotId: photo.lotId ?? null,
    hasGps,
    gps: hasGps ? { lat: lat as number, lng: lng as number } : null,
    syncState: photo.syncStatus === 'error' ? 'error' : 'uploading',
  };
}

/**
 * Merge offline-pending captures with the server photo set into one recent-first
 * list. Pending photos ALWAYS sort above server photos (they're the freshest
 * capture and must stay visible until they land); within each group, newest
 * takenAt first, with a stable id tiebreak. A pending photo that has already
 * uploaded (its serverDocumentId now appears in the server set) would otherwise
 * show twice — callers pass only still-pending photos, but we also de-duplicate
 * by any shared id defensively. Returns a new array; does not mutate inputs.
 */
export function mergePhotoItems(
  serverDocs: ServerPhotoDoc[],
  pending: OfflinePendingPhoto[],
): PhotoItem[] {
  const pendingItems = pending.map(pendingToItem);
  const serverItems = serverDocs.map(serverDocToItem);

  const seen = new Set(pendingItems.map((p) => p.id));
  const dedupedServer = serverItems.filter((s) => !seen.has(s.id));

  const byRecency = (a: PhotoItem, b: PhotoItem) => {
    const ta = Date.parse(a.takenAt);
    const tb = Date.parse(b.takenAt);
    const va = Number.isFinite(ta) ? ta : 0;
    const vb = Number.isFinite(tb) ? tb : 0;
    if (va !== vb) return vb - va;
    return a.id.localeCompare(b.id);
  };

  pendingItems.sort(byRecency);
  dedupedServer.sort(byRecency);

  // Pending first (always on top), then the recent-first server photos.
  return [...pendingItems, ...dedupedServer];
}

/** Apply the All / Unfiled chip. `all` shows everything; `unfiled` only the
 * lot-less ones. Returns a new array; does not mutate the input. */
export function filterPhotos(items: PhotoItem[], filter: PhotoFilterKey): PhotoItem[] {
  if (filter === 'unfiled') return items.filter((i) => i.unfiled);
  return [...items];
}

/** Count of unfiled photos — drives the header sub-line + the Unfiled chip badge. */
export function unfiledPhotoCount(items: PhotoItem[]): number {
  return items.filter((i) => i.unfiled).length;
}

// ── Formatting ────────────────────────────────────────────────────────────────

/** Short mono date for a tile (e.g. "10 Jun"). Falls back to the raw string. */
export function formatPhotoDate(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(parsed);
}

/** Full mono date for the detail screen (e.g. "10 Jun 2026, 8:05 am"). */
export function formatPhotoDateLong(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

/** Compact "lat, lng" label for the GPS chip. */
export function formatGps(gps: { lat: number; lng: number }): string {
  return `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`;
}
