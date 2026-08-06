// The canonical lot-status vocabulary: key, label and the one-line explanation
// shown on the dashboard legend. Colour is NOT here — every swatch, dot and
// chip for these statuses comes from `lib/statusColors.ts`, which is what stops
// the dashboard, the register and the map from drifting apart.
export const LOT_STATUS_OVERVIEW_ITEMS = [
  {
    key: 'not_started',
    label: 'Not Started',
    description: 'Work has not begun on site.',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    description: 'Work is underway but not ready for evidence review.',
  },
  {
    key: 'awaiting_test',
    label: 'Awaiting Test',
    description: 'The lot needs test evidence before conformance.',
  },
  {
    key: 'hold_point',
    label: 'Hold Point',
    description: 'Inspection or release is required before work continues.',
  },
  {
    key: 'ncr_raised',
    label: 'NCR Raised',
    description: 'An open non-conformance must be resolved.',
  },
  {
    key: 'completed',
    label: 'Completed',
    description: 'Field work is complete but not yet conformed.',
  },
  {
    key: 'conformed',
    label: 'Conformed',
    description: 'Quality evidence is approved and the lot can be claimed.',
  },
  {
    key: 'claimed',
    label: 'Claimed',
    description: 'The lot is included in a progress claim.',
  },
] as const;

export type LotStatusKey = (typeof LOT_STATUS_OVERVIEW_ITEMS)[number]['key'];
export type LotStatusCounts = Record<LotStatusKey, number>;

export const EMPTY_LOT_STATUS_COUNTS: LotStatusCounts = Object.fromEntries(
  LOT_STATUS_OVERVIEW_ITEMS.map((item) => [item.key, 0]),
) as LotStatusCounts;

// Re-exported so the surfaces that already import it from here keep working;
// the colours themselves live in `lib/statusColors.ts`.
export { getLotStatusBadgeClass, getLotStatusSwatch } from './statusColors';
