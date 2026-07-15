/**
 * Supported coordinate reference systems for control lines.
 *
 * MIRRORS the backend preset list in `backend/src/lib/spatial/crs.ts`: GDA2020
 * MGA zones 49–56 (EPSG:7849–7856) and GDA94 MGA zones 49–56 (EPSG:28349–28356).
 * Keep the two in sync — the backend rejects any EPSG code it does not know.
 */

export interface CoordinateSystemOption {
  /** EPSG code, e.g. "EPSG:7856". */
  value: string;
  /** Human label, e.g. "GDA2020 / MGA Zone 56 (EPSG:7856)". */
  label: string;
}

// MGA/UTM zones covering mainland Australia.
const MGA_ZONES = [49, 50, 51, 52, 53, 54, 55, 56] as const;

function buildOptions(): CoordinateSystemOption[] {
  const options: CoordinateSystemOption[] = [];
  for (const zone of MGA_ZONES) {
    options.push({
      value: `EPSG:${7800 + zone}`,
      label: `GDA2020 / MGA Zone ${zone} (EPSG:${7800 + zone})`,
    });
  }
  for (const zone of MGA_ZONES) {
    options.push({
      value: `EPSG:${28300 + zone}`,
      label: `GDA94 / MGA Zone ${zone} (EPSG:${28300 + zone})`,
    });
  }
  return options;
}

export const COORDINATE_SYSTEM_OPTIONS: CoordinateSystemOption[] = buildOptions();

// GDA2020 MGA Zone 56 covers eastern AU (Sydney/Brisbane) — the most common
// setout datum for our pilot region, so it is the sensible default.
export const DEFAULT_COORDINATE_SYSTEM = 'EPSG:7856';

// GDA2020 MGA zone of each state/territory capital — a *suggestion* only.
// States span multiple MGA zones, so the picker always lets the user confirm
// or change this. Derived from the capital: NSW/Sydney z56, ACT/Canberra z55,
// VIC/Melbourne z55, QLD/Brisbane z56, SA/Adelaide z54, WA/Perth z50,
// TAS/Hobart z55, NT/Darwin z52.
const COORDINATE_SYSTEM_BY_STATE: Record<string, string> = {
  NSW: 'EPSG:7856',
  ACT: 'EPSG:7855',
  VIC: 'EPSG:7855',
  QLD: 'EPSG:7856',
  SA: 'EPSG:7854',
  WA: 'EPSG:7850',
  TAS: 'EPSG:7855',
  NT: 'EPSG:7852',
};

/**
 * Suggested GDA2020 MGA coordinate system for an AU state/territory, based on
 * its capital's zone. A suggestion, never truth — states span zones, so the
 * user must always be able to confirm/override. Unknown/empty state falls back
 * to {@link DEFAULT_COORDINATE_SYSTEM}.
 */
export function defaultCoordinateSystemForState(state: string | null | undefined): string {
  const normalizedState = state?.trim().toUpperCase() ?? '';
  return COORDINATE_SYSTEM_BY_STATE[normalizedState] ?? DEFAULT_COORDINATE_SYSTEM;
}

const LABEL_BY_VALUE = new Map(COORDINATE_SYSTEM_OPTIONS.map((o) => [o.value, o.label]));

/** Label for an EPSG code, falling back to the raw code if unrecognised. */
export function coordinateSystemLabel(value: string): string {
  return LABEL_BY_VALUE.get(value) ?? value;
}

/**
 * True for a GDA94 MGA zone (EPSG:28349–28356). GDA94 coordinates sit ~1.8 m
 * off current (WGS84/GDA2020-aligned) satellite imagery because of plate motion,
 * so the pickers warn when one is chosen. See the geodesy audit for the maths.
 */
export function isGda94(value: string): boolean {
  const match = /^EPSG:(\d+)$/.exec(value.trim());
  if (!match) return false;
  const code = Number(match[1]);
  return code >= 28349 && code <= 28356;
}
