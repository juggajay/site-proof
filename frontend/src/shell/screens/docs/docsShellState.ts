/**
 * docsShellState.ts — Pure state derivation for the foreman shell Drawings & Docs
 * surface (/m/docs).
 *
 * SINGLE SOURCE OF TRUTH for the surface's:
 *   - the unified DocItem shape projected from a Drawing register row,
 *   - "current revision" detection (a drawing is CURRENT when nothing supersedes
 *     it; SUPERSEDED once a newer revision points back to it via supersededBy),
 *   - the current-first ordering (current revisions first, A→Z by number; then
 *     superseded ones, muted, below),
 *   - the optional lot filter (the lot hub's Drawings tile may deep-link with a
 *     ?lotId=…), and
 *   - the pill labels: green "REV X — CURRENT", muted "SUPERSEDED", and the lot
 *     chip vs. the PROJECT-WIDE pill.
 *
 * Every function here is pure — no React, no fetch — so the screen stays thin and
 * these decisions are exhaustively unit-tested. The drawing register has NO lot
 * linkage in the data model today (the Drawing model is project-scoped only), so
 * `lotLabel`/`lotId` are derived defensively from any future lot relation and are
 * null with the current data — which renders the honest PROJECT-WIDE pill rather
 * than a fabricated lot chip. The lot-filter helper is wired the same way so the
 * deep-link is future-proof and tested, while honestly being a passthrough until
 * the register grows a lot link.
 *
 * Lot-scoped deep-links include project-wide drawings because the drawing
 * register is project-scoped today. Future lot-linked drawings are narrowed to
 * the matching lot, while current project-wide rows remain visible.
 *
 * The drawing FILE is opened via the existing signed-URL idiom in useDocFileOpen
 * (openDocumentAccessUrl), NOT here — this module never touches the network.
 */

// ── Source row (the subset of the Drawing register shape we project from) ─────

/**
 * A Drawing register row from GET /api/drawings/:projectId.
 * Mirrors the `Drawing` type in pages/drawings/drawingsUploadData.ts, narrowed to
 * the fields the shell surface reads. `supersededBy` is non-null once a newer
 * revision supersedes this one. A lot relation is included optionally so the
 * projection is ready if the register ever links drawings to lots.
 */
export interface DrawingRegisterRow {
  id: string;
  drawingNumber: string;
  title: string | null;
  revision: string | null;
  status: string;
  document: {
    id: string;
    fileUrl?: string | null;
  };
  supersededBy: { id: string; drawingNumber: string; revision: string } | null;
  /** Optional lot link — absent in the current data model; honoured if present. */
  lotId?: string | null;
  lot?: { id: string; lotNumber: string } | null;
}

// ── Unified item the list renders ─────────────────────────────────────────────

export interface DocItem {
  /** Stable key — the drawing register row id. */
  id: string;
  /** Mono document number, e.g. "DRG-1204" / "SPEC-R44". */
  number: string;
  /** Plain-English title, e.g. "Embankment typical sections". */
  title: string | null;
  /** Revision label without the "Rev" prefix, e.g. "C"; null when unknown. */
  revision: string | null;
  /** True when nothing supersedes this row (the current revision). */
  current: boolean;
  /** Lot label when the drawing is lot-linked (e.g. "LOT-001"); else null. */
  lotLabel: string | null;
  /** Lot id when lot-linked; else null (drives the optional lot filter). */
  lotId: string | null;
  /** Document id used to mint a signed URL when opening the file. */
  documentId: string;
  /** Legacy stored/public file URL fallback. New API responses may omit it. */
  fileUrl?: string | null;
}

// ── Projection ────────────────────────────────────────────────────────────────

/** A register row is CURRENT when nothing supersedes it. */
export function isCurrentDrawing(row: Pick<DrawingRegisterRow, 'supersededBy'>): boolean {
  return !row.supersededBy;
}

function rowToItem(row: DrawingRegisterRow): DocItem {
  return {
    id: row.id,
    number: row.drawingNumber,
    title: row.title,
    revision: row.revision,
    current: isCurrentDrawing(row),
    lotLabel: row.lot?.lotNumber ?? null,
    lotId: row.lotId ?? row.lot?.id ?? null,
    documentId: row.document.id,
    fileUrl: row.document.fileUrl,
  };
}

/**
 * Project the register rows into DocItems and order them current-first.
 *
 * Ordering: CURRENT revisions before SUPERSEDED ones; within each group, by
 * drawing number (locale, case-insensitive, numeric-aware) so "DRG-9" sorts
 * before "DRG-10", with a stable id tiebreak. Returns a new array; does not
 * mutate the input.
 */
export function toDocItems(rows: DrawingRegisterRow[]): DocItem[] {
  const items = rows.map(rowToItem);
  return sortDocsCurrentFirst(items);
}

/**
 * Sort DocItems current-first, then by number. Pure; returns a new array.
 * Exported separately so it can be unit-tested in isolation from the projection.
 */
export function sortDocsCurrentFirst(items: DocItem[]): DocItem[] {
  const byNumber = (a: DocItem, b: DocItem) => {
    const n = a.number.localeCompare(b.number, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (n !== 0) return n;
    return a.id.localeCompare(b.id);
  };
  return [...items].sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    return byNumber(a, b);
  });
}

// ── Lot filter (optional deep-link) ───────────────────────────────────────────

/**
 * Apply the optional ?lotId= deep-link filter. When `lotId` is null/empty, every
 * item passes. Otherwise lot-linked drawings must match that lot, and
 * project-wide drawings remain visible because the drawing register is currently
 * project-scoped. Returns a new array; does not mutate.
 */
export function filterDocsByLot(items: DocItem[], lotId: string | null | undefined): DocItem[] {
  if (!lotId) return [...items];
  return items.filter((i) => !i.lotId || i.lotId === lotId);
}

/** Count of current (non-superseded) revisions — drives the header sub-line. */
export function currentDocCount(items: DocItem[]): number {
  return items.filter((i) => i.current).length;
}

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * Client-side search across the document number and title. Case-insensitive,
 * trims and ignores empty queries (returns a copy). Returns a new array.
 */
export function searchDocs(items: DocItem[], query: string): DocItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter(
    (i) => i.number.toLowerCase().includes(q) || (i.title ?? '').toLowerCase().includes(q),
  );
}

// ── Pill labels ───────────────────────────────────────────────────────────────

/**
 * The green "REV X — CURRENT" / muted "REV X — SUPERSEDED" pill label. When the
 * revision is unknown, drops the "REV X" prefix and shows just the state.
 */
export function revisionPillLabel(item: Pick<DocItem, 'revision' | 'current'>): string {
  const state = item.current ? 'CURRENT' : 'SUPERSEDED';
  return item.revision ? `REV ${item.revision} — ${state}` : state;
}
