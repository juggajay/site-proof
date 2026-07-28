/**
 * Wave C3 Phase B2 — the captured sample point, and the words it is said in.
 *
 * ONE module so the map pin popup, the test card and the capture control cannot
 * disagree about what "GPS ±6 m" means or when a location is absent.
 *
 * `[C3S-B1]`, the rule this file exists to keep: nothing here derives a
 * coordinate. There is no centroid fallback, no parse of `sampleLocation` free
 * text, no default. A row with no captured pair has no location and reads as
 * "No location captured" — a fact. A dot in the middle of a lot would be a claim.
 */

/** Provenance values the DB CHECK constraint allows (backend `SAMPLE_LOCATION_SOURCES`). */
export type SampleLocationSource = 'gps' | 'map_pick';

/** The four columns as they arrive over JSON — Prisma `Decimal` serialises as a string. */
export interface SamplePointFields {
  sampleLatitude?: number | string | null;
  sampleLongitude?: number | string | null;
  sampleLocationSource?: string | null;
  sampleLocationAccuracyM?: number | string | null;
}

export interface SamplePoint {
  lat: number;
  lng: number;
  source: string | null;
  /** Metres, from the GPS fix that produced the pair. NULL for a map pick. */
  accuracyM: number | null;
}

/**
 * Metres. A GPS fix coarser than this is REFUSED at the capture site with its own
 * number shown — never silently discarded, never silently saved (spec §5.4).
 *
 * It lives at the capture call site rather than inside a location hook because
 * "accurate enough to guess which lot you are standing in" and "accurate enough
 * to be a sample point" are different questions with different answers.
 */
export const MAX_ACCURACY_M = 30;

export const NO_SAMPLE_POINT_LABEL = 'No location captured';

export function tooCoarseMessage(accuracyM: number): string {
  return `GPS accuracy ±${Math.round(accuracyM)} m — too coarse for a sample point. Pick on map instead.`;
}

/**
 * Coerce one JSON coordinate-ish value to a finite number, or null.
 *
 * `Number('')` is `0`, so a blank coordinate would otherwise land in the Gulf of
 * Guinea. Shared with the map's spatial-search normalisers.
 */
export function toFiniteNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * The captured point, or null when there is nothing captured.
 *
 * Half a coordinate is not a location — the DB pair constraint makes that state
 * unreachable, and this returns null if it ever is anyway.
 */
export function readSamplePoint(row: SamplePointFields): SamplePoint | null {
  const lat = toFiniteNumber(row.sampleLatitude);
  const lng = toFiniteNumber(row.sampleLongitude);
  if (lat == null || lng == null) return null;
  return {
    lat,
    lng,
    source: row.sampleLocationSource ?? null,
    accuracyM: toFiniteNumber(row.sampleLocationAccuracyM),
  };
}

/**
 * "GPS ±6 m" | "Picked on map" `[C3R-A5]`.
 *
 * An accuracy left unstated invites a reader to trust a pin more than it
 * deserves — a ±40 m pin and a ±4 m pin are different evidence.
 */
export function formatProvenance(point: SamplePoint): string {
  if (point.source === 'gps') {
    return point.accuracyM == null ? 'GPS' : `GPS ±${Math.round(point.accuracyM)} m`;
  }
  if (point.source === 'map_pick') return 'Picked on map';
  // Unreachable while the source-null-iff CHECK constraint holds; stated rather
  // than guessed, because inventing provenance is the failure `[C3S-B1]` forbids.
  return 'Source not recorded';
}

export function formatCoordinate(point: SamplePoint): string {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

/** "-33.868800, 151.209300 · GPS ±6 m", or the absent-location fact. */
export function formatSamplePoint(row: SamplePointFields): string {
  const point = readSamplePoint(row);
  return point ? `${formatCoordinate(point)} · ${formatProvenance(point)}` : NO_SAMPLE_POINT_LABEL;
}
