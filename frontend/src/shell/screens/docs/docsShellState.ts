/**
 * docsShellState.ts — Pure state derivation for the foreman shell Drawings & Docs
 * surface (/m/docs).
 *
 * SINGLE SOURCE OF TRUTH for the surface's:
 *   - the unified DocItem shape, projected from EITHER source that holds a
 *     drawing: a Drawing register row, or a drawing-typed project Document,
 *   - "current revision" detection (CURRENT when nothing supersedes the row;
 *     SUPERSEDED once something points back to it — `supersededBy` on the
 *     register, `supersededById` on a Document),
 *   - the current-first ordering (current revisions first, A→Z by number; then
 *     superseded ones, muted, below),
 *   - the merge + dedupe of the two sources, and
 *   - the optional lot filter (the lot hub's Drawings tile deep-links with a
 *     ?lotId=…), and
 *   - the pill labels: green "REV X — CURRENT", muted "SUPERSEDED".
 *
 * TWO SOURCES, ONE SURFACE. Lot-specific drawings are filed on the Documents
 * page — a `Document` row with a `lotId` and documentType 'drawing' — and that
 * never creates a Drawing register row. The `Drawing` model has no lot linkage
 * at all. Reading only the register therefore showed "No drawings for this lot
 * yet" on lots that DO have drawings, so both are projected here. Every register
 * drawing is ALSO backed by a Document row, so the merge dedupes on the document
 * id (`DocItem.documentId`) and the richer register row wins.
 *
 * Lot linkage is real for Document-sourced rows (`lotId`) and absent for
 * register rows, so `filterDocsByLot` narrows lot-linked rows to the requested
 * lot while keeping project-wide (null-lot) rows visible.
 *
 * The drawing FILE is opened via the existing signed-URL idiom in useDocFileOpen
 * (openDocumentAccessUrl), NOT here — this module never touches the network.
 */
import { formatStatusLabel } from '@/lib/statusLabels';

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

/**
 * A drawing-typed Document row from
 * GET /api/documents/:projectId?documentType=drawing — how lot-specific drawings
 * are actually filed (the Documents page writes these; they never reach the
 * Drawing register). It carries no drawing number or revision label, so the
 * projection shows the filename and no REV pill rather than inventing either.
 * The list response strips `fileUrl`, so the file is opened from the document id.
 */
export interface DrawingDocumentRow {
  id: string;
  filename: string;
  caption?: string | null;
  /** Wave G G1 formal supersede pointer; null/absent while this is current. */
  supersededById?: string | null;
  lotId?: string | null;
  lot?: { id: string; lotNumber: string } | null;
}

// ── Unified item the list renders ─────────────────────────────────────────────

export interface DocItem {
  /** Stable key — the Drawing register row id, or the Document id. */
  id: string;
  /**
   * Which table the row came from. 'register' rows are governed `Drawing`
   * records (their id keys the revision timeline); 'document' rows are plain
   * project documents with no revision history to show.
   */
  source: 'register' | 'document';
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
    source: 'register',
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
 * Project a drawing-typed Document row. No drawing number and no revision label
 * exist on this table, so the filename stands in for the number and `revision`
 * stays null (the pill then reads plain CURRENT/SUPERSEDED). The lot link is the
 * real one — this is the only source that has one.
 */
function documentRowToItem(row: DrawingDocumentRow): DocItem {
  return {
    id: row.id,
    source: 'document',
    number: row.filename,
    title: row.caption ?? null,
    revision: null,
    current: !row.supersededById,
    lotLabel: row.lot?.lotNumber ?? null,
    lotId: row.lotId ?? row.lot?.id ?? null,
    documentId: row.id,
    fileUrl: null,
  };
}

/**
 * Project BOTH sources into DocItems, dedupe, and order them current-first.
 *
 * Dedupe: every register drawing is backed by a Document row, so the same file
 * arrives from both endpoints. A document whose id already appears as a register
 * row's `documentId` is dropped — the register row carries the drawing number,
 * revision and supersede chain, so it is strictly the better projection.
 *
 * Ordering: CURRENT revisions before SUPERSEDED ones; within each group, by
 * number (locale, case-insensitive, numeric-aware) so "DRG-9" sorts before
 * "DRG-10", with a stable id tiebreak. Returns a new array; does not mutate.
 */
export function toDocItems(
  rows: DrawingRegisterRow[],
  documentRows: DrawingDocumentRow[] = [],
): DocItem[] {
  const items = rows.map(rowToItem);
  const registeredDocumentIds = new Set(items.map((i) => i.documentId));
  for (const row of documentRows) {
    if (!registeredDocumentIds.has(row.id)) items.push(documentRowToItem(row));
  }
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
 * Apply the ?lotId= deep-link filter from the lot hub's Drawings tile. When
 * `lotId` is null/empty, every item passes. Otherwise lot-linked drawings must
 * match that lot, and project-wide drawings (register rows, and documents filed
 * without a lot) remain visible — a lot is built off the project drawing set as
 * well as its own filed sheets. Returns a new array; does not mutate.
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
 *
 * The state words come from `statusLabels` rather than being spelled here: this
 * is the same vocabulary the doc sheet's revision chip renders, and one map is
 * how the two stay identical.
 */
export function revisionPillLabel(item: Pick<DocItem, 'revision' | 'current'>): string {
  const state = formatStatusLabel(
    item.current ? 'revision_current' : 'revision_superseded',
  ).toUpperCase();
  return item.revision ? `REV ${item.revision} — ${state}` : state;
}
