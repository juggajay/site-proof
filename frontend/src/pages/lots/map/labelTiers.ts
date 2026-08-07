import RBush from 'rbush';

import { ACTIVE_WORK_STATUSES } from './cameraPolicy';

/**
 * Zoom-tiered lot labels (plan consensus #4).
 *
 * Corridor lots are sub-pixel at overview zoom — no fill treatment fixes that,
 * so the overview tier is a centroid status DOT. Working zoom shows the lot
 * number; detail zoom adds chainage. Collision is pruned with an rbush index in
 * priority order (selected lot first, then active work fronts), recomputed only
 * on zoom/move — never per frame. (The maintained plugins for this are all dead;
 * rbush + ~40 lines is the M9-sanctioned build.)
 */

export type LabelTier = 'dot' | 'number' | 'detail';

// Working thresholds for chainage-scale lots on web-mercator zooms.
const NUMBER_ZOOM = 15;
const DETAIL_ZOOM = 17;

export function labelTier(zoom: number): LabelTier {
  if (zoom >= DETAIL_ZOOM) return 'detail';
  if (zoom >= NUMBER_ZOOM) return 'number';
  return 'dot';
}

export interface LabelCandidate {
  lotId: string;
  lotNumber: string;
  status: string;
  /** Preformatted "Ch 1,300–1,400", or null when the lot has no chainage. */
  chainage: string | null;
  /** Centroid in container pixels at the current view. */
  x: number;
  y: number;
}

export interface PlacedLabel extends LabelCandidate {
  tier: LabelTier;
  /** Second line at detail tier; null otherwise. */
  detail: string | null;
}

// Box model for collision: measured generously so halos never touch.
const CHAR_W = 6.8; // ~11px semibold average glyph width
const LINE_H = 15;
const DOT_SIZE = 14;
const PAD = 2;

/** Hard cap on rendered labels — bounds DOM weight at dense corridors. */
export const MAX_LABELS = 250;

function priorityOf(candidate: LabelCandidate, selectedLotId: string | null): number {
  if (candidate.lotId === selectedLotId) return 0;
  if (ACTIVE_WORK_STATUSES.has(candidate.status)) return 1;
  return 2;
}

function boxFor(candidate: LabelCandidate, tier: LabelTier, detail: string | null) {
  if (tier === 'dot') {
    const half = DOT_SIZE / 2 + PAD;
    return {
      minX: candidate.x - half,
      minY: candidate.y - half,
      maxX: candidate.x + half,
      maxY: candidate.y + half,
    };
  }
  const chars = Math.max(candidate.lotNumber.length, detail?.length ?? 0);
  const halfW = (chars * CHAR_W) / 2 + PAD;
  const halfH = (detail ? LINE_H * 2 : LINE_H) / 2 + PAD;
  return {
    minX: candidate.x - halfW,
    minY: candidate.y - halfH,
    maxX: candidate.x + halfW,
    maxY: candidate.y + halfH,
  };
}

/**
 * Prune colliding labels in priority order: the selected lot always places,
 * then active work fronts, then the rest (stable by lot number within a band).
 * Returns at most MAX_LABELS placements. Callers resolve the tier (geographic
 * maps via labelTier(zoom); the plan canvas has its own zoom scale).
 */
export function placeLabels(
  candidates: LabelCandidate[],
  tier: LabelTier,
  selectedLotId: string | null,
): PlacedLabel[] {
  const tree = new RBush<{ minX: number; minY: number; maxX: number; maxY: number }>();
  const placed: PlacedLabel[] = [];

  const ordered = [...candidates].sort((a, b) => {
    const pa = priorityOf(a, selectedLotId);
    const pb = priorityOf(b, selectedLotId);
    return pa !== pb ? pa - pb : a.lotNumber.localeCompare(b.lotNumber);
  });

  for (const candidate of ordered) {
    if (placed.length >= MAX_LABELS) break;
    const detail = tier === 'detail' ? candidate.chainage : null;
    const box = boxFor(candidate, tier, detail);
    if (tree.collides(box)) continue;
    tree.insert(box);
    placed.push({ ...candidate, tier, detail });
  }
  return placed;
}
