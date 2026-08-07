/**
 * Wave 6 — 4D QA playback paint planning (pure; no 3D imports).
 *
 * Joins the version's approved element→lot links against the as-at lot-status
 * map the 2D scrubber already computes (`historicalStatusByLot` — shared cache,
 * shared semantics) and buckets elements into paint layers for the viewer
 * adapter to apply.
 *
 * Status is never colour-only here: every colour comes from the shared
 * Okabe-Ito swatch map (`lib/statusColors.ts` — one status = one colour on the
 * 2D map, the register and this model), the bar renders labelled legend counts
 * beside the canvas, and opacity is a second, non-hue channel: elements with no
 * QA record at the date are ghosted (barely-there), open statuses render
 * translucent, and conformed/claimed render fully solid — so "done" vs "open"
 * survives greyscale.
 */
import { LOT_STATUS_OVERVIEW_ITEMS } from '@/lib/lotStatusOverview';
import { getLotStatusSwatch } from '@/lib/statusColors';

import type { ModelElementLink } from '@/lib/models/designModelsApi';

/** One highlight pass. `localIds` undefined = every element in the model. */
export interface PaintLayer {
  localIds?: number[];
  /** Hex colour, e.g. '#009E73'. */
  color: string;
  /** 0..1; < 1 renders transparent. */
  opacity: number;
}

export interface PaintPlan {
  /** Applied in order: ghost-everything first, then one layer per status. */
  layers: PaintLayer[];
  /**
   * Linked-element count per status, in legend order (zero counts omitted).
   * Counts come from the ledger join, NOT the geometry join — an element whose
   * GUID has no geometry in the frag still counts (and the counts render before
   * the 3D stack finishes booting).
   */
  statusCounts: Map<string, number>;
  /**
   * Linked elements with no QA record at the date (lot not yet created) —
   * ghosted, same as unlinked geometry.
   */
  noRecordCount: number;
  /** Compare mode only: linked elements whose status differs from current. */
  changedCount: number | null;
}

/** zinc-400 at near-nothing opacity — "exists, but no QA story at this date". */
export const GHOST_LAYER: PaintLayer = { color: '#a1a1aa', opacity: 0.12 };

// The non-hue channel: closed-out statuses are solid, everything still open is
// translucent. Conformed/claimed are the two "the QA story is finished" states.
const SOLID_STATUSES = new Set(['conformed', 'claimed']);
const OPEN_OPACITY = 0.6;

export function paintOpacityForStatus(status: string): number {
  return SOLID_STATUSES.has(status) ? 1 : OPEN_OPACITY;
}

// Stable legend/paint order = the canonical status vocabulary order.
const STATUS_ORDER: string[] = LOT_STATUS_OVERVIEW_ITEMS.map((item) => item.key);

/**
 * Build the paint plan for one scrubbed date.
 *
 * `statusAtDate` is `historicalStatusByLot(timeline, dateKey)` — a lot absent
 * from it did not exist on that date, so its elements stay ghosted (2D hides
 * the polygon; 3D geometry cannot vanish honestly, so it ghosts instead).
 *
 * `currentByLot` switches on compare mode: only elements whose status CHANGED
 * between the scrubbed date and now are painted (by their current status);
 * unchanged elements ghost. "What has moved since date D" is the question a
 * progress conversation actually asks.
 */
export function buildPaintPlan(
  links: ModelElementLink[],
  guidToLocalId: Map<string, number>,
  statusAtDate: Map<string, string>,
  currentByLot?: Map<string, string>,
): PaintPlan {
  const byStatus = new Map<string, number[]>();
  const countByStatus = new Map<string, number>();
  let noRecordCount = 0;
  let changedCount = 0;

  for (const link of links) {
    const then = statusAtDate.get(link.lotId) ?? null;

    let painted: string | null;
    if (currentByLot) {
      const now = currentByLot.get(link.lotId) ?? null;
      painted = now !== null && now !== then ? now : null;
      if (painted !== null) changedCount += 1;
    } else {
      painted = then;
      if (painted === null) noRecordCount += 1;
    }
    if (painted === null) continue;

    countByStatus.set(painted, (countByStatus.get(painted) ?? 0) + 1);
    const localId = guidToLocalId.get(link.ifcGuid);
    if (localId === undefined) continue; // element has no geometry in the frag
    const bucket = byStatus.get(painted);
    if (bucket) bucket.push(localId);
    else byStatus.set(painted, [localId]);
  }

  const orderedStatuses = [
    ...STATUS_ORDER.filter((status) => countByStatus.has(status)),
    // Unknown statuses still paint (fallback swatch) rather than silently ghost.
    ...[...countByStatus.keys()].filter((status) => !STATUS_ORDER.includes(status)),
  ];

  const layers: PaintLayer[] = [
    GHOST_LAYER,
    ...orderedStatuses
      .filter((status) => byStatus.has(status))
      .map((status) => ({
        localIds: byStatus.get(status)!,
        color: getLotStatusSwatch(status),
        opacity: paintOpacityForStatus(status),
      })),
  ];
  const statusCounts = new Map(
    orderedStatuses.map((status) => [status, countByStatus.get(status)!]),
  );

  return {
    layers,
    statusCounts,
    noRecordCount,
    changedCount: currentByLot ? changedCount : null,
  };
}

/** lotId → currentStatus, straight off the shared timeline payload. */
export function currentStatusByLot(
  lots: Array<{ lotId: string; currentStatus: string }>,
): Map<string, string> {
  return new Map(lots.map((lot) => [lot.lotId, lot.currentStatus]));
}
