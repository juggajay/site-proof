/**
 * The one status-colour map. Companion to `statusLabels.ts`: that file decides
 * what a status is *called*, this one decides what it *looks like*, so a lot
 * that reads "Conformed" is the same green on the register, the mobile card,
 * the linear map, the spatial map and the dashboard legend.
 *
 * Before this module there were four competing lot-status colour systems —
 * `LOT_STATUS_BADGE_CLASSES` (chips, three-quarters grey), the Okabe-Ito hex
 * map in `linearMapViewHelpers.ts` (maps), `dotClassName` on
 * `LOT_STATUS_OVERVIEW_ITEMS` (dashboard dots) and a second `ncrStatusColors`
 * in `pages/lots/constants.ts` that disagreed with the one in
 * `pages/ncr/constants.ts`. Same lot, four colours, depending on which screen
 * you were looking at.
 *
 * Two rules this module exists to keep:
 *
 * 1. **Colour is never the only encoding.** Every consumer renders the label
 *    from `formatStatusLabel` beside the chip or swatch. The palette makes a
 *    register scannable; it is not what tells a user the status.
 * 2. **The chip and the swatch are the same decision.** They live in one record
 *    per status so a map fill and a table chip cannot drift apart again.
 *
 * The lot palette is Okabe-Ito (colour-blind safe, Feature #438) — the eight
 * colours already shipped in the lot map legend. The `chip` classes are the
 * nearest theme token where one exists (`warning`, `destructive`, `success`,
 * `info`) and a tinted Tailwind palette pair with an explicit `dark:` variant
 * where none does.
 */

import type { LotStatusKey } from './lotStatusOverview';

/**
 * `MobileDataCard`'s status variant vocabulary. NCR statuses map onto it here
 * rather than in the card, so the mobile chip and the desktop chip are decided
 * in one place.
 */
export type { MobileDataCardStatusVariant } from '@/components/ui/MobileDataCard';
import type { MobileDataCardStatusVariant } from '@/components/ui/MobileDataCard';

export interface LotStatusColor {
  /** Tinted chip: background + readable text. Always rendered with its label. */
  chip: string;
  /** Solid fill for map polygons, legend keys, dashboard dots and thumbnails. */
  swatch: string;
  /** Fill is too light for a white label — draw text in near-black instead. */
  darkText?: boolean;
}

export const LOT_STATUS_COLORS: Record<LotStatusKey, LotStatusColor> = {
  not_started: {
    chip: 'bg-muted text-muted-foreground',
    swatch: '#d1d5db',
    darkText: true,
  },
  in_progress: {
    chip: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    swatch: '#56B4E9',
    darkText: true,
  },
  awaiting_test: {
    chip: 'bg-yellow-400/20 text-yellow-700 dark:text-yellow-300',
    swatch: '#F0E442',
    darkText: true,
  },
  hold_point: {
    chip: 'bg-warning/10 text-warning',
    swatch: '#E69F00',
    darkText: true,
  },
  ncr_raised: {
    chip: 'bg-destructive/10 text-destructive',
    swatch: '#D55E00',
  },
  // `info` is the darker of the two blues in the theme, so it sits with the
  // darker Okabe-Ito blue and leaves the sky pair to In Progress.
  completed: {
    chip: 'bg-info/10 text-info',
    swatch: '#0072B2',
  },
  conformed: {
    chip: 'bg-success/10 text-success',
    swatch: '#009E73',
  },
  claimed: {
    chip: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
    swatch: '#CC79A7',
    darkText: true,
  },
};

/** Neutral fallback for a status this map has never heard of. */
const UNKNOWN_LOT_STATUS: LotStatusColor = {
  chip: 'bg-muted text-muted-foreground',
  swatch: '#9ca3af',
};

const lotStatusColor = (status: string): LotStatusColor =>
  LOT_STATUS_COLORS[status as LotStatusKey] ?? UNKNOWN_LOT_STATUS;

/** Chip classes for a lot-status badge. Render `formatStatusLabel` inside it. */
export const getLotStatusBadgeClass = (status: string): string => lotStatusColor(status).chip;

/** Solid fill for a lot-status swatch, map polygon or legend key. */
export const getLotStatusSwatch = (status: string): string => lotStatusColor(status).swatch;

/** True when a lot-status fill needs dark rather than white text over it. */
export const lotStatusUsesDarkText = (status: string): boolean =>
  lotStatusColor(status).darkText ?? false;

/**
 * NCR lifecycle colour, one tier per stage of "who owes what":
 * red nobody has answered, amber the responsible party owes something, blue
 * the ball is back in our court, green resolved. `closed_concession` is
 * deliberately *not* green — the work was accepted as-is rather than made
 * conformant, and a register should be able to show the difference.
 *
 * `mobileVariant` picks the matching entry in `MobileDataCard`'s own palette so
 * the phone card and the desktop table agree without the card needing to know
 * anything about NCRs.
 */
export interface NcrStatusColor {
  chip: string;
  mobileVariant: MobileDataCardStatusVariant;
}

export const NCR_STATUS_COLORS: Record<string, NcrStatusColor> = {
  open: { chip: 'bg-destructive/10 text-destructive', mobileVariant: 'error' },
  investigating: { chip: 'bg-warning/10 text-warning', mobileVariant: 'warning' },
  rectification: { chip: 'bg-warning/10 text-warning', mobileVariant: 'warning' },
  verification: { chip: 'bg-info/10 text-info', mobileVariant: 'info' },
  closed: { chip: 'bg-success/10 text-success', mobileVariant: 'success' },
  closed_concession: { chip: 'bg-muted text-foreground', mobileVariant: 'default' },
};

const UNKNOWN_NCR_STATUS: NcrStatusColor = {
  chip: 'bg-muted text-foreground',
  mobileVariant: 'default',
};

/** Chip classes for an NCR-status badge. Render `formatStatusLabel` inside it. */
export const getNcrStatusBadgeClass = (status: string): string =>
  (NCR_STATUS_COLORS[status] ?? UNKNOWN_NCR_STATUS).chip;

/** `MobileDataCard` status variant for an NCR status. */
export const getNcrStatusMobileVariant = (status: string): MobileDataCardStatusVariant =>
  (NCR_STATUS_COLORS[status] ?? UNKNOWN_NCR_STATUS).mobileVariant;

/**
 * Dot classes for the NCR gate strip. Shape carries the state as well as
 * colour — filled disc, hollow ring, flat dash — so the strip survives being
 * printed, screenshotted in greyscale, or read by someone who cannot
 * distinguish the hues.
 */
export const NCR_GATE_DOT_CLASSES = {
  done: 'h-2.5 w-2.5 rounded-full bg-success',
  pending: 'h-2.5 w-2.5 rounded-full border border-muted-foreground/60',
  not_required: 'h-px w-2.5 bg-muted-foreground/40',
} as const;

const HOLD_POINT_STATUS_BADGE_CLASSES: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  notified: 'bg-warning/10 text-warning',
  released: 'bg-success/10 text-success',
  completed: 'bg-success/10 text-success',
  release_refused: 'bg-destructive/10 text-destructive',
  released_with_conditions: 'bg-warning/10 text-warning',
};

export function getHoldPointStatusBadgeClass(statusKey: string): string {
  return HOLD_POINT_STATUS_BADGE_CLASSES[statusKey] ?? HOLD_POINT_STATUS_BADGE_CLASSES.pending;
}
